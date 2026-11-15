//! Loom IDE — Tauri backend.
//!
//! Three data sources, kept strictly separate:
//!
//! 1. Local, structured work items (`<app-data>/loom-ide/work.json`) and a
//!    user files in a separate workspace folder (Documents/Loom by default).
//! 2. The Loom server on localhost:5006: sessions and agents, and chat via
//!    `POST /v1/weave` with the selected session/agent.
//!
//! 3. Shared markdown knowledge in native-app/Research Vault, via knowledge.rs.
//!
//! Nothing here invents a reply or fakes progress. When the server is not
//! reachable, session/agent/chat commands fail and the UI shows the error.
//! The workspace explorer is local and works regardless of the server.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, State};

mod experiment;
mod knowledge;
#[path = "../../shared/navigation.rs"]
mod navigation;
use experiment::{Experiment, ExperimentStore};
mod loom_http;
mod loom_stream;
mod spatial;
mod store;
mod workspace;

#[tauri::command]
fn save_spatial_memory(object: String, body: String) -> Result<String, String> {
    let root = knowledge::default_root();
    spatial::save(&root, &object, &body)
}
#[tauri::command]
fn read_spatial_memory(object: String) -> Result<String, String> {
    let root = knowledge::default_root();
    spatial::read(&root, &object)
}
use store::{
    AcceptanceCriterion, AttentionItem, Intent, IntentStore, WorkItem, WorkStore, autonomy_rank,
};
use workspace::{WorkspaceInfo, WorkspaceStore};

#[cfg(test)]
mod gateway_tests;
#[cfg(test)]
mod workspace_tests;

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

fn workspace_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("loom-ide/workspace.json"))
        .map_err(|e| format!("Could not locate workspace settings: {e}"))
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

/// Where intents live on disk: <app-data>/loom-ide/intents.json
fn intents_file_path(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("loom-ide")
        .join("intents.json")
}

pub struct AppState {
    work: Mutex<WorkStore>,
    experiments: Mutex<ExperimentStore>,
    intents: Mutex<IntentStore>,
    workspace: Mutex<WorkspaceStore>,
}

// ---------------------------------------------------------------------------
// Work items
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_work_items(state: State<AppState>) -> Vec<WorkItem> {
    state.work.lock().unwrap_or_else(|e| e.into_inner()).items()
}

