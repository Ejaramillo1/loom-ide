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
    max_rounds: Option<i32>,
    timeout_seconds: Option<i32>,
) -> Result<(), String> {
    validate_stream_inputs(&request_id, &message)?;
    let body = weave_stream_body(
        message.trim(),
        session_id.as_deref(),
        agent_id.as_deref(),
        context.as_ref(),
        max_rounds,
        timeout_seconds,
    );
    start_loom_stream(
        app,
        request_id,
        "loom-stream",
        "POST",
        "/v1/weave:stream".into(),
        Value::Object(body),
    )
}

/// Build the weave-stream request body. The custom SSE handler decodes
/// with `encoding/json`, so these keys are snake_case by wire contract
/// (`pkg/server/http.go` pins the format: "Do not switch to protojson").
/// camelCase keys here would silently drop the selected session and agent
/// (QC-03). The vault context pack travels as `context`; blank optionals
/// are omitted rather than sent empty.
fn weave_stream_body(
    message: &str,
    session_id: Option<&str>,
    agent_id: Option<&str>,
    context: Option<&std::collections::HashMap<String, String>>,
    max_rounds: Option<i32>,
    timeout_seconds: Option<i32>,
) -> serde_json::Map<String, Value> {
    let mut obj = serde_json::Map::new();
    obj.insert("query".into(), Value::String(message.to_string()));
    if let Some(s) = session_id.filter(|s| !s.trim().is_empty()) {
        obj.insert("session_id".into(), Value::String(s.to_string()));
    }
    if let Some(a) = agent_id.filter(|a| !a.trim().is_empty()) {
        obj.insert("agent_id".into(), Value::String(a.to_string()));
    }
    // Per-turn budget from the intent (W-1). The custom SSE handler decodes
    // with `encoding/json`, so these are snake_case; only positive values
    // are sent (None/0 = server default).
    if let Some(r) = max_rounds.filter(|&v| v > 0) {
        obj.insert("max_rounds".into(), Value::from(r));
    }
    if let Some(t) = timeout_seconds.filter(|&v| v > 0) {
        obj.insert("timeout_seconds".into(), Value::from(t));
    }
    if let Some(c) = context {
        if !c.is_empty() {
            obj.insert("context".into(), serde_json::json!(c));
        }
    }
    // Tracing on so the completed turn has an observability record.
    obj.insert("enable_trace".into(), Value::Bool(true));
    obj
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
    clarification_ack(&value)
}

fn weave_completed(value: &Value) -> Result<bool, String> {
    if let Some(error) = value
        .get("error")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
    {
        return Err(error.to_string());
    }
    let stage = value.get("stage");
    // FAILED (8 / EXECUTION_STAGE_FAILED) fails even without error text:
    // a failed execution must never read as "completed" (QC-04 residue).
    if stage.and_then(Value::as_i64) == Some(8)
        || stage.and_then(Value::as_str) == Some("EXECUTION_STAGE_FAILED")
    {
        return Err("Loom's execution failed.".into());
    }
    Ok(stage.and_then(Value::as_i64) == Some(7)
        || stage.and_then(Value::as_str) == Some("EXECUTION_STAGE_COMPLETED"))
}

fn clarification_ack(value: &Value) -> Result<String, String> {
    if value.get("success").and_then(Value::as_bool) == Some(true)
        && value.get("accepted").and_then(Value::as_bool) == Some(true)
    {
        Ok("accepted".into())
    } else {
        Err(value
            .get("error")
            .and_then(Value::as_str)
            .filter(|message| !message.is_empty())
            .unwrap_or("Loom did not accept the answer.")
            .to_string())
    }
}

// --- Response framing -----------------------------------------------------
//
// The unary reader (lib.rs `loom_http_raw`) decodes chunked bodies; until
// now the stream reader parsed SSE directly from the raw socket. Go's
// net/http writes streaming responses as HTTP/1.1 chunked transfer
// encoding, and a write larger than the server's internal buffer (~2 KB)
// is split mid-payload — so large events (typically the completion event,
// which carries cost and context state) arrived split at a chunk boundary
// and were corrupted or dropped (issue 017). Body framing is decoded here,
// BEFORE SSE/NDJSON line parsing; TCP reads, HTTP chunks and event lines
// have independent boundaries.

/// Limits for the response head and body (§2.2.2: every stream is bounded).
const MAX_HEADER_LINES: usize = 200;
const MAX_HEADER_BYTES: usize = 64 * 1024;
const MAX_LINE_BYTES: usize = 1024 * 1024;
const MAX_BODY_BYTES: usize = 16 * 1024 * 1024;
const MAX_CHUNK_SIZE_LINE: usize = 1024;

/// The parsed response head: status plus body framing.
struct ResponseHead {
    status: u16,
    chunked: bool,
    content_length: Option<u64>,
}

/// Read one line with cancel/deadline wakeups and an INCREMENTAL size
/// bound (review #7/#9): bytes are appended only after the bound check, so
/// a header/body line without a newline can never grow past `max`, and a
/// timeout mid-line retains the bytes already appended — the returned
/// count covers the whole logical line across wakeups. `Ok(0)` means EOF
/// before any byte.
fn checked_read_until_bounded<R: BufRead>(
    reader: &mut R,
    byte: u8,
    buf: &mut Vec<u8>,
    max: usize,
    cancel: &AtomicBool,
    started: Instant,
) -> Result<usize, String> {
    let start = buf.len();
    loop {
        if cancel.load(Ordering::SeqCst) {
            return Err("Cancelled.".into());
        }
        if started.elapsed() > Duration::from_secs(1800) {
            return Err("The Loom stream exceeded 30 minutes.".into());
        }
        let available = match reader.fill_buf() {
            Ok(bytes) => bytes,
            Err(e)
                if e.kind() == std::io::ErrorKind::TimedOut
                    || e.kind() == std::io::ErrorKind::WouldBlock =>
            {
                continue;
            }
            Err(e) => return Err(e.to_string()),
        };
        if available.is_empty() {
            return Ok(buf.len() - start);
        }
        let take = match available.iter().position(|&b| b == byte) {
            Some(pos) => pos + 1,
            None => available.len(),
        };
        if buf.len() + take - start > max {
            return Err(format!(
                "A Loom response line exceeded the {max}-byte limit."
            ));
        }
        let terminator = available[take - 1] == byte;
        buf.extend_from_slice(&available[..take]);
        reader.consume(take);
        if terminator {
            return Ok(buf.len() - start);
        }
    }
}

