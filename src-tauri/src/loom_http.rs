//! Loom HTTP surfaces the IDE had not wired before: MCP server management,
//! agent lifecycle, patterns, embedded apps, presets/templates and session
//! completeness. All of these are HTTP-bound in Loom v1.4.0, so no transport
//! decision is needed — the frontend gets real typed commands over the same
//! raw HTTP client the rest of the backend uses.
//!
//! gRPC-only services (tasks, graph memory, judge, skills import, …) stay
//! unwired until the Phase 5 transport decision is made; nothing here fakes
//! them.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{loom_request, percent_encode};

async fn loom_get(path: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || loom_request("GET", &path, None))
        .await
        .map_err(|e| e.to_string())?
}

async fn loom_send(
    method: &'static str,
    path: String,
    body: Option<Value>,
) -> Result<Value, String> {
    let body = body.map(|b| b.to_string());
    tauri::async_runtime::spawn_blocking(move || loom_request(method, &path, body))
        .await
        .map_err(|e| e.to_string())?
}

fn list_field<'a>(value: &'a Value, keys: &[&str]) -> &'a [Value] {
    for key in keys {
        if let Some(arr) = value.get(*key).and_then(|v| v.as_array()) {
            return arr;
        }
    }
    &[]
}

// ---------------------------------------------------------------------------
// MCP server management (9 HTTP RPCs)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServer {
    pub name: String,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub connected: bool,
    #[serde(default)]
    pub transport: String,
    #[serde(default)]
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: serde_json::Map<String, Value>,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub error: String,
    #[serde(default)]
    pub url: String,
}

