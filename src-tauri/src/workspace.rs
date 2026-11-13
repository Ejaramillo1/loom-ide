use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceInfo {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Settings {
    root: PathBuf,
}

#[derive(Debug)]
pub struct WorkspaceStore {
    settings_path: PathBuf,
    root: PathBuf,
}

impl WorkspaceStore {
    pub fn load(settings_path: PathBuf, default_root: PathBuf) -> Result<Self, String> {
        let root = match fs::read_to_string(&settings_path) {
            Ok(text) => {
                serde_json::from_str::<Settings>(&text)
                    .map_err(|e| format!("Could not read workspace settings: {e}"))?
                    .root
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                fs::create_dir_all(&default_root)
                    .map_err(|e| format!("Could not create the Loom folder: {e}"))?;
                default_root.canonicalize().map_err(|e| e.to_string())?
            }
            Err(error) => return Err(format!("Could not read workspace settings: {error}")),
        };
        if !root.is_absolute() {
            return Err("The saved workspace folder path is invalid.".into());
        }
        // A missing previously selected folder is reported by the explorer;
        // never replace it with a different folder or recreate its contents.
        let store = Self {
            settings_path,
            root,
        };
        if !store.settings_path.exists() {
            store.save(&store.root)?;
        }
        Ok(store)
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn info(&self) -> WorkspaceInfo {
        WorkspaceInfo {
            name: self
                .root
                .file_name()
                .unwrap_or(self.root.as_os_str())
                .to_string_lossy()
                .into_owned(),
            path: self.root.display().to_string(),
        }
    }

    pub fn open(&mut self, path: &str) -> Result<WorkspaceInfo, String> {
        let root = PathBuf::from(path.trim());
        if !root.is_absolute() {
            return Err("Enter the full path to a folder.".into());
        }
        let root = root
            .canonicalize()
            .map_err(|e| format!("Could not open this folder: {e}"))?;
        if !root.is_dir() {
            return Err("Choose a folder.".into());
        }
        fs::read_dir(&root).map_err(|e| format!("Could not read this folder: {e}"))?;
        self.save(&root)?;
        self.root = root;
        Ok(self.info())
    }

    fn save(&self, root: &Path) -> Result<(), String> {
        if let Some(parent) = self.settings_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let bytes = serde_json::to_vec_pretty(&Settings { root: root.into() })
            .map_err(|e| e.to_string())?;
        atomic_write(&self.settings_path, &bytes, None)
    }
}

pub fn resolve(root: &Path, path: &str) -> Result<PathBuf, String> {
    let root = root
        .canonicalize()
        .map_err(|e| format!("Could not open the workspace folder: {e}"))?;
    let requested = Path::new(path);
    let target = if requested.is_absolute() {
        requested.to_path_buf()
    } else {
        root.join(requested)
    };
    let target = target
        .canonicalize()
        .map_err(|e| format!("Could not open this file or folder: {e}"))?;
    if !target.starts_with(root) {
        return Err("This file is outside the workspace folder.".into());
    }
    Ok(target)
}

pub fn read_text(root: &Path, path: &str) -> Result<String, String> {
    let path = resolve(root, path)?;
    if !path.is_file() {
        return Err("Choose a text file.".into());
    }
    if path.metadata().map_err(|e| e.to_string())?.len() > 1024 * 1024 {
        return Err("This file is larger than 1 MB and cannot be opened in the editor.".into());
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    if bytes.contains(&0) {
        return Err("This file contains binary data.".into());
    }
    String::from_utf8(bytes).map_err(|_| "This file is not UTF-8 text.".into())
}

pub fn write_text(root: &Path, path: &str, content: &str, original: &str) -> Result<(), String> {
    if content.len() > 1024 * 1024 || content.contains('\0') {
        return Err("The editor saves UTF-8 text files up to 1 MB.".into());
    }
    let path = resolve(root, path)?;
    if read_text(root, path.to_str().ok_or("Unsupported filename")?)? != original {
        return Err(
            "This file changed on disk. Your edits are still here; reopen the file before saving."
                .into(),
        );
    }
    let permissions = path.metadata().map_err(|e| e.to_string())?.permissions();
    if permissions.readonly() {
        return Err("This file is read-only.".into());
    }
    atomic_write(&path, content.as_bytes(), Some(permissions))
}

fn atomic_write(
    path: &Path,
    bytes: &[u8],
    permissions: Option<fs::Permissions>,
) -> Result<(), String> {
    let unique = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let temp = path.with_file_name(format!(".loom-save-{}-{unique}", std::process::id()));
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)
        .map_err(|e| format!("Could not save: {e}"))?;
    let result = (|| {
        if let Some(permissions) = permissions {
            file.set_permissions(permissions)?;
        }
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temp, path)
    })();
    if let Err(error) = result {
        let _ = fs::remove_file(temp);
        return Err(format!("Could not save: {error}"));
    }
    Ok(())
}
