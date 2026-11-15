use super::*;

struct WorkspaceFixture(PathBuf);

impl WorkspaceFixture {
    fn new() -> Self {
        static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let unique = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "loom-workspace-test-{}-{}-{unique}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir(&path).unwrap();
        Self(path)
    }
}

impl Drop for WorkspaceFixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[test]
fn creates_real_files_and_folders_at_root_and_in_subfolders() {
    let workspace = WorkspaceFixture::new();
    let folder = create_workspace_entry_at(&workspace.0, "", "src", true).unwrap();
    assert!(folder.is_dir);
    let file = create_workspace_entry_at(&workspace.0, &folder.path, "main.ts", false).unwrap();
    assert!(!file.is_dir);
    assert_eq!(std::fs::read(&file.path).unwrap(), b"");
    assert_eq!(
        Path::new(&file.path).parent().unwrap(),
        Path::new(&folder.path)
    );
    let nested = create_workspace_entry_at(&workspace.0, "src", "nested", true).unwrap();
    assert!(Path::new(&nested.path).is_dir());
    let hidden = create_workspace_entry_at(&workspace.0, "", ".gitignore", false).unwrap();
    let entries = list_dir_entries(&workspace.0).unwrap();
    assert!(entries[0].is_dir);
    assert!(entries.iter().any(|entry| entry.path == hidden.path));
}

#[test]
fn collisions_never_overwrite_files_or_replace_directories() {
    let workspace = WorkspaceFixture::new();
    let existing = workspace.0.join("keep.txt");
    std::fs::write(&existing, "keep this content").unwrap();
    for is_dir in [false, true] {
        let error = create_workspace_entry_at(&workspace.0, "", "keep.txt", is_dir).unwrap_err();
        assert!(error.contains("already exists"));
        assert_eq!(
            std::fs::read_to_string(&existing).unwrap(),
            "keep this content"
        );
    }
    std::fs::create_dir(workspace.0.join("existing-folder")).unwrap();
    for is_dir in [false, true] {
        assert!(create_workspace_entry_at(&workspace.0, "", "existing-folder", is_dir).is_err());
    }
}

#[test]
fn rejects_invalid_names_without_creating_anything() {
    let workspace = WorkspaceFixture::new();
    for name in [
        "",
        " ",
        ".",
        "..",
        "../escape",
        "a/b",
        "a\\b",
        "/absolute",
        "bad\0name",
        "bad\nname",
    ] {
        for is_dir in [false, true] {
            assert!(
                create_workspace_entry_at(&workspace.0, "", name, is_dir).is_err(),
                "accepted {name:?}"
            );
        }
    }
    assert_eq!(std::fs::read_dir(&workspace.0).unwrap().count(), 0);
}

#[test]
fn rejects_missing_non_directory_and_outside_parents() {
    let workspace = WorkspaceFixture::new();
    let outside = WorkspaceFixture::new();
    std::fs::write(workspace.0.join("file"), "").unwrap();
    for parent in ["missing", "file", "..", outside.0.to_str().unwrap()] {
        assert!(create_workspace_entry_at(&workspace.0, parent, "created", false).is_err());
    }
    assert_eq!(std::fs::read_dir(&outside.0).unwrap().count(), 0);
}

#[cfg(unix)]
#[test]
fn symlinks_cannot_redirect_creations_outside_or_overwrite_targets() {
    let workspace = WorkspaceFixture::new();
    let outside = WorkspaceFixture::new();
    std::os::unix::fs::symlink(&outside.0, workspace.0.join("outside")).unwrap();
    assert!(create_workspace_entry_at(&workspace.0, "outside", "escape", false).is_err());
    assert!(!outside.0.join("escape").exists());
    let target = outside.0.join("target");
    std::fs::write(&target, "preserved").unwrap();
    std::os::unix::fs::symlink(&target, workspace.0.join("link")).unwrap();
    assert!(create_workspace_entry_at(&workspace.0, "", "link", false).is_err());
    assert_eq!(std::fs::read_to_string(&target).unwrap(), "preserved");
}