fn parse_mcp(value: &Value) -> McpServer {
    let s = |k: &str| {
        value
            .get(k)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    };
    McpServer {
        name: s("name"),
        enabled: value
            .get("enabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        connected: value
            .get("connected")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        transport: s("transport"),
        command: s("command"),
        args: value
            .get("args")
            .and_then(|v| v.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default(),
        env: value
            .get("env")
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default(),
        status: s("status"),
        error: s("error"),
        url: s("url"),
    }
}

#[tauri::command]
pub async fn mcp_servers_list() -> Result<Vec<McpServer>, String> {
    let value = loom_get("/v1/mcp/servers".into()).await?;
    Ok(list_field(&value, &["servers"])
        .iter()
        .map(parse_mcp)
        .collect())
}

#[tauri::command]
pub async fn mcp_server_get(server_name: String) -> Result<McpServer, String> {
    let value = loom_get(format!("/v1/mcp/servers/{}", percent_encode(&server_name))).await?;
    Ok(parse_mcp(&value))
}

#[tauri::command]
pub async fn mcp_server_add(
    name: String,
    transport: String,
    command: Option<String>,
    args: Option<Vec<String>>,
    url: Option<String>,
    enabled: Option<bool>,
) -> Result<McpServer, String> {
    if name.trim().is_empty() {
        return Err("The server needs a name.".into());
    }
    let mut body = serde_json::json!({ "name": name.trim(), "transport": transport.trim() });
    if let Some(c) = command {
        if !c.trim().is_empty() {
            body["command"] = Value::String(c);
        }
    }
    if let Some(a) = args {
        body["args"] = Value::Array(a.into_iter().map(Value::String).collect());
    }
    if let Some(u) = url {
        if !u.trim().is_empty() {
            body["url"] = Value::String(u);
        }
    }
    if let Some(e) = enabled {
        body["enabled"] = Value::Bool(e);
    }
    let value = loom_send("POST", "/v1/mcp/servers".into(), Some(body)).await?;
    Ok(parse_mcp(&value))
}

#[tauri::command]
pub async fn mcp_server_update(
    server_name: String,
    transport: Option<String>,
    command: Option<String>,
    args: Option<Vec<String>>,
    url: Option<String>,
    enabled: Option<bool>,
) -> Result<McpServer, String> {
    if server_name.trim().is_empty() {
        return Err("No server selected.".into());
    }
    let mut body = serde_json::Map::new();
    if let Some(t) = transport {
        body.insert("transport".into(), Value::String(t));
    }
    if let Some(c) = command {
        body.insert("command".into(), Value::String(c));
    }
    if let Some(a) = args {
        body.insert(
            "args".into(),
            Value::Array(a.into_iter().map(Value::String).collect()),
        );
    }
    if let Some(u) = url {
        body.insert("url".into(), Value::String(u));
    }
    if let Some(e) = enabled {
        body.insert("enabled".into(), Value::Bool(e));
    }
    let value = loom_send(
        "PUT",
        format!("/v1/mcp/servers/{}", percent_encode(&server_name)),
        Some(Value::Object(body)),
    )
    .await?;
    Ok(parse_mcp(&value))
}

#[tauri::command]
pub async fn mcp_server_delete(server_name: String) -> Result<String, String> {
    if server_name.trim().is_empty() {
        return Err("No server selected.".into());
    }
    let value = loom_send(
        "DELETE",
        format!("/v1/mcp/servers/{}", percent_encode(&server_name)),
        None,
    )
    .await?;
    Ok(value
        .get("message")
        .and_then(|m| m.as_str())
        .unwrap_or("Deleted.")
        .to_string())
}

#[tauri::command]
pub async fn mcp_server_restart(server_name: String) -> Result<McpServer, String> {
    if server_name.trim().is_empty() {
        return Err("No server selected.".into());
    }
    let value = loom_send(
        "POST",
        format!("/v1/mcp/servers/{}:restart", percent_encode(&server_name)),
        Some(serde_json::json!({})),
    )
    .await?;
    Ok(parse_mcp(&value))
}

#[tauri::command]
pub async fn mcp_servers_health_check() -> Result<Vec<McpServer>, String> {
    let value = loom_get("/v1/mcp/servers:health".into()).await?;
    Ok(list_field(&value, &["servers", "results"])
        .iter()
        .map(parse_mcp)
        .collect())
}

#[tauri::command]
pub async fn mcp_server_test(
    name: String,
    transport: String,
    command: Option<String>,
    args: Option<Vec<String>>,
    url: Option<String>,
) -> Result<McpServer, String> {
    let mut body = serde_json::json!({ "name": name.trim(), "transport": transport });
    if let Some(c) = command {
        body["command"] = Value::String(c);
    }
    if let Some(a) = args {
        body["args"] = Value::Array(a.into_iter().map(Value::String).collect());
    }
    if let Some(u) = url {
        body["url"] = Value::String(u);
    }
    let value = loom_send("POST", "/v1/mcp/servers:test".into(), Some(body)).await?;
    Ok(parse_mcp(&value))
}

#[tauri::command]
pub async fn mcp_server_tools(server_name: String) -> Result<Vec<Value>, String> {
    if server_name.trim().is_empty() {
        return Err("No server selected.".into());
    }
    let value = loom_get(format!(
        "/v1/mcp/servers/{}/tools",
        percent_encode(&server_name)
    ))
    .await?;
    Ok(list_field(&value, &["tools"]).to_vec())
}

// ---------------------------------------------------------------------------
// Agent lifecycle (create / start / stop / reload / delete)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn agent_create(config: Value) -> Result<Value, String> {
    let config = config
        .as_object()
        .ok_or("The agent config must be a JSON object.")?;
    if config.is_empty() {
        return Err("The agent config is empty.".into());
    }
    loom_send(
        "POST",
        "/v1/agents".into(),
        Some(Value::Object(config.clone())),
    )
    .await
}

#[tauri::command]
pub async fn agent_start(agent_id: String) -> Result<Value, String> {
    if agent_id.trim().is_empty() {
        return Err("No agent selected.".into());
    }
    loom_send(
        "POST",
        format!("/v1/agents/{}:start", percent_encode(&agent_id)),
        Some(serde_json::json!({})),
    )
    .await
}

#[tauri::command]
pub async fn agent_stop(agent_id: String) -> Result<Value, String> {
    if agent_id.trim().is_empty() {
        return Err("No agent selected.".into());
    }
    loom_send(
        "POST",
        format!("/v1/agents/{}:stop", percent_encode(&agent_id)),
        Some(serde_json::json!({})),
    )
    .await
}

#[tauri::command]
pub async fn agent_reload(agent_id: String) -> Result<Value, String> {
    if agent_id.trim().is_empty() {
        return Err("No agent selected.".into());
    }
    loom_send(
        "POST",
        format!("/v1/agents/{}:reload", percent_encode(&agent_id)),
        Some(serde_json::json!({})),
    )
    .await
}

#[tauri::command]
pub async fn agent_delete(agent_id: String) -> Result<Value, String> {
    if agent_id.trim().is_empty() {
        return Err("No agent selected.".into());
    }
    loom_send(
        "DELETE",
        format!("/v1/agents/{}", percent_encode(&agent_id)),
        None,
    )
    .await
}

// ---------------------------------------------------------------------------
// Presets + workflow templates
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn agent_presets_list() -> Result<Vec<Value>, String> {
    let value = loom_get("/v1/presets/agents".into()).await?;
    Ok(list_field(&value, &["presets", "agents"]).to_vec())
}

#[tauri::command]
pub async fn workflow_templates_list() -> Result<Vec<Value>, String> {
    let value = loom_get("/v1/templates/workflows".into()).await?;
    Ok(list_field(&value, &["templates", "workflows"]).to_vec())
}

// ---------------------------------------------------------------------------
// Patterns (HTTP-bound; the gRPC-only skills service stays unwired)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn patterns_list() -> Result<Vec<Value>, String> {
    let value = loom_get("/v1/patterns".into()).await?;
    Ok(list_field(&value, &["patterns"]).to_vec())
}

