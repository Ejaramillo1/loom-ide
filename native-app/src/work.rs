//! Read the existing Tauri records directly without migrating or duplicating them.
use eframe::egui::*;
use serde_json::Value;
use std::path::PathBuf;
#[derive(Default)]
pub struct Overview {
    records: Vec<(String, Value)>,
    error: String,
    loaded: bool,
}
impl Overview {
    pub fn ui(&mut self, ui: &mut Ui) {
        ui.heading("Work · shared with Tauri");
        ui.label(
            "The same saved work, intents and experiment records. Knowledge stays in your vault.",
        );
        ui.horizontal(|ui| {
            if ui.button("Refresh saved work").clicked() {
                self.loaded = false;
            }
            if ui.button("Go to full Tauri tools").clicked() {
                if let Err(e) = crate::files::open_tauri() {
                    self.error = e;
                }
            }
        });
        if !self.loaded {
            self.records.clear();
            self.error.clear();
            self.loaded = true;
            let home = std::env::var_os("HOME")
                .map(PathBuf::from)
                .unwrap_or_default();
            let root = std::env::var_os("XDG_DATA_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".local/share"))
                .join("com.loom.ide/loom-ide");
            for (label, name) in [
                ("Work", "work.json"),
                ("Intents", "intents.json"),
                ("Experiments", "experiments.json"),
            ] {
                let p = root.join(name);
                match std::fs::read_to_string(&p) {
                    Ok(text) => match serde_json::from_str(&text) {
                        Ok(v) => self.records.push((label.into(), v)),
                        Err(e) => self.error = format!("{}: {e}", p.display()),
                    },
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                        self.records.push((label.into(), Value::Array(vec![])))
                    }
                    Err(e) => self.error = format!("{}: {e}", p.display()),
                }
            }
        }
        if !self.error.is_empty() {
            ui.colored_label(ui.visuals().error_fg_color, &self.error);
        }
        ScrollArea::vertical().id_salt("shared-work").show(ui,|ui| {
            for (label,data) in &self.records {
                ui.heading(label);
                let rows=data.as_array().or_else(||data.get("intents").and_then(Value::as_array));
                if let Some(rows)=rows {
                    if rows.is_empty(){ui.label("Nothing recorded yet.");}
                    for row in rows {
                        let title=row["title"].as_str().or_else(||row["statement"].as_str()).or_else(||row["question"].as_str()).unwrap_or("Untitled");
                        ui.push_id(row["id"].as_str().unwrap_or(title),|ui| {
                            CollapsingHeader::new(title).show(ui,|ui| {
                                if let Some(status)=row["status"].as_str(){ui.label(format!("Local state: {status}"));}
                                if let Some(planning)=row["autonomy"].as_str(){ui.label(format!("Planning preference: {planning}"));}
                                if let Some(criteria)=row["success_criteria"].as_array(){for c in criteria {if let Some(s)=c.as_str(){ui.label(format!("• {s}"));}}}
                                ui.label("Saved record · editing and runtime tools available in Tauri");
                                ui.collapsing("Inspect full record",|ui| {ui.label(RichText::new(serde_json::to_string_pretty(row).unwrap_or_default()).monospace());});
                            });
                        });
                    }
                } else {ui.label("Unrecognized record format; original file is preserved.");}
                ui.separator();
            }
        });
    }
}
