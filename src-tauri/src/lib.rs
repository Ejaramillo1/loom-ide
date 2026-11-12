//! Loom IDE — Tauri backend.
//!
//! Two data sources, kept strictly separate:
//!
//! 1. Local, structured work items (`<app-data>/loom-ide/work.json`) and a
//!    read-only explorer over the Loom workspace directory (`~/.loom`).
//! 2. The Loom server on localhost:5006: sessions and agents, and chat via
//!    `POST /v1/weave` with the selected session/agent.
//!
//! Nothing here invents a reply or fakes progress. When the server is not
//! reachable, session/agent/chat commands fail and the UI shows the error.
//! The workspace explorer is local and works regardless of the server.

use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, State};

mod experiment;
use experiment::{Experiment, ExperimentStore};
mod store;
use store::{AttentionItem, CollabStep, WorkItem, WorkStore};

/// Deserialize an `i64` that may arrive either as a JSON number or as a
/// JSON string. The Loom gateway (grpc-gateway / protojson) encodes every
/// 64-bit integer as a string (`"uptimeSeconds": "3600"`), while serde's
/// plain `i64` rejects a string. `#[serde(default)]` alone does not help:
/// it only applies when the key is absent, not when it is present with the
/// wrong JSON type.
fn de_i64<'de, D>(d: D) -> Result<i64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    struct I64Visitor;
    impl serde::de::Visitor<'_> for I64Visitor {
        type Value = i64;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("an integer or a string containing an integer")
        }
        fn visit_i64<E: serde::de::Error>(self, v: i64) -> Result<i64, E> {
            Ok(v)
        }
        fn visit_u64<E: serde::de::Error>(self, v: u64) -> Result<i64, E> {
            i64::try_from(v).map_err(|_| E::custom("integer out of range for i64"))
        }
        fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<i64, E> {
            v.parse::<i64>().map_err(E::custom)
        }
    }
    d.deserialize_any(I64Visitor)
}

/// Percent-encode one URL path/query segment (RFC 3986 unreserved set kept
/// as-is). Used for ids interpolated into request paths.
fn percent_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// Where work items live on disk: <app-data>/loom-ide/work.json
fn work_file_path(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("loom-ide")
        .join("work.json")
}

/// Where experiments live on disk: <app-data>/loom-ide/experiments.json
fn experiments_file_path(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("loom-ide")
        .join("experiments.json")
}

pub struct AppState {
    work: Mutex<WorkStore>,
    experiments: Mutex<ExperimentStore>,
}

// ---------------------------------------------------------------------------
// Work items
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_work_items(state: State<AppState>) -> Vec<WorkItem> {
    state.work.lock().unwrap_or_else(|e| e.into_inner()).items()
}

#[tauri::command]
fn add_work_item(title: String, state: State<AppState>) -> Result<WorkItem, String> {
    state
        .work
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .add(title)
}

#[tauri::command]
fn set_work_status(id: String, status: String, state: State<AppState>) -> Result<WorkItem, String> {
    state
        .work
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .set_status(&id, &status)
}

#[tauri::command]
fn set_work_autonomy(
    id: String,
    autonomy: String,
    state: State<AppState>,
) -> Result<WorkItem, String> {
    state
        .work
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .set_autonomy(&id, &autonomy)
}

#[tauri::command]
fn set_work_session(
    id: String,
    session_id: Option<String>,
    state: State<AppState>,
) -> Result<WorkItem, String> {
    state
        .work
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .set_session(&id, session_id)
}

#[tauri::command]
fn set_work_success_criteria(
    id: String,
    criteria: Vec<String>,
    state: State<AppState>,
) -> Result<WorkItem, String> {
    state
        .work
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .set_success_criteria(&id, criteria)
}

#[tauri::command]
fn set_work_artifacts(
    id: String,
    artifact_ids: Vec<String>,
    state: State<AppState>,
) -> Result<WorkItem, String> {
    state
        .work
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .set_artifacts(&id, artifact_ids)
}