#[tauri::command]
pub async fn pattern_get(name: String) -> Result<Value, String> {
    if name.trim().is_empty() {
        return Err("No pattern selected.".into());
    }
    loom_get(format!("/v1/patterns/{}", percent_encode(&name))).await
}

#[tauri::command]
pub async fn pattern_create(body: Value) -> Result<Value, String> {
    loom_send("POST", "/v1/patterns".into(), Some(body)).await
}

#[tauri::command]
pub async fn patterns_load(source: String) -> Result<Value, String> {
    if source.trim().is_empty() {
        return Err("No pattern source provided.".into());
    }
    loom_send(
        "POST",
        "/v1/patterns:load".into(),
        Some(serde_json::json!({ "source": source.trim() })),
    )
    .await
}

// ---------------------------------------------------------------------------
// Embedded MCP apps (Conversation Viewer, Data Chart, …)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn apps_list() -> Result<Vec<Value>, String> {
    let value = loom_get("/v1/apps".into()).await?;
    Ok(list_field(&value, &["apps"]).to_vec())
}

// ---------------------------------------------------------------------------
// Workflow scheduling (HTTP-bound; no transport decision needed)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn workflow_schedules_list() -> Result<Vec<Value>, String> {
    let value = loom_get("/v1/workflows/schedules".into()).await?;
    Ok(list_field(&value, &["schedules"]).to_vec())
}

#[tauri::command]
pub async fn workflow_schedule_get(schedule_id: String) -> Result<Value, String> {
    if schedule_id.trim().is_empty() {
        return Err("No schedule selected.".into());
    }
    loom_get(format!(
        "/v1/workflows/schedules/{}",
        percent_encode(&schedule_id)
    ))
    .await
}

#[tauri::command]
pub async fn workflow_schedule_create(
    workflow_name: String,
    cron: String,
    timezone: Option<String>,
    enabled: Option<bool>,
) -> Result<Value, String> {
    if workflow_name.trim().is_empty() || cron.trim().is_empty() {
        return Err("A workflow name and a cron expression are required.".into());
    }
    let mut schedule = serde_json::Map::new();
    schedule.insert("cron".into(), Value::String(cron.trim().to_string()));
    if let Some(tz) = timezone {
        if !tz.trim().is_empty() {
            schedule.insert("timezone".into(), Value::String(tz));
        }
    }
    if let Some(e) = enabled {
        schedule.insert("enabled".into(), Value::Bool(e));
    }
    let body = serde_json::json!({
        "workflowName": workflow_name.trim(),
        "schedule": Value::Object(schedule),
    });
    loom_send("POST", "/v1/workflows/schedules".into(), Some(body)).await
}

#[tauri::command]
pub async fn workflow_schedule_update(
    schedule_id: String,
    cron: Option<String>,
    timezone: Option<String>,
    enabled: Option<bool>,
) -> Result<Value, String> {
    if schedule_id.trim().is_empty() {
        return Err("No schedule selected.".into());
    }
    let mut schedule = serde_json::Map::new();
    if let Some(c) = cron {
        if !c.trim().is_empty() {
            schedule.insert("cron".into(), Value::String(c));
        }
    }
    if let Some(tz) = timezone {
        if !tz.trim().is_empty() {
            schedule.insert("timezone".into(), Value::String(tz));
        }
    }
    if let Some(e) = enabled {
        schedule.insert("enabled".into(), Value::Bool(e));
    }
    let body = serde_json::json!({ "schedule": Value::Object(schedule) });
    loom_send(
        "PATCH",
        format!("/v1/workflows/schedules/{}", percent_encode(&schedule_id)),
        Some(body),
    )
    .await
}

