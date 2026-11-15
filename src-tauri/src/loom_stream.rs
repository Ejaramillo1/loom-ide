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
fn start_stream(
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
#[tauri::command]
pub fn ask_loom_stream(
    app: AppHandle,
    request_id: String,
    message: String,
    session_id: Option<String>,
    agent_id: Option<String>,
) -> Result<(), String> {
    let message = message.trim();
    if message.is_empty() {
        return Err("Enter a message first.".into());
    }
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
    // Tracing on so the completed turn has an observability record.
    obj.insert("enableTrace".into(), Value::Bool(true));
    start_stream(
        app,
        request_id,
        "loom-stream",
        "POST",
        "/v1/weave:stream".into(),
        Value::Object(obj),
    )
}

/// Ask the stream thread to stop. The stream ends with kind `cancelled`.
#[tauri::command]
pub fn cancel_loom_stream(request_id: String) -> Result<(), String> {
    if let Ok(map) = cancels().lock() {
        if let Some(c) = map.get(request_id.trim()) {
            c.store(true, Ordering::SeqCst);
        }
    }
    Ok(())
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
    start_stream(
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
    start_stream(
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
    start_stream(
        app,
        request_id,
        "loom-abtest",
        "POST",
        "/v1/providers:abtest".into(),
        Value::Object(obj),
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
    let status = value
        .get("status")
        .and_then(|s| s.as_str())
        .unwrap_or("answered")
        .to_string();
    Ok(status)
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
    let mut stream =
        TcpStream::connect_timeout(&"127.0.0.1:5006".parse().unwrap(), Duration::from_secs(2))
            .map_err(|e| format!("Loom is unavailable. Start looms serve --http-port 5006. {e}"))?;
    // A weave stream can sit quiet for long stretches (thinking, tool
    // holds, approval waits). The server emits heartbeats; a generous read
    // timeout keeps a live stream attached without hanging forever.
    stream
        .set_read_timeout(Some(Duration::from_secs(310)))
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
    let started = Instant::now();

    for line in reader.lines() {
        if cancel.load(Ordering::SeqCst) {
            return Err("Cancelled.".into());
        }
        if started.elapsed() > Duration::from_secs(1800) {
            return Err("The Loom stream exceeded 30 minutes.".into());
        }
        let line = line.map_err(|e| {
            if e.kind() == std::io::ErrorKind::TimedOut
                || e.kind() == std::io::ErrorKind::WouldBlock
            {
                "The Loom stream went quiet and timed out.".to_string()
            } else {
                e.to_string()
            }
        })?;

        if in_headers {
            if line.is_empty() {
                in_headers = false;
                let code: u16 = status_line
                    .split_whitespace()
                    .nth(1)
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
                if !(200..300).contains(&code) {
                    return Err(format!("Loom returned HTTP {code}."));
                }
            } else if line.starts_with("HTTP/") {
                status_line = line;
            }
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
                    }
                    // Non-JSON chunks (error bodies, comments) are skipped;
                    // the terminal status already says what went wrong.
                }
            }
        } else if line.starts_with(':') {
            // SSE heartbeat/comment — keep-alive traffic, no state.
        } else if line.starts_with("data:") {
            event_payload.push_str(line.trim_start_matches("data:").trim_start());
            event_payload.push('\n');
        } else {
            // `event:`, `id:`, `retry:` lines — not needed for weaving.
        }
    }
    Ok(())
}
