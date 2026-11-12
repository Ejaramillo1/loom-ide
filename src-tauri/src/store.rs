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
    /// The intent this work belongs to. Every work item created after
    /// intents exist points at one; older items predate intents and have
    /// none (they are unaffected by intent autonomy rules).
    #[serde(default)]
    pub intent_id: Option<String>,
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

/// The four autonomy levels, least to most permissive. The same scale is
/// used by intents and by work items: an intent's level is inherited by
/// its work, and a work item may only be tightened below it, never
/// loosened above it without the person. (L5 Autonomous is out of scope.)
pub const AUTONOMY_LEVELS: [&str; 4] = ["manual", "assisted", "collaborative", "delegated"];

/// Rank of an autonomy level (0 = manual, 3 = delegated), or None for an
/// unknown level. Higher rank means more freedom for the system.
pub fn autonomy_rank(level: &str) -> Option<usize> {
    AUTONOMY_LEVELS.iter().position(|l| *l == level)
}

fn default_intent_autonomy() -> String {
    "collaborative".to_string()
}

fn default_intent_status() -> String {
    "active".to_string()
}

fn default_intent_version() -> u32 {
    1
}

/// One acceptance criterion: what "done" means for an intent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcceptanceCriterion {
    pub text: String,
    #[serde(default)]
    pub done: bool,
}

/// A snapshot of an intent as it was before a content change: the previous
/// version's statement, why, acceptance list and last-updated time.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentVersion {
    pub version: u32,
    pub statement: String,
    #[serde(default)]
    pub why: Option<String>,
    #[serde(default)]
    pub acceptance: Vec<AcceptanceCriterion>,
    #[serde(default)]
    pub updated_at: i64,
}

/// An Intent is the primary object: what the person wants, why, what
/// "done" means (acceptance criteria), and how much freedom the system
/// has (autonomy). One intent owns many pieces of work.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Intent {
    pub id: String,
    pub statement: String,
    #[serde(default)]
    pub why: Option<String>,
    #[serde(default)]
    pub acceptance: Vec<AcceptanceCriterion>,
    /// "manual" | "assisted" | "collaborative" | "delegated"
    #[serde(default = "default_intent_autonomy")]
    pub autonomy: String,
    /// "active" | "done"
    #[serde(default = "default_intent_status")]
    pub status: String,
    /// Starts at 1; bumped on every statement/why/autonomy change.
    #[serde(default = "default_intent_version")]
    pub version: u32,
    /// Snapshots of previous versions, oldest first.
    #[serde(default)]
    pub history: Vec<IntentVersion>,
    #[serde(default)]
    pub created_at: i64,
    #[serde(default)]
    pub updated_at: i64,
}

/// On-disk shape of intents.json.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct IntentsFile {
    #[serde(default)]
    active_intent_id: Option<String>,
    #[serde(default)]
    intents: Vec<Intent>,
}

/// Trim acceptance criteria and drop empties, keeping the done flag.
fn normalize_acceptance(criteria: Vec<AcceptanceCriterion>) -> Vec<AcceptanceCriterion> {
    criteria
        .into_iter()
        .map(|c| AcceptanceCriterion {
            text: c.text.trim().to_string(),
            done: c.done,
        })
        .filter(|c| !c.text.is_empty())
        .collect()
}

fn new_intent_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let n = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("intent-{nanos}-{n}")
}

pub struct IntentStore {
    path: PathBuf,
    active_intent_id: Option<String>,
    intents: Vec<Intent>,
}

