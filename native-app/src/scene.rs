//! A local scene-preview prototype, independent of the home scene and Unity runtime.
use eframe::egui::*;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Preset {
    pub x: f32,
    pub y: f32,
    pub scale: f32,
    pub speed: f32,
}
impl Default for Preset {
    fn default() -> Self {
        Self { x: 0., y: 0., scale: 1., speed: 1. }
    }
}
impl Preset {
    fn validate(&self) -> Result<(), String> {
        if !(-1.0..=1.0).contains(&self.x) || !(-1.0..=1.0).contains(&self.y)
            || !(0.5..=1.5).contains(&self.scale) || !(0.25..=2.0).contains(&self.speed)
        {
            return Err("Scene preset contains unsupported values".into());
        }
        Ok(())
    }
    pub fn load(root: &Path) -> Result<Self, String> {
        let path = root.join(".loom/scene-preview.json");
        match std::fs::read(path) {
            Ok(bytes) => {
                let preset: Self = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
                preset.validate()?;
                Ok(preset)
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Self::default()),
            Err(e) => Err(e.to_string()),
        }
    }
    pub fn save(&self, root: &Path) -> Result<(), String> {
        self.validate()?;
        let directory = root.join(".loom");
        std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        let temp = directory.join(format!("scene-preview-{}.tmp", crate::knowledge::new_id()));
        let bytes = serde_json::to_vec_pretty(self).map_err(|e| e.to_string())?;
        let result = std::fs::write(&temp, bytes)
            .and_then(|_| std::fs::rename(&temp, directory.join("scene-preview.json")));
        if result.is_err() { let _ = std::fs::remove_file(&temp); }
        result.map_err(|e| e.to_string())
    }
}

#[derive(Default)]
pub struct ScenePreview {
    pub preset: Preset,
    pub playing: bool,
    pub time: f64,
}
impl ScenePreview {
    pub fn advance(&mut self, delta: f32, reduced_motion: bool) {
        if self.playing && !reduced_motion {
            self.time += delta.clamp(0., 0.1) as f64 * self.preset.speed as f64;
        }
    }
    /// Returns whether the user requested saving. All edits stay in this preview.
    pub fn show(&mut self, ui: &mut Ui, orb: TextureId, colors: crate::visual::Palette,
        reduced_motion: bool) -> bool
    {
        ui.label(RichText::new("Unity-inspired scene controls").size(19.));
        ui.label(RichText::new("A local visual prototype. Unity is not connected.").color(colors.second));
        ui.add_space(12.);
        ui.horizontal_wrapped(|ui| {
            if ui.button(if self.playing { "Pause preview" } else { "Play preview" }).clicked() {
                self.playing = !self.playing;
            }
            if ui.button("Stop").clicked() { self.playing = false; self.time = 0.; }
            if ui.button("Reset scene").clicked() { *self = Self::default(); }
            ui.label(RichText::new(if reduced_motion { "Reduced motion · static preview" }
                else if self.playing { "Playing" } else { "Paused" }).size(12.).color(colors.muted));
        });
        self.advance(ui.input(|i| i.stable_dt), reduced_motion);
        if self.playing && !reduced_motion { ui.ctx().request_repaint_after(std::time::Duration::from_millis(33)); }
        ui.add_space(10.);
        let height = 200_f32.min((ui.ctx().screen_rect().height() - 400.).max(100.));
        let (canvas, _) = ui.allocate_exact_size(vec2(ui.available_width(), height), Sense::hover());
        let p = ui.painter().with_clip_rect(canvas);
        p.rect_filled(canvas, 16., colors.overlay(6));
        p.rect_stroke(canvas, 16., Stroke::new(1_f32, colors.overlay(20)));
        for i in 1..8 {
            let x = canvas.left() + canvas.width() * i as f32 / 8.;
            p.line_segment([pos2(x, canvas.top()), pos2(x, canvas.bottom())], Stroke::new(1_f32, colors.overlay(7)));
        }
        for i in 1..4 {
            let y = canvas.top() + canvas.height() * i as f32 / 4.;
            p.line_segment([pos2(canvas.left(), y), pos2(canvas.right(), y)], Stroke::new(1_f32, colors.overlay(7)));
        }
        let diameter = canvas.height() * 0.43 * self.preset.scale;
        let extent = (canvas.size() - Vec2::splat(diameter / 0.76)) * 0.5;
        let center = canvas.center() + vec2(self.preset.x * extent.x, -self.preset.y * extent.y);
        let side = diameter / 0.76;
        p.image(orb, Rect::from_center_size(center, Vec2::splat(side)),
            Rect::from_min_max(Pos2::ZERO, pos2(1., 1.)), Color32::WHITE);
        for k in 0..6 {
            let points = crate::mechanics::wave_points(diameter * 0.5, self.time, reduced_motion,
                crate::knowledge::State::Idle, k).into_iter().map(|[x, y]| center + vec2(x, y)).collect::<Vec<_>>();
            if points.len() >= crate::mechanics::RIBBON_MIN_POINTS {
                p.add(Shape::line(points, Stroke::new(0.8_f32, colors.overlay(40))));
            }
        }
        ui.add_space(12.);
        ui.label(RichText::new("Scene  /  Luminous sphere").color(colors.purple));
        ui.label(RichText::new("Inspector · position, size and animation").size(12.).color(colors.muted));
        ui.add(Slider::new(&mut self.preset.x, -1.0..=1.0).text("Position X"));
        ui.add(Slider::new(&mut self.preset.y, -1.0..=1.0).text("Position Y"));
        ui.add(Slider::new(&mut self.preset.scale, 0.5..=1.5).text("Scale"));
        ui.add(Slider::new(&mut self.preset.speed, 0.25..=2.0).text("Animation speed"));
        ui.add_space(8.);
        let save = ui.button("Save scene preset").clicked();
        ui.label(RichText::new("Saved locally for your next visit. The home sphere keeps its original settings.")
            .size(12.).color(colors.muted));
        save
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preview_clock_obeys_pause_stop_and_reduced_motion() {
        let mut scene = ScenePreview::default();
        scene.advance(0.1, false);
        assert_eq!(scene.time, 0.);
        scene.playing = true;
        scene.preset.speed = 2.;
        scene.advance(0.05, false);
        assert!((scene.time - 0.1).abs() < 0.00001);
        let paused = scene.time;
        scene.advance(0.1, true);
        assert_eq!(scene.time, paused);
        scene.playing = false;
        scene.advance(0.1, false);
        assert_eq!(scene.time, paused);
    }
    #[test]
    fn preset_round_trip_and_invalid_values_preserve_saved_scene() {
        let root = std::env::temp_dir().join(crate::knowledge::new_id());
        let mut preset = Preset { x: 0.6, y: -0.3, scale: 1.4, speed: 0.5 };
        assert_eq!(Preset::load(&root).unwrap(), Preset::default());
        preset.save(&root).unwrap();
        assert_eq!(Preset::load(&root).unwrap(), preset);
        preset.scale = f32::NAN;
        assert!(preset.save(&root).is_err());
        assert_eq!(Preset::load(&root).unwrap().scale, 1.4);
        std::fs::write(root.join(".loom/scene-preview.json"), br#"{"x":0,"y":0,"scale":100,"speed":1}"#).unwrap();
        assert!(Preset::load(&root).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
}
