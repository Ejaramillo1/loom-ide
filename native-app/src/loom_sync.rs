//! Sync Loom sessions, agents and artifacts into the vault as notes.
//! Runs only when the user clicks "Sync from Loom", never automatically.
//! Each synced note carries a "Loom ID: <id>" marker line in its body;
//! items already in the vault are skipped, never duplicated. Artifact
//! content is referenced, not downloaded.

use crate::knowledge::{Actor, Vault};
use crate::loom_adapter::LoomHttpAdapter;

fn text<'a>(value: &'a serde_json::Value, key: &str) -> &'a str {
    value.get(key).and_then(|v| v.as_str()).unwrap_or("")
}

fn count(value: &serde_json::Value, key: &str) -> u64 {
    value.get(key).and_then(|v| v.as_u64()).unwrap_or(0)
}

fn already_synced(vault: &Vault, loom_id: &str) -> bool {
    !vault.search(&format!("Loom ID: {loom_id}")).is_empty()
}

fn list<'a>(value: &'a serde_json::Value, key: &str) -> Result<&'a Vec<serde_json::Value>, String> {
    value
        .get(key)
        .and_then(|v| v.as_array())
        .ok_or_else(|| format!("Loom returned no {key} list"))
}

fn fetch_list(
    adapter: &LoomHttpAdapter,
    path: &str,
    key: &str,
) -> Result<serde_json::Value, String> {
    let (status, payload) = adapter.loom_request("GET", path, None)?;
    if !(200..300).contains(&status) {
        return Err(format!("Loom returned HTTP {status} listing {key}"));
    }
    adapter.parse_json(&payload)
}

/// Fetch Loom sessions and save each new one as a "session" note.
/// Returns the number of notes created.
pub fn sync_sessions(vault: &mut Vault, adapter: &LoomHttpAdapter) -> Result<usize, String> {
    let value = fetch_list(adapter, "/v1/sessions?limit=500", "sessions")?;
    let sessions = list(&value, "sessions")?;
    let mut created = 0;
    for session in sessions {
        let id = text(session, "id");
        if id.is_empty() || already_synced(vault, id) {
            continue;
        }
        let name = text(session, "name");
        let title = if name.is_empty() { id } else { name };
        let body = format!(
            "Loom ID: {id}\nState: {}\nAgent: {}\nUpdated: {}\nMessages: {}\n\nSynced from the Loom server.",
            text(session, "state"),
            text(session, "agent_name"),
            text(session, "updated_at"),
            count(session, "conversation_count")
        );
        vault.create(title, &body, "session", Actor::Human)?;
        created += 1;
    }
    Ok(created)
}

/// Fetch Loom agents and save each new one as an "agent" note.
/// Returns the number of notes created.
pub fn sync_agents(vault: &mut Vault, adapter: &LoomHttpAdapter) -> Result<usize, String> {
    let value = fetch_list(adapter, "/v1/agents", "agents")?;
    let agents = list(&value, "agents")?;
    let mut created = 0;
    for agent in agents {
        let id = text(agent, "id");
        if id.is_empty() || already_synced(vault, id) {
            continue;
        }
        let name = text(agent, "name");
        let title = if name.is_empty() { id } else { name };
        let body = format!(
            "Loom ID: {id}\nStatus: {}\nUptime: {} seconds\nActive sessions: {}\nTotal messages: {}\n\nSynced from the Loom server.",
            text(agent, "status"),
            count(agent, "uptime_seconds"),
            count(agent, "active_sessions"),
            count(agent, "total_messages")
        );
        vault.create(title, &body, "agent", Actor::Human)?;
        created += 1;
    }
    Ok(created)
}

/// Fetch Loom artifacts and save each new one as an "artifact" note.
/// Returns the number of notes created.
pub fn sync_artifacts(vault: &mut Vault, adapter: &LoomHttpAdapter) -> Result<usize, String> {
    let value = fetch_list(adapter, "/v1/artifacts?limit=200", "artifacts")?;
    let artifacts = list(&value, "artifacts")?;
    let mut created = 0;
    for artifact in artifacts {
        let id = text(artifact, "id");
        if id.is_empty() || already_synced(vault, id) {
            continue;
        }
        let name = text(artifact, "name");
        let title = if name.is_empty() { id } else { name };
        let body = format!(
            "Loom ID: {id}\nPurpose: {}\nSource: {}\nSession: {}\nCreated: {}\n\nContent is referenced, not downloaded.",
            text(artifact, "purpose"),
            text(artifact, "source"),
            text(artifact, "session_id"),
            text(artifact, "created_at")
        );
        vault.create(title, &body, "artifact", Actor::Human)?;
        created += 1;
    }
    Ok(created)
}