#[tauri::command]
fn add_work_item(
    title: String,
    intent_id: Option<String>,
    state: State<AppState>,
) -> Result<WorkItem, String> {
    // The title is validated before any intent is auto-created, so a bad
    // title cannot leave a stray one-line intent behind.
    if title.trim().is_empty() {
        return Err("Work item title cannot be empty".to_string());
    }
    // Lock order is ALWAYS intents first, then work (never the reverse).
    let mut intents = state.intents.lock().unwrap_or_else(|e| e.into_inner());
    // The intent this call auto-created, if any: deleted again if the
    // work save below fails, so a failed add leaves no orphan intent.
    let mut auto_created: Option<String> = None;
    let resolved: Intent = match intent_id {
        Some(id) => intents
            .get(&id)
            .ok_or_else(|| format!("Unknown intent: {id}"))?,
        None => match intents.active() {
            Some(intent) => intent,
            None => {
                // Rule 1: no work exists without an intent. A one-line
                // intent the person confirms (the work title) is created
                // and made active.
                let mut intent = intents.create(
                    title.trim().to_string(),
                    None,
                    Vec::new(),
                    Some("collaborative".to_string()),
                )?;
                auto_created = Some(intent.id.clone());
                if intents.active_id().as_deref() != Some(intent.id.as_str()) {
                    intent = match intents.set_active(&intent.id) {
                        Ok(intent) => intent,
                        Err(e) => {
                            let work = state.work.lock().unwrap_or_else(|e| e.into_inner());
                            let _ = intents.delete(&intent.id, &work);
                            return Err(e);
                        }
                    };
                }
                intent
            }
        },
    };
    let mut work = state.work.lock().unwrap_or_else(|e| e.into_inner());
    let created = (|| -> Result<WorkItem, String> {
        let mut item = work.add(title, Some(resolved.id.clone()))?;
        // Inheritance (rule 3): the work starts at the intent's autonomy.
        if resolved.autonomy != "collaborative" {
            item = work.set_autonomy(&item.id, &resolved.autonomy)?;
        }
        Ok(item)
    })();
    match created {
        Ok(item) => Ok(item),
        Err(e) => {
            if let Some(id) = auto_created {
                // The work save failed (and no work references the intent
                // yet, so delete refuses nothing): remove it again.
                let _ = intents.delete(&id, &work);
            }
            Err(e)
        }
    }
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
    justification: Option<String>,
    state: State<AppState>,
) -> Result<WorkItem, String> {
    let requested =
        autonomy_rank(&autonomy).ok_or_else(|| format!("Unknown autonomy level: {autonomy}"))?;
    // Lock order is ALWAYS intents first, then work (never the reverse).
    let intents = state.intents.lock().unwrap_or_else(|e| e.into_inner());
    let mut work = state.work.lock().unwrap_or_else(|e| e.into_inner());
    // Rule 3: a work item's autonomy can be tightened below its intent's
    // setting, never loosened above it without the person. Work items
    // with no intent (created before intents existed) are unaffected.
    let item = work
        .items()
        .into_iter()
        .find(|w| w.id == id)
        .ok_or_else(|| format!("Unknown work item: {id}"))?;
    let current_rank = autonomy_rank(&item.autonomy).unwrap_or(0);
    if let Some(intent_id) = &item.intent_id {
        if let Some(intent) = intents.get(intent_id) {
            let allowed = autonomy_rank(&intent.autonomy).unwrap_or(2);
            if requested > allowed {
                return Err(format!(
                    "Cannot raise this work item to \"{autonomy}\": its intent allows at most \"{}\". Loosen the intent's autonomy first, or pick a lower level for this work item.",
                    intent.autonomy
                ));
            }
        }
    }
    // Moving down (tightening) is always instant; moving up requires
    // justification — the system never grants itself more freedom.
    if requested > current_rank {
        let just = justification.as_deref().unwrap_or("").trim();
        if just.is_empty() {
            return Err(format!(
                "Raising autonomy from \"{}\" to \"{}\" requires a justification — why is more freedom needed?",
                item.autonomy, autonomy
            ));
        }
        work.autonomy_history_push(
            &id,
            &autonomy,
            justification.as_deref().map(|s| s.trim().to_string()),
        )?;
    }
    work.set_autonomy(&id, &autonomy)
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
// Intents (the primary object: what the person wants, why, what "done"
// means, and how much freedom the system has). One intent owns many
// pieces of work; no work exists without an intent.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
struct IntentsList {
    active_intent_id: Option<String>,
    intents: Vec<Intent>,
}

#[tauri::command]
fn get_intents(state: State<AppState>) -> IntentsList {
    let (active_intent_id, intents) = state
        .intents
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .list();
    IntentsList {
        active_intent_id,
        intents,
    }
}

#[tauri::command]
fn create_intent(
    statement: String,
    why: Option<String>,
    acceptance: Vec<AcceptanceCriterion>,
    autonomy: Option<String>,
    state: State<AppState>,
) -> Result<Intent, String> {
    state
        .intents
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .create(statement, why, acceptance, autonomy)
}

#[tauri::command]
fn update_intent(
    id: String,
    statement: Option<String>,
    why: Option<String>,
    autonomy: Option<String>,
    status: Option<String>,
    justification: Option<String>,
    state: State<AppState>,
) -> Result<Intent, String> {
    let updated = state
        .intents
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .update(&id, statement, why, autonomy.clone(), status, justification)?;
    // If the intent's autonomy was lowered, tighten any work items that
    // now exceed the new ceiling. Moving down is instant — no justification
    // needed, and the system does it automatically to preserve the rule.
    if let Some(a) = &autonomy {
        let new_rank = autonomy_rank(a).unwrap_or(0);
        let mut work = state.work.lock().unwrap_or_else(|e| e.into_inner());
        // The intent itself already updated above; a failure to tighten
        // a work item must not hide behind a success, so collect the
        // failures and report them instead of swallowing them.
        let mut failures: Vec<String> = Vec::new();
        for item in work.items() {
            if item.intent_id.as_deref() == Some(&id) {
                let item_rank = autonomy_rank(&item.autonomy).unwrap_or(0);
                if item_rank > new_rank {
                    // Record the automatic tightening in the work item's
                    // history, so the change is visible, not silent.
                    if let Err(e) = work.autonomy_history_push(
                        &item.id,
                        a,
                        Some(
                            "Tightened automatically: the intent's autonomy was lowered."
                                .to_string(),
                        ),
                    ) {
                        failures.push(format!("{}: {e}", item.id));
                        continue;
                    }
                    if let Err(e) = work.set_autonomy(&item.id, a) {
                        failures.push(format!("{}: {e}", item.id));
                    }
                }
            }
        }
        if !failures.is_empty() {
            return Err(format!(
                "Intent updated, but some work items could not be tightened: {}",
                failures.join("; ")
            ));
        }
    }
    Ok(updated)
}

#[tauri::command]
fn set_intent_acceptance(
    id: String,
    criteria: Vec<AcceptanceCriterion>,
    state: State<AppState>,
) -> Result<Intent, String> {
    state
        .intents
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .set_acceptance(&id, criteria)
}

#[tauri::command]
fn set_active_intent(id: String, state: State<AppState>) -> Result<Intent, String> {
    state
        .intents
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .set_active(&id)
}

#[tauri::command]
fn delete_intent(id: String, state: State<AppState>) -> Result<bool, String> {
    // Lock order is ALWAYS intents first, then work (never the reverse):
    // delete refuses when work still references the intent.
    let mut intents = state.intents.lock().unwrap_or_else(|e| e.into_inner());
    let work = state.work.lock().unwrap_or_else(|e| e.into_inner());
    intents.delete(&id, &work)
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
// Attention (derived locally until the Loom server exposes attention items)
// ---------------------------------------------------------------------------

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
    #[serde(default)]
    pub error: String,
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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

#[derive(Debug, Deserialize)]
struct ToolListResponse {
    #[serde(default)]
    tools: Vec<ToolDefinition>,
}

#[derive(Debug, Deserialize)]
struct ModelListResponse {
    #[serde(default)]
    models: Vec<ModelInfo>,
}

#[derive(Debug, Deserialize)]
struct ProviderListResponse {
    #[serde(default)]
    providers: Vec<ProviderEntry>,
    #[serde(default, alias = "activeProvider")]
    active_provider: String,
}

impl ProviderListResponse {
    fn into_entries(self) -> Vec<ProviderEntry> {
        self.providers
            .into_iter()
            .map(|mut entry| {
                entry.active =
                    !self.active_provider.is_empty() && entry.name == self.active_provider;
                entry
            })
            .collect()
    }
}

#[derive(Debug, Deserialize)]
struct GetArtifactResponse {
    #[serde(default)]
    artifact: Artifact,
}

#[derive(Debug, Deserialize)]
struct GetArtifactContentResponse {
    #[serde(default)]
    content: serde_json::Value,
    #[serde(default)]
    encoding: String,
}

impl GetArtifactContentResponse {
    fn decode(self) -> Result<String, String> {
        // protojson always base64-encodes bytes. The handler adds an inner
        // base64 layer for binary content, so that encoding needs two decodes.
        let encoded = match self.content {
            serde_json::Value::String(content) => content,
            // protojson omits an empty bytes field.
            serde_json::Value::Null => String::new(),
            _ => return Err("Artifact content had an unexpected format.".into()),
        };
        let mut bytes = decode_base64(&encoded)?;
        if self.encoding == "base64" {
            let inner = std::str::from_utf8(&bytes)
                .map_err(|e| format!("Invalid inner base64 content: {e}"))?;
            bytes = decode_base64(inner)?;
        }
        match String::from_utf8(bytes) {
            Ok(text) => Ok(text),
            Err(error) => Ok(encode_base64(error.as_bytes())),
        }
    }
}

// RFC 4648 standard alphabet, as emitted by Go's protojson and artifact handler.
const BASE64_ALPHABET: &[u8; 64] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn decode_base64(encoded: &str) -> Result<Vec<u8>, String> {
    let invalid = || "Artifact content contains invalid base64.".to_string();
    if encoded.len() % 4 != 0 {
        return Err(invalid());
    }
    let mut bytes = Vec::with_capacity(encoded.len() / 4 * 3);
    for (index, chunk) in encoded.as_bytes().chunks_exact(4).enumerate() {
        let padding = if chunk[2] == b'=' {
            2
        } else if chunk[3] == b'=' {
            1
        } else {
            0
        };
        if padding > 0 && (chunk[3] != b'=' || (index + 1) * 4 != encoded.len()) {
            return Err(invalid());
        }
        let mut value = 0u32;
        for (position, byte) in chunk.iter().enumerate() {
            let digit = if position >= 4 - padding {
                0
            } else {
                BASE64_ALPHABET
                    .iter()
                    .position(|candidate| candidate == byte)
                    .ok_or_else(invalid)? as u32
            };
            value = (value << 6) | digit;
        }
        // Padding must not hide nonzero trailing bits.
        if (padding == 2 && value & 0xffff != 0) || (padding == 1 && value & 0xff != 0) {
            return Err(invalid());
        }
        bytes.push((value >> 16) as u8);
        if padding < 2 {
            bytes.push((value >> 8) as u8);
        }
        if padding == 0 {
            bytes.push(value as u8);
        }
    }
    Ok(bytes)
}

fn encode_base64(bytes: &[u8]) -> String {
    let mut encoded = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let value = ((chunk[0] as u32) << 16)
            | ((chunk.get(1).copied().unwrap_or(0) as u32) << 8)
            | chunk.get(2).copied().unwrap_or(0) as u32;
        encoded.push(BASE64_ALPHABET[(value >> 18) as usize] as char);
        encoded.push(BASE64_ALPHABET[((value >> 12) & 63) as usize] as char);
        encoded.push(if chunk.len() > 1 {
            BASE64_ALPHABET[((value >> 6) & 63) as usize] as char
        } else {
            '='
        });
        encoded.push(if chunk.len() > 2 {
            BASE64_ALPHABET[(value & 63) as usize] as char
        } else {
            '='
        });
    }
    encoded
}

#[derive(Debug, Deserialize)]
struct SearchArtifactsResponse {
    #[serde(default)]
    artifacts: Vec<Artifact>,
}

/// Detailed session (GET /v1/sessions/{session_id}).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionDetail {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub backend: String,
    #[serde(default, alias = "createdAt", deserialize_with = "de_i64")]
    pub created_at: i64,
    #[serde(default, alias = "updatedAt", deserialize_with = "de_i64")]
    pub updated_at: i64,
    #[serde(default)]
    pub state: String,
    #[serde(default, alias = "totalCostUsd")]
    pub total_cost_usd: f64,
    #[serde(default, alias = "conversationCount")]
    pub conversation_count: i32,
    #[serde(default)]
    pub metadata: HashMap<String, String>,
    #[serde(default, alias = "agentId")]
    pub agent_id: String,
    #[serde(default, alias = "agentName")]
    pub agent_name: String,
    #[serde(default, alias = "startedAt")]
    pub started_at: String,
    #[serde(default, alias = "endedAt")]
    pub ended_at: String,
    #[serde(default, alias = "metadataStatus")]
    pub metadata_status: String,
    #[serde(default, alias = "artifactCount")]
    pub artifact_count: i32,
}

