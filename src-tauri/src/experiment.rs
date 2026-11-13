//! Experiments: the human's experimental designs, run through Loom.
//!
//! Persisted as structured JSON next to work.json. Arms are run as real
//! weave calls from the frontend; an arm's result is only ever the reply
//! text a real run returned. Nothing here invents metrics or progress.

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
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

#[derive(Debug)]
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

fn now_unix_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Path for a preserved copy of a corrupt store file, next to the original.
fn corrupt_backup_path(path: &PathBuf) -> PathBuf {
    let mut p = path.clone().into_os_string();
    p.push(format!(".corrupt-{}", now_unix_secs()));
    PathBuf::from(p)
}

impl ExperimentStore {
    /// Load the store. A missing file starts empty (and is created). A file
    /// that exists but cannot be read or parsed is **never** overwritten:
    /// it is moved aside to `<name>.corrupt-<unix-secs>` and loading fails
    /// with a message telling the user where the file went.
    /// Arms left "running" by a previous app run are reset to "defined":
    /// their run died with the process and can never complete.
    pub fn load(path: PathBuf) -> Result<Self, String> {
        match fs::read_to_string(&path) {
            Ok(text) => match serde_json::from_str::<Vec<Experiment>>(&text) {
                Ok(mut items) => {
                    let mut any_reset = false;
                    for exp in items.iter_mut() {
                        let mut reset = false;
                        for arm in exp.arms.iter_mut() {
                            if arm.status == "running" {
                                arm.status = "defined".to_string();
                                reset = true;
                            }
                        }
                        if reset {
                            exp.status = self_status(exp);
                            any_reset = true;
                        }
                    }
                    let store = Self { path, items };
                    if any_reset {
                        store.save()?;
                    }
                    Ok(store)
                }
                Err(e) => {
                    let backup = corrupt_backup_path(&path);
                    let _ = fs::rename(&path, &backup);
                    Err(format!(
                        "experiments.json is corrupt ({e}). The unreadable file was moved to {} so nothing is lost. Fix or delete that file, then restart.",
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

    pub fn items(&self) -> Vec<Experiment> {
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

    /// Experiments with at least two finished arms and no decision yet —
    /// the decisions currently waiting on the human.
    pub fn awaiting_decision(&self) -> Vec<Experiment> {
        self.items
            .iter()
            .filter(|e| {
                e.decision.is_none() && e.arms.iter().filter(|a| a.status == "done").count() >= 2
            })
            .cloned()
            .collect()
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
        // A new arm changes the comparison set, so a previous decision no
        // longer stands; recompute the status from arms + decision.
        item.decision = None;
        item.status = self_status(item);
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
        if status == "done" {
            return Err(
                "An arm can only become done by recording a result (set_arm_result).".to_string(),
            );
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
        if result.trim().is_empty() {
            return Err("Arm result cannot be empty.".to_string());
        }
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
        let arm = item
            .arms
            .iter()
            .find(|a| a.id == arm_id)
            .ok_or_else(|| format!("Unknown arm: {arm_id}"))?;
        if arm.status != "done" || arm.result.trim().is_empty() {
            return Err("Arm has not run yet.".to_string());
        }
        item.decision = Some(arm_id.to_string());
        item.status = "decided".to_string();
        let out = item.clone();
        self.save()?;
        Ok(out)
    }

    /// Revoke a decision (e.g. after a misclick) so the arms can be
    /// compared again. The runs and their results are kept.
    pub fn clear_decision(&mut self, id: &str) -> Result<Experiment, String> {
        let item = self.get_mut(id)?;
        item.decision = None;
        item.status = self_status(item);
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    struct TempDir {
        path: PathBuf,
    }

    impl TempDir {
        fn new(tag: &str) -> Self {
            let n = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join("loom-ide-tests").join(format!(
                "{}-{}-{}",
                std::process::id(),
                tag,
                n
            ));
            fs::create_dir_all(&path).unwrap();
            Self { path }
        }

        fn file(&self, name: &str) -> PathBuf {
            self.path.join(name)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn setup() -> (TempDir, ExperimentStore) {
        let dir = TempDir::new("exp");
        let store = ExperimentStore::load(dir.file("experiments.json")).unwrap();
        (dir, store)
    }

    fn two_done_arms(store: &mut ExperimentStore, id: &str) -> (String, String) {
        let exp = store
            .add_arm(id, "A".to_string(), "c1".to_string())
            .unwrap();
        let a1 = exp.arms[0].id.clone();
        let exp = store
            .add_arm(id, "B".to_string(), "c2".to_string())
            .unwrap();
        let a2 = exp.arms[1].id.clone();
        store
            .set_arm_result(id, &a1, "result A".to_string())
            .unwrap();
        store
            .set_arm_result(id, &a2, "result B".to_string())
            .unwrap();
        (a1, a2)
    }

    #[test]
    fn experiment_add_defaults_and_rejects_empty_title() {
        let (_dir, mut store) = setup();
        let exp = store
            .add("Title".to_string(), " Q ".to_string(), " H ".to_string())
            .unwrap();
        assert_eq!(exp.title, "Title");
        assert_eq!(exp.question, "Q");
        assert_eq!(exp.hypothesis, "H");
        assert_eq!(exp.status, "draft");
        assert!(exp.arms.is_empty());
        assert_eq!(exp.decision, None);
        assert!(
            store
                .add("".to_string(), "q".to_string(), "h".to_string())
                .is_err()
        );
        assert!(
            store
                .add("   ".to_string(), "q".to_string(), "h".to_string())
                .is_err()
        );
    }

    #[test]
    fn experiment_add_arm_validates_label_and_starts_defined() {
        let (_dir, mut store) = setup();
        let exp = store
            .add("T".to_string(), "q".to_string(), "h".to_string())
            .unwrap();
        let out = store
            .add_arm(&exp.id, "  Baseline  ".to_string(), " cfg ".to_string())
            .unwrap();
        assert_eq!(out.arms.len(), 1);
        assert_eq!(out.arms[0].label, "Baseline");
        assert_eq!(out.arms[0].config, "cfg");
        assert_eq!(out.arms[0].status, "defined");
        assert_eq!(out.arms[0].result, "");
        assert!(
            store
                .add_arm(&exp.id, "  ".to_string(), "c".to_string())
                .is_err()
        );
        assert!(
            store
                .add_arm("no-such-id", "x".to_string(), "c".to_string())
                .is_err()
        );
    }

    #[test]
    fn experiment_add_arm_clears_a_previous_decision() {
        let (_dir, mut store) = setup();
        let exp = store
            .add("T".to_string(), "q".to_string(), "h".to_string())
            .unwrap();
        let (a1, _a2) = two_done_arms(&mut store, &exp.id);
        let decided = store.choose_arm(&exp.id, &a1).unwrap();
        assert_eq!(decided.status, "decided");
        assert_eq!(decided.decision.as_deref(), Some(a1.as_str()));
        // A new arm changes the comparison set: the decision no longer stands.
        let out = store
            .add_arm(&exp.id, "C".to_string(), "c3".to_string())
            .unwrap();
        assert_eq!(out.decision, None);
        assert_eq!(out.status, "draft");
    }

    #[test]
    fn experiment_set_arm_status_rejects_done_and_unknown() {
        let (_dir, mut store) = setup();
        let exp = store
            .add("T".to_string(), "q".to_string(), "h".to_string())
            .unwrap();
        let exp = store
            .add_arm(&exp.id, "A".to_string(), "c".to_string())
            .unwrap();
        let arm = exp.arms[0].id.clone();
        assert_eq!(
            store
                .set_arm_status(&exp.id, &arm, "running")
                .unwrap()
                .status,
            "running"
        );
        // "done" can only come from recording a result.
        let err = store.set_arm_status(&exp.id, &arm, "done").unwrap_err();
        assert!(err.contains("set_arm_result"), "error was: {err}");
        assert!(store.set_arm_status(&exp.id, &arm, "bogus").is_err());
        assert!(
            store
                .set_arm_status(&exp.id, "no-such-arm", "running")
                .is_err()
        );
    }

    #[test]
    fn experiment_set_arm_result_requires_nonempty_and_marks_done() {
        let (_dir, mut store) = setup();
        let exp = store
            .add("T".to_string(), "q".to_string(), "h".to_string())
            .unwrap();
        let exp = store
            .add_arm(&exp.id, "A".to_string(), "c".to_string())
            .unwrap();
        let arm = exp.arms[0].id.clone();
        assert!(
            store
                .set_arm_result(&exp.id, &arm, "   ".to_string())
                .is_err()
        );
        let out = store
            .set_arm_result(&exp.id, &arm, "the reply".to_string())
            .unwrap();
        assert_eq!(out.arms[0].status, "done");
        assert_eq!(out.arms[0].result, "the reply");
    }

    #[test]
    fn experiment_choose_arm_requires_a_finished_arm() {
        let (_dir, mut store) = setup();
        let exp = store
            .add("T".to_string(), "q".to_string(), "h".to_string())
            .unwrap();
        let exp = store
            .add_arm(&exp.id, "A".to_string(), "c".to_string())
            .unwrap();
        let arm = exp.arms[0].id.clone();
        assert!(store.choose_arm(&exp.id, &arm).is_err());
        store
            .set_arm_result(&exp.id, &arm, "r".to_string())
            .unwrap();
        let decided = store.choose_arm(&exp.id, &arm).unwrap();
        assert_eq!(decided.status, "decided");
        assert_eq!(decided.decision.as_deref(), Some(arm.as_str()));
        assert!(store.choose_arm(&exp.id, "no-such-arm").is_err());
    }

    #[test]
    fn experiment_clear_decision_keeps_results_and_restores_draft() {
        let (_dir, mut store) = setup();
        let exp = store
            .add("T".to_string(), "q".to_string(), "h".to_string())
            .unwrap();
        let (a1, _a2) = two_done_arms(&mut store, &exp.id);
        store.choose_arm(&exp.id, &a1).unwrap();
        let cleared = store.clear_decision(&exp.id).unwrap();
        assert_eq!(cleared.decision, None);
        assert_eq!(cleared.status, "draft");
        assert_eq!(cleared.arms[0].result, "result A");
        assert_eq!(cleared.arms[1].result, "result B");
    }

    #[test]
    fn experiment_awaiting_decision_needs_two_finished_arms() {
        let (_dir, mut store) = setup();
        let exp = store
            .add("T".to_string(), "q".to_string(), "h".to_string())
            .unwrap();
        assert!(store.awaiting_decision().is_empty());
        let exp = store
            .add_arm(&exp.id, "A".to_string(), "c1".to_string())
            .unwrap();
        let a1 = exp.arms[0].id.clone();
        store.set_arm_result(&exp.id, &a1, "r".to_string()).unwrap();
        assert!(
            store.awaiting_decision().is_empty(),
            "one done arm is not enough"
        );
        let exp = store
            .add_arm(&exp.id, "B".to_string(), "c2".to_string())
            .unwrap();
        let a2 = exp.arms[1].id.clone();
        store.set_arm_result(&exp.id, &a2, "r".to_string()).unwrap();
        assert_eq!(store.awaiting_decision().len(), 1);
        store.choose_arm(&exp.id, &a1).unwrap();
        assert!(store.awaiting_decision().is_empty());
    }

    #[test]
    fn experiment_load_resets_running_arms_to_defined() {
        let dir = TempDir::new("exp-load-running");
        let path = dir.file("experiments.json");
        let file = serde_json::json!([{
            "id": "exp-1", "title": "T", "question": "q", "hypothesis": "h",
            "status": "running",
            "arms": [
                {"id": "arm-1", "label": "A", "config": "c", "status": "running", "result": ""},
                {"id": "arm-2", "label": "B", "config": "c", "status": "done", "result": "r"}
            ],
            "decision": null
        }]);
        fs::write(&path, serde_json::to_string(&file).unwrap()).unwrap();
        let store = ExperimentStore::load(path).unwrap();
        let exp = &store.items()[0];
        assert_eq!(
            exp.arms[0].status, "defined",
            "a run that died with the process can never complete"
        );
        assert_eq!(exp.arms[1].status, "done");
        assert_eq!(exp.status, "draft");
    }

    #[test]
    fn experiment_save_load_round_trip_and_corrupt_handling() {
        let dir = TempDir::new("exp-roundtrip");
        let path = dir.file("experiments.json");
        {
            let mut store = ExperimentStore::load(path.clone()).unwrap();
            let exp = store
                .add("T".to_string(), "q".to_string(), "h".to_string())
                .unwrap();
            two_done_arms(&mut store, &exp.id);
        }
        let store = ExperimentStore::load(path.clone()).unwrap();
        assert_eq!(store.items().len(), 1);
        assert_eq!(store.items()[0].arms.len(), 2);
        assert_eq!(store.awaiting_decision().len(), 1);
        // Corrupt file: moved aside, error names it.
        fs::write(&path, "nope{{{").unwrap();
        let err = ExperimentStore::load(path.clone()).unwrap_err();
        assert!(err.contains("corrupt"), "error was: {err}");
        assert!(!path.exists());
    }
}