#[tauri::command]
pub async fn workflow_schedule_delete(schedule_id: String) -> Result<String, String> {
    if schedule_id.trim().is_empty() {
        return Err("No schedule selected.".into());
    }
    let value = loom_send(
        "DELETE",
        format!("/v1/workflows/schedules/{}", percent_encode(&schedule_id)),
        None,
    )
    .await?;
    Ok(value
        .get("message")
        .and_then(|m| m.as_str())
        .unwrap_or("Deleted.")
        .to_string())
}

#[tauri::command]
pub async fn workflow_schedule_trigger(schedule_id: String) -> Result<Value, String> {
    if schedule_id.trim().is_empty() {
        return Err("No schedule selected.".into());
    }
    loom_send(
        "POST",
        format!(
            "/v1/workflows/schedules/{}:trigger",
            percent_encode(&schedule_id)
        ),
        Some(serde_json::json!({})),
    )
    .await
}

#[tauri::command]
pub async fn workflow_schedule_history(schedule_id: String) -> Result<Vec<Value>, String> {
    if schedule_id.trim().is_empty() {
        return Err("No schedule selected.".into());
    }
    let value = loom_get(format!(
        "/v1/workflows/schedules/{}/history",
        percent_encode(&schedule_id)
    ))
    .await?;
    Ok(list_field(&value, &["history", "executions"]).to_vec())
}

#[tauri::command]
pub async fn workflow_schedule_pause(schedule_id: String) -> Result<Value, String> {
    if schedule_id.trim().is_empty() {
        return Err("No schedule selected.".into());
    }
    loom_send(
        "POST",
        format!(
            "/v1/workflows/schedules/{}:pause",
            percent_encode(&schedule_id)
        ),
        Some(serde_json::json!({})),
    )
    .await
}

#[tauri::command]
pub async fn workflow_schedule_resume(schedule_id: String) -> Result<Value, String> {
    if schedule_id.trim().is_empty() {
        return Err("No schedule selected.".into());
    }
    loom_send(
        "POST",
        format!(
            "/v1/workflows/schedules/{}:resume",
            percent_encode(&schedule_id)
        ),
        Some(serde_json::json!({})),
    )
    .await
}

#[tauri::command]
pub async fn workflow_schedule_cancel_execution(execution_id: String) -> Result<Value, String> {
    if execution_id.trim().is_empty() {
        return Err("No execution selected.".into());
    }
    loom_send(
        "POST",
        format!(
            "/v1/workflows/schedules/executions/{}:cancel",
            percent_encode(&execution_id)
        ),
        Some(serde_json::json!({})),
    )
    .await
}

// ---------------------------------------------------------------------------
// Skills (100% HTTP — no transport decision needed)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn skills_add(inline: Value) -> Result<Value, String> {
    let name = inline
        .get("name")
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .ok_or("The skill needs a name.")?;
    let _ = name;
    if inline
        .get("skill_md")
        .or_else(|| inline.get("skillMd"))
        .is_none()
    {
        return Err("The skill needs its SKILL.md content.".into());
    }
    loom_send(
        "POST",
        "/v1/skills".into(),
        Some(serde_json::json!({ "inline": inline })),
    )
    .await
}

#[tauri::command]
pub async fn skills_classify(skill_name: String) -> Result<Value, String> {
    if skill_name.trim().is_empty() {
        return Err("No skill selected.".into());
    }
    loom_send(
        "POST",
        format!("/v1/skills/{}:classify", percent_encode(&skill_name)),
        Some(serde_json::json!({})),
    )
    .await
}

#[tauri::command]
pub async fn skills_bulk_import(
    app: tauri::AppHandle,
    request_id: String,
    src_dir: String,
    out_dir: Option<String>,
) -> Result<(), String> {
    if src_dir.trim().is_empty() {
        return Err("The skill source directory is required.".into());
    }
    let mut body = serde_json::json!({ "srcDir": src_dir.trim() });
    if let Some(o) = out_dir {
        if !o.trim().is_empty() {
            body["outDir"] = Value::String(o);
        }
    }
    super::loom_stream::start_loom_stream(
        app,
        request_id,
        "loom-skills",
        "POST",
        "/v1/skills:bulkImport".into(),
        body,
    )
}

// ---------------------------------------------------------------------------
// MCP apps CRUD + component types
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn apps_get(name: String) -> Result<Value, String> {
    if name.trim().is_empty() {
        return Err("No app selected.".into());
    }
    loom_get(format!("/v1/apps/{}", percent_encode(&name))).await
}

