//! File tools inside Living Workbench. Uses Tauri's selected folder, never its source tree implicitly.
use eframe::egui::*;
use std::{fs, path::PathBuf};

pub struct Files {
    root: PathBuf,
    folder: String,
    name: String,
    selected: Option<PathBuf>,
    text: String,
    original: String,
    error: String,
}
impl Default for Files {
    fn default() -> Self {
        let home = std::env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_default();
        let data = std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".local/share"));
        let root = fs::read_to_string(data.join("com.loom.ide/loom-ide/workspace.json"))
            .ok()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
            .and_then(|v| v["root"].as_str().map(PathBuf::from))
            .unwrap_or_else(|| home.join("Documents/Loom"));
        Self {
            folder: root.display().to_string(),
            root,
            name: String::new(),
            selected: None,
            text: String::new(),
            original: String::new(),
            error: String::new(),
        }
    }
}
fn read(path: &std::path::Path) -> Result<String, String> {
    if fs::metadata(path).map_err(|e| e.to_string())?.len() > 1024 * 1024 {
        return Err("File exceeds 1 MB".into());
    }
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if text.contains('\0') {
        return Err("Binary files cannot be edited here".into());
    }
    Ok(text)
}
fn save(path: &std::path::Path, original: &str, text: &str) -> Result<(), String> {
    if text.len() > 1024 * 1024 || text.contains('\0') {
        return Err("Save UTF-8 text up to 1 MB".into());
    }
    if read(path)? != original {
        return Err(
            "File changed elsewhere. Your draft is preserved; reopen after copying your changes."
                .into(),
        );
    }
    // Replace through a sibling temporary file so interrupted writes preserve the original.
    let temp = path.with_file_name(format!(".loom-edit-{}", crate::knowledge::new_id()));
    let result = (|| {
        use std::io::Write;
        let mut f = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)
            .map_err(|e| e.to_string())?;
        f.set_permissions(fs::metadata(path).map_err(|e| e.to_string())?.permissions())
            .map_err(|e| e.to_string())?;
        f.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
        fs::rename(&temp, path).map_err(|e| e.to_string())
    })();
    if result.is_err() {
        let _ = fs::remove_file(temp);
    }
    result
}
impl Files {
    pub fn ui(&mut self, ui: &mut Ui) {
        ui.heading("Files & editor");
        ui.label("Shared folder from the Tauri workspace · explicit Save · local files");
        ui.horizontal_wrapped(|ui| {
            ui.label("Folder");
            ui.text_edit_singleline(&mut self.folder);
            if ui.button("Open folder").clicked() {
                if self.text != self.original {
                    self.error = "Save your current draft before changing folders.".into();
                } else {
                    match PathBuf::from(&self.folder).canonicalize() {
                        Ok(p) if p.is_dir() => {
                            self.root = p;
                            self.selected = None;
                            self.error.clear();
                        }
                        _ => self.error = "Choose an existing folder using its full path.".into(),
                    }
                }
            }
        });
        ui.horizontal_wrapped(|ui| {
            ui.label("New name");
            ui.text_edit_singleline(&mut self.name);
            for folder in [false, true] {
                if ui
                    .button(if folder {
                        "Create folder"
                    } else {
                        "Create file"
                    })
                    .clicked()
                {
                    let name = self.name.trim();
                    let result = if name.is_empty()
                        || std::path::Path::new(name).components().count() != 1
                        || name == ".."
                        || name == "."
                        || name.contains(['/', '\\'])
                    {
                        Err("Use a single file or folder name".to_string())
                    } else if folder {
                        fs::create_dir(self.root.join(name)).map_err(|e| e.to_string())
                    } else {
                        fs::OpenOptions::new()
                            .write(true)
                            .create_new(true)
                            .open(self.root.join(name))
                            .map(|_| ())
                            .map_err(|e| e.to_string())
                    };
                    match result {
                        Ok(()) => {
                            self.name.clear();
                            self.error.clear();
                        }
                        Err(e) => self.error = e,
                    }
                }
            }
        });
        if !self.error.is_empty() {
            ui.colored_label(ui.visuals().error_fg_color, &self.error);
        }
        ui.separator();
        ui.horizontal_top(|ui| {
            ScrollArea::vertical()
                .id_salt("files-tree")
                .max_width(220.)
                .show(ui, |ui| {
                    ui.vertical(|ui| match fs::read_dir(&self.root) {
                        Err(e) => {
                            ui.label(e.to_string());
                        }
                        Ok(entries) => {
                            let mut entries = entries.filter_map(Result::ok).collect::<Vec<_>>();
                            entries.sort_by_key(|e| e.file_name());
                            if let Some(parent) = self.root.parent() {
                                if ui.button("↑ Parent folder").clicked()
                                    && self.text == self.original
                                {
                                    self.folder = parent.display().to_string();
                                    self.root = parent.to_path_buf();
                                }
                            }
                            for e in entries {
                                let p = e.path();
                                if e.file_type().map(|t| t.is_symlink()).unwrap_or(true) {
                                    continue;
                                }
                                let is_dir = p.is_dir();
                                if ui
                                    .selectable_label(
                                        self.selected.as_ref() == Some(&p),
                                        format!(
                                            "{} {}",
                                            if is_dir { "▸" } else { "·" },
                                            e.file_name().to_string_lossy()
                                        ),
                                    )
                                    .clicked()
                                {
                                    if self.text != self.original {
                                        self.error =
                                            "Save your draft before opening another file.".into();
                                        continue;
                                    }
                                    if is_dir {
                                        self.root = p;
                                        self.folder = self.root.display().to_string();
                                        self.selected = None;
                                    } else {
                                        match read(&p) {
                                            Ok(s) => {
                                                self.original = s.clone();
                                                self.text = s;
                                                self.selected = Some(p);
                                                self.error.clear();
                                            }
                                            Err(e) => self.error = e,
                                        }
                                    }
                                }
                            }
                        }
                    });
                });
            ui.separator();
            ui.vertical(|ui| {
                if let Some(p) = self.selected.clone() {
                    ui.label(p.display().to_string());
                    ui.horizontal(|ui| {
                        if ui.button("Save · Ctrl+S").clicked()
                            || ui.input(|i| i.modifiers.command && i.key_pressed(Key::S))
                        {
                            match save(&p, &self.original, &self.text) {
                                Ok(()) => {
                                    self.original = self.text.clone();
                                    self.error.clear();
                                }
                                Err(e) => self.error = e,
                            }
                        }
                        ui.label(if self.text == self.original {
                            "Saved"
                        } else {
                            "Unsaved draft"
                        });
                    });
                    ScrollArea::both().id_salt("file-editor").show(ui, |ui| {
                        ui.add(
                            TextEdit::multiline(&mut self.text)
                                .font(TextStyle::Monospace)
                                .desired_width(ui.available_width())
                                .desired_rows(28)
                                .code_editor(),
                        );
                    });
                } else {
                    ui.label("Select a text file, or create one above.");
                }
            });
        });
    }
}

