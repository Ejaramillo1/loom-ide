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
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

mod experiment;
use experiment::{Experiment, ExperimentStore};
mod store;
use store::{AttentionItem, CollabStep, WorkItem, WorkStore};

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
    state.work.lock().unwrap().items()
}

#[tauri::command]
fn add_work_item(title: String, state: State<AppState>) -> Result<WorkItem, String> {
    state.work.lock().unwrap().add(title)
}

#[tauri::command]
fn set_work_status(
    id: String,
    status: String,
    state: State<AppState>,
) -> Result<WorkItem, String> {
    state.work.lock().unwrap().set_status(&id, &status)
}

#[tauri::command]
fn set_work_autonomy(
    id: String,
    autonomy: String,
    state: State<AppState>,
) -> Result<WorkItem, String> {
    state.work.lock().unwrap().set_autonomy(&id, &autonomy)
}

#[tauri::command]
fn set_work_session(
    id: String,
    session_id: Option<String>,
    state: State<AppState>,
) -> Result<WorkItem, String> {
    state.work.lock().unwrap().set_session(&id, session_id)
}

#[tauri::command]
fn set_work_success_criteria(
    id: String,
    criteria: Vec<String>,
    state: State<AppState>,
) -> Result<WorkItem, String> {
    state.work.lock().unwrap().set_success_criteria(&id, criteria)
}

#[tauri::command]
fn set_work_artifacts(
    id: String,
    artifact_ids: Vec<String>,
    state: State<AppState>,
) -> Result<WorkItem, String> {
    state.work.lock().unwrap().set_artifacts(&id, artifact_ids)
}

