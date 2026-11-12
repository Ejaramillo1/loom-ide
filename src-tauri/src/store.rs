//! Work items, collaboration steps and attention items.
//! Work items are the only data persisted to disk (structured JSON),
//! mirroring the existing eframe app. Everything else is seed /
//! demonstration data until the Loom server exposes it.

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

pub fn seed_work_items() -> Vec<WorkItem> {
    vec![
        WorkItem {
            id: "work-1".to_string(),
            title: "Investigate agent memory latency".to_string(),
            status: "active".to_string(),
            autonomy: "collaborative".to_string(),
            updated_label: "Now".to_string(),
        },
        WorkItem {
            id: "work-2".to_string(),
            title: "Improve tool reliability".to_string(),
            status: "paused".to_string(),
            autonomy: "assisted".to_string(),
            updated_label: "2h".to_string(),
        },
        WorkItem {
            id: "work-3".to_string(),
            title: "Review PR #4287".to_string(),
            status: "paused".to_string(),
            autonomy: "manual".to_string(),
            updated_label: "4h".to_string(),
        },
    ]
}

pub fn seed_steps() -> Vec<CollabStep> {
    vec![
        CollabStep {
            id: "step-1".to_string(),
            label: "Analyze baseline traces".to_string(),
            state: "done".to_string(),
            progress: None,
        },
        CollabStep {
            id: "step-2".to_string(),
            label: "Reproduce with memory on/off".to_string(),
            state: "done".to_string(),
            progress: None,
        },
        CollabStep {
            id: "step-3".to_string(),
            label: "Run configuration experiments".to_string(),
            state: "active".to_string(),
            progress: Some(68),
        },
        CollabStep {
            id: "step-4".to_string(),
            label: "Compare results".to_string(),
            state: "pending".to_string(),
            progress: None,
        },
        CollabStep {
            id: "step-5".to_string(),
            label: "Identify likely causes".to_string(),
            state: "pending".to_string(),
            progress: None,
        },
    ]
}

pub fn seed_attention() -> Vec<AttentionItem> {
    vec![
        AttentionItem {
            id: "att-1".to_string(),
            kind: "decision".to_string(),
            title: "Decision: next experiment".to_string(),
            detail: "2 configurations ready".to_string(),
        },
        AttentionItem {
            id: "att-2".to_string(),
            kind: "finding".to_string(),
            title: "Finding: memory adds ~340 ms".to_string(),
            detail: "Consistent across 3 runs".to_string(),
        },
    ]
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
            items: seed_work_items(),
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
}
