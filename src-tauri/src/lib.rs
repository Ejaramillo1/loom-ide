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
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream};
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

/// Loom server address (built at runtime: `From` is not const-stable).
fn loom_addr() -> SocketAddr {
    SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 5006)
}

fn loom_reachable() -> bool {
    TcpStream::connect_timeout(&loom_addr(), Duration::from_millis(400)).is_ok()
}

#[tauri::command]
fn get_loom_status() -> LoomStatus {
    if loom_reachable() {
        LoomStatus {
            online: true,
            url: LOOM_HTTP_URL.to_string(),
            detail: "Loom server is reachable at localhost:5006.".to_string(),
        }
    } else {
        LoomStatus {
            online: false,
            url: LOOM_HTTP_URL.to_string(),
            detail: "Could not connect to localhost:5006 — is the Loom server running? Showing demonstration data.".to_string(),
        }
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

fn demo_reply(message: &str) -> ChatReply {
    if message.to_lowercase().contains("experiment") {
        ChatReply {
            text: "Sure. Based on the current findings, here's a proposal:".to_string(),
            source: "demonstration".to_string(),
            card: Some(ChatCard {
                title: "Experiment design".to_string(),
                detail: "Compare memory strategies".to_string(),
            }),
        }
    } else {
        ChatReply {
            text: "I can help with that once the Loom server is running. Right now I'm answering from demonstration data, so I can't run agents or read live traces.".to_string(),
            source: "demonstration".to_string(),
            card: None,
        }
    }
}

/// Best-effort raw HTTP POST to the Loom server (no extra dependencies).
/// Returns the reply text when the server answers with a JSON object
/// carrying a `reply`, `text`, `content` or `message` string field.
fn loom_weave(message: &str) -> Option<String> {
    let body = serde_json::json!({ "message": message }).to_string();
    let request = format!(
        "POST /v1/weave HTTP/1.1\r\nHost: localhost:5006\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let mut stream =
        TcpStream::connect_timeout(&loom_addr(), Duration::from_millis(500)).ok()?;
    stream
        .set_read_timeout(Some(Duration::from_millis(2500)))
        .ok()?;
    stream
        .set_write_timeout(Some(Duration::from_millis(500)))
        .ok()?;
    stream.write_all(request.as_bytes()).ok()?;
    let mut raw = String::new();
    stream.read_to_string(&mut raw).ok()?;
    let body_start = raw.find("\r\n\r\n").map(|i| i + 4)?;
    let json_text = &raw[body_start..];
    let value: serde_json::Value = serde_json::from_str(json_text).ok()?;
    for key in ["reply", "text", "content", "message"] {
        if let Some(s) = value.get(key).and_then(|v| v.as_str()) {
            if !s.trim().is_empty() {
                return Some(s.to_string());
            }
        }
    }
    None
}

#[tauri::command]
fn ask_loom(message: String) -> ChatReply {
    match loom_weave(&message) {
        Some(text) => ChatReply {
            text,
            source: "live".to_string(),
            card: None,
        },
        None => demo_reply(&message),
    }
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