// ---------------------------------------------------------------------------
// Experiments (local definitions; arms run through real Loom calls)
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_experiments(state: State<AppState>) -> Vec<Experiment> {
    state.experiments.lock().unwrap().items()
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
        .unwrap()
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
        .unwrap()
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
        .unwrap()
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
        .unwrap()
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
        .unwrap()
        .choose_arm(&id, &arm_id)
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
fn get_attention() -> Vec<AttentionItem> {
    // The Loom server does not expose attention items yet.
    Vec::new()
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
    #[serde(default, alias = "updatedAt")]
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
    #[serde(default, alias = "uptimeSeconds")]
    pub uptime_seconds: i64,
    #[serde(default, alias = "activeSessions")]
    pub active_sessions: i32,
    #[serde(default, alias = "totalMessages")]
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
    #[serde(default, alias = "startedAt")]
    pub started_at: i64,
    #[serde(default, alias = "completedAt")]
    pub completed_at: i64,
    #[serde(default)]
    pub error: String,
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
    #[serde(default, alias = "createdAt")]
    pub created_at: i64,
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

#[derive(Debug, Deserialize)]
struct ExecuteWorkflowResponse {
    #[serde(default, alias = "executionId")]
    execution_id: String,
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

#[tauri::command]
async fn get_loom_status() -> LoomStatus {
    let result = tauri::async_runtime::spawn_blocking(|| loom_request("GET", "/health", None)).await;
    let online = matches!(result, Ok(Ok(_)));
    LoomStatus {
        online,
        url: LOOM_HTTP_URL.to_string(),
        detail: if online { "Loom HTTP service is healthy.".into() }
            else { "Loom is unavailable. Start looms serve --http-port 5006.".into() },
    }
}

/// Read HTTP framing explicitly, including chunked responses from gRPC-gateway.
fn loom_request(method: &str, path: &str, body: Option<String>) -> Result<serde_json::Value, String> {
    let mut stream = TcpStream::connect_timeout(&"127.0.0.1:5006".parse().unwrap(), Duration::from_secs(2))
        .map_err(|e| format!("Loom is unavailable. Start looms serve --http-port 5006. {e}"))?;
    stream.set_read_timeout(Some(Duration::from_secs(if body.is_some() { 180 } else { 4 }))).map_err(|e| e.to_string())?;
    stream.set_write_timeout(Some(Duration::from_secs(5))).map_err(|e| e.to_string())?;
    let body = body.unwrap_or_default();
    let request = format!("{method} {path} HTTP/1.1\r\nHost: localhost:5006\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
    stream.write_all(request.as_bytes()).map_err(|e| e.to_string())?;
    let mut raw = Vec::new();
    stream.read_to_end(&mut raw).map_err(|e| e.to_string())?;
    let start = raw.windows(4).position(|w| w == b"\r\n\r\n").ok_or("Invalid HTTP response")?;
    let head = String::from_utf8_lossy(&raw[..start]);
    let status: u16 = head.split_whitespace().nth(1).and_then(|v| v.parse().ok()).ok_or("Invalid HTTP status")?;
    let mut payload = raw[start + 4..].to_vec();
    if head.to_ascii_lowercase().contains("transfer-encoding: chunked") {
        let mut decoded = Vec::new();
        let mut rest = payload.as_slice();
        loop {
            let end = rest.windows(2).position(|w| w == b"\r\n").ok_or("Invalid chunk header")?;
            let header = std::str::from_utf8(&rest[..end]).map_err(|e| e.to_string())?;
            let size = usize::from_str_radix(header.split(';').next().unwrap_or("").trim(), 16).map_err(|e| e.to_string())?;
            if size == 0 { break; }
            rest = &rest[end + 2..];
            if size > rest.len().saturating_sub(2) { return Err("Incomplete HTTP chunk".into()); }
            decoded.extend_from_slice(&rest[..size]);
            rest = &rest[size + 2..];
        }
        payload = decoded;
    }
    if status == 204 {
        return Ok(serde_json::Value::Null);
    }
    let value: serde_json::Value = serde_json::from_slice(&payload).map_err(|e| format!("Invalid Loom response: {e}"))?;
    if !(200..300).contains(&status) {
        return Err(format!("Loom returned HTTP {status}: {}", value.get("message").and_then(|v| v.as_str()).unwrap_or("Request failed")));
    }
    Ok(value)
}

#[tauri::command]
async fn list_sessions() -> Result<Vec<Session>, String> {
    let value = tauri::async_runtime::spawn_blocking(|| {
        loom_request("GET", "/v1/sessions?limit=200", None)
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
    let value = tauri::async_runtime::spawn_blocking(|| {
        loom_request("GET", "/v1/agents", None)
    })
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
        loom_request("GET", &format!("/v1/sessions/{session_id}/history"), None)
    })
    .await
    .map_err(|e| e.to_string())??;
    let resp: HistoryResponse =
        serde_json::from_value(value).map_err(|e| format!("Unexpected history response: {e}"))?;
    Ok(resp.messages)
}

#[tauri::command]
async fn list_workflows() -> Result<Vec<Workflow>, String> {
    let value = tauri::async_runtime::spawn_blocking(|| {
        loom_request("GET", "/v1/workflows", None)
    })
    .await
    .map_err(|e| e.to_string())??;
    let resp: WorkflowsResponse =
        serde_json::from_value(value).map_err(|e| format!("Unexpected workflows response: {e}"))?;
    Ok(resp.workflows)
}

#[tauri::command]
async fn execute_workflow(workflow_ref: String) -> Result<String, String> {
    if workflow_ref.trim().is_empty() {
        return Err("No workflow selected.".to_string());
    }
    let body = serde_json::json!({ "workflow_ref": workflow_ref }).to_string();
    let value = tauri::async_runtime::spawn_blocking(move || {
        loom_request("POST", "/v1/workflows:execute", Some(body))
    })
    .await
    .map_err(|e| e.to_string())??;
    let resp: ExecuteWorkflowResponse =
        serde_json::from_value(value).map_err(|e| format!("Unexpected execute response: {e}"))?;
    Ok(resp.execution_id)
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
async fn list_artifacts() -> Result<Vec<Artifact>, String> {
    let value = tauri::async_runtime::spawn_blocking(|| {
        loom_request("GET", "/v1/artifacts", None)
    })
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
    if message.trim().is_empty() { return Err("Enter a message first.".into()); }
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
        let text = ["text", "response", "content", "reply", "message"].iter()
            .find_map(|key| value.get(key).and_then(|v| v.as_str()).filter(|v| !v.trim().is_empty()))
            .ok_or("Loom returned an empty response. Check its agent configuration.")?;
        let session_id = value
            .get("session_id")
            .or_else(|| value.get("sessionId"))
            .and_then(|v| v.as_str())
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.to_string());
        Ok(ChatReply { text: text.into(), source: "live".into(), card: None, session_id })
    }).await.map_err(|e| e.to_string())?
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
        return Err(format!("File is larger than 1 MB and was not opened: {}", target.display()));
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
    let requested = PathBuf::from(path);

    let (canon_root, canon_target) = if requested == root {
        (root.clone(), root.clone())
    } else {
        let canon_root = root.canonicalize().map_err(|e| format!("Workspace not found: {e}"))?;
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
            let path = work_file_path(app.handle());
            let store = WorkStore::load(path);
            let exp_path = experiments_file_path(app.handle());
            let exp_store = ExperimentStore::load(exp_path);
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
            list_workflow_executions,
            list_artifacts,
            get_experiments,
            add_experiment,
            add_experiment_arm,
            set_experiment_arm_status,
            set_experiment_arm_result,
            choose_experiment_arm,
            list_workspace,
            list_directory,
            read_file
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

#[allow(dead_code)]
fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