#[test]
fn default_workspace_is_empty_and_separate_from_server_and_settings() {
    let fixture = WorkspaceFixture::new();
    let server = fixture.0.join(".loom");
    std::fs::create_dir(&server).unwrap();
    let internal = server.join("server.yaml");
    std::fs::write(&internal, "server configuration").unwrap();
    let root = fixture.0.join("Documents/Loom");
    let settings = fixture.0.join("app-data/workspace.json");
    let store = WorkspaceStore::load(settings.clone(), root.clone()).unwrap();
    assert_eq!(store.root(), root.canonicalize().unwrap());
    assert_eq!(store.info().name, "Loom");
    assert!(list_dir_entries(store.root()).unwrap().is_empty());
    assert!(settings.is_file());
    assert!(!settings.starts_with(store.root()));
    assert!(workspace::read_text(store.root(), internal.to_str().unwrap()).is_err());
    create_workspace_entry_at(store.root(), "", "my-note.md", false).unwrap();
    assert!(root.join("my-note.md").is_file());
    assert!(!server.join("my-note.md").exists());
    assert_eq!(
        std::fs::read_to_string(internal).unwrap(),
        "server configuration"
    );
}

#[test]
fn selected_folder_is_remembered_without_seeding_or_changing_its_files() {
    let fixture = WorkspaceFixture::new();
    let settings = fixture.0.join("settings/workspace.json");
    let mut store =
        WorkspaceStore::load(settings.clone(), fixture.0.join("Documents/Loom")).unwrap();
    let project = fixture.0.join("My project");
    std::fs::create_dir(&project).unwrap();
    std::fs::write(project.join("existing.md"), "my work").unwrap();
    store.open(project.to_str().unwrap()).unwrap();
    let unused_default = fixture.0.join("unused-default");
    let reloaded = WorkspaceStore::load(settings, unused_default.clone()).unwrap();
    assert_eq!(reloaded.root(), project.canonicalize().unwrap());
    assert_eq!(reloaded.info().name, "My project");
    assert!(!unused_default.exists());
    assert_eq!(list_dir_entries(reloaded.root()).unwrap().len(), 1);
    assert_eq!(
        std::fs::read_to_string(project.join("existing.md")).unwrap(),
        "my work"
    );
}

#[test]
fn invalid_folder_selection_keeps_the_current_workspace() {
    let fixture = WorkspaceFixture::new();
    let settings = fixture.0.join("settings.json");
    let mut store = WorkspaceStore::load(settings.clone(), fixture.0.join("Loom")).unwrap();
    let before = std::fs::read(&settings).unwrap();
    let old_root = store.root().to_path_buf();
    let file = fixture.0.join("file.txt");
    std::fs::write(&file, "content").unwrap();
    let missing = fixture.0.join("missing");
    for path in [
        "",
        "relative",
        file.to_str().unwrap(),
        missing.to_str().unwrap(),
    ] {
        assert!(store.open(path).is_err());
        assert_eq!(store.root(), old_root);
        assert_eq!(std::fs::read(&settings).unwrap(), before);
    }
}

#[test]
fn invalid_settings_do_not_create_a_replacement_workspace() {
    let fixture = WorkspaceFixture::new();
    let settings = fixture.0.join("settings.json");
    let default = fixture.0.join("Documents/Loom");
    for invalid in ["bad json", r#"{"root":"relative/path"}"#] {
        std::fs::write(&settings, invalid).unwrap();
        assert!(WorkspaceStore::load(settings.clone(), default.clone()).is_err());
        assert!(!default.exists());
        assert_eq!(std::fs::read_to_string(&settings).unwrap(), invalid);
    }
}

#[test]
fn missing_selected_folder_is_not_recreated_or_replaced() {
    let fixture = WorkspaceFixture::new();
    let settings = fixture.0.join("settings.json");
    let missing = fixture.0.join("missing-project");
    std::fs::write(&settings, serde_json::json!({"root": missing}).to_string()).unwrap();
    let default = fixture.0.join("Documents/Loom");
    let store = WorkspaceStore::load(settings, default.clone()).unwrap();
    assert_eq!(store.root(), missing);
    assert!(!missing.exists());
    assert!(!default.exists());
}

