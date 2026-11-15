//! Loom TaskService + boards — 100% HTTP (19 google.api.http annotations in
//! task.proto), so this is pure IDE work: no transport decision, no Loom-side
//! change. The Work view shows Loom tasks beside local work items, labelled by
//! source; nothing is migrated silently (read-bridge first, per the plan).

use serde_json::Value;

use super::{loom_request, percent_encode, percent_encode_query};

async fn get(path: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || loom_request("GET", &path, None))
        .await
        .map_err(|e| e.to_string())?
}

async fn send(method: &'static str, path: String, body: Option<Value>) -> Result<Value, String> {
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

fn field<'a>(value: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    keys.iter().find_map(|k| value.get(*k))
}

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn task_boards_list() -> Result<Vec<Value>, String> {
    let value = get("/v1/boards".into()).await?;
    Ok(list_field(&value, &["boards"]).to_vec())
}

#[tauri::command]
pub async fn task_board_get(board_id: String) -> Result<Value, String> {
    if board_id.trim().is_empty() {
        return Err("No board selected.".into());
    }
    let value = get(format!("/v1/boards/{}", percent_encode(&board_id))).await?;
    Ok(field(&value, &["board"]).cloned().unwrap_or(value))
}

#[tauri::command]
pub async fn task_board_create(board: Value) -> Result<Value, String> {
    if !board.is_object() {
        return Err("The board must be a JSON object.".into());
    }
    let value = send(
        "POST",
        "/v1/boards".into(),
        Some(serde_json::json!({ "board": board })),
    )
    .await?;
    Ok(field(&value, &["board"]).cloned().unwrap_or(value))
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

fn tasks_of(value: Value) -> Vec<Value> {
    match value {
        Value::Object(mut obj) => {
            if let Some(list) = obj.remove("tasks").and_then(|v| v.as_array().cloned()) {
                list
            } else if let Some(list) = obj.remove("results").and_then(|v| v.as_array().cloned()) {
                list
            } else {
                vec![Value::Object(obj)]
            }
        }
        other => vec![other],
    }
}

#[tauri::command]
pub async fn loom_tasks_list(
    board_id: Option<String>,
    status: Option<String>,
    query: Option<String>,
) -> Result<Vec<Value>, String> {
    let mut parts: Vec<String> = Vec::new();
    if let Some(b) = board_id {
        if !b.trim().is_empty() {
            // grpc-gateway query parameters keep the proto field names
            // (snake_case); `boardId` would be silently ignored (QC-11).
            parts.push(format!("board_id={}", percent_encode_query(&b)));
        }
    }
    if let Some(s) = status {
        if !s.trim().is_empty() {
            parts.push(format!("status={}", percent_encode_query(&s)));
        }
    }
    if let Some(q) = query {
        if !q.trim().is_empty() {
            parts.push(format!("query={}", percent_encode_query(&q)));
        }
    }
    let path = if parts.is_empty() {
        "/v1/tasks".to_string()
    } else {
        format!("/v1/tasks?{}", parts.join("&"))
    };
    let value = get(path).await?;
    Ok(tasks_of(value))
}

#[tauri::command]
pub async fn loom_task_get(task_id: String) -> Result<Value, String> {
    if task_id.trim().is_empty() {
        return Err("No task selected.".into());
    }
    let value = get(format!("/v1/tasks/{}", percent_encode(&task_id))).await?;
    Ok(field(&value, &["task"]).cloned().unwrap_or(value))
}

#[tauri::command]
pub async fn loom_task_create(task: Value) -> Result<Value, String> {
    if !task.is_object() {
        return Err("The task must be a JSON object.".into());
    }
    let value = send(
        "POST",
        "/v1/tasks".into(),
        Some(serde_json::json!({ "task": task })),
    )
    .await?;
    // CreateTaskResponse { task }: a response without the required field
    // is an unexpected envelope, never something to pass through as a
    // task (QC-11).
    match field(&value, &["task"]).cloned() {
        Some(t) => Ok(t),
        None => Err("Unexpected task create response shape (no task field).".into()),
    }
}

#[tauri::command]
pub async fn loom_task_update(task: Value) -> Result<Value, String> {
    let id = task
        .get("id")
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .ok_or("The task needs an id to update.")?;
    // UpdateTaskRequest { task, update_mask }: the nested task is the
    // contract; the route resolves {task.id} from inside that envelope.
    let value = send(
        "PATCH",
        format!("/v1/tasks/{}", percent_encode(id)),
        Some(serde_json::json!({ "task": task })),
    )
    .await?;
    match field(&value, &["task"]).cloned() {
        Some(t) => Ok(t),
        None => Err("Unexpected task update response shape (no task field).".into()),
    }
}

#[tauri::command]
pub async fn loom_task_delete(task_id: String) -> Result<String, String> {
    if task_id.trim().is_empty() {
        return Err("No task selected.".into());
    }
    let value = send(
        "DELETE",
        format!("/v1/tasks/{}", percent_encode(&task_id)),
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
pub async fn loom_task_claim(
    task_id: String,
    agent_id: Option<String>,
    session_id: Option<String>,
) -> Result<Value, String> {
    if task_id.trim().is_empty() {
        return Err("No task selected.".into());
    }
    let mut body = serde_json::Map::new();
    if let Some(a) = agent_id {
        if !a.trim().is_empty() {
            body.insert("agentId".into(), Value::String(a));
        }
    }
    if let Some(s) = session_id {
        if !s.trim().is_empty() {
            body.insert("sessionId".into(), Value::String(s));
        }
    }
    send(
        "POST",
        format!("/v1/tasks/{}:claim", percent_encode(&task_id)),
        Some(Value::Object(body)),
    )
    .await
}

#[tauri::command]
pub async fn loom_task_release(task_id: String) -> Result<Value, String> {
    if task_id.trim().is_empty() {
        return Err("No task selected.".into());
    }
    send(
        "POST",
        format!("/v1/tasks/{}:release", percent_encode(&task_id)),
        Some(serde_json::json!({})),
    )
    .await
}

#[tauri::command]
pub async fn loom_task_close(task_id: String) -> Result<Value, String> {
    if task_id.trim().is_empty() {
        return Err("No task selected.".into());
    }
    send(
        "POST",
        format!("/v1/tasks/{}:close", percent_encode(&task_id)),
        Some(serde_json::json!({})),
    )
    .await
}

#[tauri::command]
pub async fn loom_task_transition(
    task_id: String,
    new_status: String,
    reason: Option<String>,
) -> Result<Value, String> {
    if task_id.trim().is_empty() || new_status.trim().is_empty() {
        return Err("A task and a status are required.".into());
    }
    let mut body = serde_json::json!({ "newStatus": new_status.trim() });
    if let Some(r) = reason {
        if !r.trim().is_empty() {
            body["reason"] = Value::String(r);
        }
    }
    send(
        "POST",
        format!("/v1/tasks/{}:transition", percent_encode(&task_id)),
        Some(body),
    )
    .await
}

#[tauri::command]
pub async fn loom_task_add_dependency(
    from_task_id: String,
    to_task_id: String,
) -> Result<Value, String> {
    if from_task_id.trim().is_empty() || to_task_id.trim().is_empty() {
        return Err("Both task ids are required.".into());
    }
    send(
        "POST",
        "/v1/tasks/dependencies".into(),
        Some(serde_json::json!({
            "dependency": { "fromTaskId": from_task_id.trim(), "toTaskId": to_task_id.trim() }
        })),
    )
    .await
}

#[tauri::command]
pub async fn loom_task_remove_dependency(
    from_task_id: String,
    to_task_id: String,
) -> Result<String, String> {
    if from_task_id.trim().is_empty() || to_task_id.trim().is_empty() {
        return Err("Both task ids are required.".into());
    }
    let path = format!(
        "/v1/tasks/dependencies/{}/{}",
        percent_encode(&from_task_id),
        percent_encode(&to_task_id)
    );
    let value = send("DELETE", path, None).await?;
    Ok(value
        .get("message")
        .and_then(|m| m.as_str())
        .unwrap_or("Dependency removed.")
        .to_string())
}

#[tauri::command]
pub async fn task_board_ready(board_id: String) -> Result<Vec<Value>, String> {
    if board_id.trim().is_empty() {
        return Err("No board selected.".into());
    }
    let value = get(format!("/v1/boards/{}/ready", percent_encode(&board_id))).await?;
    // GetReadyFrontResponse { ready_tasks } arrives as protojson
    // `readyTasks` (QC-11); the snake_case fallback covers older peers.
    Ok(list_field(&value, &["readyTasks", "ready_tasks"]).to_vec())
}

#[tauri::command]
pub async fn task_board_blocked(board_id: String) -> Result<Vec<Value>, String> {
    if board_id.trim().is_empty() {
        return Err("No board selected.".into());
    }
    let value = get(format!("/v1/boards/{}/blocked", percent_encode(&board_id))).await?;
    // GetBlockedTasksResponse { blocked_tasks } arrives as protojson
    // `blockedTasks` (QC-11).
    Ok(list_field(&value, &["blockedTasks", "blocked_tasks"]).to_vec())
}

#[tauri::command]
pub async fn loom_task_decompose(
    goal: String,
    context: Option<String>,
    board_id: Option<String>,
) -> Result<Value, String> {
    if goal.trim().is_empty() {
        return Err("Describe the goal to decompose.".into());
    }
    let mut body = serde_json::json!({ "goal": goal.trim() });
    if let Some(c) = context {
        if !c.trim().is_empty() {
            body["context"] = Value::String(c);
        }
    }
    if let Some(b) = board_id {
        if !b.trim().is_empty() {
            body["boardId"] = Value::String(b);
        }
    }
    send("POST", "/v1/tasks:decompose".into(), Some(body)).await
}

#[tauri::command]
pub async fn loom_task_context(agent_id: String) -> Result<Value, String> {
    if agent_id.trim().is_empty() {
        return Err("No agent selected.".into());
    }
    get(format!(
        "/v1/agents/{}/task-context",
        percent_encode(&agent_id)
    ))
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tasks_of_unwraps_tasks_results_and_single_objects() {
        let tasks = serde_json::json!({ "tasks": [{"id": "a"}, {"id": "b"}] });
        assert_eq!(tasks_of(tasks).len(), 2);
        let results = serde_json::json!({ "results": [{"id": "c"}] });
        assert_eq!(tasks_of(results).len(), 1);
        let single = serde_json::json!({ "id": "d" });
        let out = tasks_of(single);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0]["id"], "d");
        let arr = serde_json::json!([1, 2]);
        assert_eq!(tasks_of(arr).len(), 1);
    }

    #[test]
    fn list_field_reads_each_candidate_key() {
        let value = serde_json::json!({ "boards": [{"id": "b1"}] });
        assert_eq!(list_field(&value, &["boards", "results"]).len(), 1);
        assert_eq!(list_field(&value, &["results"]).len(), 0);
    }

    #[test]
    fn ready_and_blocked_lists_read_protojson_keys() {
        let ready = serde_json::json!({ "readyTasks": [{"id": "a"}] });
        assert_eq!(list_field(&ready, &["readyTasks", "ready_tasks"]).len(), 1);
        let blocked = serde_json::json!({ "blockedTasks": [{"id": "b"}] });
        assert_eq!(
            list_field(&blocked, &["blockedTasks", "blocked_tasks"]).len(),
            1
        );
    }
}