pub fn open_tauri() -> Result<(), String> {
    if crate::navigation::activate(crate::navigation::TAURI)? { return Ok(()); }
    static CHILD: std::sync::Mutex<Option<std::process::Child>> = std::sync::Mutex::new(None);
    let mut child = CHILD.lock().map_err(|e| e.to_string())?;
    if let Some(running) = child.as_mut() {
        if running.try_wait().map_err(|e| e.to_string())?.is_none() {
            return Ok(());
        }
    }
    let repo = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf();
    let executable = [
        repo.join("src-tauri/target/release/loom-ide"),
        repo.join("src-tauri/target/debug/loom-ide"),
    ]
    .into_iter()
    .find(|p| p.is_file())
    .ok_or("Build the Tauri app first with npm run tauri build")?;
    *child = Some(
        std::process::Command::new(executable)
            .env("GDK_BACKEND", "x11")
            .current_dir(repo)
            .spawn()
            .map_err(|e| e.to_string())?,
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn refuses_external_edits_and_preserves_both_versions() {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("test-data")
            .join(crate::knowledge::new_id());
        fs::create_dir_all(&dir).unwrap();
        let p = dir.join("note.md");
        fs::write(&p, "original").unwrap();
        fs::write(&p, "external").unwrap();
        assert!(save(&p, "original", "draft").is_err());
        assert_eq!(read(&p).unwrap(), "external");
        save(&p, "external", "merged").unwrap();
        assert_eq!(read(&p).unwrap(), "merged");
        fs::remove_dir_all(dir).unwrap();
    }
}
