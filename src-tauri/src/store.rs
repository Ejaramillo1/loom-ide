//! Work items and attention items.
//! Work items are the only data persisted to disk (structured JSON),
//! mirroring the existing eframe app. The store starts empty: work
//! items come from the user creating them. Attention items are derived
//! locally from experiments awaiting a decision; collaboration.proto
//! defines no service, so there is nothing to wire for collaboration
//! steps (§2.6.5).

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
    /// History of autonomy changes for this work item, oldest first.
    #[serde(default)]
    pub autonomy_history: Vec<AutonomyChange>,
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

/// A record of an autonomy change: from what level, to what level,
/// with optional justification (required when raising).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutonomyChange {
    pub from: String,
    pub to: String,
    /// Required when raising autonomy (loosening). Optional when lowering.
    pub justification: Option<String>,
    pub at: i64,
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
    /// Optional per-turn budget: maximum agent rounds. `None` means the
    /// server default (3) applies. Sent on both weave paths (W-1).
    #[serde(default)]
    pub max_rounds: Option<i32>,
    /// Optional per-turn deadline in seconds. `None` means the server
    /// default (300) applies; the server enforces it via context.WithTimeout.
    #[serde(default)]
    pub timeout_seconds: Option<i32>,
    /// "active" | "done"
    #[serde(default = "default_intent_status")]
    pub status: String,
    /// Starts at 1; bumped on every statement/why/autonomy change.
    #[serde(default = "default_intent_version")]
    pub version: u32,
    /// Snapshots of previous versions, oldest first.
    #[serde(default)]
    pub history: Vec<IntentVersion>,
    /// History of autonomy changes, oldest first. Each entry records the
    /// from/to levels and any justification (required when raising).
    #[serde(default)]
    pub autonomy_history: Vec<AutonomyChange>,
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

/// Validate an optional budget value on create: `None` means the server
/// default, a positive integer is kept, anything else is an error.
fn normalize_budget(value: Option<i32>, name: &str) -> Result<Option<i32>, String> {
    match value {
        None => Ok(None),
        Some(v) if v > 0 => Ok(Some(v)),
        Some(_) => Err(format!("{name} must be a positive whole number")),
    }
}

/// Resolve a budget change on update into the store's `Option` form.
/// Outer `None` = leave unchanged; `Some(0)` = clear (back to server
/// default); `Some(v > 0)` = set; `Some(v < 0)` = error.
fn normalize_budget_update(value: Option<i32>, name: &str) -> Result<Option<Option<i32>>, String> {
    match value {
        None => Ok(None),
        Some(0) => Ok(Some(None)),
        Some(v) if v > 0 => Ok(Some(Some(v))),
        Some(_) => Err(format!(
            "{name} must be a positive whole number, or 0 to clear"
        )),
    }
}

fn new_intent_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let n = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("intent-{nanos}-{n}")
}