// ---------------------------------------------------------------------------
// Experiments (local definitions; arms run through real Loom calls)
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_experiments(state: State<AppState>) -> Vec<Experiment> {
    state
        .experiments
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .items()
}

#[tauri::command]
fn add_experiment(
    title: String,
    question: String,
    hypothesis: String,
    state: State<AppState>,
) -> Result<Experiment, String> {
    state
        .experiments
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .add(title, question, hypothesis)
}

#[tauri::command]
fn add_experiment_arm(
    id: String,
    label: String,
    config: String,
    state: State<AppState>,
) -> Result<Experiment, String> {
    state
        .experiments
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .add_arm(&id, label, config)
}

#[tauri::command]
fn set_experiment_arm_status(
    id: String,
    arm_id: String,
    status: String,
    state: State<AppState>,
) -> Result<Experiment, String> {
    state
        .experiments
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .set_arm_status(&id, &arm_id, &status)
}

#[tauri::command]
fn set_experiment_arm_result(
    id: String,
    arm_id: String,
    result: String,
    state: State<AppState>,
) -> Result<Experiment, String> {
    state
        .experiments
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .set_arm_result(&id, &arm_id, result)
}

#[tauri::command]
fn choose_experiment_arm(
    id: String,
    arm_id: String,
    state: State<AppState>,
) -> Result<Experiment, String> {
    state
        .experiments
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .choose_arm(&id, &arm_id)
}

#[tauri::command]
fn clear_experiment_decision(id: String, state: State<AppState>) -> Result<Experiment, String> {
    state
        .experiments
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clear_decision(&id)
}

// ---------------------------------------------------------------------------
// Collaboration + attention (empty until the Loom server exposes them)
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_collaboration() -> Vec<CollabStep> {
    // The Loom server does not expose step-by-step execution yet.
    Vec::new()
}