/// A tool definition from Loom (GET /v1/tools).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default, alias = "inputSchemaJson")]
    pub input_schema_json: String,
    #[serde(default, alias = "outputSchemaJson")]
    pub output_schema_json: String,
    #[serde(default)]
    pub backends: Vec<String>,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub providers: Vec<String>,
}

/// An execution trace (GET /v1/traces/{trace_id}).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trace {
    #[serde(default)]
    pub id: String,
    #[serde(default, alias = "sessionId")]
    pub session_id: String,
    #[serde(default, alias = "rootSpan")]
    pub root_span: Option<TraceSpan>,
    #[serde(default)]
    pub spans: Vec<TraceSpan>,
    #[serde(default, alias = "totalDurationMs", deserialize_with = "de_i64")]
    pub total_duration_ms: i64,
}

/// A trace span.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceSpan {
    #[serde(default)]
    pub id: String,
    #[serde(default, alias = "parentId")]
    pub parent_id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default, alias = "startTimeUs", deserialize_with = "de_i64")]
    pub start_time_us: i64,
    #[serde(default, alias = "endTimeUs", deserialize_with = "de_i64")]
    pub end_time_us: i64,
    #[serde(default, alias = "durationUs", deserialize_with = "de_i64")]
    pub duration_us: i64,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub attributes: HashMap<String, String>,
}