#[derive(Debug)]
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
                    // A bogus level or status fails loudly: the fields
                    // default only when *missing*. A present-but-unknown
                    // value previously flowed through and was treated as
                    // rank 0 / an unrenderable status.
                    for i in &file.intents {
                        if autonomy_rank(&i.autonomy).is_none() {
                            return Err(format!(
                                "intents.json: intent {} has unknown autonomy level \"{}\" (expected one of manual, assisted, collaborative, delegated). Fix the file, then restart.",
                                i.id, i.autonomy
                            ));
                        }
                        if i.status != "active" && i.status != "done" {
                            return Err(format!(
                                "intents.json: intent {} has unknown status \"{}\" (expected active or done). Fix the file, then restart.",
                                i.id, i.status
                            ));
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
        self.active_intent_id.as_ref().and_then(|id| self.get(id))
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
        max_rounds: Option<i32>,
        timeout_seconds: Option<i32>,
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
        let max_rounds = normalize_budget(max_rounds, "Max rounds")?;
        let timeout_seconds = normalize_budget(timeout_seconds, "Timeout seconds")?;
        let now = now_unix_secs();
        let id = new_intent_id();
        let first = self.intents.is_empty();
        let intent = Intent {
            id: id.clone(),
            statement,
            why,
            acceptance,
            autonomy,
            max_rounds,
            timeout_seconds,
            status: default_intent_status(),
            version: default_intent_version(),
            history: Vec::new(),
            autonomy_history: Vec::new(),
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
        justification: Option<String>,
        max_rounds: Option<i32>,
        timeout_seconds: Option<i32>,
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
        // Budget: None = leave unchanged; Some(0) = clear; Some(v>0) = set.
        let max_rounds = normalize_budget_update(max_rounds, "Max rounds")?;
        let timeout_seconds = normalize_budget_update(timeout_seconds, "Timeout seconds")?;
        // Outer None = leave unchanged; Some(None) = clear; Some(Some) = set.
        let why = why.map(|s| {
            let t = s.trim().to_string();
            if t.is_empty() { None } else { Some(t) }
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
                // Moving down (tightening) is always instant; moving up
                // (loosening) requires justification — the system never
                // grants itself more freedom.
                let old_rank = autonomy_rank(&intent.autonomy).unwrap_or(0);
                let new_rank = autonomy_rank(a).unwrap_or(0);
                if new_rank > old_rank {
                    let just = justification.as_deref().unwrap_or("").trim();
                    if just.is_empty() {
                        return Err(format!(
                            "Raising autonomy from \"{}\" to \"{}\" requires a justification — why is more freedom needed?",
                            intent.autonomy, a
                        ));
                    }
                }
                content_changed = true;
                intent.autonomy_history.push(AutonomyChange {
                    from: intent.autonomy.clone(),
                    to: a.clone(),
                    justification: justification
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty()),
                    at: now_unix_secs(),
                });
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
        // Budget is a runtime control, not a content change: it does not
        // bump the version, but it persists and updates the timestamp.
        let mut budget_changed = false;
        if let Some(mr) = max_rounds {
            if mr != intent.max_rounds {
                budget_changed = true;
            }
            intent.max_rounds = mr;
        }
        if let Some(ts) = timeout_seconds {
            if ts != intent.timeout_seconds {
                budget_changed = true;
            }
            intent.timeout_seconds = ts;
        }
        if content_changed || status_changed || budget_changed {
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

#[derive(Debug)]
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
                    // A bogus level or status fails loudly, like intents:
                    // a present-but-unknown value previously flowed
                    // through and was treated as rank 0 / unrenderable.
                    for w in &items {
                        if autonomy_rank(&w.autonomy).is_none() {
                            return Err(format!(
                                "work.json: work item {} has unknown autonomy level \"{}\" (expected one of manual, assisted, collaborative, delegated). Fix the file, then restart.",
                                w.id, w.autonomy
                            ));
                        }
                        if w.status != "active" && w.status != "paused" {
                            return Err(format!(
                                "work.json: work item {} has unknown status \"{}\" (expected active or paused). Fix the file, then restart.",
                                w.id, w.status
                            ));
                        }
                    }
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
            autonomy_history: Vec::new(),
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

    /// Push an autonomy change record onto a work item's history.
    pub fn autonomy_history_push(
        &mut self,
        id: &str,
        to: &str,
        justification: Option<String>,
    ) -> Result<(), String> {
        let item = self
            .items
            .iter_mut()
            .find(|w| w.id == id)
            .ok_or_else(|| format!("Unknown work item: {id}"))?;
        let from = item.autonomy.clone();
        item.autonomy_history.push(AutonomyChange {
            from,
            to: to.to_string(),
            justification,
            at: now_unix_secs(),
        });
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicU64;

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    /// A fresh temp dir per test, removed on drop. Tests run in parallel
    /// in one process, so each dir is unique (pid + tag + counter).
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

    fn acc(text: &str, done: bool) -> AcceptanceCriterion {
        AcceptanceCriterion {
            text: text.to_string(),
            done,
        }
    }

    fn work_file_json(items: serde_json::Value) -> String {
        serde_json::to_string(&items).unwrap()
    }

    // ------------------------------------------------------------------
    // autonomy_rank
    // ------------------------------------------------------------------

    #[test]
    fn autonomy_rank_orders_the_four_levels() {
        assert_eq!(autonomy_rank("manual"), Some(0));
        assert_eq!(autonomy_rank("assisted"), Some(1));
        assert_eq!(autonomy_rank("collaborative"), Some(2));
        assert_eq!(autonomy_rank("delegated"), Some(3));
    }

    #[test]
    fn autonomy_rank_rejects_unknown_levels() {
        assert_eq!(autonomy_rank("autonomous"), None);
        assert_eq!(autonomy_rank(""), None);
        assert_eq!(autonomy_rank("Manual"), None);
    }

    // ------------------------------------------------------------------
    // WorkStore
    // ------------------------------------------------------------------

    #[test]
    fn work_add_starts_paused_collaborative_with_unique_ids() {
        let dir = TempDir::new("work-add");
        let mut store = WorkStore::load(dir.file("work.json")).unwrap();
        let a = store.add("  Fix the thing  ".to_string(), None).unwrap();
        let b = store
            .add("Second".to_string(), Some("intent-1".to_string()))
            .unwrap();
        assert_ne!(a.id, b.id);
        assert!(a.id.starts_with("work-"));
        assert_eq!(a.title, "Fix the thing");
        assert_eq!(a.status, "paused");
        assert_eq!(a.autonomy, "collaborative");
        assert_eq!(a.intent_id, None);
        assert_eq!(b.intent_id.as_deref(), Some("intent-1"));
        assert!(a.updated_at > 0);
    }

    #[test]
    fn work_add_rejects_empty_title() {
        let dir = TempDir::new("work-add-empty");
        let mut store = WorkStore::load(dir.file("work.json")).unwrap();
        assert!(store.add("".to_string(), None).is_err());
        assert!(store.add("   ".to_string(), None).is_err());
        assert_eq!(store.items().len(), 0);
    }

    #[test]
    fn work_set_status_validates() {
        let dir = TempDir::new("work-status");
        let mut store = WorkStore::load(dir.file("work.json")).unwrap();
        let item = store.add("T".to_string(), None).unwrap();
        assert_eq!(
            store.set_status(&item.id, "active").unwrap().status,
            "active"
        );
        assert_eq!(
            store.set_status(&item.id, "paused").unwrap().status,
            "paused"
        );
        assert!(store.set_status(&item.id, "done").is_err());
        assert!(store.set_status(&item.id, "").is_err());
        assert!(store.set_status("no-such-id", "active").is_err());
    }

    #[test]
    fn work_set_autonomy_validates_levels() {
        let dir = TempDir::new("work-autonomy");
        let mut store = WorkStore::load(dir.file("work.json")).unwrap();
        let item = store.add("T".to_string(), None).unwrap();
        for level in ["manual", "assisted", "collaborative", "delegated"] {
            assert_eq!(store.set_autonomy(&item.id, level).unwrap().autonomy, level);
        }
        // L5 Autonomous is out of scope and must be rejected.
        assert!(store.set_autonomy(&item.id, "autonomous").is_err());
        assert!(store.set_autonomy(&item.id, "").is_err());
        assert!(store.set_autonomy("no-such-id", "manual").is_err());
    }

    #[test]
    fn work_set_session_sets_and_clears() {
        let dir = TempDir::new("work-session");
        let mut store = WorkStore::load(dir.file("work.json")).unwrap();
        let item = store.add("T".to_string(), None).unwrap();
        let with = store
            .set_session(&item.id, Some("sess-1".to_string()))
            .unwrap();
        assert_eq!(with.session_id.as_deref(), Some("sess-1"));
        // Whitespace-only clears, exactly like None.
        let cleared = store
            .set_session(&item.id, Some("   ".to_string()))
            .unwrap();
        assert_eq!(cleared.session_id, None);
        let cleared2 = store.set_session(&item.id, None).unwrap();
        assert_eq!(cleared2.session_id, None);
    }

    #[test]
    fn work_set_success_criteria_trims_and_drops_empties() {
        let dir = TempDir::new("work-criteria");
        let mut store = WorkStore::load(dir.file("work.json")).unwrap();
        let item = store.add("T".to_string(), None).unwrap();
        let out = store
            .set_success_criteria(
                &item.id,
                vec![
                    " Done ".to_string(),
                    "".to_string(),
                    "   ".to_string(),
                    "Later".to_string(),
                ],
            )
            .unwrap();
        assert_eq!(out.success_criteria, vec!["Done", "Later"]);
    }

    #[test]
    fn work_set_artifacts_trims_and_drops_empties() {
        let dir = TempDir::new("work-artifacts");
        let mut store = WorkStore::load(dir.file("work.json")).unwrap();
        let item = store.add("T".to_string(), None).unwrap();
        let out = store
            .set_artifacts(
                &item.id,
                vec![" art-1 ".to_string(), "".to_string(), "art-2".to_string()],
            )
            .unwrap();
        assert_eq!(out.artifact_ids, vec!["art-1", "art-2"]);
    }

    #[test]
    fn work_autonomy_history_push_records_from_and_to() {
        let dir = TempDir::new("work-history");
        let mut store = WorkStore::load(dir.file("work.json")).unwrap();
        let item = store.add("T".to_string(), None).unwrap();
        assert_eq!(item.autonomy, "collaborative");
        // The push records from the item's CURRENT autonomy; the caller
        // then applies the change (this mirrors the set_work_autonomy
        // command: push first, set_autonomy second).
        store
            .autonomy_history_push(&item.id, "manual", None)
            .unwrap();
        store.set_autonomy(&item.id, "manual").unwrap();
        store
            .autonomy_history_push(
                &item.id,
                "delegated",
                Some("needed for the demo".to_string()),
            )
            .unwrap();
        store.set_autonomy(&item.id, "delegated").unwrap();
        let item = store.items().into_iter().find(|w| w.id == item.id).unwrap();
        assert_eq!(item.autonomy_history.len(), 2);
        assert_eq!(item.autonomy_history[0].from, "collaborative");
        assert_eq!(item.autonomy_history[0].to, "manual");
        assert_eq!(item.autonomy_history[0].justification, None);
        assert!(item.autonomy_history[0].at > 0);
        assert_eq!(item.autonomy_history[1].from, "manual");
        assert_eq!(item.autonomy_history[1].to, "delegated");
        assert_eq!(
            item.autonomy_history[1].justification.as_deref(),
            Some("needed for the demo")
        );
        assert!(
            store
                .autonomy_history_push("no-such-id", "manual", None)
                .is_err()
        );
    }

    #[test]
    fn work_save_load_round_trip_preserves_everything() {
        let dir = TempDir::new("work-roundtrip");
        let path = dir.file("work.json");
        let id;
        {
            let mut store = WorkStore::load(path.clone()).unwrap();
            let item = store
                .add("T".to_string(), Some("intent-9".to_string()))
                .unwrap();
            id = item.id.clone();
            store.set_session(&id, Some("sess-7".to_string())).unwrap();
            store
                .set_success_criteria(&id, vec!["Done".to_string()])
                .unwrap();
            store.set_autonomy(&id, "manual").unwrap();
        }
        let store = WorkStore::load(path).unwrap();
        let items = store.items();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, id);
        assert_eq!(items[0].title, "T");
        assert_eq!(items[0].intent_id.as_deref(), Some("intent-9"));
        assert_eq!(items[0].session_id.as_deref(), Some("sess-7"));
        assert_eq!(items[0].success_criteria, vec!["Done"]);
        assert_eq!(items[0].autonomy, "manual");
    }

    #[test]
    fn work_load_missing_file_starts_empty_and_creates_it() {
        let dir = TempDir::new("work-missing");
        let path = dir.file("work.json");
        assert!(!path.exists());
        let store = WorkStore::load(path.clone()).unwrap();
        assert!(store.items().is_empty());
        assert!(path.exists());
    }

    #[test]
    fn work_load_corrupt_file_moves_it_aside_and_errors() {
        let dir = TempDir::new("work-corrupt");
        let path = dir.file("work.json");
        fs::write(&path, "this is not json{{{").unwrap();
        let err = WorkStore::load(path.clone()).unwrap_err();
        assert!(err.contains("corrupt"), "error was: {err}");
        assert!(!path.exists(), "corrupt file must be moved aside, not kept");
        let backup = fs::read_dir(&dir.path)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .find(|n| n.starts_with("work.json.corrupt-"));
        assert!(backup.is_some(), "no .corrupt- backup found");
    }

    #[test]
    fn work_load_dedups_duplicate_ids_keeping_the_first() {
        let dir = TempDir::new("work-dedup");
        let path = dir.file("work.json");
        let first = serde_json::json!({
            "id": "work-1", "title": "First", "status": "paused",
            "autonomy": "collaborative", "updated_label": "Now", "updated_at": 10
        });
        let dup = serde_json::json!({
            "id": "work-1", "title": "Duplicate", "status": "active",
            "autonomy": "manual", "updated_label": "Now", "updated_at": 20
        });
        fs::write(&path, work_file_json(serde_json::json!([first, dup]))).unwrap();
        let store = WorkStore::load(path.clone()).unwrap();
        assert_eq!(store.items().len(), 1);
        assert_eq!(store.items()[0].title, "First");
        // The deduped file is written back.
        let reloaded = WorkStore::load(path).unwrap();
        assert_eq!(reloaded.items().len(), 1);
    }

    #[test]
    fn work_load_legacy_item_without_new_fields_uses_defaults() {
        let dir = TempDir::new("work-legacy");
        let path = dir.file("work.json");
        // Written before intents / sessions / history existed.
        let legacy = serde_json::json!([{
            "id": "work-old", "title": "Old", "status": "active",
            "autonomy": "manual", "updated_label": "2h"
        }]);
        fs::write(&path, work_file_json(legacy)).unwrap();
        let store = WorkStore::load(path).unwrap();
        let item = &store.items()[0];
        assert_eq!(item.updated_at, 0);
        assert_eq!(item.session_id, None);
        assert_eq!(item.intent_id, None);
        assert!(item.success_criteria.is_empty());
        assert!(item.autonomy_history.is_empty());
    }

    #[test]
    fn work_load_rejects_unknown_autonomy_and_status() {
        let dir = TempDir::new("work-load-bad-values");
        let path = dir.file("work.json");
        let bad_level = serde_json::json!([{
            "id": "w-1", "title": "T", "status": "active",
            "autonomy": "superuser", "updated_label": "Now"
        }]);
        fs::write(&path, serde_json::to_string(&bad_level).unwrap()).unwrap();
        let err = WorkStore::load(path.clone()).unwrap_err();
        assert!(err.contains("w-1"), "{err}");
        assert!(err.contains("superuser"), "{err}");
        let bad_status = serde_json::json!([{
            "id": "w-2", "title": "T", "status": "archived",
            "autonomy": "manual", "updated_label": "Now"
        }]);
        fs::write(&path, serde_json::to_string(&bad_status).unwrap()).unwrap();
        let err = WorkStore::load(path).unwrap_err();
        assert!(err.contains("w-2"), "{err}");
        assert!(err.contains("archived"), "{err}");
    }

    // ------------------------------------------------------------------
    // IntentStore
    // ------------------------------------------------------------------

    fn intent_path(dir: &TempDir) -> PathBuf {
        dir.file("intents.json")
    }

    #[test]
    fn intent_create_sets_defaults_and_first_becomes_active() {
        let dir = TempDir::new("intent-create");
        let mut store = IntentStore::load(intent_path(&dir)).unwrap();
        let intent = store
            .create(
                "  Ship v1  ".to_string(),
                Some("  because users need it  ".to_string()),
                vec![acc(" Done ", false), acc("", true), acc("  ", false)],
                None,
                None,
                None,
            )
            .unwrap();
        assert_eq!(intent.statement, "Ship v1");
        assert_eq!(intent.why.as_deref(), Some("because users need it"));
        assert_eq!(intent.acceptance.len(), 1);
        assert_eq!(intent.acceptance[0].text, "Done");
        assert_eq!(intent.autonomy, "collaborative");
        assert_eq!(intent.status, "active");
        assert_eq!(intent.version, 1);
        assert!(intent.history.is_empty());
        assert!(intent.autonomy_history.is_empty());
        assert!(intent.created_at > 0);
        assert_eq!(store.active_id().as_deref(), Some(intent.id.as_str()));
    }

    #[test]
    fn intent_create_rejects_empty_statement_and_unknown_autonomy() {
        let dir = TempDir::new("intent-create-err");
        let mut store = IntentStore::load(intent_path(&dir)).unwrap();
        assert!(
            store
                .create("".to_string(), None, vec![], None, None, None)
                .is_err()
        );
        assert!(
            store
                .create("   ".to_string(), None, vec![], None, None, None)
                .is_err()
        );
        assert!(
            store
                .create(
                    "Ok".to_string(),
                    None,
                    vec![],
                    Some("autonomous".to_string()),
                    None,
                    None
                )
                .is_err()
        );
        assert_eq!(store.list().1.len(), 0);
    }

    #[test]
    fn intent_create_second_does_not_become_active() {
        let dir = TempDir::new("intent-create-second");
        let mut store = IntentStore::load(intent_path(&dir)).unwrap();
        let first = store
            .create("First".to_string(), None, vec![], None, None, None)
            .unwrap();
        let second = store
            .create(
                "Second".to_string(),
                None,
                vec![],
                Some("manual".to_string()),
                None,
                None,
            )
            .unwrap();
        assert_eq!(second.autonomy, "manual");
        assert_eq!(store.active_id().as_deref(), Some(first.id.as_str()));
    }

    #[test]
    fn intent_update_statement_bumps_version_and_snapshots() {
        let dir = TempDir::new("intent-update");
        let mut store = IntentStore::load(intent_path(&dir)).unwrap();
        let intent = store
            .create(
                "Old".to_string(),
                Some("why".to_string()),
                vec![],
                None,
                None,
                None,
            )
            .unwrap();
        let updated = store
            .update(
                &intent.id,
                Some("New".to_string()),
                None,
                None,
                None,
                None,
                None,
                None,
            )
            .unwrap();
        assert_eq!(updated.version, 2);
        assert_eq!(updated.statement, "New");
        assert_eq!(updated.history.len(), 1);
        assert_eq!(updated.history[0].version, 1);
        assert_eq!(updated.history[0].statement, "Old");
        assert_eq!(updated.history[0].why.as_deref(), Some("why"));
    }

    #[test]
    fn intent_update_status_only_does_not_bump_version() {
        let dir = TempDir::new("intent-status");
        let mut store = IntentStore::load(intent_path(&dir)).unwrap();
        let intent = store
            .create("S".to_string(), None, vec![], None, None, None)
            .unwrap();
        let updated = store
            .update(
                &intent.id,
                None,
                None,
                None,
                Some("done".to_string()),
                None,
                None,
                None,
            )
            .unwrap();
        assert_eq!(updated.status, "done");
        assert_eq!(updated.version, 1);
        assert!(updated.history.is_empty());
    }

    #[test]
    fn intent_update_noop_changes_nothing() {
        let dir = TempDir::new("intent-noop");
        let mut store = IntentStore::load(intent_path(&dir)).unwrap();
        let intent = store
            .create("S".to_string(), None, vec![], None, None, None)
            .unwrap();
        let same = store
            .update(&intent.id, None, None, None, None, None, None, None)
            .unwrap();
        assert_eq!(same.version, 1);
        assert!(same.history.is_empty());
        let same2 = store
            .update(
                &intent.id,
                Some("S".to_string()),
                None,
                Some("collaborative".to_string()),
                None,
                None,
                None,
                None,
            )
            .unwrap();
        assert_eq!(same2.version, 1);
        assert!(same2.history.is_empty());
    }

    #[test]
    fn intent_budget_set_update_and_clear_round_trip() {
        let dir = TempDir::new("intent-budget");
        let path = intent_path(&dir);
        let id;
        {
            let mut store = IntentStore::load(path.clone()).unwrap();
            let intent = store
                .create(
                    "Budgeted".to_string(),
                    None,
                    vec![],
                    None,
                    Some(4),
                    Some(120),
                )
                .unwrap();
            assert_eq!(intent.max_rounds, Some(4));
            assert_eq!(intent.timeout_seconds, Some(120));
            id = intent.id.clone();
            // A non-positive value is rejected on create.
            assert!(
                store
                    .create("Bad".to_string(), None, vec![], None, Some(0), None)
                    .is_err()
            );
            // Update to new values; budget is a runtime control, not a
            // content change, so the version does not bump.
            let updated = store
                .update(&id, None, None, None, None, None, Some(8), Some(60))
                .unwrap();
            assert_eq!(updated.max_rounds, Some(8));
            assert_eq!(updated.timeout_seconds, Some(60));
            assert_eq!(updated.version, 1);
            // Some(0) clears both back to the server default.
            let cleared = store
                .update(&id, None, None, None, None, None, Some(0), Some(0))
                .unwrap();
            assert_eq!(cleared.max_rounds, None);
            assert_eq!(cleared.timeout_seconds, None);
        }
        // Persistence round-trip preserves the cleared (default) state.
        let store = IntentStore::load(path).unwrap();
        let intent = store.get(&id).unwrap();
        assert_eq!(intent.max_rounds, None);
        assert_eq!(intent.timeout_seconds, None);
    }

    #[test]
    fn intent_update_why_clear_and_rejects() {
        let dir = TempDir::new("intent-why");
        let mut store = IntentStore::load(intent_path(&dir)).unwrap();
        let intent = store
            .create(
                "S".to_string(),
                Some("old why".to_string()),
                vec![],
                None,
                None,
                None,
            )
            .unwrap();
        // Some("") clears the why; the version bumps (content changed).
        let cleared = store
            .update(
                &intent.id,
                None,
                Some("".to_string()),
                None,
                None,
                None,
                None,
                None,
            )
            .unwrap();
        assert_eq!(cleared.why, None);
        assert_eq!(cleared.version, 2);
        // An empty statement is rejected and changes nothing.
        assert!(
            store
                .update(
                    &intent.id,
                    Some("   ".to_string()),
                    None,
                    None,
                    None,
                    None,
                    None,
                    None
                )
                .is_err()
        );
        assert_eq!(store.get(&intent.id).unwrap().version, 2);
        assert!(
            store
                .update(
                    &intent.id,
                    None,
                    None,
                    Some("bogus".to_string()),
                    None,
                    None,
                    None,
                    None
                )
                .is_err()
        );
        assert!(
            store
                .update(
                    &intent.id,
                    None,
                    None,
                    None,
                    Some("archived".to_string()),
                    None,
                    None,
                    None
                )
                .is_err()
        );
        assert!(
            store
                .update(
                    "no-such-id",
                    Some("x".to_string()),
                    None,
                    None,
                    None,
                    None,
                    None,
                    None
                )
                .is_err()
        );
    }

    #[test]
    fn intent_raise_requires_justification_lower_is_instant() {
        let dir = TempDir::new("intent-dial");
        let mut store = IntentStore::load(intent_path(&dir)).unwrap();
        let intent = store
            .create(
                "S".to_string(),
                None,
                vec![],
                Some("manual".to_string()),
                None,
                None,
            )
            .unwrap();
        // Raising with no justification fails.
        assert!(
            store
                .update(
                    &intent.id,
                    None,
                    None,
                    Some("delegated".to_string()),
                    None,
                    None,
                    None,
                    None
                )
                .is_err()
        );
        // Raising with a blank justification fails too.
        assert!(
            store
                .update(
                    &intent.id,
                    None,
                    None,
                    Some("delegated".to_string()),
                    None,
                    Some("   ".to_string()),
                    None,
                    None
                )
                .is_err()
        );
        // Raising with a real justification works and records history.
        let raised = store
            .update(
                &intent.id,
                None,
                None,
                Some("delegated".to_string()),
                None,
                Some("the task is routine now".to_string()),
                None,
                None,
            )
            .unwrap();
        assert_eq!(raised.autonomy, "delegated");
        assert_eq!(raised.version, 2);
        assert_eq!(raised.autonomy_history.len(), 1);
        assert_eq!(raised.autonomy_history[0].from, "manual");
        assert_eq!(raised.autonomy_history[0].to, "delegated");
        assert_eq!(
            raised.autonomy_history[0].justification.as_deref(),
            Some("the task is routine now")
        );
        // Lowering is instant, no justification needed, history recorded
        // with no justification.
        let lowered = store
            .update(
                &intent.id,
                None,
                None,
                Some("manual".to_string()),
                None,
                None,
                None,
                None,
            )
            .unwrap();
        assert_eq!(lowered.autonomy, "manual");
        assert_eq!(lowered.autonomy_history.len(), 2);
        assert_eq!(lowered.autonomy_history[1].from, "delegated");
        assert_eq!(lowered.autonomy_history[1].to, "manual");
        assert_eq!(lowered.autonomy_history[1].justification, None);
    }

    #[test]
    fn intent_set_acceptance_does_not_bump_version() {
        let dir = TempDir::new("intent-acceptance");
        let mut store = IntentStore::load(intent_path(&dir)).unwrap();
        let intent = store
            .create(
                "S".to_string(),
                None,
                vec![acc("Old", false)],
                None,
                None,
                None,
            )
            .unwrap();
        let updated = store
            .set_acceptance(
                &intent.id,
                vec![acc(" New ", true), acc("", false), acc("Later", false)],
            )
            .unwrap();
        assert_eq!(updated.version, 1);
        assert!(updated.history.is_empty());
        assert_eq!(updated.acceptance.len(), 2);
        assert_eq!(updated.acceptance[0].text, "New");
        assert!(updated.acceptance[0].done);
        assert!(store.set_acceptance("no-such-id", vec![]).is_err());
    }

    #[test]
    fn intent_set_active_switches_and_rejects_unknown() {
        let dir = TempDir::new("intent-active");
        let mut store = IntentStore::load(intent_path(&dir)).unwrap();
        let first = store
            .create("First".to_string(), None, vec![], None, None, None)
            .unwrap();
        let second = store
            .create("Second".to_string(), None, vec![], None, None, None)
            .unwrap();
        assert_eq!(store.active_id().as_deref(), Some(first.id.as_str()));
        store.set_active(&second.id).unwrap();
        assert_eq!(store.active_id().as_deref(), Some(second.id.as_str()));
        assert!(store.set_active("no-such-id").is_err());
    }

    #[test]
    fn intent_delete_refuses_when_work_references_it() {
        let dir = TempDir::new("intent-delete");
        let mut intents = IntentStore::load(intent_path(&dir)).unwrap();
        let mut work = WorkStore::load(dir.file("work.json")).unwrap();
        let a = intents
            .create("A".to_string(), None, vec![], None, None, None)
            .unwrap();
        let b = intents
            .create("B".to_string(), None, vec![], None, None, None)
            .unwrap();
        work.add("job".to_string(), Some(a.id.clone())).unwrap();
        let err = intents.delete(&a.id, &work).unwrap_err();
        assert!(err.contains("1 work item"), "error was: {err}");
        assert!(intents.get(&a.id).is_some());
        // Unreferenced intent deletes fine.
        assert!(intents.delete(&b.id, &work).unwrap());
        assert!(intents.get(&b.id).is_none());
        assert!(intents.delete("no-such-id", &work).is_err());
    }

    #[test]
    fn intent_delete_clears_active_pointer() {
        let dir = TempDir::new("intent-delete-active");
        let mut intents = IntentStore::load(intent_path(&dir)).unwrap();
        let work = WorkStore::load(dir.file("work.json")).unwrap();
        let a = intents
            .create("A".to_string(), None, vec![], None, None, None)
            .unwrap();
        assert_eq!(intents.active_id().as_deref(), Some(a.id.as_str()));
        intents.delete(&a.id, &work).unwrap();
        assert_eq!(intents.active_id(), None);
    }

    #[test]
    fn intent_save_load_round_trip_preserves_versions_and_history() {
        let dir = TempDir::new("intent-roundtrip");
        let path = intent_path(&dir);
        let id;
        {
            let mut store = IntentStore::load(path.clone()).unwrap();
            let intent = store
                .create(
                    "S".to_string(),
                    Some("why".to_string()),
                    vec![acc("A", false)],
                    None,
                    None,
                    None,
                )
                .unwrap();
            id = intent.id.clone();
            store
                .update(
                    &id,
                    Some("S2".to_string()),
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                )
                .unwrap();
            store
                .update(
                    &id,
                    None,
                    None,
                    Some("delegated".to_string()),
                    None,
                    Some("routine now".to_string()),
                    None,
                    None,
                )
                .unwrap();
        }
        let store = IntentStore::load(path).unwrap();
        let intent = store.get(&id).unwrap();
        assert_eq!(intent.version, 3);
        assert_eq!(intent.statement, "S2");
        assert_eq!(intent.history.len(), 2);
        assert_eq!(intent.history[0].statement, "S");
        assert_eq!(intent.history[1].statement, "S2");
        assert_eq!(intent.autonomy_history.len(), 1);
        assert_eq!(intent.autonomy, "delegated");
        assert_eq!(store.active_id().as_deref(), Some(id.as_str()));
    }

    #[test]
    fn intent_load_missing_file_starts_empty_and_creates_it() {
        let dir = TempDir::new("intent-missing");
        let path = intent_path(&dir);
        assert!(!path.exists());
        let store = IntentStore::load(path.clone()).unwrap();
        assert!(store.list().1.is_empty());
        assert_eq!(store.active_id(), None);
        assert!(path.exists());
    }

    #[test]
    fn intent_load_corrupt_file_moves_it_aside_and_errors() {
        let dir = TempDir::new("intent-corrupt");
        let path = intent_path(&dir);
        fs::write(&path, "garbage{{{").unwrap();
        let err = IntentStore::load(path.clone()).unwrap_err();
        assert!(err.contains("corrupt"), "error was: {err}");
        assert!(!path.exists());
        let backup = fs::read_dir(&dir.path)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .find(|n| n.starts_with("intents.json.corrupt-"));
        assert!(backup.is_some(), "no .corrupt- backup found");
    }

    #[test]
    fn intent_load_rejects_unknown_autonomy_and_status() {
        let dir = TempDir::new("intent-load-bad-values");
        let path = intent_path(&dir);
        let bad_level = serde_json::json!({
            "active_intent_id": null,
            "intents": [
                {"id": "i-1", "statement": "One", "autonomy": "superuser", "status": "active", "version": 1}
            ]
        });
        fs::write(&path, serde_json::to_string(&bad_level).unwrap()).unwrap();
        let err = IntentStore::load(path.clone()).unwrap_err();
        assert!(err.contains("i-1"), "{err}");
        assert!(err.contains("superuser"), "{err}");
        let bad_status = serde_json::json!({
            "active_intent_id": null,
            "intents": [
                {"id": "i-2", "statement": "Two", "autonomy": "manual", "status": "archived", "version": 1}
            ]
        });
        fs::write(&path, serde_json::to_string(&bad_status).unwrap()).unwrap();
        let err = IntentStore::load(path).unwrap_err();
        assert!(err.contains("i-2"), "{err}");
        assert!(err.contains("archived"), "{err}");
    }

    #[test]
    fn intent_load_dedups_and_drops_dangling_active_pointer() {
        let dir = TempDir::new("intent-load-cleanup");
        let path = intent_path(&dir);
        let file = serde_json::json!({
            "active_intent_id": "missing",
            "intents": [
                {"id": "i-1", "statement": "One", "version": 1},
                {"id": "i-1", "statement": "Dupe", "version": 1},
                {"id": "i-2", "statement": "Two", "version": 1}
            ]
        });
        fs::write(&path, serde_json::to_string(&file).unwrap()).unwrap();
        let store = IntentStore::load(path).unwrap();
        assert_eq!(store.list().1.len(), 2);
        assert_eq!(store.list().1[0].statement, "One");
        assert_eq!(store.active_id(), None);
    }
}
