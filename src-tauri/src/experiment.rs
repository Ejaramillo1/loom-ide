//! Experiments: the human's experimental designs, run through Loom.
//!
//! Persisted as structured JSON next to work.json. Arms are run as real
//! weave calls from the frontend; an arm's result is only ever the reply
//! text a real run returned. Nothing here invents metrics or progress.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExperimentArm {
    pub id: String,
    /// Short human label, e.g. "Baseline (memory off)".
    pub label: String,
    /// What makes this configuration different.
    pub config: String,
    /// "defined" | "running" | "done"
    pub status: String,
    /// The real reply text from the arm's run (empty until it ran).
    #[serde(default)]
    pub result: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Experiment {
    pub id: String,
    pub title: String,
    pub question: String,
    pub hypothesis: String,
    /// "draft" | "running" | "decided"
    pub status: String,
    #[serde(default)]
    pub arms: Vec<ExperimentArm>,
    /// Arm id chosen by the human (set once a decision is made).
    #[serde(default)]
    pub decision: Option<String>,
}

pub struct ExperimentStore {
    path: PathBuf,
    items: Vec<Experiment>,
}

fn new_id(prefix: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{prefix}-{nanos}")
}

impl ExperimentStore {
    pub fn load(path: PathBuf) -> Self {
        if let Ok(text) = fs::read_to_string(&path) {
            if let Ok(items) = serde_json::from_str::<Vec<Experiment>>(&text) {
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

    pub fn items(&self) -> Vec<Experiment> {
        self.items.clone()
    }

    pub fn save(&self) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let text = serde_json::to_string_pretty(&self.items).map_err(|e| e.to_string())?;
        fs::write(&self.path, text).map_err(|e| e.to_string())
    }

    fn get_mut(&mut self, id: &str) -> Result<&mut Experiment, String> {
        self.items
            .iter_mut()
            .find(|e| e.id == id)
            .ok_or_else(|| format!("Unknown experiment: {id}"))
    }

    pub fn add(
        &mut self,
        title: String,
        question: String,
        hypothesis: String,
    ) -> Result<Experiment, String> {
        let title = title.trim().to_string();
        if title.is_empty() {
            return Err("Experiment title cannot be empty".to_string());
        }
        let item = Experiment {
            id: new_id("exp"),
            title,
            question: question.trim().to_string(),
            hypothesis: hypothesis.trim().to_string(),
            status: "draft".to_string(),
            arms: Vec::new(),
            decision: None,
        };
        self.items.insert(0, item.clone());
        self.save()?;
        Ok(item)
    }

    pub fn add_arm(
        &mut self,
        id: &str,
        label: String,
        config: String,
    ) -> Result<Experiment, String> {
        let label = label.trim().to_string();
        if label.is_empty() {
            return Err("Arm label cannot be empty".to_string());
        }
        let item = self.get_mut(id)?;
        item.arms.push(ExperimentArm {
            id: new_id("arm"),
            label,
            config: config.trim().to_string(),
            status: "defined".to_string(),
            result: String::new(),
        });
        let out = item.clone();
        self.save()?;
        Ok(out)
    }

    pub fn set_arm_status(
        &mut self,
        id: &str,
        arm_id: &str,
        status: &str,
    ) -> Result<Experiment, String> {
        if !["defined", "running", "done"].contains(&status) {
            return Err(format!("Unknown arm status: {status}"));
        }
        let item = self.get_mut(id)?;
        let arm = item
            .arms
            .iter_mut()
            .find(|a| a.id == arm_id)
            .ok_or_else(|| format!("Unknown arm: {arm_id}"))?;
        arm.status = status.to_string();
        item.status = self_status(item);
        let out = item.clone();
        self.save()?;
        Ok(out)
    }

    pub fn set_arm_result(
        &mut self,
        id: &str,
        arm_id: &str,
        result: String,
    ) -> Result<Experiment, String> {
        let item = self.get_mut(id)?;
        let arm = item
            .arms
            .iter_mut()
            .find(|a| a.id == arm_id)
            .ok_or_else(|| format!("Unknown arm: {arm_id}"))?;
        arm.result = result;
        arm.status = "done".to_string();
        item.status = self_status(item);
        let out = item.clone();
        self.save()?;
        Ok(out)
    }

    pub fn choose_arm(&mut self, id: &str, arm_id: &str) -> Result<Experiment, String> {
        let item = self.get_mut(id)?;
        if !item.arms.iter().any(|a| a.id == arm_id) {
            return Err(format!("Unknown arm: {arm_id}"));
        }
        item.decision = Some(arm_id.to_string());
        item.status = "decided".to_string();
        let out = item.clone();
        self.save()?;
        Ok(out)
    }
}

/// Experiment status derived from its arms and decision.
fn self_status(item: &Experiment) -> String {
    if item.arms.iter().any(|a| a.status == "running") {
        "running".to_string()
    } else if item.decision.is_some() {
        "decided".to_string()
    } else {
        "draft".to_string()
    }
}