#[tauri::command]
pub async fn apps_create(body: Value) -> Result<Value, String> {
    loom_send("POST", "/v1/apps".into(), Some(body)).await
}

#[tauri::command]
pub async fn apps_update(name: String, body: Value) -> Result<Value, String> {
    if name.trim().is_empty() {
        return Err("No app selected.".into());
    }
    loom_send(
        "PUT",
        format!("/v1/apps/{}", percent_encode(&name)),
        Some(body),
    )
    .await
}

#[tauri::command]
pub async fn apps_delete(name: String) -> Result<String, String> {
    if name.trim().is_empty() {
        return Err("No app selected.".into());
    }
    let value = loom_send(
        "DELETE",
        format!("/v1/apps/{}", percent_encode(&name)),
        None,
    )
    .await?;
    Ok(value
        .get("message")
        .and_then(|m| m.as_str())
        .unwrap_or("Deleted.")
        .to_string())
}

#[tauri::command]
pub async fn apps_component_types() -> Result<Vec<Value>, String> {
    let value = loom_get("/v1/apps/component-types".into()).await?;
    Ok(list_field(&value, &["componentTypes", "types"]).to_vec())
}

// ---------------------------------------------------------------------------
// Tools: register + permission request (the human answer path for holds is
// the clarification endpoint; this is the agent-side request surface)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn tools_register(tool: Value) -> Result<Value, String> {
    loom_send(
        "POST",
        "/v1/tools:register".into(),
        Some(serde_json::json!({ "tool": tool })),
    )
    .await
}

#[tauri::command]
pub async fn tool_permission_request(
    session_id: String,
    tool_name: String,
    args_json: Option<String>,
    description: Option<String>,
    risk_level: Option<String>,
) -> Result<Value, String> {
    if session_id.trim().is_empty() || tool_name.trim().is_empty() {
        return Err("A session and tool name are required.".into());
    }
    let mut body = serde_json::json!({
        "sessionId": session_id.trim(),
        "toolName": tool_name.trim(),
    });
    if let Some(a) = args_json {
        if !a.trim().is_empty() {
            body["argsJson"] = Value::String(a);
        }
    }
    if let Some(d) = description {
        if !d.trim().is_empty() {
            body["description"] = Value::String(d);
        }
    }
    if let Some(r) = risk_level {
        if !r.trim().is_empty() {
            body["riskLevel"] = Value::String(r);
        }
    }
    loom_send("POST", "/v1/tools:request-permission".into(), Some(body)).await
}

// ---------------------------------------------------------------------------
// Server administration (TLS status/renew, storage migration)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn tls_status() -> Result<Value, String> {
    loom_get("/v1/server/tls".into()).await
}

#[tauri::command]
pub async fn tls_renew() -> Result<Value, String> {
    loom_send(
        "POST",
        "/v1/server/tls:renew".into(),
        Some(serde_json::json!({})),
    )
    .await
}

#[tauri::command]
pub async fn run_migration() -> Result<Value, String> {
    loom_send(
        "POST",
        "/v1/server/storage:migrate".into(),
        Some(serde_json::json!({})),
    )
    .await
}

// ---------------------------------------------------------------------------
// Session completeness (delete / resume / resolve-gap)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn session_delete(session_id: String) -> Result<String, String> {
    if session_id.trim().is_empty() {
        return Err("No session selected.".into());
    }
    let value = loom_send(
        "DELETE",
        format!("/v1/sessions/{}", percent_encode(&session_id)),
        None,
    )
    .await?;
    Ok(value
        .get("message")
        .and_then(|m| m.as_str())
        .unwrap_or("Deleted.")
        .to_string())
}

#[tauri::command]
pub async fn session_resume(session_id: String) -> Result<Value, String> {
    if session_id.trim().is_empty() {
        return Err("No session selected.".into());
    }
    loom_send(
        "POST",
        format!("/v1/sessions/{}:resume", percent_encode(&session_id)),
        Some(serde_json::json!({})),
    )
    .await
}

#[tauri::command]
pub async fn session_resolve_gap(session_id: String) -> Result<Value, String> {
    if session_id.trim().is_empty() {
        return Err("No session selected.".into());
    }
    loom_send(
        "POST",
        format!(
            "/v1/sessions/{}:resolveExecutionGap",
            percent_encode(&session_id)
        ),
        Some(serde_json::json!({})),
    )
    .await
}