#[test]
fn edits_save_real_text_and_do_not_leave_temporary_files() {
    let fixture = WorkspaceFixture::new();
    create_workspace_entry_at(&fixture.0, "", "note.md", false).unwrap();
    workspace::write_text(&fixture.0, "note.md", "My first note — hello", "").unwrap();
    assert_eq!(
        workspace::read_text(&fixture.0, "note.md").unwrap(),
        "My first note — hello"
    );
    workspace::write_text(&fixture.0, "note.md", "Updated", "My first note — hello").unwrap();
    assert_eq!(
        std::fs::read_to_string(fixture.0.join("note.md")).unwrap(),
        "Updated"
    );
    assert_eq!(std::fs::read_dir(&fixture.0).unwrap().count(), 1);
}

#[test]
fn saving_refuses_external_changes_deleted_files_and_outside_paths() {
    let fixture = WorkspaceFixture::new();
    let outside = WorkspaceFixture::new();
    let file = fixture.0.join("note.md");
    std::fs::write(&file, "changed elsewhere").unwrap();
    let error = workspace::write_text(&fixture.0, "note.md", "my draft", "original").unwrap_err();
    assert!(error.contains("changed on disk"));
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "changed elsewhere");
    assert!(workspace::write_text(&fixture.0, "missing.md", "draft", "").is_err());
    assert!(!fixture.0.join("missing.md").exists());
    let external = outside.0.join("external.md");
    std::fs::write(&external, "keep me").unwrap();
    assert!(
        workspace::write_text(
            &fixture.0,
            external.to_str().unwrap(),
            "overwrite",
            "keep me"
        )
        .is_err()
    );
    assert_eq!(std::fs::read_to_string(external).unwrap(), "keep me");
}

#[cfg(unix)]
#[test]
fn saves_preserve_permissions_and_reject_readonly_files_and_external_symlinks() {
    use std::os::unix::fs::PermissionsExt;
    let fixture = WorkspaceFixture::new();
    let outside = WorkspaceFixture::new();
    let file = fixture.0.join("script.sh");
    std::fs::write(&file, "original").unwrap();
    std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o750)).unwrap();
    workspace::write_text(&fixture.0, "script.sh", "updated", "original").unwrap();
    assert_eq!(file.metadata().unwrap().permissions().mode() & 0o777, 0o750);
    std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o440)).unwrap();
    assert!(workspace::write_text(&fixture.0, "script.sh", "new", "updated").is_err());
    let external = outside.0.join("note.md");
    std::fs::write(&external, "keep").unwrap();
    std::os::unix::fs::symlink(&external, fixture.0.join("link.md")).unwrap();
    assert!(workspace::write_text(&fixture.0, "link.md", "overwrite", "keep").is_err());
    assert_eq!(std::fs::read_to_string(external).unwrap(), "keep");
}

// The local autonomy admission gate (Rule 3) at the command boundary: the
// exact helper `set_work_autonomy` invokes, tested against direct
// invocations that bypass the UI entirely (Step 8 / QC-01 — this gate is
// LOCAL metadata policy, and is never presented as server enforcement).

#[test]
fn autonomy_admission_rejects_raising_above_the_intent_ceiling() {
    let err = autonomy_admission("assisted", "delegated", Some("assisted"), None).unwrap_err();
    assert!(err.contains("its intent allows at most"), "got: {err}");
    // The same raise WITH justification is still rejected: the ceiling
    // is not overridable by prose.
    let err =
        autonomy_admission("assisted", "delegated", Some("assisted"), Some("because")).unwrap_err();
    assert!(err.contains("its intent allows at most"), "got: {err}");
}

#[test]
fn autonomy_admission_requires_justification_to_raise_within_the_ceiling() {
    let err = autonomy_admission("manual", "assisted", Some("delegated"), None).unwrap_err();
    assert!(err.contains("requires a justification"), "got: {err}");
    assert!(autonomy_admission("manual", "assisted", Some("delegated"), Some("a reason")).is_ok());
}

#[test]
fn autonomy_admission_lets_tightening_through_without_justification() {
    assert!(autonomy_admission("delegated", "manual", Some("delegated"), None).is_ok());
    assert!(autonomy_admission("collaborative", "assisted", Some("delegated"), None).is_ok());
}

#[test]
fn autonomy_admission_rejects_unknown_levels_and_ignores_missing_intents() {
    assert!(autonomy_admission("manual", "sovereign", None, None).is_err());
    // Work items without an intent are unaffected by ceilings.
    assert!(autonomy_admission("assisted", "delegated", None, Some("a reason")).is_ok());
}
