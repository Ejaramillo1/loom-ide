//! Work items, collaboration steps and attention items.
//! Work items are the only data persisted to disk (structured JSON),
//! mirroring the existing eframe app. The store starts empty: work
//! items come from the user creating them. Collaboration steps and
//! attention items are empty until the Loom server exposes them.

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkItem {
    pub id: String,
    pub title: String,
    /// "active" | "paused"
    pub status: String,
    /// "manual" | "assisted" | "collaborative" | "delegated"
    pub autonomy: String,
    /// Human label: "Now" | "2h" | "4h" ...
    pub updated_label: String,
    /// Unix seconds of the last mutation (0 for items written before this
    /// field existed). The frontend renders relative time from this; the
    /// label above is kept for backward compatibility only.
    #[serde(default)]
    pub updated_at: i64,
    /// The Loom conversation session associated with this work (if any).
    #[serde(default)]
    pub session_id: Option<String>,
    /// Human-defined criteria for "done".
    #[serde(default)]
    pub success_criteria: Vec<String>,
    /// Loom artifact ids attached to this work.
    #[serde(default)]
    pub artifact_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollabStep {
    pub id: String,
    pub label: String,
    /// "done" | "active" | "pending"
    pub state: String,
    pub progress: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttentionItem {
    pub id: String,
    /// "decision" | "finding"
    pub kind: String,
    pub title: String,
    pub detail: String,
}

pub struct WorkStore {
    path: PathBuf,
    items: Vec<WorkItem>,
}

/// Monotonic per-process counter so two items created in the same nanosecond
/// still get distinct ids.
static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn now_unix_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn new_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let n = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("work-{nanos}-{n}")
}

/// Path for a preserved copy of a corrupt store file, next to the original.
fn corrupt_backup_path(path: &PathBuf) -> PathBuf {
    let mut p = path.clone().into_os_string();
    p.push(format!(".corrupt-{}", now_unix_secs()));
    PathBuf::from(p)
}

impl WorkStore {
    /// Load the store. A missing file starts empty (and is created). A file
    /// that exists but cannot be read or parsed is **never** overwritten:
    /// it is moved aside to `<name>.corrupt-<unix-secs>` and loading fails
    /// with a message telling the user where the file went, so no data is
    /// silently destroyed.
    pub fn load(path: PathBuf) -> Result<Self, String> {
        match fs::read_to_string(&path) {
            Ok(text) => match serde_json::from_str::<Vec<WorkItem>>(&text) {
                Ok(mut items) => {
                    // Defensive dedup: keep the first item of each id, drop
                    // later duplicates (same-second ids from older builds).
                    let mut seen = std::collections::HashSet::new();
                    let before = items.len();
                    items.retain(|w| seen.insert(w.id.clone()));
                    let store = Self { path, items };
                    if store.items.len() != before {
                        store.save()?;
                    }
                    Ok(store)
                }
                Err(e) => {
                    let backup = corrupt_backup_path(&path);
                    let _ = fs::rename(&path, &backup);
                    Err(format!(
                        "work.json is corrupt ({e}). The unreadable file was moved to {} so nothing is lost. Fix or delete that file, then restart.",
                        backup.display()
                    ))
                }
            },
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                let store = Self {
                    path,
                    items: Vec::new(),
                };
                store.save()?;
                Ok(store)
            }
            Err(e) => Err(format!("Cannot read {}: {e}", path.display())),
        }
    }

    pub fn items(&self) -> Vec<WorkItem> {
        self.items.clone()
    }

    /// Save atomically: write to a temp file in the same directory, fsync
    /// it, then rename over the live file, so a crash mid-write can never
    /// leave a truncated store behind.
    pub fn save(&self) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let text = serde_json::to_string_pretty(&self.items).map_err(|e| e.to_string())?;
        let tmp = self.path.with_extension("json.tmp");
        {
            let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
            f.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
            f.sync_all().map_err(|e| e.to_string())?;
        }
        fs::rename(&tmp, &self.path).map_err(|e| e.to_string())?;
        // Best-effort fsync of the parent directory so the rename is durable.
        if let Some(parent) = self.path.parent() {
            if let Ok(dir) = fs::File::open(parent) {
                let _ = dir.sync_all();
            }
        }
        Ok(())
    }

    pub fn add(&mut self, title: String) -> Result<WorkItem, String> {
        let title = title.trim().to_string();
        if title.is_empty() {
            return Err("Work item title cannot be empty".to_string());
        }
        let item = WorkItem {
            id: new_id(),
            title,
            status: "paused".to_string(),
            autonomy: "collaborative".to_string(),
            updated_label: "Now".to_string(),
            updated_at: now_unix_secs(),
            session_id: None,
            success_criteria: Vec::new(),
            artifact_ids: Vec::new(),
        };
        self.items.insert(0, item.clone());
        self.save()?;
        Ok(item)
    }

    pub fn set_status(&mut self, id: &str, status: &str) -> Result<WorkItem, String> {
        if status != "active" && status != "paused" {
            return Err(format!("Unknown status: {status}"));
        }
        let item = self
            .items
            .iter_mut()
            .find(|w| w.id == id)
            .ok_or_else(|| format!("Unknown work item: {id}"))?;
        item.status = status.to_string();
        item.updated_at = now_unix_secs();
        let out = item.clone();
        self.save()?;
        Ok(out)
    }

    pub fn set_autonomy(&mut self, id: &str, autonomy: &str) -> Result<WorkItem, String> {
        const LEVELS: [&str; 4] = ["manual", "assisted", "collaborative", "delegated"];
        if !LEVELS.contains(&autonomy) {
            return Err(format!("Unknown autonomy level: {autonomy}"));
        }
        let item = self
            .items
            .iter_mut()
            .find(|w| w.id == id)
            .ok_or_else(|| format!("Unknown work item: {id}"))?;
        item.autonomy = autonomy.to_string();
        item.updated_at = now_unix_secs();
        let out = item.clone();
        self.save()?;
        Ok(out)
    }

    /// Associate (or clear) the Loom session for a work item. An empty
    /// `session_id` clears the association.
    pub fn set_session(
        &mut self,
        id: &str,
        session_id: Option<String>,
    ) -> Result<WorkItem, String> {
        let normalized = session_id
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let item = self
            .items
            .iter_mut()
            .find(|w| w.id == id)
            .ok_or_else(|| format!("Unknown work item: {id}"))?;
        item.session_id = normalized;
        item.updated_at = now_unix_secs();
        let out = item.clone();
        self.save()?;
        Ok(out)
    }

    /// Replace the success criteria for a work item (trimmed, empties dropped).
    pub fn set_success_criteria(
        &mut self,
        id: &str,
        criteria: Vec<String>,
    ) -> Result<WorkItem, String> {
        let item = self
            .items
            .iter_mut()
            .find(|w| w.id == id)
            .ok_or_else(|| format!("Unknown work item: {id}"))?;
        item.success_criteria = criteria
            .into_iter()
            .map(|c| c.trim().to_string())
            .filter(|c| !c.is_empty())
            .collect();
        item.updated_at = now_unix_secs();
        let out = item.clone();
        self.save()?;
        Ok(out)
    }

    /// Replace the attached artifact ids for a work item.
    pub fn set_artifacts(
        &mut self,
        id: &str,
        artifact_ids: Vec<String>,
    ) -> Result<WorkItem, String> {
        let item = self
            .items
            .iter_mut()
            .find(|w| w.id == id)
            .ok_or_else(|| format!("Unknown work item: {id}"))?;
        item.artifact_ids = artifact_ids
            .into_iter()
            .map(|a| a.trim().to_string())
            .filter(|a| !a.is_empty())
            .collect();
        item.updated_at = now_unix_secs();
        let out = item.clone();
        self.save()?;
        Ok(out)
    }
}