/// An LLM model (GET /v1/models).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub provider: String,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default, alias = "contextWindow")]
    pub context_window: i32,
    #[serde(default, alias = "costPer1mInputUsd")]
    pub cost_per_1m_input_usd: f64,
    #[serde(default, alias = "costPer1mOutputUsd")]
    pub cost_per_1m_output_usd: f64,
    #[serde(default)]
    pub available: bool,
    #[serde(default, alias = "maxOutputTokens")]
    pub max_output_tokens: i32,
    #[serde(default, alias = "isReasoning")]
    pub is_reasoning: bool,
    #[serde(default, alias = "showInDropdown")]
    pub show_in_dropdown: bool,
}

/// A named provider (GET /v1/providers).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderEntry {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub config: LLMConfig,
    /// Derived from ListProvidersResponse.active_provider, never from an entry.
    #[serde(skip_deserializing)]
    pub active: bool,
}

/// Provider fields used by the inspector from the nested LLMConfig message.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LLMConfig {
    #[serde(default)]
    pub provider: String,
    #[serde(default)]
    pub model: String,
}

/// Artifact stats (GET /v1/artifacts/stats).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactStats {
    #[serde(default, alias = "totalFiles")]
    pub total_files: i32,
    #[serde(default, alias = "totalSizeBytes", deserialize_with = "de_i64")]
    pub total_size_bytes: i64,
    #[serde(default, alias = "userFiles")]
    pub user_files: i32,
    #[serde(default, alias = "generatedFiles")]
    pub generated_files: i32,
    #[serde(default, alias = "deletedFiles")]
    pub deleted_files: i32,
}

/// Server configuration (GET /v1/server/config).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    #[serde(default)]
    pub name: String,
    pub network: Option<NetworkConfig>,
    pub tls: Option<TlsConfig>,
    pub behavior: Option<ServerBehavior>,
    #[serde(default)]
    pub metadata: HashMap<String, String>,
    pub storage: Option<ServerStorageConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig {
    #[serde(default, alias = "grpcAddress")]
    pub grpc_address: String,
    #[serde(default, alias = "httpAddress")]
    pub http_address: String,
    #[serde(default, alias = "httpEnabled")]
    pub http_enabled: bool,
    #[serde(default, alias = "reflectionEnabled")]
    pub reflection_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TlsConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerBehavior {
    #[serde(default, alias = "maxConcurrentRequests")]
    pub max_concurrent_requests: i32,
    #[serde(default, alias = "requestTimeoutSeconds")]
    pub request_timeout_seconds: i32,
    #[serde(default, alias = "gracefulShutdown")]
    pub graceful_shutdown: bool,
    #[serde(default, alias = "shutdownTimeoutSeconds")]
    pub shutdown_timeout_seconds: i32,
    #[serde(default, alias = "corsEnabled")]
    pub cors_enabled: bool,
    #[serde(default, alias = "corsAllowedOrigins")]
    pub cors_allowed_origins: Vec<String>,
}

/// Only the storage backend is shown; connection credentials stay out of the UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStorageConfig {
    #[serde(default)]
    pub backend: String,
}

#[derive(Debug, Deserialize)]
struct StorageStatusResponse {
    status: StorageStatus,
}

/// Storage status (GET /v1/server/storage).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStatus {
    #[serde(default)]
    pub backend: String,
    #[serde(default)]
    pub healthy: bool,
    #[serde(default)]
    pub error: String,
    #[serde(default, alias = "latencyMs", deserialize_with = "de_i64")]
    pub latency_ms: i64,
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
    // The trace id the server reports, when tracing is enabled — the
    // handle for the observability surface (GetTrace).
    trace_id: Option<String>,
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

