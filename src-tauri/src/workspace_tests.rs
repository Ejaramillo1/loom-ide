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
