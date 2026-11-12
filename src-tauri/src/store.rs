//! Work items, collaboration steps and attention items.
//! Work items are the only data persisted to disk (structured JSON),
//! mirroring the existing eframe app. The store starts empty: work
//! items come from the user creating them. Collaboration steps and
//! attention items are empty until the Loom server exposes them.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
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
    /// The Loom conversation session associated with this work (if any).
    #[serde(default)]
    pub session_id: Option<String>,
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

fn new_id() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("work-{secs}")
}

impl WorkStore {
    pub fn load(path: PathBuf) -> Self {
        if let Ok(text) = fs::read_to_string(&path) {
            if let Ok(items) = serde_json::from_str::<Vec<WorkItem>>(&text) {
                return Self { path, items };
            }
        }
        let store = Self {
            path,
            items: Vec::new(),
        };
        let _ = store.save();
        store
    }

    pub fn items(&self) -> Vec<WorkItem> {
        self.items.clone()
    }

    pub fn save(&self) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let text = serde_json::to_string_pretty(&self.items).map_err(|e| e.to_string())?;
        fs::write(&self.path, text).map_err(|e| e.to_string())
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
            session_id: None,
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
        let out = item.clone();
        self.save()?;
        Ok(out)
    }

    /// Associate (or clear) the Loom session for a work item. An empty
    /// `session_id` clears the association.
    pub fn set_session(&mut self, id: &str, session_id: Option<String>) -> Result<WorkItem, String> {
        let normalized = session_id
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let item = self
            .items
            .iter_mut()
            .find(|w| w.id == id)
            .ok_or_else(|| format!("Unknown work item: {id}"))?;
        item.session_id = normalized;
        let out = item.clone();
        self.save()?;
        Ok(out)
    }
}