// Parse a `Content-Length` value out of an HTTP response head, if one is
// present and numeric. Returns None when the header is absent or invalid,
// in which case callers fall back to reading until EOF.
fn parse_content_length(head: &str) -> Option<usize> {
    head.lines().find_map(|line| {
        let (name, value) = line.split_once(':')?;
        if name.trim().eq_ignore_ascii_case("content-length") {
            value.trim().parse().ok()
        } else {
            None
        }
    })
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
                // Stop as soon as the whole body is here: with a
                // Content-Length the server need not close the
                // connection first. Chunked bodies have no usable
                // length, so they still read to EOF.
                if let Some(end) = raw.windows(4).position(|w| w == b"\r\n\r\n") {
                    let head = String::from_utf8_lossy(&raw[..end]);
                    if !head
                        .to_ascii_lowercase()
                        .contains("transfer-encoding: chunked")
                    {
                        if let Some(len) = parse_content_length(&head) {
                            if raw.len() >= end + 4 + len {
                                break;
                            }
                        }
                    }
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
            obj.insert("agentId".into(), a.into());
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
    let body = serde_json::json!({ "workflowRef": workflow_ref }).to_string();
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
        loom_request("GET", "/v1/workflows/executions?limit=500", None)
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

/// Get details of a single session (GET /v1/sessions/{session_id}).
#[tauri::command]
async fn get_session(session_id: String) -> Result<SessionDetail, String> {
    if session_id.trim().is_empty() {
        return Err("No session selected.".to_string());
    }
    let value = tauri::async_runtime::spawn_blocking(move || {
        loom_request(
            "GET",
            &format!("/v1/sessions/{}", percent_encode(&session_id)),
            None,
        )
    })
    .await
    .map_err(|e| e.to_string())??;
    serde_json::from_value(value).map_err(|e| format!("Unexpected session response: {e}"))
}

/// List all registered tools (GET /v1/tools).
#[tauri::command]
async fn list_tools() -> Result<Vec<ToolDefinition>, String> {
    let value = tauri::async_runtime::spawn_blocking(|| loom_request("GET", "/v1/tools", None))
        .await
        .map_err(|e| e.to_string())??;
    let resp: ToolListResponse =
        serde_json::from_value(value).map_err(|e| format!("Unexpected tools response: {e}"))?;
    Ok(resp.tools)
}

/// Get an execution trace (GET /v1/traces/{trace_id}).
#[tauri::command]
async fn get_trace(trace_id: String) -> Result<Trace, String> {
    if trace_id.trim().is_empty() {
        return Err("No trace ID provided.".to_string());
    }
    let value = tauri::async_runtime::spawn_blocking(move || {
        loom_request(
            "GET",
            &format!("/v1/traces/{}", percent_encode(&trace_id)),
            None,
        )
    })
    .await
    .map_err(|e| e.to_string())??;
    serde_json::from_value(value).map_err(|e| format!("Unexpected trace response: {e}"))
}

/// Get details of a single agent (GET /v1/agents/{agent_id}).
#[tauri::command]
async fn get_agent(agent_id: String) -> Result<Agent, String> {
    if agent_id.trim().is_empty() {
        return Err("No agent selected.".to_string());
    }
    let value = tauri::async_runtime::spawn_blocking(move || {
        loom_request(
            "GET",
            &format!("/v1/agents/{}", percent_encode(&agent_id)),
            None,
        )
    })
    .await
    .map_err(|e| e.to_string())??;
    serde_json::from_value(value).map_err(|e| format!("Unexpected agent response: {e}"))
}

/// List available LLM models (GET /v1/models).
#[tauri::command]
async fn list_models() -> Result<Vec<ModelInfo>, String> {
    let value = tauri::async_runtime::spawn_blocking(|| loom_request("GET", "/v1/models", None))
        .await
        .map_err(|e| e.to_string())??;
    let resp: ModelListResponse =
        serde_json::from_value(value).map_err(|e| format!("Unexpected models response: {e}"))?;
    Ok(resp.models)
}

/// List named LLM providers (GET /v1/providers).
#[tauri::command]
async fn list_providers() -> Result<Vec<ProviderEntry>, String> {
    let value = tauri::async_runtime::spawn_blocking(|| loom_request("GET", "/v1/providers", None))
        .await
        .map_err(|e| e.to_string())??;
    let resp: ProviderListResponse =
        serde_json::from_value(value).map_err(|e| format!("Unexpected providers response: {e}"))?;
    Ok(resp.into_entries())
}

/// Switch the LLM model for a session (POST /v1/sessions/{session_id}:switch-model).
#[tauri::command]
async fn switch_model(
    session_id: String,
    provider: Option<String>,
    model: Option<String>,
) -> Result<serde_json::Value, String> {
    if session_id.trim().is_empty() {
        return Err("No session selected.".to_string());
    }
    let provider = provider
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty());
    let model = model
        .map(|m| m.trim().to_string())
        .filter(|m| !m.is_empty());
    if provider.is_none() && model.is_none() {
        return Err("Choose a provider, a model, or both before switching.".to_string());
    }
    let mut obj = serde_json::Map::new();
    if let Some(p) = provider {
        obj.insert("provider".into(), p.into());
    }
    if let Some(m) = model {
        obj.insert("model".into(), m.into());
    }
    let body = serde_json::Value::Object(obj).to_string();
    let value = tauri::async_runtime::spawn_blocking(move || {
        loom_request(
            "POST",
            &format!("/v1/sessions/{}:switch-model", percent_encode(&session_id)),
            Some(body),
        )
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(value)
}

/// Get artifact details (GET /v1/artifacts/{id}).
#[tauri::command]
async fn get_artifact(artifact_id: String) -> Result<Artifact, String> {
    if artifact_id.trim().is_empty() {
        return Err("No artifact selected.".to_string());
    }
    let value = tauri::async_runtime::spawn_blocking(move || {
        loom_request(
            "GET",
            &format!("/v1/artifacts/{}", percent_encode(&artifact_id)),
            None,
        )
    })
    .await
    .map_err(|e| e.to_string())??;
    let resp: GetArtifactResponse =
        serde_json::from_value(value).map_err(|e| format!("Unexpected artifact response: {e}"))?;
    Ok(resp.artifact)
}

/// Read artifact file content (GET /v1/artifacts/{id}/content).
#[tauri::command]
async fn get_artifact_content(
    artifact_id: String,
    encoding: Option<String>,
) -> Result<String, String> {
    if artifact_id.trim().is_empty() {
        return Err("No artifact selected.".to_string());
    }
    let mut path = format!("/v1/artifacts/{}/content", percent_encode(&artifact_id));
    if let Some(e) = encoding {
        if !e.trim().is_empty() {
            path.push_str(&format!("?encoding={}", percent_encode(&e)));
        }
    }
    let value = tauri::async_runtime::spawn_blocking(move || loom_request("GET", &path, None))
        .await
        .map_err(|e| e.to_string())??;
    let resp: GetArtifactContentResponse = serde_json::from_value(value)
        .map_err(|e| format!("Unexpected artifact content response: {e}"))?;
    resp.decode()
}

/// Search artifacts (GET /v1/artifacts:search).
#[tauri::command]
async fn search_artifacts(query: String) -> Result<Vec<Artifact>, String> {
    if query.trim().is_empty() {
        return Err("No search query provided.".to_string());
    }
    let path = format!(
        "/v1/artifacts:search?query={}&limit=200",
        percent_encode(&query.trim())
    );
    let value = tauri::async_runtime::spawn_blocking(move || loom_request("GET", &path, None))
        .await
        .map_err(|e| e.to_string())??;
    let resp: SearchArtifactsResponse =
        serde_json::from_value(value).map_err(|e| format!("Unexpected search response: {e}"))?;
    Ok(resp.artifacts)
}

/// Get artifact storage statistics (GET /v1/artifacts/stats).
#[tauri::command]
async fn get_artifact_stats() -> Result<ArtifactStats, String> {
    let value =
        tauri::async_runtime::spawn_blocking(|| loom_request("GET", "/v1/artifacts/stats", None))
            .await
            .map_err(|e| e.to_string())??;
    serde_json::from_value(value).map_err(|e| format!("Unexpected artifact stats response: {e}"))
}

/// Get server configuration (GET /v1/server/config).
#[tauri::command]
async fn get_server_config() -> Result<ServerConfig, String> {
    let value =
        tauri::async_runtime::spawn_blocking(|| loom_request("GET", "/v1/server/config", None))
            .await
            .map_err(|e| e.to_string())??;
    serde_json::from_value(value).map_err(|e| format!("Unexpected server config response: {e}"))
}

/// Get storage backend status (GET /v1/server/storage).
#[tauri::command]
async fn get_storage_status() -> Result<StorageStatus, String> {
    let value =
        tauri::async_runtime::spawn_blocking(|| loom_request("GET", "/v1/server/storage", None))
            .await
            .map_err(|e| e.to_string())??;
    let resp: StorageStatusResponse = serde_json::from_value(value)
        .map_err(|e| format!("Unexpected storage status response: {e}"))?;
    Ok(resp.status)
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
            obj.insert("sessionId".into(), s.into());
        }
    }
    if let Some(a) = agent_id {
        if !a.trim().is_empty() {
            obj.insert("agentId".into(), a.into());
        }
    }
    obj.insert("enableTrace".into(), serde_json::Value::Bool(true));
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
        let trace_id = value
            .get("trace_id")
            .or_else(|| value.get("traceId"))
            .and_then(|v| v.as_str())
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.to_string());
        Ok(ChatReply {
            text: text.into(),
            source: "live".into(),
            card: None,
            session_id,
            trace_id,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------------------------------------------------------------------------
// Workspace explorer (local filesystem; independent of the Loom server)
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_workspace(state: State<AppState>) -> WorkspaceInfo {
    state
        .workspace
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .info()
}

#[tauri::command]
fn open_workspace(path: String, state: State<AppState>) -> Result<WorkspaceInfo, String> {
    state
        .workspace
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .open(&path)
}

#[derive(Debug, Clone, Serialize)]
struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
}

/// List a directory's entries: directories first, then files, each
/// alphabetically. Include dotfiles so files such as .gitignore are visible.
fn list_dir_entries(dir: &Path) -> Result<Vec<DirEntry>, String> {
    let read = std::fs::read_dir(dir).map_err(|e| format!("Cannot read {}: {e}", dir.display()))?;
    let mut out: Vec<DirEntry> = Vec::new();
    for entry in read.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
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
fn list_workspace(state: State<AppState>) -> Result<Vec<DirEntry>, String> {
    list_dir_entries(
        state
            .workspace
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .root(),
    )
}

#[tauri::command]
fn list_directory(path: String, state: State<AppState>) -> Result<Vec<DirEntry>, String> {
    let workspace = state.workspace.lock().unwrap_or_else(|e| e.into_inner());
    let target = workspace::resolve(workspace.root(), &path)?;
    if !target.is_dir() {
        return Err(format!("Not a directory: {}", target.display()));
    }
    list_dir_entries(&target)
}

/// Create a single entry without replacing anything that already exists.
fn create_workspace_entry_at(
    root: &Path,
    parent: &str,
    name: &str,
    is_dir: bool,
) -> Result<DirEntry, String> {
    let name = name.trim();
    if name.is_empty()
        || name == "."
        || name == ".."
        || name.contains(['/', '\\'])
        || name.chars().any(char::is_control)
    {
        return Err(
            "Enter a file or folder name without path separators or control characters.".into(),
        );
    }
    let root = root
        .canonicalize()
        .map_err(|e| format!("Workspace not found: {e}"))?;
    let requested = Path::new(parent);
    let parent = if requested.is_absolute() {
        requested.to_path_buf()
    } else {
        root.join(requested)
    };
    let parent = parent
        .canonicalize()
        .map_err(|e| format!("Cannot open destination folder: {e}"))?;
    if !parent.starts_with(&root) {
        return Err("Destination is outside the workspace.".into());
    }
    if !parent.is_dir() {
        return Err("Destination is not a folder.".into());
    }
    let target = parent.join(name);
    let result = if is_dir {
        std::fs::create_dir(&target)
    } else {
        std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)
            .map(|_| ())
    };
    result.map_err(|e| {
        if e.kind() == std::io::ErrorKind::AlreadyExists {
            format!("An entry named \"{name}\" already exists in this folder.")
        } else {
            format!("Could not create \"{name}\": {e}")
        }
    })?;
    Ok(DirEntry {
        name: name.into(),
        path: target.display().to_string(),
        is_dir,
    })
}

#[tauri::command]
fn create_workspace_file(
    parent: String,
    name: String,
    state: State<AppState>,
) -> Result<DirEntry, String> {
    create_workspace_entry_at(
        state
            .workspace
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .root(),
        &parent,
        &name,
        false,
    )
}

#[tauri::command]
fn create_workspace_directory(
    parent: String,
    name: String,
    state: State<AppState>,
) -> Result<DirEntry, String> {
    create_workspace_entry_at(
        state
            .workspace
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .root(),
        &parent,
        &name,
        true,
    )
}

#[tauri::command]
fn read_file(path: String, state: State<AppState>) -> Result<String, String> {
    let workspace = state.workspace.lock().unwrap_or_else(|e| e.into_inner());
    workspace::read_text(workspace.root(), &path)
}

#[tauri::command]
fn write_file(
    path: String,
    content: String,
    original: String,
    state: State<AppState>,
) -> Result<(), String> {
    let workspace = state.workspace.lock().unwrap_or_else(|e| e.into_inner());
    workspace::write_text(workspace.root(), &path, &content, &original)
}

// ---------------------------------------------------------------------------
// App entry
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let instance = match navigation::Instance::claim(navigation::TAURI) {
        Ok(Some(instance)) => instance,
        Ok(None) => return,
        Err(error) => {
            eprintln!("{error}");
            return;
        }
    };
    tauri::Builder::default()
        .setup(move |app| {
            let handle = app.handle().clone();
            instance.serve(move || {
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            });
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
            let int_path = intents_file_path(app.handle());
            let int_store = IntentStore::load(int_path)?;
            let workspace_settings = workspace_settings_path(app.handle())?;
            let documents = app.handle().path().document_dir()
                .map_err(|e| format!("Could not locate your Documents folder: {e}"))?;
            let workspace_store = WorkspaceStore::load(workspace_settings, documents.join("Loom"))?;
            app.manage(AppState {
                work: Mutex::new(store),
                experiments: Mutex::new(exp_store),
                intents: Mutex::new(int_store),
                workspace: Mutex::new(workspace_store),
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
            knowledge::knowledge_list,
            knowledge::knowledge_read,
            knowledge::knowledge_create,
            knowledge::knowledge_save,
            knowledge::knowledge_relate,
            knowledge::knowledge_review,
            knowledge::knowledge_archive,
            knowledge::knowledge_restore,
            knowledge::knowledge_export_canvas,
            knowledge::knowledge_sync_from_loom,
            knowledge::knowledge_signature,
            knowledge::knowledge_canvas_layout_save,
            knowledge::knowledge_canvas_layout_load,
            save_spatial_memory,
            read_spatial_memory,
            get_work_items,
            add_work_item,
            set_work_status,
            set_work_autonomy,
            set_work_session,
            set_work_success_criteria,
            set_work_artifacts,
            get_intents,
            create_intent,
            update_intent,
            set_intent_acceptance,
            set_active_intent,
            delete_intent,
            get_attention,
            get_loom_status,
            ask_loom,
            loom_stream::ask_loom_stream,
            loom_stream::cancel_loom_stream,
            loom_stream::answer_clarification,
            loom_http::mcp_servers_list,
            loom_http::mcp_server_get,
            loom_http::mcp_server_add,
            loom_http::mcp_server_update,
            loom_http::mcp_server_delete,
            loom_http::mcp_server_restart,
            loom_http::mcp_servers_health_check,
            loom_http::mcp_server_test,
            loom_http::mcp_server_tools,
            loom_http::agent_create,
            loom_http::agent_start,
            loom_http::agent_stop,
            loom_http::agent_reload,
            loom_http::agent_delete,
            loom_http::agent_presets_list,
            loom_http::workflow_templates_list,
            loom_http::patterns_list,
            loom_http::pattern_get,
            loom_http::pattern_create,
            loom_http::patterns_load,
            loom_http::apps_list,
            loom_http::session_delete,
            loom_http::session_resume,
            loom_http::session_resolve_gap,
            loom_http::tool_permission_request,
            list_sessions,
            create_session,
            list_agents,
            get_session_history,
            list_workflows,
            execute_workflow,
            get_workflow_execution,
            list_workflow_executions,
            list_artifacts,
            get_session,
            list_tools,
            get_trace,
            get_agent,
            list_models,
            list_providers,
            switch_model,
            get_artifact,
            get_artifact_content,
            search_artifacts,
            get_artifact_stats,
            get_server_config,
            get_storage_status,
            get_experiments,
            add_experiment,
            add_experiment_arm,
            set_experiment_arm_status,
            set_experiment_arm_result,
            choose_experiment_arm,
            clear_experiment_decision,
            get_workspace,
            open_workspace,
            list_workspace,
            list_directory,
            create_workspace_file,
            create_workspace_directory,
            read_file,
            write_file
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------------
    // de_i64: the gateway sends every int64 as a JSON string.
    // ------------------------------------------------------------------

    #[derive(Debug, Deserialize)]
    struct I64Holder {
        #[serde(default, deserialize_with = "de_i64")]
        v: i64,
    }

    fn parse_i64(json: &str) -> Result<i64, String> {
        serde_json::from_str::<I64Holder>(json)
            .map(|h| h.v)
            .map_err(|e| e.to_string())
    }

    #[test]
    fn de_i64_accepts_number_and_string_forms() {
        assert_eq!(parse_i64(r#"{"v": 42}"#).unwrap(), 42);
        assert_eq!(parse_i64(r#"{"v": "3600"}"#).unwrap(), 3600);
        assert_eq!(parse_i64(r#"{"v": -5}"#).unwrap(), -5);
        assert_eq!(parse_i64(r#"{"v": "-5"}"#).unwrap(), -5);
        assert_eq!(parse_i64(r#"{"v": 0}"#).unwrap(), 0);
    }

    #[test]
    fn de_i64_rejects_floats_bools_and_garbage() {
        // A float must fail: this is the trap that mistyped total_cost_usd
        // fell into (proto double read through de_i64).
        assert!(parse_i64(r#"{"v": 0.05}"#).is_err());
        assert!(parse_i64(r#"{"v": true}"#).is_err());
        assert!(parse_i64(r#"{"v": "abc"}"#).is_err());
        assert!(parse_i64(r#"{"v": null}"#).is_err());
        // Out of range for i64.
        assert!(parse_i64(r#"{"v": 18446744073709551615}"#).is_err());
    }

    #[test]
    fn de_i64_missing_key_defaults_to_zero() {
        assert_eq!(parse_i64(r#"{}"#).unwrap(), 0);
    }

    // ------------------------------------------------------------------
    // parse_content_length (loom_http_raw stops reading once the body
    // is complete instead of waiting for EOF)
    // ------------------------------------------------------------------

    #[test]
    fn parse_content_length_finds_the_header_and_ignores_the_rest() {
        let head = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 42";
        assert_eq!(parse_content_length(head), Some(42));
        let head = "HTTP/1.1 200 OK\r\ncontent-length: 0";
        assert_eq!(parse_content_length(head), Some(0));
        let head = "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked";
        assert_eq!(parse_content_length(head), None);
        let head = "HTTP/1.1 200 OK\r\nContent-Length: not-a-number";
        assert_eq!(parse_content_length(head), None);
    }

    // ------------------------------------------------------------------
    // percent_encode (ids interpolated into request paths)
    // ------------------------------------------------------------------

    #[test]
    fn percent_encode_keeps_unreserved_and_escapes_the_rest() {
        assert_eq!(percent_encode("abc-_.~123"), "abc-_.~123");
        assert_eq!(percent_encode("hello world"), "hello%20world");
        assert_eq!(percent_encode("a/b?c=d&e"), "a%2Fb%3Fc%3Dd%26e");
        assert_eq!(percent_encode("sess:1"), "sess%3A1");
        assert_eq!(percent_encode(""), "");
    }

    // ------------------------------------------------------------------
    // Wire format: gateway-shaped JSON (camelCase keys, int64 as strings).
    // Existing response structs retain their gateway compatibility. The
    // newer response shapes and content decoding are tested in gateway_tests.
    // ------------------------------------------------------------------

    #[test]
    fn session_parses_gateway_json_camel_and_snake_case() {
        let camel = r#"{"id":"s-1","name":"Main","state":"active","agentId":"a-1","agentName":"Weaver","updatedAt":"1720000000","conversationCount":3}"#;
        let s: Session = serde_json::from_str(camel).unwrap();
        assert_eq!(s.id, "s-1");
        assert_eq!(s.agent_id, "a-1");
        assert_eq!(s.agent_name, "Weaver");
        assert_eq!(s.updated_at, 1_720_000_000);
        assert_eq!(s.conversation_count, 3);
        // protojson also accepts the proto field names; the aliases must
        // not break that.
        let snake = r#"{"id":"s-1","agent_id":"a-1","agent_name":"Weaver","updated_at":"1720000000","conversation_count":3}"#;
        let s2: Session = serde_json::from_str(snake).unwrap();
        assert_eq!(s2.agent_id, "a-1");
        assert_eq!(s2.updated_at, 1_720_000_000);
    }

    #[test]
    fn agent_parses_gateway_json() {
        let json = r#"{"id":"a-1","name":"Weaver","status":"active","uptimeSeconds":"3600","activeSessions":2,"totalMessages":"123"}"#;
        let a: Agent = serde_json::from_str(json).unwrap();
        assert_eq!(a.uptime_seconds, 3600);
        assert_eq!(a.active_sessions, 2);
        assert_eq!(a.total_messages, 123);
    }

    #[test]
    fn workflow_execution_parses_gateway_json() {
        let json = r#"{"id":"e-1","status":"completed","startedAt":"1720000000","completedAt":"1720000300","error":"","result":{"merged_output":"ok"}}"#;
        let e: WorkflowExecution = serde_json::from_str(json).unwrap();
        assert_eq!(e.started_at, 1_720_000_000);
        assert_eq!(e.completed_at, 1_720_000_300);
        assert!(e.result.is_some());
    }

    #[test]
    fn artifact_parses_gateway_json() {
        let json = r#"{"id":"art-1","name":"notes.md","purpose":"notes","source":"session","createdAt":"1720000000","sessionId":"s-1"}"#;
        let a: Artifact = serde_json::from_str(json).unwrap();
        assert_eq!(a.created_at, 1_720_000_000);
        assert_eq!(a.session_id, "s-1");
    }

    #[test]
    fn sessions_and_agents_wrappers_parse() {
        let sessions = r#"{"sessions":[{"id":"s-1","updatedAt":"1720000000"}]}"#;
        let r: SessionsResponse = serde_json::from_str(sessions).unwrap();
        assert_eq!(r.sessions.len(), 1);
        assert_eq!(r.sessions[0].updated_at, 1_720_000_000);
        let agents = r#"{"agents":[{"id":"a-1","uptimeSeconds":"60"}]}"#;
        let r: AgentsResponse = serde_json::from_str(agents).unwrap();
        assert_eq!(r.agents[0].uptime_seconds, 60);
    }
}
