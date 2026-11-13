use std::{
    fs,
    io::Write,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

fn validate(root: &Path, object: &str) -> Result<(), String> {
    if !["Work", "Code", "Experiments", "Evidence", "Agents", "Notes"].contains(&object) {
        return Err("Unknown workbench object".into());
    }
    for path in [root.to_path_buf(), root.join("10 Fleeting Notes")] {
        if fs::symlink_metadata(&path).is_ok_and(|m| m.file_type().is_symlink()) {
            return Err("Vault paths must not be symbolic links".into());
        }
    }
    Ok(())
}

// shortcut: anchors read the default fleeting folder; add vault selection when custom vaults are integrated.
pub fn read(root: &Path, object: &str) -> Result<String, String> {
    validate(root, object)?;
    let folder = root.join("10 Fleeting Notes");
    let entries = match fs::read_dir(folder) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(String::new()),
        Err(e) => return Err(e.to_string()),
    };
    let prefix = format!("spatial-{}-", object.to_lowercase());
    let mut latest = None;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.starts_with(&prefix)
            || !name.ends_with(".md")
            || !entry.file_type().map_err(|e| e.to_string())?.is_file()
        {
            continue;
        }
        if latest.as_ref().is_none_or(|(previous, _)| name > *previous) {
            latest = Some((name, entry.path()));
        }
    }
    let Some((_, path)) = latest else {
        return Ok(String::new());
    };
    if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 64 * 1024 {
        return Err("Saved memory is too large to open here".into());
    }
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let (_, body) = text
        .strip_prefix("---\n")
        .and_then(|text| text.split_once("\n---\n"))
        .ok_or("Saved memory has invalid metadata")?;
    if body.chars().count() > 600 {
        return Err("This memory exceeds 600 characters; edit it in Living Workbench".into());
    }
    Ok(body.to_owned())
}

// Append-only notes avoid racing the native vault's ledger and existing edits.
pub fn save(root: &Path, object: &str, body: &str) -> Result<String, String> {
    validate(root, object)?;
    if body.trim().is_empty() || body.chars().count() > 600 {
        return Err("Enter a note between 1 and 600 characters".into());
    }
    fs::create_dir_all(root.join("10 Fleeting Notes")).map_err(|e| e.to_string())?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?;
    let id = format!("spatial-{}-{}", object.to_lowercase(), now.as_nanos());
    let meta = serde_json::json!({"id":id,"kind":"memory","title":format!("{object} · spatial memory"),
        "created":now.as_secs(),"modified":now.as_secs(),"author":"human",
        "source":"Resolute Spatial Workbench","status":"working","version":1});
    let content = format!(
        "---\n{}\n---\n{}",
        serde_json::to_string_pretty(&meta).unwrap(),
        body
    );
    let path = root.join("10 Fleeting Notes").join(format!("{id}.md"));
    let pending = path.with_file_name(format!(".{id}.pending"));
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&pending)
        .map_err(|e| e.to_string())?;
    let result = file
        .write_all(content.as_bytes())
        .and_then(|_| file.sync_all())
        .and_then(|_| fs::hard_link(&pending, &path));
    let _ = fs::remove_file(pending);
    result.map_err(|e| e.to_string())?;
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;
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