impl IntentStore {
    /// Load the store, following the WorkStore pattern exactly: a missing
    /// file starts empty (and is created); a file that exists but cannot
    /// be read or parsed is **never** overwritten — it is moved aside to
    /// `<name>.corrupt-<unix-secs>` and loading fails with a message
    /// telling the user where the file went.
    pub fn load(path: PathBuf) -> Result<Self, String> {
        match fs::read_to_string(&path) {
            Ok(text) => match serde_json::from_str::<IntentsFile>(&text) {
                Ok(mut file) => {
                    // Defensive dedup: keep the first intent of each id.
                    let mut seen = std::collections::HashSet::new();
                    let before = file.intents.len();
                    file.intents.retain(|i| seen.insert(i.id.clone()));
                    let mut changed = file.intents.len() != before;
                    // Drop a dangling active pointer (its intent is gone).
                    if let Some(active) = &file.active_intent_id {
                        if !file.intents.iter().any(|i| &i.id == active) {
                            file.active_intent_id = None;
                            changed = true;
                        }
                    }
                    let store = Self {
                        path,
                        active_intent_id: file.active_intent_id,
                        intents: file.intents,
                    };
                    if changed {
                        store.save()?;
                    }
                    Ok(store)
                }
                Err(e) => {
                    let backup = corrupt_backup_path(&path);
                    let _ = fs::rename(&path, &backup);
                    Err(format!(
                        "intents.json is corrupt ({e}). The unreadable file was moved to {} so nothing is lost. Fix or delete that file, then restart.",
                        backup.display()
                    ))
                }
            },
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                let store = Self {
                    path,
                    active_intent_id: None,
                    intents: Vec::new(),
                };
                store.save()?;
                Ok(store)
            }
            Err(e) => Err(format!("Cannot read {}: {e}", path.display())),
        }
    }

    /// Save atomically: write to a temp file in the same directory, fsync
    /// it, then rename over the live file, so a crash mid-write can never
    /// leave a truncated store behind.
    pub fn save(&self) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let file = IntentsFile {
            active_intent_id: self.active_intent_id.clone(),
            intents: self.intents.clone(),
        };
        let text = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
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

    /// (active intent id, all intents, newest first).
    pub fn list(&self) -> (Option<String>, Vec<Intent>) {
        (self.active_intent_id.clone(), self.intents.clone())
    }

    pub fn get(&self, id: &str) -> Option<Intent> {
        self.intents.iter().find(|i| i.id == id).cloned()
    }

    pub fn active_id(&self) -> Option<String> {
        self.active_intent_id.clone()
    }

    pub fn active(&self) -> Option<Intent> {
        self.active_intent_id
            .as_ref()
            .and_then(|id| self.get(id))
    }

    /// Create an intent. The statement is required and non-empty; `why`
    /// and `acceptance` are normalized (trimmed, empties dropped);
    /// autonomy defaults to "collaborative". The first intent ever created
    /// also becomes the active one.
    pub fn create(
        &mut self,
        statement: String,
        why: Option<String>,
        acceptance: Vec<AcceptanceCriterion>,
        autonomy: Option<String>,
    ) -> Result<Intent, String> {
        let statement = statement.trim().to_string();
        if statement.is_empty() {
            return Err("Intent statement cannot be empty".to_string());
        }
        let autonomy = match autonomy {
            Some(a) => {
                let a = a.trim().to_string();
                if autonomy_rank(&a).is_none() {
                    return Err(format!("Unknown autonomy level: {a}"));
                }
                a
            }
            None => default_intent_autonomy(),
        };
        let why = why.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
        let acceptance = normalize_acceptance(acceptance);
        let now = now_unix_secs();
        let id = new_intent_id();
        let first = self.intents.is_empty();
        let intent = Intent {
            id: id.clone(),
            statement,
            why,
            acceptance,
            autonomy,
            status: default_intent_status(),
            version: default_intent_version(),
            history: Vec::new(),
            created_at: now,
            updated_at: now,
        };
        if first {
            self.active_intent_id = Some(id);
        }
        self.intents.insert(0, intent.clone());
        self.save()?;
        Ok(intent)
    }

    /// Update an intent. Any change to statement, why or autonomy bumps
    /// the version and pushes a snapshot of the previous version into
    /// history; a status-only change does not bump the version. A `why`
    /// of `Some("")` clears it; `None` leaves it unchanged. A no-op
    /// update (nothing actually differs) returns the intent unchanged.
    pub fn update(
        &mut self,
        id: &str,
        statement: Option<String>,
        why: Option<String>,
        autonomy: Option<String>,
        status: Option<String>,
    ) -> Result<Intent, String> {
        // Validate everything before mutating anything.
        let statement = statement.map(|s| s.trim().to_string());
        if let Some(s) = &statement {
            if s.is_empty() {
                return Err("Intent statement cannot be empty".to_string());
            }
        }
        let autonomy = autonomy.map(|s| s.trim().to_string());
        if let Some(a) = &autonomy {
            if autonomy_rank(a).is_none() {
                return Err(format!("Unknown autonomy level: {a}"));
            }
        }
        let status = status.map(|s| s.trim().to_string());
        if let Some(s) = &status {
            if s != "active" && s != "done" {
                return Err(format!("Unknown intent status: {s}"));
            }
        }
        // Outer None = leave unchanged; Some(None) = clear; Some(Some) = set.
        let why = why.map(|s| {
            let t = s.trim().to_string();
            if t.is_empty() {
                None
            } else {
                Some(t)
            }
        });

        let intent = self
            .intents
            .iter_mut()
            .find(|i| i.id == id)
            .ok_or_else(|| format!("Unknown intent: {id}"))?;

        let mut content_changed = false;
        if let Some(s) = &statement {
            if *s != intent.statement {
                content_changed = true;
            }
        }
        if let Some(w) = &why {
            if *w != intent.why {
                content_changed = true;
            }
        }
        if let Some(a) = &autonomy {
            if *a != intent.autonomy {
                content_changed = true;
            }
        }
        let status_changed = match &status {
            Some(s) => *s != intent.status,
            None => false,
        };

        if content_changed {
            let snapshot = IntentVersion {
                version: intent.version,
                statement: intent.statement.clone(),
                why: intent.why.clone(),
                acceptance: intent.acceptance.clone(),
                updated_at: intent.updated_at,
            };
            intent.history.push(snapshot);
            intent.version += 1;
        }
        if let Some(s) = statement {
            intent.statement = s;
        }
        if let Some(w) = why {
            intent.why = w;
        }
        if let Some(a) = autonomy {
            intent.autonomy = a;
        }
        if let Some(s) = status {
            intent.status = s;
        }
        if content_changed || status_changed {
            intent.updated_at = now_unix_secs();
            let out = intent.clone();
            self.save()?;
            Ok(out)
        } else {
            Ok(intent.clone())
        }
    }

    /// Replace the acceptance criteria (trimmed, empties dropped). This
    /// does NOT bump the version: acceptance is what "done" means, not a
    /// restatement of the intent.
    pub fn set_acceptance(
        &mut self,
        id: &str,
        criteria: Vec<AcceptanceCriterion>,
    ) -> Result<Intent, String> {
        let criteria = normalize_acceptance(criteria);
        let intent = self
            .intents
            .iter_mut()
            .find(|i| i.id == id)
            .ok_or_else(|| format!("Unknown intent: {id}"))?;
        intent.acceptance = criteria;
        intent.updated_at = now_unix_secs();
        let out = intent.clone();
        self.save()?;
        Ok(out)
    }

    /// Make an intent the active one. Errors on an unknown id.
    pub fn set_active(&mut self, id: &str) -> Result<Intent, String> {
        let intent = self
            .intents
            .iter()
            .find(|i| i.id == id)
            .ok_or_else(|| format!("Unknown intent: {id}"))?
            .clone();
        self.active_intent_id = Some(id.to_string());
        self.save()?;
        Ok(intent)
    }

    /// Delete an intent. Refuses with the count of referencing work items
    /// when any work item points at it — deleting it would orphan that
    /// work. Clears the active pointer when it pointed at this intent.
    pub fn delete(&mut self, id: &str, work: &WorkStore) -> Result<bool, String> {
        let count = work
            .items()
            .iter()
            .filter(|w| w.intent_id.as_deref() == Some(id))
            .count();
        if count > 0 {
            return Err(format!(
                "Cannot delete intent {id}: {count} work item(s) still reference it. Reassign or delete that work first."
            ));
        }
        let pos = self
            .intents
            .iter()
            .position(|i| i.id == id)
            .ok_or_else(|| format!("Unknown intent: {id}"))?;
        self.intents.remove(pos);
        if self.active_intent_id.as_deref() == Some(id) {
            self.active_intent_id = None;
        }
        self.save()?;
        Ok(true)
    }
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

    /// The caller resolves the intent (see lib.rs): the store only records
    /// the given intent_id. New work starts at "collaborative"; the caller
    /// then applies the intent's autonomy (inheritance).
    pub fn add(&mut self, title: String, intent_id: Option<String>) -> Result<WorkItem, String> {
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
            intent_id,
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
        if autonomy_rank(autonomy).is_none() {
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
