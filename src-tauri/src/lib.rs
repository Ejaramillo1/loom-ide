//! Loom IDE — Tauri backend.
//!
//! Work items persist as structured JSON on disk, like the existing
//! eframe app does. Collaboration steps and attention items are
//! demonstration data for now: the Loom server does not yet expose
//! step-by-step execution, and the UI labels them as such.
//!
//! Chat tries the real Loom server first (POST /v1/weave on
//! http://localhost:5006, the same endpoint the eframe app uses) and
//! falls back to a clearly labelled demonstration reply when the
//! server is not reachable. Nothing here fakes agent progress.

use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

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

pub struct AppState {
    work: Mutex<WorkStore>,
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

// ---------------------------------------------------------------------------
// Collaboration + attention (demonstration data — labelled in the UI)
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_collaboration() -> Vec<CollabStep> {
    store::seed_steps()
}

#[tauri::command]
fn get_attention() -> Vec<AttentionItem> {
    store::seed_attention()
}

// ---------------------------------------------------------------------------
// Loom server: presence probe + chat
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
struct LoomStatus {
    online: bool,
    url: String,
    detail: String,
}

const LOOM_HTTP_URL: &str = "http://localhost:5006";

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

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatCard {
    title: String,
    detail: String,
}

#[derive(Debug, Clone, Serialize)]
struct ChatReply {
    text: String,
    source: String, // "live" | "demonstration"
    card: Option<ChatCard>,
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
    let value: serde_json::Value = serde_json::from_slice(&payload).map_err(|e| format!("Invalid Loom response: {e}"))?;
    if !(200..300).contains(&status) {
        return Err(format!("Loom returned HTTP {status}: {}", value.get("message").and_then(|v| v.as_str()).unwrap_or("Request failed")));
    }
    Ok(value)
}

#[tauri::command]
async fn ask_loom(message: String) -> Result<ChatReply, String> {
    if message.trim().is_empty() { return Err("Enter a message first.".into()); }
    tauri::async_runtime::spawn_blocking(move || {
        let value = loom_request("POST", "/v1/weave", Some(serde_json::json!({ "query": message }).to_string()))?;
        let text = ["response", "reply", "text", "content", "message"].iter()
            .find_map(|key| value.get(key).and_then(|v| v.as_str()).filter(|v| !v.trim().is_empty()))
            .ok_or("Loom returned an empty response. Check its agent configuration.")?;
        Ok(ChatReply { text: text.into(), source: "live".into(), card: None })
    }).await.map_err(|e| e.to_string())?
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
            app.manage(AppState {
                work: Mutex::new(store),
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
            get_collaboration,
            get_attention,
            get_loom_status,
            ask_loom
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
