use crate::knowledge::{ACCESS, Actor, Vault};
use std::path::Path;

fn validate(object: &str) -> Result<(), String> {
    if !["Work", "Code", "Experiments", "Evidence", "Agents", "Notes"].contains(&object) {
        return Err("Unknown workbench object".into());
    }
    Ok(())
}

// The bench no longer edits text (notes are edited in the Tauri Knowledge
// surface), so these two functions are no longer registered as commands.
// The module and its tests stay: native-app parity and vault safety rules.
#[allow(dead_code)]
pub fn read(root: &Path, object: &str) -> Result<String, String> {
    validate(object)?;
    let _guard = ACCESS.lock().map_err(|e| e.to_string())?;
    let vault = Vault::open(root.into())?;
    let listing = vault.list("");
    let prefix = format!("spatial-{}-", object.to_lowercase());
    let title = format!("{object} · spatial memory");
    let note = listing.notes.iter().rev().find(|n| {
        n.meta.id.starts_with(&prefix) || (n.meta.kind == "memory" && n.meta.title == title)
    });
    let body = note.map(|n| n.body.clone()).unwrap_or_default();
    if body.chars().count() > 600 {
        return Err("This memory exceeds 600 characters; edit it in Knowledge".into());
    }
    Ok(body)
}

#[allow(dead_code)]
pub fn save(root: &Path, object: &str, body: &str) -> Result<String, String> {
    validate(object)?;
    if body.trim().is_empty() || body.chars().count() > 600 {
        return Err("Enter a note between 1 and 600 characters".into());
    }
    let _guard = ACCESS.lock().map_err(|e| e.to_string())?;
    let mut vault = Vault::open(root.into())?;
    let revision = vault.list("").revision;
    vault.create(
        &format!("{object} · spatial memory"),
        body,
        "memory",
        "10 Fleeting Notes",
        Actor::Human,
        &revision,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };
    #[test]
    fn saves_native_notes_without_overwriting_and_rejects_invalid_input() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join(format!(
                "spatial-test-{}",
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
        assert_eq!(read(&root, "Notes").unwrap(), "");
        let first = save(&root, "Notes", "first thought").unwrap();
        let second = save(&root, "Notes", "revised thought").unwrap();
        assert_ne!(first, second);
        let text =
            fs::read_to_string(root.join("10 Fleeting Notes").join(format!("{first}.md"))).unwrap();
        assert!(text.ends_with("first thought"));
        let metadata: serde_json::Value =
            serde_json::from_str(text.split("---\n").nth(1).unwrap().trim()).unwrap();
        assert_eq!(metadata["kind"], "memory");
        assert_eq!(read(&root, "Notes").unwrap(), "revised thought");
        assert_eq!(read(&root, "Work").unwrap(), "");
        assert!(read(&root, "../escape").is_err());
        assert_eq!(
            fs::read_dir(root.join("10 Fleeting Notes"))
                .unwrap()
                .count(),
            2
        );
        assert!(save(&root, "../escape", "text").is_err());
        assert!(save(&root, "Notes", " ").is_err());
        assert!(save(&root, "Notes", &"x".repeat(601)).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
