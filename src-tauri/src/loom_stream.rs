//! Streaming chat (POST /v1/weave:stream, SSE) forwarded to the frontend as
//! Tauri events, plus clarification answers and per-request cancellation.
//!
//! The unary POST /v1/weave blocks for the whole turn — on a slow local
//! model that means minutes of nothing but a typing indicator. The stream
//! emits WeaveProgress events (partial tokens, tool lifecycle, HITL
//! requests, completion) that the frontend renders incrementally, with a
//! working Stop that cancels the underlying stream.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde_json::Value;
use tauri::{AppHandle, Emitter};

use super::{loom_request, percent_encode};

/// Per-request cancel flags, keyed by the frontend's request id. Dropping a
/// stream (server close, error, completion) also drops its entry.
static CANCELS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();

fn cancels() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    CANCELS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Start one SSE stream from Loom. `method`/`path`/`body` describe the
/// endpoint, `event_name` is the Tauri event the frontend listens to, and
/// the terminal payload carries the request id so listeners can correlate.
pub fn start_loom_stream(
    app: AppHandle,
    request_id: String,
    event_name: &'static str,
    method: &'static str,
    path: String,
    body: Value,
) -> Result<(), String> {
    let rid = request_id.trim().to_string();
    if rid.is_empty() {
        return Err("A request id is required.".into());
    }
    let body = body.to_string();
    let cancel = Arc::new(AtomicBool::new(false));
    if let Ok(mut map) = cancels().lock() {
        map.insert(rid.clone(), cancel.clone());
    }
    let rid2 = rid.clone();
    std::thread::spawn(move || {
        let result = run_stream(&app, &rid2, method, &path, &body, &cancel, event_name);
        let terminal = match result {
            Ok(()) => serde_json::json!({ "requestId": rid2, "kind": "done" }),
            Err(e) => {
                let cancelled = cancel.load(Ordering::SeqCst);
                serde_json::json!({
                    "requestId": rid2,
                    "kind": if cancelled { "cancelled" } else { "error" },
                    "error": if cancelled { Value::Null } else { Value::String(e) },
                })
            }
        };
        let _ = app.emit(event_name, terminal);
        if let Ok(mut map) = cancels().lock() {
            map.remove(&rid2);
        }
    });
    Ok(())
}