#[tauri::command]
fn get_attention(state: State<AppState>) -> Vec<AttentionItem> {
    // The Loom server does not expose attention items yet, but the
    // decisions already waiting in local experiments are real attention
    // items: an experiment with >= 2 finished arms and no decision.
    let experiments = state
        .experiments
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .awaiting_decision();
    experiments
        .iter()
        .map(|exp| {
            let done = exp.arms.iter().filter(|a| a.status == "done").count();
            AttentionItem {
                id: format!("decision-{}", exp.id),
                kind: "decision".to_string(),
                title: format!("Decide: {}", exp.title),
                detail: format!(
                    "{done} arms finished and no winner picked yet — open the experiment to decide."
                ),
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Loom server: sessions + agents + chat
// ---------------------------------------------------------------------------

const LOOM_HTTP_URL: &str = "http://localhost:5006";

/// A Loom conversation session (the subset the IDE shows). Field names are
/// snake_case in this struct; the server may answer with either snake_case or
/// camelCase keys, so the aliases accept both.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub state: String,
    #[serde(default, alias = "agentId")]
    pub agent_id: String,
    #[serde(default, alias = "agentName")]
    pub agent_name: String,
    #[serde(default, alias = "updatedAt", deserialize_with = "de_i64")]
    pub updated_at: i64,
    #[serde(default, alias = "conversationCount")]
    pub conversation_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub status: String,
    #[serde(default, alias = "uptimeSeconds", deserialize_with = "de_i64")]
    pub uptime_seconds: i64,
    #[serde(default, alias = "activeSessions")]
    pub active_sessions: i32,
    #[serde(default, alias = "totalMessages", deserialize_with = "de_i64")]
    pub total_messages: i64,
}

#[derive(Debug, Deserialize)]
struct SessionsResponse {
    #[serde(default)]
    sessions: Vec<Session>,
}

#[derive(Debug, Deserialize)]
struct AgentsResponse {
    #[serde(default)]
    agents: Vec<Agent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryMessage {
    #[serde(default)]
    pub role: String,
    #[serde(default)]
    pub content: String,
}

#[derive(Debug, Deserialize)]
struct HistoryResponse {
    #[serde(default)]
    messages: Vec<HistoryMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default, rename = "type")]
    pub workflow_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExecution {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub status: String,
    #[serde(default, alias = "startedAt", deserialize_with = "de_i64")]
    pub started_at: i64,
    #[serde(default, alias = "completedAt", deserialize_with = "de_i64")]
    pub completed_at: i64,
    #[serde(default)]
    pub error: String,
    /// The run's recorded output (`WorkflowResult`), when the server
    /// returns it. Ignored by older responses.
    #[serde(default)]
    pub result: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub purpose: String,
    #[serde(default)]
    pub source: String,
    #[serde(default, alias = "createdAt", deserialize_with = "de_i64")]
    pub created_at: i64,
    /// The session that produced this artifact, when the server reports it.
    /// Lets the UI show "what this work produced" instead of a global list.
    #[serde(default, alias = "sessionId")]
    pub session_id: String,
}

#[derive(Debug, Deserialize)]
struct WorkflowsResponse {
    #[serde(default)]
    workflows: Vec<Workflow>,
}

#[derive(Debug, Deserialize)]
struct ExecutionsResponse {
    #[serde(default)]
    executions: Vec<WorkflowExecution>,
}

#[derive(Debug, Deserialize)]
struct ArtifactsResponse {
    #[serde(default)]
    artifacts: Vec<Artifact>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ExecuteWorkflowResponse {
    #[serde(default, alias = "executionId")]
    execution_id: String,
    /// The run's recorded output (`WorkflowResult`), when the server
    /// returns it with the execute response.
    #[serde(default)]
    result: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
struct LoomStatus {
    online: bool,
    url: String,
    detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatCard {
    title: String,
    detail: String,
}

#[derive(Debug, Clone, Serialize)]
struct ChatReply {
    text: String,
    source: String, // always "live" — there is no demo reply
    card: Option<ChatCard>,
    // The session the reply belongs to; set when the server reports one
    // (so a first message without a session adopts the auto-created one).
    session_id: Option<String>,
}

/// Summarize the non-healthy components of a /v1/health body, if any.
fn component_errors(value: &serde_json::Value) -> String {
    let mut errs = Vec::new();
    if let Some(components) = value.get("components").and_then(|v| v.as_object()) {
        for (name, comp) in components {
            let st = comp.get("status").and_then(|v| v.as_str()).unwrap_or("");
            if st != "healthy" {
                let e = comp.get("error").and_then(|v| v.as_str()).unwrap_or(st);
                errs.push(format!("{name}: {e}"));
            }
        }
    }
    if errs.is_empty() {
        "see /v1/health".to_string()
    } else {
        errs.join("; ")
    }
}

#[tauri::command]
async fn get_loom_status() -> LoomStatus {
    // The real component check, not the static /health stub (which returns
    // 200 {"status":"healthy"} unconditionally). /v1/health pings each
    // configured LLM provider, so it gets a longer read timeout, and any
    // 2xx counts as "the server is up" regardless of the body shape.
    let result = tauri::async_runtime::spawn_blocking(|| {
        loom_http_raw("GET", "/v1/health", None, Duration::from_secs(30))
    })
    .await;
    let (online, detail) = match result {
        Ok(Ok((status, payload))) if (200..300).contains(&status) => {
            match serde_json::from_slice::<serde_json::Value>(&payload) {
                Ok(value) => match value.get("status").and_then(|v| v.as_str()) {
                    Some("healthy") => (true, "Loom HTTP service is healthy.".to_string()),
                    Some("degraded") => (
                        true,
                        format!("Loom is degraded ({}).", component_errors(&value)),
                    ),
                    Some(other) => (
                        false,
                        format!("Loom reports {other}: {}.", component_errors(&value)),
                    ),
                    None => (true, "Loom HTTP service is up.".to_string()),
                },
                Err(_) => (
                    true,
                    "Loom HTTP service is up (health body unreadable).".to_string(),
                ),
            }
        }
        _ => (
            false,
            "Loom is unavailable. Start looms serve --http-port 5006.".to_string(),
        ),
    };
    LoomStatus {
        online,
        url: LOOM_HTTP_URL.to_string(),
        detail,
    }
}

/// Raw HTTP request over a plain TCP connection, including chunked
/// responses from gRPC-gateway. Returns (status, body). The read has a
/// *total* deadline (not per-read) and a 16 MB size cap, so a server that
/// dribbles bytes cannot hold a worker forever and a runaway response
/// cannot grow memory without bound. Timeouts surface as a plain
/// "timed out" message instead of raw OS text.
fn loom_http_raw(
    method: &str,
    path: &str,
    body: Option<String>,
    read_timeout: Duration,
) -> Result<(u16, Vec<u8>), String> {
    let mut stream =
        TcpStream::connect_timeout(&"127.0.0.1:5006".parse().unwrap(), Duration::from_secs(2))
            .map_err(|e| format!("Loom is unavailable. Start looms serve --http-port 5006. {e}"))?;
    stream
        .set_read_timeout(Some(read_timeout))
        .map_err(|e| e.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| e.to_string())?;
    let body = body.unwrap_or_default();
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: localhost:5006\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|e| e.to_string())?;
    const MAX_RESPONSE_BYTES: usize = 16 * 1024 * 1024;
    let started = Instant::now();
    let mut raw = Vec::new();
    let mut buf = [0u8; 65536];
    loop {
        if started.elapsed() > read_timeout {
            return Err(format!(
                "Loom request timed out after {}s.",
                read_timeout.as_secs()
            ));
        }
        match stream.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                raw.extend_from_slice(&buf[..n]);
                if raw.len() > MAX_RESPONSE_BYTES {
                    return Err("Loom response exceeded 16 MB.".to_string());
                }
            }
            Err(e)
                if e.kind() == std::io::ErrorKind::TimedOut
                    || e.kind() == std::io::ErrorKind::WouldBlock =>
            {
                return Err(format!(
                    "Loom request timed out after {}s.",
                    read_timeout.as_secs()
                ));
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    let header_end = raw
        .windows(4)
        .position(|w| w == b"\r\n\r\n")
        .ok_or("Invalid HTTP response")?;
    let head = String::from_utf8_lossy(&raw[..header_end]);
    let status: u16 = head
        .split_whitespace()
        .nth(1)
        .and_then(|v| v.parse().ok())
        .ok_or("Invalid HTTP status")?;
    let mut payload = raw[header_end + 4..].to_vec();
    if head
        .to_ascii_lowercase()
        .contains("transfer-encoding: chunked")
    {
        let mut decoded = Vec::new();
        let mut rest = payload.as_slice();
        loop {
            let end = rest
                .windows(2)
                .position(|w| w == b"\r\n")
                .ok_or("Invalid chunk header")?;
            let header = std::str::from_utf8(&rest[..end]).map_err(|e| e.to_string())?;
            let size = usize::from_str_radix(header.split(';').next().unwrap_or("").trim(), 16)
                .map_err(|e| e.to_string())?;
            if size == 0 {
                break;
            }
            rest = &rest[end + 2..];
            if size > rest.len().saturating_sub(2) {
                return Err("Incomplete HTTP chunk".into());
            }
            decoded.extend_from_slice(&rest[..size]);
            rest = &rest[size + 2..];
        }
        payload = decoded;
    }
    Ok((status, payload))
}

/// JSON request to the Loom gateway: status is checked *before* parsing, so
/// a non-2xx error with an empty or non-JSON body reports its status instead
/// of a misleading parse error.
fn loom_request(
    method: &str,
    path: &str,
    body: Option<String>,
) -> Result<serde_json::Value, String> {
    let read_timeout = Duration::from_secs(if body.is_some() { 180 } else { 4 });
    let (status, payload) = loom_http_raw(method, path, body, read_timeout)?;
    if status == 204 {
        return Ok(serde_json::Value::Null);
    }
    if !(200..300).contains(&status) {
        if let Ok(value) = serde_json::from_slice::<serde_json::Value>(&payload) {
            let msg = value
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("Request failed");
            return Err(format!("Loom returned HTTP {status}: {msg}"));
        }
        let snippet: String = String::from_utf8_lossy(&payload)
            .chars()
            .take(200)
            .collect();
        return Err(format!("Loom returned HTTP {status}: {snippet}"));
    }
    serde_json::from_slice(&payload).map_err(|e| format!("Invalid Loom response: {e}"))
}

#[tauri::command]
async fn list_sessions() -> Result<Vec<Session>, String> {
    let value = tauri::async_runtime::spawn_blocking(|| {
        loom_request("GET", "/v1/sessions?limit=500", None)
    })
    .await
    .map_err(|e| e.to_string())??;
    let resp: SessionsResponse =
        serde_json::from_value(value).map_err(|e| format!("Unexpected sessions response: {e}"))?;
    Ok(resp.sessions)
}

#[tauri::command]
async fn create_session(name: Option<String>, agent_id: Option<String>) -> Result<Session, String> {
    let mut obj = serde_json::Map::new();
    if let Some(n) = name {
        if !n.trim().is_empty() {
            obj.insert("name".into(), n.into());
        }
    }
    if let Some(a) = agent_id {
        if !a.trim().is_empty() {
            obj.insert("agent_id".into(), a.into());
        }
    }
    let body = serde_json::Value::Object(obj).to_string();
    let value = tauri::async_runtime::spawn_blocking(move || {
        loom_request("POST", "/v1/sessions", Some(body))
    })
    .await
    .map_err(|e| e.to_string())??;
    serde_json::from_value(value).map_err(|e| format!("Unexpected session response: {e}"))
}

#[tauri::command]
async fn list_agents() -> Result<Vec<Agent>, String> {
    let value = tauri::async_runtime::spawn_blocking(|| loom_request("GET", "/v1/agents", None))
        .await
        .map_err(|e| e.to_string())??;
    let resp: AgentsResponse =
        serde_json::from_value(value).map_err(|e| format!("Unexpected agents response: {e}"))?;
    Ok(resp.agents)
}

#[tauri::command]
async fn get_session_history(session_id: String) -> Result<Vec<HistoryMessage>, String> {
    if session_id.trim().is_empty() {
        return Err("No session selected.".to_string());
    }
    let value = tauri::async_runtime::spawn_blocking(move || {
        loom_request(
            "GET",
            &format!("/v1/sessions/{}/history", percent_encode(&session_id)),
            None,
        )
    })
    .await
    .map_err(|e| e.to_string())??;
    let resp: HistoryResponse =
        serde_json::from_value(value).map_err(|e| format!("Unexpected history response: {e}"))?;
    Ok(resp.messages)
}

#[tauri::command]
async fn list_workflows() -> Result<Vec<Workflow>, String> {
    let value = tauri::async_runtime::spawn_blocking(|| loom_request("GET", "/v1/workflows", None))
        .await
        .map_err(|e| e.to_string())??;
    let resp: WorkflowsResponse =
        serde_json::from_value(value).map_err(|e| format!("Unexpected workflows response: {e}"))?;
    Ok(resp.workflows)
}

#[tauri::command]
async fn execute_workflow(workflow_ref: String) -> Result<ExecuteWorkflowResponse, String> {
    if workflow_ref.trim().is_empty() {
        return Err("No workflow selected.".to_string());
    }
    let body = serde_json::json!({ "workflow_ref": workflow_ref }).to_string();
    let value = tauri::async_runtime::spawn_blocking(move || {
        loom_request("POST", "/v1/workflows:execute", Some(body))
    })
    .await
    .map_err(|e| e.to_string())??;
    // The full response, including `result` when the server returns it, so
    // the UI can show the run's actual output instead of re-listing.
    serde_json::from_value(value).map_err(|e| format!("Unexpected execute response: {e}"))
}

/// Fetch one execution (for polling the run just started instead of
/// re-listing everything).
#[tauri::command]
async fn get_workflow_execution(execution_id: String) -> Result<WorkflowExecution, String> {
    if execution_id.trim().is_empty() {
        return Err("No execution selected.".to_string());
    }
    let value = tauri::async_runtime::spawn_blocking(move || {
        loom_request(
            "GET",
            &format!(
                "/v1/workflows/executions/{}",
                percent_encode(execution_id.trim())
            ),
            None,
        )
    })
    .await
    .map_err(|e| e.to_string())??;
    serde_json::from_value(value).map_err(|e| format!("Unexpected execution response: {e}"))
}

#[tauri::command]
async fn list_workflow_executions() -> Result<Vec<WorkflowExecution>, String> {
    let value = tauri::async_runtime::spawn_blocking(|| {
        loom_request("GET", "/v1/workflows/executions", None)
    })
    .await
    .map_err(|e| e.to_string())??;
    let resp: ExecutionsResponse = serde_json::from_value(value)
        .map_err(|e| format!("Unexpected executions response: {e}"))?;
    Ok(resp.executions)
}

#[tauri::command]
async fn list_artifacts(session_id: Option<String>) -> Result<Vec<Artifact>, String> {
    // The server caps unfiltered lists at 50 rows; ask for more, and scope
    // to one session when the caller passes one ("what this work produced").
    let mut path = "/v1/artifacts?limit=200".to_string();
    if let Some(s) = session_id {
        if !s.trim().is_empty() {
            path.push_str(&format!("&session_id={}", percent_encode(s.trim())));
        }
    }
    let value = tauri::async_runtime::spawn_blocking(move || loom_request("GET", &path, None))
        .await
        .map_err(|e| e.to_string())??;
    let resp: ArtifactsResponse =
        serde_json::from_value(value).map_err(|e| format!("Unexpected artifacts response: {e}"))?;
    Ok(resp.artifacts)
}

#[tauri::command]
async fn ask_loom(
    message: String,
    session_id: Option<String>,
    agent_id: Option<String>,
) -> Result<ChatReply, String> {
    if message.trim().is_empty() {
        return Err("Enter a message first.".into());
    }
    let mut obj = serde_json::Map::new();
    obj.insert("query".into(), message.into());
    if let Some(s) = session_id {
        if !s.trim().is_empty() {
            obj.insert("session_id".into(), s.into());
        }
    }
    if let Some(a) = agent_id {
        if !a.trim().is_empty() {
            obj.insert("agent_id".into(), a.into());
        }
    }
    let body = serde_json::Value::Object(obj).to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let value = loom_request("POST", "/v1/weave", Some(body))?;
        let text = ["text", "response", "content", "reply", "message"]
            .iter()
            .find_map(|key| {
                value
                    .get(key)
                    .and_then(|v| v.as_str())
                    .filter(|v| !v.trim().is_empty())
            })
            .ok_or("Loom returned an empty response. Check its agent configuration.")?;
        let session_id = value
            .get("session_id")
            .or_else(|| value.get("sessionId"))
            .and_then(|v| v.as_str())
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.to_string());
        Ok(ChatReply {
            text: text.into(),
            source: "live".into(),
            card: None,
            session_id,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------------------------------------------------------------------------
// Workspace explorer (local filesystem; independent of the Loom server)
// ---------------------------------------------------------------------------

/// The Loom data/workspace directory: $LOOM_DATA_DIR, else ~/.loom.
fn loom_data_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("LOOM_DATA_DIR") {
        let p = PathBuf::from(dir);
        if p.is_dir() {
            return p;
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join(".loom");
    }
    PathBuf::from(".loom")
}

#[derive(Debug, Clone, Serialize)]
struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
}

/// List a directory's entries: directories first, then files, each
/// alphabetically; hidden entries (dotfiles) are skipped.
fn list_dir_entries(dir: &Path) -> Result<Vec<DirEntry>, String> {
    let read = std::fs::read_dir(dir).map_err(|e| format!("Cannot read {}: {e}", dir.display()))?;
    let mut out: Vec<DirEntry> = Vec::new();
    for entry in read.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        out.push(DirEntry {
            name,
            path: path.display().to_string(),
            is_dir: path.is_dir(),
        });
    }
    out.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(out)
}

#[tauri::command]
fn list_workspace() -> Result<Vec<DirEntry>, String> {
    list_dir_entries(&loom_data_dir())
}

#[tauri::command]
fn list_directory(path: String) -> Result<Vec<DirEntry>, String> {
    let target = workspace_path(&path)?;
    if !target.is_dir() {
        return Err(format!("Not a directory: {}", target.display()));
    }
    list_dir_entries(&target)
}

/// Read a text file from within the workspace, bounded and UTF-8 only.
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    const MAX_BYTES: u64 = 1024 * 1024;
    let target = workspace_path(&path)?;
    if !target.is_file() {
        return Err(format!("Not a file: {}", target.display()));
    }
    let meta = target.metadata().map_err(|e| e.to_string())?;
    if meta.len() > MAX_BYTES {
        return Err(format!(
            "File is larger than 1 MB and was not opened: {}",
            target.display()
        ));
    }
    let bytes = std::fs::read(&target).map_err(|e| e.to_string())?;
    if bytes.contains(&0) {
        return Err(format!("Binary file: {}", target.display()));
    }
    String::from_utf8(bytes).map_err(|_| format!("File is not UTF-8 text: {}", target.display()))
}

/// Resolve an absolute or workspace-relative path and require it to stay
/// inside the workspace directory (following symlinks for the comparison).
fn workspace_path(path: &str) -> Result<PathBuf, String> {
    let root = loom_data_dir();
    // Workspace-relative paths resolve against the workspace root, not the
    // process working directory.
    let requested = {
        let p = PathBuf::from(path);
        if p.is_relative() { root.join(p) } else { p }
    };

    let (canon_root, canon_target) = if requested == root {
        (root.clone(), root.clone())
    } else {
        let canon_root = root
            .canonicalize()
            .map_err(|e| format!("Workspace not found: {e}"))?;
        let canon_target = requested
            .canonicalize()
            .map_err(|e| format!("Cannot read {}: {e}", requested.display()))?;
        (canon_root, canon_target)
    };

    if !canon_target.starts_with(&canon_root) {
        return Err("Path is outside the workspace.".to_string());
    }
    Ok(canon_target)
}

// ---------------------------------------------------------------------------
// App entry
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Refuse to guess where data lives: if the app-data directory
            // cannot be determined, fail startup loudly instead of writing
            // work.json next to wherever the app was launched from.
            if app.handle().path().app_data_dir().is_err() {
                return Err(
                    "Could not determine the app data directory; refusing to write work data to the current directory.".into(),
                );
            }
            let path = work_file_path(app.handle());
            let store = WorkStore::load(path)?;
            let exp_path = experiments_file_path(app.handle());
            let exp_store = ExperimentStore::load(exp_path)?;
            app.manage(AppState {
                work: Mutex::new(store),
                experiments: Mutex::new(exp_store),
            });
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_work_items,
            add_work_item,
            set_work_status,
            set_work_autonomy,
            set_work_session,
            set_work_success_criteria,
            set_work_artifacts,
            get_collaboration,
            get_attention,
            get_loom_status,
            ask_loom,
            list_sessions,
            create_session,
            list_agents,
            get_session_history,
            list_workflows,
            execute_workflow,
            get_workflow_execution,
            list_workflow_executions,
            list_artifacts,
            get_experiments,
            add_experiment,
            add_experiment_arm,
            set_experiment_arm_status,
            set_experiment_arm_result,
            choose_experiment_arm,
            clear_experiment_decision,
            list_workspace,
            list_directory,
            read_file
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