fn checked_read_line<R: BufRead>(
    reader: &mut R,
    line: &mut String,
    max: usize,
    cancel: &AtomicBool,
    started: Instant,
) -> Result<usize, String> {
    let mut raw: Vec<u8> = Vec::new();
    let n = checked_read_until_bounded(reader, b'\n', &mut raw, max, cancel, started)?;
    line.push_str(&String::from_utf8_lossy(&raw[..n]));
    Ok(n)
}

fn read_response_head<R: BufRead>(
    reader: &mut R,
    cancel: &AtomicBool,
    started: Instant,
) -> Result<ResponseHead, String> {
    let mut status = 0u16;
    let mut chunked = false;
    let mut content_length: Option<u64> = None;
    let mut line = String::new();
    let mut total = 0usize;
    for index in 0..MAX_HEADER_LINES {
        line.clear();
        // The head phase honors the same cancel/deadline wakeups as the
        // body: a Stop pending while Loom is slow to respond still lands.
        let n = match checked_read_line(reader, &mut line, MAX_HEADER_BYTES, cancel, started) {
            Ok(n) => n,
            Err(e) if e == "Cancelled." => return Err(e),
            Err(e) => return Err(format!("Could not read Loom's response head: {e}")),
        };
        if n == 0 {
            return Err("Loom closed the connection before responding.".into());
        }
        total += n;
        if total > MAX_HEADER_BYTES {
            return Err("Loom's response headers exceeded the size limit.".into());
        }
        let trimmed = line.trim_end();
        if trimmed.is_empty() {
            if status == 0 {
                return Err("Loom returned no HTTP status line.".into());
            }
            return Ok(ResponseHead {
                status,
                chunked,
                content_length,
            });
        }
        if index == 0 {
            status = trimmed
                .split_whitespace()
                .nth(1)
                .and_then(|s| s.parse().ok())
                .unwrap_or(0);
            continue;
        }
        let (name, value) = trimmed
            .split_once(':')
            .map(|(n, v)| (n.trim(), v.trim()))
            .unwrap_or((trimmed, ""));
        if name.eq_ignore_ascii_case("content-length") {
            content_length = value.parse::<u64>().ok().filter(|l| *l > 0);
        } else if name.eq_ignore_ascii_case("transfer-encoding") {
            chunked = value
                .split(',')
                .any(|t| t.trim().eq_ignore_ascii_case("chunked"));
        }
    }
    Err("Loom's response headers exceeded the line limit.".into())
}