/// Start a streaming weave. Returns immediately; progress arrives as
/// `loom-stream` events carrying `{ requestId, kind, event? , error? }`
/// where kind is `progress` | `done` | `error` | `cancelled`.
fn validate_stream_inputs(request_id: &str, message: &str) -> Result<(), String> {
    if message.trim().is_empty() {
        return Err("Enter a message first.".into());
    }
    if request_id.trim().is_empty() {
        return Err("A request id is required.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn ask_loom_stream(
    app: AppHandle,
    request_id: String,
    message: String,
    session_id: Option<String>,
    agent_id: Option<String>,
    context: Option<std::collections::HashMap<String, String>>,
) -> Result<(), String> {
    validate_stream_inputs(&request_id, &message)?;
    let message = message.trim();
    let mut obj = serde_json::Map::new();
    obj.insert("query".into(), Value::String(message.to_string()));
    if let Some(s) = session_id {
        if !s.trim().is_empty() {
            obj.insert("sessionId".into(), Value::String(s));
        }
    }
    if let Some(a) = agent_id {
        if !a.trim().is_empty() {
            obj.insert("agentId".into(), Value::String(a));
        }
    }
    // The vault context pack (§2.4): active work, intent and the open file
    // travel with the query so the model answers with the real context.
    if let Some(c) = context {
        if !c.is_empty() {
            obj.insert("context".into(), serde_json::json!(c));
        }
    }
    // Tracing on so the completed turn has an observability record.
    obj.insert("enableTrace".into(), Value::Bool(true));
    start_loom_stream(
        app,
        request_id,
        "loom-stream",
        "POST",
        "/v1/weave:stream".into(),
        Value::Object(obj),
    )
}

/// Ask the stream thread to stop. The stream ends with kind `cancelled`.
/// An unknown request id is an error (§2.1.2): the frontend must be able
/// to tell whether its Stop cancelled anything.
#[tauri::command]
pub fn cancel_loom_stream(request_id: String) -> Result<(), String> {
    let rid = request_id.trim();
    let known = if let Ok(map) = cancels().lock() {
        match map.get(rid) {
            Some(c) => {
                c.store(true, Ordering::SeqCst);
                true
            }
            None => false,
        }
    } else {
        false
    };
    if known {
        Ok(())
    } else {
        Err("No stream with that request id is running.".into())
    }
}

/// Stream a workflow run (POST /v1/workflows:stream) as `loom-workflow`
/// events so long runs report live progress instead of one blocking wait.
#[tauri::command]
pub fn execute_workflow_stream(
    app: AppHandle,
    request_id: String,
    workflow_ref: String,
) -> Result<(), String> {
    if workflow_ref.trim().is_empty() {
        return Err("No workflow selected.".into());
    }
    start_loom_stream(
        app,
        request_id,
        "loom-workflow",
        "POST",
        "/v1/workflows:stream".into(),
        serde_json::json!({ "workflowRef": workflow_ref.trim() }),
    )
}

/// Subscribe to a session's live updates (GET /v1/sessions/{id}:subscribe)
/// as `loom-session` events, so the session surface reflects server-side
/// changes without polling.
#[tauri::command]
pub fn session_subscribe(
    app: AppHandle,
    request_id: String,
    session_id: String,
) -> Result<(), String> {
    if session_id.trim().is_empty() {
        return Err("No session selected.".into());
    }
    start_loom_stream(
        app,
        request_id,
        "loom-session",
        "GET",
        format!(
            "/v1/sessions/{}:subscribe",
            percent_encode(session_id.trim())
        ),
        serde_json::Value::Null,
    )
}

/// Run a provider A/B test (POST /v1/providers:abtest) as `loom-abtest`
/// events: each provider's streamed answer plus score/latency/cost and the
/// winner on the final event.
#[tauri::command]
pub fn provider_abtest(
    app: AppHandle,
    request_id: String,
    prompt: String,
    provider_names: Option<Vec<String>>,
    mode: Option<String>,
) -> Result<(), String> {
    if prompt.trim().is_empty() {
        return Err("Enter a prompt to compare.".into());
    }
    let mut obj = serde_json::Map::new();
    obj.insert("prompt".into(), Value::String(prompt.trim().to_string()));
    if let Some(names) = provider_names {
        let names: Vec<Value> = names
            .into_iter()
            .filter(|n| !n.trim().is_empty())
            .map(Value::String)
            .collect();
        if !names.is_empty() {
            obj.insert("providerNames".into(), Value::Array(names));
        }
    }
    if let Some(m) = mode {
        if !m.trim().is_empty() {
            obj.insert("mode".into(), Value::String(m.trim().to_string()));
        }
    }
    start_loom_stream(
        app,
        request_id,
        "loom-abtest",
        "POST",
        "/v1/providers:abtest".into(),
        Value::Object(obj),
    )
}

/// Stream pattern-library updates (GET /v1/patterns:stream) as
/// `loom-patterns` events, so the Patterns shelf reflects Loom changes
/// without refreshing.
#[tauri::command]
pub fn pattern_updates_stream(app: AppHandle, request_id: String) -> Result<(), String> {
    start_loom_stream(
        app,
        request_id,
        "loom-patterns",
        "GET",
        "/v1/patterns:stream".into(),
        Value::Null,
    )
}

/// Stream task updates for a board (GET /v1/boards/{id}/updates:stream) as
/// `loom-tasks` events, so the Work board updates live (§4.2.3).
#[tauri::command]
pub fn task_updates_stream(
    app: AppHandle,
    request_id: String,
    board_id: String,
) -> Result<(), String> {
    if board_id.trim().is_empty() {
        return Err("No board selected.".into());
    }
    start_loom_stream(
        app,
        request_id,
        "loom-tasks",
        "GET",
        format!("/v1/boards/{}/updates:stream", percent_encode(&board_id)),
        Value::Null,
    )
}

/// Answer a clarification question raised mid-turn (POST
/// /v1/clarifications/{session_id}/answer). The question_id is the HITL
/// request_id the stream delivered in `hitl_request.request_id`.
#[tauri::command]
pub fn answer_clarification(
    session_id: String,
    question_id: String,
    answer: String,
) -> Result<String, String> {
    if session_id.trim().is_empty() {
        return Err("No session selected.".into());
    }
    if question_id.trim().is_empty() {
        return Err("No question id provided.".into());
    }
    if answer.trim().is_empty() {
        return Err("Answer the question first.".into());
    }
    let body = serde_json::json!({ "questionId": question_id.trim(), "answer": answer.trim() })
        .to_string();
    let path = format!(
        "/v1/clarifications/{}/answer",
        percent_encode(session_id.trim())
    );
    let value = loom_request("POST", &path, Some(body))?;
    match value.get("status").and_then(|s| s.as_str()) {
        Some(status) => Ok(status.to_string()),
        // The server did not report a status; never invent one (§3.7.3).
        None => Err(
            "The server accepted the answer but reported no status — check the conversation."
                .into(),
        ),
    }
}

/// Consume the SSE stream. Each `data:` JSON payload is re-emitted as a
/// `loom-stream` progress event verbatim; the frontend interprets
/// WeaveProgress fields (partial_content, tool lifecycle, hitl_request).
fn run_stream(
    app: &AppHandle,
    rid: &str,
    method: &str,
    path: &str,
    body: &str,
    cancel: &AtomicBool,
    event_name: &'static str,
) -> Result<(), String> {
    let addr = super::loom_addr();
    let mut stream = TcpStream::connect_timeout(&addr.parse().unwrap(), Duration::from_secs(2))
        .map_err(|e| {
            format!("Loom is unavailable at {addr}. Start looms serve --http-port 5006. {e}")
        })?;
    // A short read timeout is what makes Stop actually stop: the cancel flag
    // is re-checked on every wake, so a silent stream cancels within ~20 s
    // instead of waiting out a 310 s read. The server's heartbeats keep the
    // connection warm during thinking and holds; a missed wake is retried.
    stream
        .set_read_timeout(Some(Duration::from_secs(20)))
        .map_err(|e| e.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| e.to_string())?;
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: localhost:5006\r\nContent-Type: application/json\r\nAccept: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|e| e.to_string())?;

    let reader = BufReader::new(stream);
    let mut event_payload = String::new();
    let mut status_line = String::new();
    let mut in_headers = true;
    let mut error_body = String::new();
    let mut status_code: u16 = 0;
    let started = Instant::now();
    let mut skipped_chunks: usize = 0;
    let mut skipped_sample = String::new();

    for line in reader.lines() {
        if cancel.load(Ordering::SeqCst) {
            return Err("Cancelled.".into());
        }
        if started.elapsed() > Duration::from_secs(1800) {
            return Err("The Loom stream exceeded 30 minutes.".into());
        }
        let line = match line {
            Ok(line) => line,
            Err(e)
                if e.kind() == std::io::ErrorKind::TimedOut
                    || e.kind() == std::io::ErrorKind::WouldBlock =>
            {
                // A quiet stretch: if a Stop is pending, end as cancelled;
                // otherwise keep listening (heartbeats resume the stream).
                if cancel.load(Ordering::SeqCst) {
                    return Err("Cancelled.".into());
                }
                continue;
            }
            Err(e) => return Err(e.to_string()),
        };

        if in_headers {
            if line.is_empty() {
                in_headers = false;
                status_code = status_line
                    .split_whitespace()
                    .nth(1)
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
                if !(200..300).contains(&status_code) {
                    // Fall through: read the error body below, then report
                    // the server's own message instead of a bare status.
                }
            } else if line.starts_with("HTTP/") {
                status_line = line;
            }
            continue;
        }

        if !(200..300).contains(&status_code) {
            // Non-2xx: collect the body and surface it (§2.1.5).
            error_body.push_str(&line);
            error_body.push('\n');
            continue;
        }

        if line.is_empty() {
            // End of an SSE event.
            if !event_payload.is_empty() {
                let payload = event_payload.trim().to_string();
                event_payload.clear();
                if payload != "[DONE]" {
                    if let Ok(value) = serde_json::from_str::<Value>(&payload) {
                        let _ = app.emit(
                            event_name,
                            serde_json::json!({ "requestId": rid, "kind": "progress", "event": value }),
                        );
                    } else {
                        // Non-JSON chunks are recorded, not silently dropped
                        // (§2.1.3): they ride the terminal event so a dead
                        // stream is diagnosable.
                        skipped_chunks += 1;
                        if skipped_sample.len() < 200 {
                            skipped_sample.push_str(&payload);
                            skipped_sample.push_str(" | ");
                        }
                    }
                }
            }
        } else if line.starts_with(':') {
            // SSE heartbeat/comment — keep-alive traffic, no state.
        } else if line.starts_with("data:") {
            event_payload.push_str(line.trim_start_matches("data:").trim_start());
            event_payload.push('\n');
        } else {
            // `event:`, `id:`, `retry:` lines are deliberately discarded
            // (§2.1.4): the weave stream carries every event in `data:`
            // payloads and none of these fields carry state we render.
        }
    }

    if !(200..300).contains(&status_code) {
        let body = error_body.trim();
        let msg = serde_json::from_str::<Value>(body)
            .ok()
            .and_then(|v| {
                v.get("message")
                    .and_then(|m| m.as_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| {
                let snippet: String = body.chars().take(200).collect();
                if snippet.is_empty() {
                    format!("Loom returned HTTP {status_code}.")
                } else {
                    format!("Loom returned HTTP {status_code}: {snippet}")
                }
            });
        return Err(msg);
    }
    if skipped_chunks > 0 {
        // The stream's non-JSON chunks ride one final progress event so a
        // dead stream is diagnosable instead of silently empty (§2.1.3).
        let _ = app.emit(
            event_name,
            serde_json::json!({
                "requestId": rid,
                "kind": "progress",
                "skipped": { "chunks": skipped_chunks, "sample": skipped_sample },
            }),
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_of_an_unknown_request_is_an_error() {
        // No stream is running for this id: the frontend must be able to
        // tell whether its Stop cancelled anything (§2.1.2).
        let result = cancel_loom_stream("never-started".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn stream_inputs_are_validated_before_any_network_work() {
        assert!(validate_stream_inputs("r1", "  ").is_err());
        assert!(validate_stream_inputs("", "hello").is_err());
        assert!(validate_stream_inputs("   ", "hello").is_err());
        assert!(validate_stream_inputs("r1", "hello").is_ok());
    }
}