fn checked_read_exact<R: BufRead>(
    reader: &mut R,
    buf: &mut [u8],
    cancel: &AtomicBool,
    started: Instant,
) -> Result<(), String> {
    let mut filled = 0;
    while filled < buf.len() {
        match reader.read(&mut buf[filled..]) {
            Ok(0) => return Err("Loom's response was truncated mid-chunk.".into()),
            Ok(n) => filled += n,
            Err(e)
                if e.kind() == std::io::ErrorKind::TimedOut
                    || e.kind() == std::io::ErrorKind::WouldBlock =>
            {
                if cancel.load(Ordering::SeqCst) {
                    return Err("Cancelled.".into());
                }
                if started.elapsed() > Duration::from_secs(1800) {
                    return Err("The Loom stream exceeded 30 minutes.".into());
                }
                continue;
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(())
}

enum BodyMode {
    /// Content-Length body: exactly `u64` decoded bytes remain.
    Fixed(u64),
    Chunked(ChunkedState),
    /// Neither Content-Length nor chunked: body runs to EOF.
    UntilEof,
    Done,
}

enum ChunkedState {
    Size,
    Data { remaining: u64 },
    Trailer,
}

/// Decodes HTTP body framing into decoded body lines. Chunk-size hex
/// lines, chunk terminators, trailers and the zero chunk are consumed
/// internally; callers only see decoded body bytes. Total decoded size is
/// bounded (`MAX_BODY_BYTES`), each line is bounded (`MAX_LINE_BYTES`), and
/// every blocking read re-checks the cancel flag and the 30-minute cap.
struct BodyDecoder<R: BufRead> {
    inner: R,
    mode: BodyMode,
    total: usize,
    /// Bytes of the current chunk read past a newline, served before the
    /// next socket read.
    carry: Vec<u8>,
    /// Aggregate bytes consumed by the chunk trailer block (review #9).
    trailer_bytes: usize,
}

impl<R: BufRead> BodyDecoder<R> {
    fn new(inner: R, head: &ResponseHead) -> Self {
        let mode = if head.chunked {
            BodyMode::Chunked(ChunkedState::Size)
        } else if let Some(n) = head.content_length {
            BodyMode::Fixed(n)
        } else {
            BodyMode::UntilEof
        };
        BodyDecoder {
            inner,
            mode,
            total: 0,
            carry: Vec::new(),
            trailer_bytes: 0,
        }
    }

    fn charge(&mut self, bytes: usize) -> Result<(), String> {
        self.total += bytes;
        if self.total > MAX_BODY_BYTES {
            return Err("Loom's stream exceeded the 16 MB response limit.".into());
        }
        Ok(())
    }

    fn push_line(&mut self, out: &mut Vec<u8>, bytes: &[u8]) -> Result<(), String> {
        out.extend_from_slice(bytes);
        if out.len() > MAX_LINE_BYTES {
            return Err("A Loom stream event line exceeded the 1 MB limit.".into());
        }
        Ok(())
    }

    /// The next decoded-body line without its trailing CR/LF.
    /// `Ok(false)` means clean end of body.
    fn next_line(
        &mut self,
        out: &mut Vec<u8>,
        cancel: &AtomicBool,
        started: Instant,
    ) -> Result<bool, String> {
        out.clear();
        let mut mode = std::mem::replace(&mut self.mode, BodyMode::Done);
        loop {
            match mode {
                BodyMode::Done => return Ok(false),
                BodyMode::Fixed(mut remaining) => {
                    let mut tmp: Vec<u8> = Vec::new();
                    let n = checked_read_until_bounded(
                        &mut self.inner,
                        b'\n',
                        &mut tmp,
                        MAX_LINE_BYTES,
                        cancel,
                        started,
                    )?;
                    if n == 0 {
                        if remaining != 0 {
                            return Err(
                                "Loom's response ended before Content-Length was satisfied.".into(),
                            );
                        }
                        self.mode = BodyMode::Done;
                        return Ok(false);
                    }
                    self.charge(n)?;
                    remaining = remaining.saturating_sub(n as u64);
                    let content = strip_line_endings(&tmp[..n]);
                    self.push_line(out, content)?;
                    self.mode = if remaining == 0 {
                        BodyMode::Done
                    } else {
                        BodyMode::Fixed(remaining)
                    };
                    return Ok(true);
                }
                BodyMode::Chunked(state) => {
                    match self.chunked_step(state, out, cancel, started)? {
                        ChunkedResult::Continue(next) => mode = BodyMode::Chunked(next),
                        ChunkedResult::Line(next) => {
                            self.mode = BodyMode::Chunked(next);
                            // Strip the CR/LF terminator ONCE on the fully
                            // assembled line: a CR and its LF can arrive in
                            // different transfer chunks (review #8).
                            let stripped = strip_line_endings(out).to_vec();
                            out.clear();
                            out.extend_from_slice(&stripped);
                            return Ok(true);
                        }
                        ChunkedResult::Done => {
                            self.mode = BodyMode::Done;
                            if !out.is_empty() {
                                // A body whose last event line lacked its
                                // terminator: deliver the tail once, then
                                // report EOF on the next call.
                                let stripped = strip_line_endings(out).to_vec();
                                out.clear();
                                out.extend_from_slice(&stripped);
                                return Ok(true);
                            }
                            mode = BodyMode::Done;
                        }
                    }
                }
                BodyMode::UntilEof => {
                    let mut tmp: Vec<u8> = Vec::new();
                    let n = checked_read_until_bounded(
                        &mut self.inner,
                        b'\n',
                        &mut tmp,
                        MAX_LINE_BYTES,
                        cancel,
                        started,
                    )?;
                    if n == 0 {
                        self.mode = BodyMode::Done;
                        if tmp.is_empty() {
                            return Ok(false);
                        }
                        self.push_line(out, &tmp)?;
                        return Ok(true);
                    }
                    self.charge(n)?;
                    let content = strip_line_endings(&tmp[..n]);
                    self.push_line(out, content)?;
                    // UntilEof must stay UntilEof until real EOF: restoring
                    // the mode here keeps every line of an EOF-framed body
                    // (review #2).
                    self.mode = BodyMode::UntilEof;
                    return Ok(true);
                }
            }
        }
    }

    /// One step of the chunked state machine. Data segments are delivered
    /// up to the next newline so event lines assemble correctly across
    /// chunk boundaries.
    fn chunked_step(
        &mut self,
        state: ChunkedState,
        out: &mut Vec<u8>,
        cancel: &AtomicBool,
        started: Instant,
    ) -> Result<ChunkedResult, String> {
        match state {
            ChunkedState::Size => {
                let mut size_line: Vec<u8> = Vec::new();
                let n = checked_read_until_bounded(
                    &mut self.inner,
                    b'\n',
                    &mut size_line,
                    MAX_CHUNK_SIZE_LINE,
                    cancel,
                    started,
                )?;
                if n == 0 {
                    return Err(
                        "Loom's chunked response was truncated before the final chunk.".into(),
                    );
                }
                if n > MAX_CHUNK_SIZE_LINE {
                    return Err("Loom's chunk-size line exceeded the limit.".into());
                }
                let text = std::str::from_utf8(&size_line[..n])
                    .map_err(|_| "Malformed chunk framing.".to_string())?;
                let hex = text.trim().split(';').next().unwrap_or("").trim();
                let size = u64::from_str_radix(hex, 16)
                    .map_err(|_| format!("Malformed chunk framing: {hex:?}"))?;
                if size == 0 {
                    Ok(ChunkedResult::Continue(ChunkedState::Trailer))
                } else {
                    Ok(ChunkedResult::Continue(ChunkedState::Data {
                        remaining: size,
                    }))
                }
            }
            ChunkedState::Data { remaining } => {
                // Serve carried bytes of the current chunk first (bytes read
                // past a newline in a previous step — already charged to
                // `remaining`). They must precede the CRLF check or a
                // carried blank line would be lost.
                if let Some(pos) = self.carry.iter().position(|&b| b == b'\n') {
                    let line_bytes: Vec<u8> = self.carry.drain(..=pos).collect();
                    self.push_line(out, &line_bytes)?;
                    return Ok(ChunkedResult::Line(ChunkedState::Data { remaining }));
                }
                if !self.carry.is_empty() {
                    let bytes = std::mem::take(&mut self.carry);
                    self.push_line(out, &bytes)?;
                    return Ok(ChunkedResult::Continue(ChunkedState::Data { remaining }));
                }
                if remaining == 0 {
                    let mut crlf = [0u8; 2];
                    checked_read_exact(&mut self.inner, &mut crlf, cancel, started)?;
                    if &crlf != b"\r\n" {
                        return Err(
                            "Malformed chunk framing: missing CRLF after chunk data.".into()
                        );
                    }
                    return Ok(ChunkedResult::Continue(ChunkedState::Size));
                }
                let want = remaining.min(8192) as usize;
                let mut buf = vec![0u8; want];
                checked_read_exact(&mut self.inner, &mut buf, cancel, started)?;
                self.charge(buf.len())?;
                match buf.iter().position(|&b| b == b'\n') {
                    Some(pos) => {
                        let line_bytes: Vec<u8> = buf[..=pos].to_vec();
                        self.carry = buf[pos + 1..].to_vec();
                        self.push_line(out, &line_bytes)?;
                        Ok(ChunkedResult::Line(ChunkedState::Data {
                            remaining: remaining - buf.len() as u64,
                        }))
                    }
                    None => {
                        self.push_line(out, &buf)?;
                        Ok(ChunkedResult::Continue(ChunkedState::Data {
                            remaining: remaining - buf.len() as u64,
                        }))
                    }
                }
            }
            ChunkedState::Trailer => {
                let mut trailer: Vec<u8> = Vec::new();
                let n = checked_read_until_bounded(
                    &mut self.inner,
                    b'\n',
                    &mut trailer,
                    MAX_HEADER_BYTES,
                    cancel,
                    started,
                )?;
                if n == 0 {
                    return Err(
                        "Loom's chunked response was truncated before the trailer terminator."
                            .into(),
                    );
                }
                // Trailers get an aggregate cap too (review #9): the whole
                // trailer block is bounded like the response head.
                self.trailer_bytes += n;
                if self.trailer_bytes > MAX_HEADER_BYTES {
                    return Err("Loom's chunk trailers exceeded the size limit.".into());
                }
                let t = String::from_utf8_lossy(&trailer[..n]);
                if t.trim_end_matches(['\r', '\n']).is_empty() {
                    Ok(ChunkedResult::Done)
                } else {
                    // Trailer header line: consumed, no state.
                    Ok(ChunkedResult::Continue(ChunkedState::Trailer))
                }
            }
        }
    }
}

enum ChunkedResult {
    Continue(ChunkedState),
    /// A complete line was delivered; the returned state is stored for the
    /// next call.
    Line(ChunkedState),
    Done,
}

fn strip_line_endings(line: &[u8]) -> &[u8] {
    let mut end = line.len();
    if end > 0 && line[end - 1] == b'\n' {
        end -= 1;
    }
    if end > 0 && line[end - 1] == b'\r' {
        end -= 1;
    }
    &line[..end]
}

/// What the decoded stream produced: whether a weave completion event was
/// observed, plus the skipped-chunk accounting for the diagnostic event.
#[derive(Debug)]
struct StreamRead {
    completed: bool,
    skipped_chunks: usize,
    skipped_sample: String,
}

/// The response-body core of the stream reader: parse the head, decode
/// body framing, and hand decoded events to `emit`. SSE `data:` payloads
/// and gateway NDJSON `{"result": …}` envelopes both dispatch here (issue
/// 003 rides the same decoded-body seam). `emit` receives the parsed event
/// object; the caller wraps it in the Tauri event envelope.
fn read_response_events<R: BufRead>(
    reader: &mut R,
    cancel: &AtomicBool,
    event_name: &str,
    started: Instant,
    mut emit: impl FnMut(Value) -> Result<(), String>,
) -> Result<StreamRead, String> {
    let head = read_response_head(reader, cancel, started)?;
    if !(200..300).contains(&head.status) {
        // The error body is decoded through the same framing (Go writes
        // error bodies chunked too), then the server's message is surfaced.
        let mut decoder = BodyDecoder::new(reader, &head);
        let mut body = Vec::new();
        let mut line: Vec<u8> = Vec::new();
        while decoder.next_line(&mut line, cancel, started)? {
            body.extend_from_slice(&line);
            body.push(b'\n');
            if body.len() > MAX_LINE_BYTES {
                break;
            }
        }
        let text = String::from_utf8_lossy(&body);
        let msg = serde_json::from_str::<Value>(text.trim())
            .ok()
            .and_then(|v| {
                v.get("message")
                    .and_then(|m| m.as_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| {
                let snippet: String = text.trim().chars().take(200).collect();
                if snippet.is_empty() {
                    format!("Loom returned HTTP {}.", head.status)
                } else {
                    format!("Loom returned HTTP {}: {snippet}", head.status)
                }
            });
        return Err(msg);
    }

    let mut decoder = BodyDecoder::new(reader, &head);
    let mut event_payload = String::new();
    let mut completed = false;
    let mut skipped_chunks: usize = 0;
    let mut skipped_sample = String::new();
    let mut line: Vec<u8> = Vec::new();

    loop {
        if cancel.load(Ordering::SeqCst) {
            return Err("Cancelled.".into());
        }
        if started.elapsed() > Duration::from_secs(1800) {
            return Err("The Loom stream exceeded 30 minutes.".into());
        }
        let more = decoder.next_line(&mut line, cancel, started)?;
        if !more {
            if event_name == "loom-stream" && !completed {
                return Err("Loom disconnected before confirming completion.".into());
            }
            break;
        }
        let text = match std::str::from_utf8(&line) {
            Ok(t) => t,
            Err(_) => {
                skipped_chunks += 1;
                if skipped_sample.len() < 200 {
                    skipped_sample.push_str("<invalid utf-8 line> | ");
                }
                continue;
            }
        };
        if text.is_empty() {
            // End of an SSE event.
            if !event_payload.is_empty() {
                let payload = event_payload.trim().to_string();
                event_payload.clear();
                if payload != "[DONE]" {
                    if let Ok(value) = serde_json::from_str::<Value>(&payload) {
                        if event_name == "loom-stream" {
                            completed |= weave_completed(&value)?;
                        }
                        emit(value)?;
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
            continue;
        }
        if text.starts_with(':') {
            // SSE heartbeat/comment — keep-alive traffic, no state.
            continue;
        }
        if let Some(data) = text.strip_prefix("data:") {
            event_payload.push_str(data.trim_start());
            event_payload.push('\n');
            continue;
        }
        // Gateway NDJSON envelope: {"result": …} per line, or {"error": …}.
        if let Ok(value) = serde_json::from_str::<Value>(text) {
            if let Some(err) = value.get("error").filter(|e| !e.is_null()) {
                let msg = err
                    .get("message")
                    .and_then(Value::as_str)
                    .or_else(|| err.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| "Loom returned a stream error.".into());
                return Err(msg);
            }
            if let Some(result) = value.get("result") {
                if event_name == "loom-stream" {
                    completed |= weave_completed(result)?;
                }
                emit(result.clone())?;
                continue;
            }
        }
        // `event:`, `id:`, `retry:` and anything unparseable are recorded
        // as skipped chunks, not silently dropped (§2.1.3/§2.1.4).
        skipped_chunks += 1;
        if skipped_sample.len() < 200 {
            skipped_sample.push_str(text);
            skipped_sample.push_str(" | ");
        }
    }

    Ok(StreamRead {
        completed,
        skipped_chunks,
        skipped_sample,
    })
}

/// Consume one stream from Loom: connect, write the request, decode the
/// response (head, chunked/Content-Length framing), and re-emit decoded
/// events as Tauri events.
fn run_stream(
    app: &AppHandle,
    rid: &str,
    method: &str,
    path: &str,
    body: &str,
    cancel: &AtomicBool,
    event_name: &'static str,
) -> Result<(), String> {
    let addr_str = super::loom_addr();
    // An invalid LOOM_ADDR is a configuration error, not a panic
    // (issue 017 note).
    let addr: std::net::SocketAddr = addr_str
        .parse()
        .map_err(|e| format!("LOOM_ADDR ({addr_str}) is not a valid host:port address: {e}"))?;
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(2)).map_err(|e| {
        format!("Loom is unavailable at {addr_str}. Start looms serve --http-port 5006. {e}")
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
    // A human is waiting on chat turns: assert the interactive slot origin
    // so the server bypasses the batch admission door (issue 013). Long-
    // lived background streams (session/patterns/boards) stay batch.
    let slot_origin = if event_name == "loom-stream" {
        "X-Loom-Slot-Origin: interactive\r\n"
    } else {
        ""
    };
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: {addr}\r\n{slot_origin}Content-Type: application/json\r\nAccept: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|e| e.to_string())?;

    let started = Instant::now();
    let mut reader = BufReader::new(stream);
    let read = read_response_events(&mut reader, cancel, event_name, started, |value| {
        let _ = app.emit(
            event_name,
            serde_json::json!({ "requestId": rid, "kind": "progress", "event": value }),
        );
        Ok(())
    })?;
    if read.skipped_chunks > 0 {
        // The stream's non-JSON chunks ride one final progress event so a
        // dead stream is diagnosable instead of silently empty (§2.1.3).
        let _ = app.emit(
            event_name,
            serde_json::json!({
                "requestId": rid,
                "kind": "progress",
                "skipped": { "chunks": read.skipped_chunks, "sample": read.skipped_sample },
            }),
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weave_requires_completion_and_surfaces_application_errors() {
        assert!(weave_completed(&serde_json::json!({"stage": 7})).unwrap());
        assert!(!weave_completed(&serde_json::json!({"partial_content": "partial"})).unwrap());
        assert_eq!(
            weave_completed(&serde_json::json!({"error": "query failed"})).unwrap_err(),
            "query failed"
        );
    }

    #[test]
    fn clarification_requires_explicit_acceptance() {
        assert_eq!(
            clarification_ack(&serde_json::json!({"success": true, "accepted": true})).unwrap(),
            "accepted"
        );
        assert_eq!(
            clarification_ack(&serde_json::json!({"error": "expired"})).unwrap_err(),
            "expired"
        );
        assert!(clarification_ack(&serde_json::json!({"success": true})).is_err());
        assert!(clarification_ack(&serde_json::json!({})).is_err());
    }

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

    #[test]
    fn weave_stream_body_uses_the_sse_snake_case_contract() {
        let body = weave_stream_body("hi", Some("sess-1"), Some("agent-2"), None, None, None);
        assert_eq!(body.get("query"), Some(&Value::String("hi".into())));
        assert_eq!(
            body.get("session_id"),
            Some(&Value::String("sess-1".into()))
        );
        assert_eq!(body.get("agent_id"), Some(&Value::String("agent-2".into())));
        assert_eq!(body.get("enable_trace"), Some(&Value::Bool(true)));
        // The SSE handler's encoding/json decoder ignores protojson keys:
        // asserting their absence pins the wire contract (QC-03).
        assert!(body.get("sessionId").is_none());
        assert!(body.get("agentId").is_none());
        assert!(body.get("enableTrace").is_none());
    }

    #[test]
    fn weave_stream_body_omits_blank_optional_fields() {
        let body = weave_stream_body("hi", Some("  "), Some(""), None, None, None);
        assert!(body.get("session_id").is_none());
        assert!(body.get("agent_id").is_none());
        assert!(body.get("context").is_none());
    }

    #[test]
    fn weave_stream_body_carries_the_context_pack_when_present() {
        let mut ctx = std::collections::HashMap::new();
        ctx.insert("active_work".into(), "w1".into());
        let body = weave_stream_body("hi", None, None, Some(&ctx), None, None);
        assert_eq!(
            body.get("context").and_then(|v| v.get("active_work")),
            Some(&Value::String("w1".into()))
        );
    }

    #[test]
    fn weave_stream_body_carries_budget_as_snake_case_when_positive() {
        let body = weave_stream_body("hi", None, None, None, Some(4), Some(120));
        assert_eq!(body.get("max_rounds"), Some(&Value::from(4)));
        assert_eq!(body.get("timeout_seconds"), Some(&Value::from(120)));
        // The snake_case SSE handler ignores protojson camelCase keys.
        assert!(body.get("maxRounds").is_none());
        assert!(body.get("timeoutSeconds").is_none());
    }

    #[test]
    fn weave_stream_body_omits_non_positive_budget() {
        let body = weave_stream_body("hi", None, None, None, Some(0), Some(-3));
        assert!(body.get("max_rounds").is_none());
        assert!(body.get("timeout_seconds").is_none());
    }

    // --- Transport fixtures (issue 017 / QC-05 / QC-04 residue) ---------
    //
    // These drive the production reader (`read_response_events`) with
    // in-memory byte fixtures and one real loopback TCP socket. No live
    // Loom, no model calls.

    fn drive(bytes: &[u8], event_name: &str) -> (Result<StreamRead, String>, Vec<Value>) {
        let cancel = AtomicBool::new(false);
        let mut cursor = std::io::Cursor::new(bytes.to_vec());
        let mut events = Vec::new();
        let result =
            read_response_events(&mut cursor, &cancel, event_name, Instant::now(), |value| {
                events.push(value);
                Ok(())
            });
        (result, events)
    }

    fn chunked(chunks: &[&[u8]]) -> Vec<u8> {
        let mut out = Vec::new();
        for c in chunks {
            out.extend_from_slice(format!("{:x}\r\n", c.len()).as_bytes());
            out.extend_from_slice(c);
            out.extend_from_slice(b"\r\n");
        }
        out.extend_from_slice(b"0\r\n\r\n");
        out
    }

    #[test]
    fn failed_stage_without_error_text_is_an_error() {
        let err = weave_completed(&serde_json::json!({"stage": 8})).unwrap_err();
        assert!(
            err.contains("failed"),
            "expected a failure for stage 8, got {err:?}"
        );
        assert!(weave_completed(&serde_json::json!({"stage": "EXECUTION_STAGE_FAILED"})).is_err());
    }

    #[test]
    fn content_length_sse_parses_events() {
        let body = b"data: {\"partial_content\":\"he\"}\n\ndata: {\"stage\":7}\n\n".to_vec();
        let mut response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\n\r\n",
            body.len()
        )
        .into_bytes();
        response.extend_from_slice(&body);
        let (result, events) = drive(&response, "loom-stream");
        let read = result.expect("clean SSE body");
        assert!(read.completed, "stage 7 must mark the weave complete");
        assert_eq!(events.len(), 2);
        assert_eq!(events[0]["partial_content"], "he");
        assert_eq!(events[1]["stage"], 7);
    }

    #[test]
    fn chunked_sse_split_across_chunk_boundaries_parses() {
        let payload = b"data: {\"stage\":7,\"cost\":{\"total_cost\":0.0041},\"context_state\":{\"tokens_used\":123}}\n\n";
        let split = 23; // mid-payload, deliberately inside the JSON
        let mut response = b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\n\r\n".to_vec();
        response.extend_from_slice(&chunked(&[&payload[..split], &payload[split..]]));
        let (result, events) = drive(&response, "loom-stream");
        let read = result.expect("split chunk payload must parse as one event");
        assert!(read.completed);
        assert_eq!(
            events.len(),
            1,
            "the split halves must reassemble into one event"
        );
        assert_eq!(events[0]["stage"], 7);
        assert_eq!(events[0]["cost"]["total_cost"], 0.0041);
    }

    #[test]
    fn chunked_with_trailers_and_zero_chunk_reaches_clean_eof() {
        let mut manual = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n".to_vec();
        manual.extend_from_slice(b"13\r\ndata: {\"stage\":7}\n\n\r\n");
        manual.extend_from_slice(b"0\r\nX-Trace: abc123\r\n\r\n");
        let (result, events) = drive(&manual, "loom-stream");
        let read = result.expect("trailers must not corrupt the stream");
        assert!(read.completed);
        assert_eq!(events.len(), 1);
    }

    #[test]
    fn truncated_mid_chunk_is_an_explicit_error() {
        let mut response = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n".to_vec();
        response.extend_from_slice(b"a\r\nabc"); // promised 10 bytes, gave 3, then EOF
        let (result, _) = drive(&response, "loom-stream");
        let err = result.unwrap_err();
        assert!(
            err.contains("truncated"),
            "expected an explicit truncation error, got {err:?}"
        );
    }

    #[test]
    fn loom_stream_eof_without_completion_is_an_error() {
        let body = b"data: {\"partial_content\":\"partial only\"}\n\n".to_vec();
        let mut response =
            format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\n\r\n", body.len()).into_bytes();
        response.extend_from_slice(&body);
        let (result, events) = drive(&response, "loom-stream");
        assert_eq!(
            result.unwrap_err(),
            "Loom disconnected before confirming completion."
        );
        assert_eq!(
            events.len(),
            1,
            "the partial event must still have been delivered"
        );
    }

    #[test]
    fn ndjson_result_envelopes_are_unwrapped() {
        let body = b"{\"result\":{\"runId\":\"r1\",\"status\":\"running\"}}\n{\"result\":{\"runId\":\"r1\",\"status\":\"completed\"}}\n".to_vec();
        let mut response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson\r\nContent-Length: {}\r\n\r\n",
            body.len()
        )
        .into_bytes();
        response.extend_from_slice(&body);
        let (result, events) = drive(&response, "loom-workflow");
        assert!(result.is_ok());
        assert_eq!(events.len(), 2);
        assert_eq!(events[0]["runId"], "r1");
        assert_eq!(events[1]["status"], "completed");
    }

    #[test]
    fn ndjson_error_envelope_surfaces_the_message() {
        let body = b"{\"error\":{\"code\":5,\"message\":\"workflow not found\"}}\n".to_vec();
        let mut response =
            format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\n\r\n", body.len()).into_bytes();
        response.extend_from_slice(&body);
        let (result, _) = drive(&response, "loom-workflow");
        assert_eq!(result.unwrap_err(), "workflow not found");
    }

    #[test]
    fn chunk_size_line_is_bounded() {
        let mut response = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n".to_vec();
        response.extend_from_slice(&vec![b'f'; 2048]);
        response.extend_from_slice(b"\r\n");
        let (result, _) = drive(&response, "loom-patterns");
        let err = result.unwrap_err();
        assert!(
            err.contains("chunk-size line") || err.contains("1024-byte limit"),
            "expected a bounded chunk-size error, got {err:?}"
        );
    }

    #[test]
    fn invalid_utf8_lines_are_counted_not_corrupting() {
        let mut body = b"data: {\"ok\":1}\n\n".to_vec();
        body.extend_from_slice(&[0xff, 0xfe, b'\n']);
        let mut response =
            format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\n\r\n", body.len()).into_bytes();
        response.extend_from_slice(&body);
        let (result, events) = drive(&response, "loom-patterns");
        let read = result.expect("invalid utf-8 must not abort the stream");
        assert_eq!(events.len(), 1);
        assert!(
            read.skipped_chunks >= 1,
            "the bad line must be recorded as skipped"
        );
    }

    #[test]
    fn malformed_json_data_frame_is_counted_not_dropped_silently() {
        let body = b"data: {not valid json}\n\ndata: {\"stage\":7}\n\n".to_vec();
        let mut response =
            format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\n\r\n", body.len()).into_bytes();
        response.extend_from_slice(&body);
        let (result, events) = drive(&response, "loom-stream");
        let read = result.expect("a malformed JSON frame must not abort the stream");
        assert_eq!(events.len(), 1, "only the valid stage-7 event is emitted");
        assert_eq!(events[0]["stage"], 7);
        assert!(read.completed, "the valid completion event still completes");
        assert!(
            read.skipped_chunks >= 1,
            "the malformed frame must be recorded, not silently dropped"
        );
    }

    #[test]
    fn completion_then_truncation_is_an_error_not_a_success() {
        let mut response = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n".to_vec();
        // A valid, completed stage-7 event first...
        let done = b"data: {\"stage\":7}\n\n";
        response.extend_from_slice(format!("{:x}\r\n", done.len()).as_bytes());
        response.extend_from_slice(done);
        response.extend_from_slice(b"\r\n");
        // ...then a chunk that promises more bytes than it delivers.
        response.extend_from_slice(b"a\r\nabc");
        let (result, events) = drive(&response, "loom-stream");
        // The completed event was delivered, but the truncated tail means
        // the turn must not read as a clean success.
        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["stage"], 7);
        let err = result.unwrap_err();
        assert!(
            err.contains("truncated"),
            "expected a truncation error, got {err:?}"
        );
    }

    #[test]
    fn chunked_sse_over_a_real_tcp_socket_is_decoded() {
        use std::net::TcpListener;
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let payload = b"data: {\"stage\":7,\"cost\":{\"total_cost\":0.0041}}\n\n";
        let split = 17;
        let mut response = b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\n\r\n".to_vec();
        response.extend_from_slice(&chunked(&[&payload[..split], &payload[split..]]));
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut req = [0u8; 1024];
            let mut seen = 0usize;
            // Read the request head (up to \r\n\r\n) before answering.
            loop {
                use std::io::Read;
                let n = socket.read(&mut req[seen..]).unwrap_or(0);
                if n == 0 {
                    break;
                }
                seen += n;
                if req[..seen].windows(4).any(|w| w == b"\r\n\r\n") {
                    break;
                }
            }
            use std::io::Write;
            let _ = socket.write_all(&response);
        });
        let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(2)).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        let _ = stream
            .write_all(b"POST /v1/weave:stream HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{}");
        let cancel = AtomicBool::new(false);
        let mut reader = BufReader::new(stream);
        let mut events = Vec::new();
        let read = read_response_events(
            &mut reader,
            &cancel,
            "loom-stream",
            Instant::now(),
            |value| {
                events.push(value);
                Ok(())
            },
        )
        .expect("the real socket fixture must decode cleanly");
        server.join().unwrap();
        assert!(read.completed);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["stage"], 7);
    }

    #[test]
    fn error_after_completion_is_an_error_not_a_success() {
        // A completed stage followed by an error-bearing event must end
        // the stream as an error — "errors after completion" (QC-04).
        let body = b"data: {\"stage\":7}\n\ndata: {\"error\":\"late failure\"}\n\n".to_vec();
        let mut response =
            format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\n\r\n", body.len()).into_bytes();
        response.extend_from_slice(&body);
        let (result, events) = drive(&response, "loom-stream");
        assert_eq!(result.unwrap_err(), "late failure");
        assert_eq!(
            events.len(),
            1,
            "the completion event itself was delivered before the error"
        );
    }

    #[test]
    fn cancel_after_completion_data_still_reports_cancelled() {
        // Stop pressed near EOF: the completion event was delivered, but
        // the pending cancel must surface as cancelled, never as a false
        // success (cancellation near EOF — QC-04). The connection stays
        // open with the promised body byte outstanding, so the Stop lands
        // before EOF and the reader must observe it.
        use std::net::TcpListener;
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let mut response =
            b"HTTP/1.1 200 OK\r\nContent-Length: 21\r\n\r\ndata: {\"stage\":7}\n\n".to_vec();
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut req = [0u8; 1024];
            let mut seen = 0usize;
            loop {
                use std::io::Read;
                let n = socket.read(&mut req[seen..]).unwrap_or(0);
                if n == 0 {
                    break;
                }
                seen += n;
                if req[..seen].windows(4).any(|w| w == b"\r\n\r\n") {
                    break;
                }
            }
            use std::io::Write;
            let _ = socket.write_all(&response);
            // Hold the connection open: the completion data is all sent,
            // but the client's Stop lands before EOF.
            std::thread::sleep(Duration::from_millis(1500));
        });
        let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(2)).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_millis(100)))
            .unwrap();
        let _ = stream
            .write_all(b"POST /v1/weave:stream HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{}");
        let cancel = Arc::new(AtomicBool::new(false));
        let mut reader = BufReader::new(stream);
        let mut saw_completion = false;
        let result = read_response_events(
            &mut reader,
            &cancel,
            "loom-stream",
            Instant::now(),
            |value| {
                if value.get("stage").and_then(Value::as_i64) == Some(7) {
                    saw_completion = true;
                    // The human pressed Stop right after the completion
                    // event arrived — before the stream reached EOF.
                    cancel.store(true, Ordering::SeqCst);
                }
                Ok(())
            },
        );
        server.join().unwrap();
        assert!(
            saw_completion,
            "the fixture must deliver the completion event"
        );
        assert_eq!(result.unwrap_err(), "Cancelled.");
    }

    #[test]
    fn eof_framed_bodies_deliver_every_line() {
        // Review #2: no Content-Length and no chunked — the body runs to
        // EOF, and EVERY line must be delivered, not just the first.
        let body = b"data: {\"partial_content\":\"one\"}\n\ndata: {\"stage\":7}\n\n".to_vec();
        let mut response = b"HTTP/1.1 200 OK\r\n\r\n".to_vec();
        response.extend_from_slice(&body);
        let (result, events) = drive(&response, "loom-stream");
        let read = result.expect("EOF-framed SSE must parse");
        assert!(read.completed);
        assert_eq!(events.len(), 2, "both events must be delivered");
        assert_eq!(events[0]["partial_content"], "one");
        assert_eq!(events[1]["stage"], 7);

        let ndjson = b"{\"result\":{\"runId\":\"r1\"}}\n{\"result\":{\"runId\":\"r2\"}}\n".to_vec();
        let mut response = b"HTTP/1.1 200 OK\r\n\r\n".to_vec();
        response.extend_from_slice(&ndjson);
        let (result, events) = drive(&response, "loom-workflow");
        assert!(result.is_ok());
        assert_eq!(events.len(), 2, "both NDJSON rows must be delivered");
        assert_eq!(events[1]["runId"], "r2");
    }

    #[test]
    fn crlf_split_across_transfer_chunks_keeps_sse_boundaries() {
        // Review #8: the CR and LF of one terminator can arrive in
        // different transfer chunks. The fully assembled line must be
        // stripped once, or the blank SSE separator becomes a CR line.
        let mut response = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n".to_vec();
        response.extend_from_slice(&chunked(&[b"data: {\"stage\":7}\r", b"\n\r", b"\n"]));
        let (result, events) = drive(&response, "loom-stream");
        let read = result.expect("CRLF-split chunk framing must parse");
        assert!(read.completed);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["stage"], 7);
    }

    #[test]
    fn timeout_inside_a_line_does_not_corrupt_accumulated_bytes() {
        // Review #7: a socket timeout mid-line must keep the bytes
        // already appended; the next wake completes the same line.
        use std::net::TcpListener;
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let head = b"HTTP/1.1 200 OK\r\nContent-Length: 53\r\n\r\n";
        let part1 = b"data: {\"stage\":7}";
        let part2 = b"\n\ndata: {\"partial_content\":\"tail\"}\n\n";
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut req = [0u8; 1024];
            let mut seen = 0usize;
            loop {
                use std::io::Read;
                let n = socket.read(&mut req[seen..]).unwrap_or(0);
                if n == 0 {
                    break;
                }
                seen += n;
                if req[..seen].windows(4).any(|w| w == b"\r\n\r\n") {
                    break;
                }
            }
            use std::io::Write;
            let _ = socket.write_all(head);
            let _ = socket.write_all(part1);
            std::thread::sleep(Duration::from_millis(400));
            let _ = socket.write_all(part2);
            std::thread::sleep(Duration::from_millis(200));
        });
        let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(2)).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_millis(100)))
            .unwrap();
        let _ = stream
            .write_all(b"POST /v1/weave:stream HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{}");
        let cancel = AtomicBool::new(false);
        let mut reader = BufReader::new(stream);
        let mut events = Vec::new();
        let read = read_response_events(
            &mut reader,
            &cancel,
            "loom-stream",
            Instant::now(),
            |value| {
                events.push(value);
                Ok(())
            },
        )
        .expect("a timeout mid-line must not corrupt the event");
        server.join().unwrap();
        assert!(read.completed);
        assert_eq!(events.len(), 2);
        assert_eq!(events[0]["stage"], 7);
        assert_eq!(events[1]["partial_content"], "tail");
    }

    #[test]
    fn cancel_during_silence_stops_the_reader() {
        use std::net::TcpListener;
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            // Hold the connection open without writing anything.
            let mut buf = [0u8; 256];
            loop {
                use std::io::Read;
                match socket.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        if buf[..n].windows(4).any(|w| w == b"\r\n\r\n") {
                            break;
                        }
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(1500));
        });
        let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(2)).unwrap();
        // A short timeout makes the silence-wakeup fast for the fixture;
        // production uses 20 s — the wake path is identical.
        stream
            .set_read_timeout(Some(Duration::from_millis(100)))
            .unwrap();
        let _ = stream
            .write_all(b"POST /v1/weave:stream HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{}");
        let cancel = Arc::new(AtomicBool::new(false));
        let flag = cancel.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(300));
            flag.store(true, Ordering::SeqCst);
        });
        let mut reader = BufReader::new(stream);
        let started = Instant::now();
        let result = read_response_events(&mut reader, &cancel, "loom-stream", started, |_| Ok(()));
        server.join().unwrap();
        assert_eq!(result.unwrap_err(), "Cancelled.");
    }
}
