#[allow(dead_code)]
mod adapter;
mod knowledge;
mod loom_adapter;
mod loom_sync;
mod mechanics;
mod scene;
mod visual;
use adapter::{AgentAdapter, ContextPack};
use eframe::egui::*;
use knowledge::*;
use loom_adapter::LoomHttpAdapter;
use std::{
    path::PathBuf,
    time::{Duration, Instant},
};
use visual::*;

#[derive(Clone, PartialEq)]
enum View {
    Home,
    Knowledge,
    Canvas,
    Experiments,
    Decisions,
    Traces,
}
#[derive(Clone, PartialEq)]
enum Dialog {
    Search,
    Activity,
    Intent,
    More,
    Review,
    Note,
    New,
    Settings,
    Context,
    Journal,
    Experiment,
    Scene,
}
struct Message {
    user: bool,
    text: String,
    links: Vec<String>,
}
struct Workbench {
    vault: Option<Vault>,
    adapter: LoomHttpAdapter,
    loom_connected: bool,
    startup_error: String,
    view: View,
    dialog: Option<Dialog>,
    chat_open: bool,
    home_narrow: bool,
    messages: Vec<Message>,
    input: String,
    query: String,
    selected: String,
    draft: Option<Note>,
    editing: bool,
    new_title: String,
    new_body: String,
    new_kind: String,
    intent_draft: String,
    review_reason: String,
    relation_target: String,
    relation_kind: String,
    toast: Option<(String, Instant, bool)>,
    colors: Palette,
    bg: TextureHandle,
    orb: TextureHandle,
    started: Instant,
    processing_until: f64,
    completed_until: f64,
    experiment_stage: mechanics::ExperimentStage,
    experiment_notice: String,
    frames: u32,
    screenshot: Option<PathBuf>,
    screenshot_sent: bool,
    self_test: Option<PathBuf>,
    test_steps: Vec<serde_json::Value>,
    test_done: bool,
    focus_search: bool,
    folder: Option<String>,
    focus_graph: Option<String>,
    canvas_positions: std::collections::HashMap<String, Pos2>,
    scene: scene::ScenePreview,
}
fn rect(x: f32, y: f32, w: f32, h: f32) -> Rect {
    Rect::from_min_size(pos2(x, y), vec2(w, h))
}
fn button(ui: &mut Ui, text: &str) -> bool {
    ui.add(
        Button::new(RichText::new(text).size(14.))
            .min_size(vec2(100., 36.))
            .rounding(12.),
    )
    .clicked()
}
impl Workbench {
    fn new(
        cc: &eframe::CreationContext<'_>,
        root: PathBuf,
        screenshot: Option<PathBuf>,
        self_test: Option<PathBuf>,
        view: View,
    ) -> Self {
        let mut fonts = FontDefinitions::default();
        fonts.font_data.insert(
            "Inter".into(),
            FontData::from_static(include_bytes!("../assets/Inter-400.ttf")),
        );
        fonts.font_data.insert(
            "Inter Medium".into(),
            FontData::from_static(include_bytes!("../assets/Inter-500.ttf")),
        );
        fonts
            .families
            .entry(FontFamily::Proportional)
            .or_default()
            .insert(0, "Inter".into());
        fonts.families.insert(
            FontFamily::Name("medium".into()),
            vec!["Inter Medium".into()],
        );
        cc.egui_ctx.set_fonts(fonts);
        let (vault, startup_error) = match Vault::open(root) {
            Ok(v) => (Some(v), String::new()),
            Err(e) => (None, e),
        };
        let colors = Palette::new(vault.as_ref().map(|v| v.settings.light_mode).unwrap_or(false));
        apply_appearance(&cc.egui_ctx, colors);
        let bg = cc
            .egui_ctx
            .load_texture("Atmosphere", atmosphere(colors), TextureOptions::LINEAR);
        let orb = cc
            .egui_ctx
            .load_texture("Luminous sphere", sphere(), TextureOptions::LINEAR);
        Self {
            vault,
            adapter: LoomHttpAdapter::new(),
            loom_connected: false,
            startup_error,
            view,
            dialog: None,
            chat_open: true,
            home_narrow: false,
            messages: vec![
                Message {
                    user: true,
                    text: "Show me what we have learned about agent memory.".into(),
                    links: vec![],
                },
                Message {
                    user: false,
                    text: "Here is a summary of our findings on agent memory:".into(),
                    links: vec!["mastermind".into(), "result".into(), "map".into()],
                },
            ],
            input: String::new(),
            query: String::new(),
            selected: "result".into(),
            draft: None,
            editing: false,
            new_title: String::new(),
            new_body: String::new(),
            new_kind: "note".into(),
            intent_draft: String::new(),
            review_reason: String::new(),
            relation_target: "hypothesis".into(),
            relation_kind: "references".into(),
            toast: None,
            colors,
            bg,
            orb,
            started: Instant::now(),
            processing_until: 0.0,
            completed_until: 0.0,
            experiment_stage: Default::default(),
            experiment_notice: String::new(),
            frames: 0,
            screenshot,
            screenshot_sent: false,
            self_test,
            test_steps: Vec::new(),
            test_done: false,
            focus_search: false,
            folder: None,
            focus_graph: None,
            canvas_positions: Default::default(),
            scene: Default::default(),
        }
    }
    fn set_appearance(&mut self, ctx: &Context, light: bool) {
        if light == self.colors.light { return; }
        if let Some(vault) = self.vault.as_mut() {
            if let Err(error) = vault.set_appearance(light) {
                self.notify(error, true);
                return;
            }
        }
        self.colors = Palette::new(light);
        apply_appearance(ctx, self.colors);
        self.bg.set(atmosphere(self.colors), TextureOptions::LINEAR);
        ctx.request_repaint();
    }
    fn appearance_switch(&mut self, ui: &mut Ui, r: Rect) {
        let p = ui.painter().clone();
        p.rect_filled(r, 14., self.colors.overlay(10));
        p.rect_stroke(r, 14., Stroke::new(1_f32, self.colors.overlay(22)));
        for (i, (label, light)) in [("Dark", false), ("White", true)].into_iter().enumerate() {
            let hit = Rect::from_min_size(r.min + vec2(3. + i as f32 * 64., 3.), vec2(64., r.height() - 6.));
            let response = ui.interact(hit, ui.id().with(("appearance", label)), Sense::click());
            response.widget_info(|| WidgetInfo::selected(WidgetType::SelectableLabel, true, light == self.colors.light, format!("{label} appearance")));
            if light == self.colors.light || response.hovered() || response.has_focus() {
                p.rect_filled(hit, 11., self.colors.accent(if light == self.colors.light { 42 } else { 18 }));
            }
            p.text(hit.center(), Align2::CENTER_CENTER, label, FontId::proportional(12.),
                if light == self.colors.light { self.colors.text } else { self.colors.second });
            if response.clicked() { self.set_appearance(ui.ctx(), light); }
            response.on_hover_text(format!("Use {label} appearance")).on_hover_cursor(CursorIcon::PointingHand);
        }
    }
    fn notify(&mut self, message: impl Into<String>, error: bool) {
        if !error {
            self.completed_until = self.started.elapsed().as_secs_f64() + mechanics::COMPLETION_SECONDS;
        }
        self.toast = Some((message.into(), Instant::now(), error));
    }
    fn outcome(&mut self, r: Result<(), String>, success: &str) {
        match r {
            Ok(()) => self.notify(success, false),
            Err(e) => self.notify(e, true),
        }
    }
    /// Sync Loom sessions, agents and artifacts into the vault, on click
    /// only. New notes appear in the graph without a reload: graph()
    /// reads vault.notes each frame.
    fn sync_from_loom(&mut self) {
        if self.vault.is_none() {
            self.notify("Vault unavailable", true);
            return;
        }
        let result = {
            let vault = self.vault.as_mut().unwrap();
            let adapter = &self.adapter;
            (|| -> Result<(usize, usize, usize), String> {
                let sessions = loom_sync::sync_sessions(vault, adapter)?;
                let agents = loom_sync::sync_agents(vault, adapter)?;
                let artifacts = loom_sync::sync_artifacts(vault, adapter)?;
                Ok((sessions, agents, artifacts))
            })()
        };
        match result {
            Ok((sessions, agents, artifacts)) => self.notify(
                format!("Synced {sessions} sessions, {agents} agents, {artifacts} artifacts"),
                false,
            ),
            Err(e) => self.notify(e, true),
        }
    }
    fn open_note(&mut self, id: &str) {
        if let Some(n) = self.vault.as_ref().and_then(|v| v.get(id)).cloned() {
            self.selected = id.into();
            self.draft = Some(n);
            self.dialog = Some(Dialog::Note);
            self.editing = false;
            self.review_reason.clear();
        }
    }
    fn open_search(&mut self) {
        self.query.clear();
        self.dialog = Some(Dialog::Search);
        self.focus_search = true;
    }
    fn current_state(&self) -> State {
        let attention = if !self.startup_error.is_empty()
            || self
                .toast
                .as_ref()
                .map(|t| t.2 && t.1.elapsed().as_secs() < 6)
                .unwrap_or(false)
        {
            Some(State::Error)
        } else if self.dialog == Some(Dialog::Activity)
            || self.dialog == Some(Dialog::Review)
            || self.experiment_stage == mechanics::ExperimentStage::Choose
            || self.vault.as_ref().map(|v| v.state() == State::AwaitingApproval).unwrap_or(false)
        {
            Some(State::AwaitingApproval)
        } else {
            None
        };
        mechanics::sphere_state(attention,
            self.started.elapsed().as_secs_f64() < self.processing_until, false, &self.input,
            self.started.elapsed().as_secs_f64() < self.completed_until)
    }
    fn orb_image(&self, p: &Painter, c: Pos2, d: f32, logo: bool) {
        let reduced = self.vault.as_ref().map(|v| v.settings.reduced_motion).unwrap_or(true);
        let elapsed = self.started.elapsed().as_secs_f64();
        if !logo {
            let tint = match self.current_state() {
                State::AwaitingApproval => self.colors.amber,
                State::Completed => self.colors.green,
                State::Error => self.colors.red,
                State::Exploring | State::Executing => self.colors.blue,
                _ => self.colors.purple,
            };
            // A single interpolated surface avoids stacking translucent discs,
            // which produced hard rings and an excessively bright neon halo.
            let mut halo = Mesh::default();
            let outer = mechanics::halo_radius(d * 0.5, 0);
            for ring in 0..=24 {
                let t = ring as f32 / 24.;
                let radius = d * 0.5 + (outer - d * 0.5) * t;
                let alpha = (mechanics::glow_alpha(elapsed, reduced) as f32
                    * 1.5 * (1. - t).powi(2)) as u8;
                let channel = |c: u8| (c as u16 * alpha as u16 / 255) as u8;
                let color = Color32::from_rgba_premultiplied(
                    channel(tint.r()), channel(tint.g()), channel(tint.b()), alpha);
                for segment in 0..=96 {
                    let a = segment as f32 / 96. * std::f32::consts::TAU;
                    halo.colored_vertex(c + vec2(a.cos(), a.sin()) * radius, color);
                    if ring < 24 && segment < 96 {
                        let i = ring * 97 + segment;
                        halo.add_triangle(i, i + 1, i + 97);
                        halo.add_triangle(i + 1, i + 98, i + 97);
                    }
                }
            }
            p.add(Shape::mesh(halo));
        }
        let side = d / 0.76;
        p.image(
            self.orb.id(),
            Rect::from_center_size(c, vec2(side, side)),
            rect(0., 0., 1., 1.),
            Color32::WHITE,
        );
        if !logo {
            for k in 0..6 {
                let points = mechanics::wave_points(d * 0.5, elapsed, reduced, self.current_state(), k)
                    .into_iter().map(|[x,y]| c + vec2(x,y)).collect::<Vec<_>>();
                if points.len() >= mechanics::RIBBON_MIN_POINTS {
                    p.add(Shape::line(points, Stroke::new(mechanics::RIBBON_WIDTH,
                        Color32::from_rgba_premultiplied(16, 15, 24, 24))));
                }
            }
        }
    }
    fn top(&mut self, ui: &mut Ui, w: f32, workspace: bool) {
        let p = ui.painter().clone();
        let r = rect(32., 20., 125., 48.);
        let home = ui.interact(r, Id::new("Home logo"), Sense::click());
        home.widget_info(|| WidgetInfo::labeled(WidgetType::Button, true, "Loom Home"));
        if home.clicked() {
            self.view = View::Home;
            self.dialog = None;
        }
        self.orb_image(&p, pos2(56., 44.), 32., true);
        p.text(
            pos2(82., 44.),
            Align2::LEFT_CENTER,
            "Loom",
            FontId::new(22., FontFamily::Name("medium".into())),
            self.colors.text,
        );
        if workspace && w > 850. {
            let intent = self
                .vault
                .as_ref()
                .map(|v| v.settings.intent.as_str())
                .unwrap_or("Knowledge workspace");
            txt(&p.with_clip_rect(rect(206., 28., w - 560., 32.)), 206., 35., intent, 14., self.colors.second);
        }
        self.appearance_switch(ui, rect(w - 334., 27., 134., 34.));
        if icon_button(
            ui,
            rect(w - 184., 24., 40., 40.),
            "search",
            "Search knowledge · Ctrl+K",
        )
        .clicked()
        {
            self.open_search();
        }
        if icon_button(
            ui,
            rect(w - 132., 24., 40., 40.),
            "bell",
            "Review proposed knowledge",
        )
        .clicked()
        {
            self.dialog = Some(Dialog::Review);
        }
        if self
            .vault
            .as_ref()
            .map(|v| v.pending() > 0)
            .unwrap_or(false)
        {
            p.circle_filled(pos2(w - 102., 31.), 3., self.colors.purple);
        }
        let pr = rect(w - 80., 24., 40., 40.);
        let response = ui.interact(pr, Id::new("Profile"), Sense::click());
        p.circle_filled(pr.center(), 15., self.colors.overlay(13));
        p.circle_filled(pr.center(), 9., self.colors.purple.gamma_multiply(0.8));
        if response.clicked() {
            self.dialog = Some(Dialog::Settings);
        }
        response.on_hover_text("Local workspace settings");
    }
    fn home(&mut self, ui: &mut Ui, r: Rect) {
        let (w, h) = (r.width(), r.height());
        let p = ui.painter().clone();
        p.image(self.bg.id(), r, rect(0., 0., 1., 1.), Color32::WHITE);
        self.top(ui, w, false);
        let iw = (w - 80.).min(760.);
        txt(
            &p,
            48.,
            112.,
            "You are working on:",
            15.,
            self.colors.second,
        );
        let intent = self
            .vault
            .as_ref()
            .map(|v| v.settings.intent.clone())
            .unwrap_or("Your local research workspace".into());
        let rr = rect(48., 137., iw, 36.);
        let ir = ui.interact(rr, Id::new("Active human intent"), Sense::click());
        wrapped(&p, rr, intent, 25., self.colors.text);
        if ir.clicked() {
            self.intent_draft = self
                .vault
                .as_ref()
                .map(|v| v.settings.intent.clone())
                .unwrap_or_default();
            self.dialog = Some(Dialog::Intent);
        }
        ir.on_hover_text("Edit intent, view linked knowledge, or switch project");
        let mut m = Mesh::default();
        m.colored_vertex(pos2(48., 177.), self.colors.purple);
        m.colored_vertex(pos2(96., 177.), self.colors.blue);
        m.colored_vertex(pos2(96., 180.), self.colors.blue);
        m.colored_vertex(pos2(48., 180.), self.colors.purple);
        m.add_triangle(0, 1, 2);
        m.add_triangle(0, 2, 3);
        p.add(Shape::mesh(m));
        let narrow = w < 1100.;
        if narrow && !self.home_narrow {
            self.chat_open = false;
        }
        self.home_narrow = narrow;
        let cx = if narrow {
            w * 0.5
        } else {
            (w * (630. / 1600.)).min(w - 640.)
        };
        let cy = (h * 0.48333).max(345.).min(h - 230.);
        let d = if narrow { 330_f32.min(w * 0.61) } else { 370. }
            .min((h - 440.).max(200.));
        let orbrect = Rect::from_center_size(pos2(cx, cy), vec2(d, d));
        self.orb_image(&p, orbrect.center(), d, false);
        let or = ui.interact(orbrect, Id::new("Sphere activity"), Sense::click());
        or.widget_info(|| {
            WidgetInfo::labeled(
                WidgetType::Button,
                true,
                format!("Activity: {}", self.current_state().label()),
            )
        });
        if or.clicked() {
            self.dialog = Some(Dialog::Activity);
        }
        if or.hovered() {
            p.text(
                pos2(cx, cy + d / 2. + 44.),
                Align2::CENTER_CENTER,
                format!("{} · View activity", mechanics::state_words(self.current_state())),
                FontId::proportional(12.),
                self.colors.second,
            );
        }
        let navw = 660_f32.min(w - 40.);
        let navcx = if narrow { w * 0.5 } else { cx + 20. };
        let nav = rect(navcx - navw * 0.5, h - 110., navw, 78.);
        glass(&p, nav, 40.);
        let labels = [
            ("nodes", "Knowledge"),
            ("layers", "Canvas"),
            ("flask", "Experiments"),
            ("history", "Decisions"),
            ("activity", "Traces"),
            ("grid", "More"),
        ];
        for (i, (name, label)) in labels.iter().enumerate() {
            let x = nav.left() + nav.width() / 6. * (i as f32 + 0.5);
            let hit = Rect::from_center_size(pos2(x, nav.center().y), vec2(navw / 6. - 4., 68.));
            let response = ui.interact(hit, Id::new(("navigation", label)), Sense::click());
            response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, true, *label));
            if response.hovered() || response.has_focus() {
                p.rect_filled(hit, 32., self.colors.accent(22));
            }
            icon(
                &p,
                name,
                pos2(x, nav.top() + 25.),
                22.,
                if response.hovered() {
                    self.colors.purple
                } else {
                    self.colors.text
                },
            );
            p.text(
                pos2(x, nav.top() + 53.),
                Align2::CENTER_CENTER,
                label,
                FontId::proportional(if w < 650. { 10. } else { 12. }),
                self.colors.text,
            );
            if response.clicked() {
                self.folder = None;
                match i {
                    0 => self.view = View::Knowledge,
                    1 => self.view = View::Canvas,
                    2 => self.view = View::Experiments,
                    3 => self.view = View::Decisions,
                    4 => self.view = View::Traces,
                    _ => self.dialog = Some(Dialog::More),
                }
            }
        }
        if narrow {
            if pill(
                ui,
                rect(w - 192., h - 176., 170., 42.),
                "Conversation",
                false,
            )
            .clicked()
            {
                self.chat_open = !self.chat_open;
            }
            if self.chat_open {
                let width = 384_f32.min(w - 40.);
                self.conversation(ui, rect(w - width - 20., 210., width, (h - 330.).min(520.)));
            }
        } else if self.chat_open {
            self.conversation(ui, rect(w - 430., 140., 384., 520_f32.min(h - 190.)));
        } else if pill(ui, rect(w - 236., 140., 190., 44.), "Conversation", false).clicked() {
            self.chat_open = true;
        }
    }
    fn conversation(&mut self, ui: &mut Ui, r: Rect) {
        let p = ui.painter().clone();
        glass(&p, r, 20.);
        icon(&p, "chat", r.min + vec2(30., 32.), 20., self.colors.text);
        txt(&p, r.left() + 51., r.top() + 21., "Conversation", 16., self.colors.text);
        if icon_button(
            ui,
            rect(r.right() - 47., r.top() + 12., 34., 36.),
            "down",
            "Collapse conversation",
        )
        .clicked()
        {
            self.chat_open = false;
        }
        p.line_segment(
            [r.min + vec2(20., 62.), pos2(r.right() - 20., r.top() + 62.)],
            Stroke::new(1.0_f32, self.colors.overlay(19)),
        );
        let history = rect(
            r.left() + 16.,
            r.top() + 77.,
            r.width() - 32.,
            r.height() - 157.,
        );
        let mut open = None;
        ui.allocate_new_ui(
            UiBuilder::new()
                .max_rect(history)
                .layout(Layout::top_down(Align::Min)),
            |ui| {
                ScrollArea::vertical()
                    .id_salt("conversation history")
                    .max_height(history.height())
                    .stick_to_bottom(true)
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        for msg in &self.messages {
                            if msg.user {
                                ui.with_layout(Layout::right_to_left(Align::Min), |ui| {
                                    Frame::none()
                                        .fill(self.colors.accent(52))
                                        .rounding(16.)
                                        .inner_margin(Margin::symmetric(15., 12.))
                                        .show(ui, |ui| {
                                            ui.set_width(232.);
                                            ui.label(
                                                RichText::new(&msg.text).size(14.).color(self.colors.text),
                                            );
                                        });
                                });
                                ui.add_space(15.);
                            } else {
                                ui.horizontal_top(|ui| {
                                    let (ir, _) =
                                        ui.allocate_exact_size(vec2(26., 26.), Sense::hover());
                                    self.orb_image(ui.painter(), ir.center(), 22., true);
                                    ui.vertical(|ui| {
                                        ui.set_width(history.width() - 47.);
                                        ui.label(RichText::new(&msg.text).size(14.).color(self.colors.second));
                                        ui.add_space(8.);
                                        if !msg.links.is_empty() {
                                            Frame::none()
                                                .stroke(Stroke::new(1_f32,
                                                    self.colors.overlay(25),
                                                ))
                                                .rounding(12.)
                                                .inner_margin(3.)
                                                .show(ui, |ui| {
                                                    for (i, id) in msg.links.iter().enumerate() {
                                                        let label = if id == "map" {
                                                            "Related Knowledge (6)".into()
                                                        } else {
                                                            self.vault
                                                                .as_ref()
                                                                .and_then(|v| v.get(id))
                                                                .map(|n| n.meta.title.clone())
                                                                .unwrap_or(id.clone())
                                                        };
                                                        let (rr, res) = ui.allocate_exact_size(
                                                            vec2(ui.available_width(), 43.),
                                                            Sense::click(),
                                                        );
                                                        if res.hovered() {
                                                            ui.painter().rect_filled(
                                                                rr,
                                                                8.,
                                                                self.colors.overlay(9),
                                                            );
                                                        }
                                                        icon(
                                                            ui.painter(),
                                                            if id == "mastermind" {
                                                                "file"
                                                            } else if id == "result" {
                                                                "chart"
                                                            } else {
                                                                "nodes"
                                                            },
                                                            rr.min + vec2(19., 21.),
                                                            17.,
                                                            self.colors.second,
                                                        );
                                                        txt(
                                                            ui.painter(),
                                                            rr.left() + 36.,
                                                            rr.top() + 13.,
                                                            label,
                                                            12.,
                                                            self.colors.text,
                                                        );
                                                        icon(
                                                            ui.painter(),
                                                            "chevron",
                                                            pos2(rr.right() - 15., rr.center().y),
                                                            15.,
                                                            self.colors.second,
                                                        );
                                                        if res.clicked() {
                                                            open = Some(id.clone());
                                                        }
                                                        if i + 1 < msg.links.len() {
                                                            ui.painter().line_segment(
                                                                [
                                                                    pos2(
                                                                        rr.left() + 10.,
                                                                        rr.bottom(),
                                                                    ),
                                                                    pos2(
                                                                        rr.right() - 10.,
                                                                        rr.bottom(),
                                                                    ),
                                                                ],
                                                                Stroke::new(0.7_f32,
                                                                    self.colors.overlay(20),
                                                                ),
                                                            );
                                                        }
                                                    }
                                                });
                                        }
                                    });
                                });
                                ui.add_space(15.);
                            }
                        }
                        if self.messages.len() == 2 {
                            ui.add_space(3.);
                            ui.horizontal(|ui| {
                                ui.add_space(32.);
                                if ui
                                    .add(
                                        Button::new(
                                            RichText::new("Challenge our conclusion")
                                                .size(13.)
                                                .color(self.colors.second),
                                        )
                                        .frame(false),
                                    )
                                    .clicked()
                                {
                                    open = Some("challenge".into());
                                }
                            });
                        }
                    });
            },
        );
        let inp = rect(r.left() + 16., r.bottom() - 65., r.width() - 32., 46.);
        p.rect_filled(inp, 24., self.colors.overlay(5));
        p.rect_stroke(inp, 24., Stroke::new(1.0_f32, self.colors.overlay(50)));
        let response = ui.put(
            rect(inp.left() + 15., inp.top() + 10., inp.width() - 64., 30.),
            TextEdit::singleline(&mut self.input)
                .frame(false)
                .font(FontId::proportional(13.))
                .hint_text("Ask or propose something..."),
        );
        let send = icon_button(
            ui,
            rect(inp.right() - 43., inp.top() + 5., 36., 36.),
            "send",
            "Send message",
        )
        .clicked();
        if send || (response.lost_focus() && ui.input(|i| i.key_pressed(Key::Enter))) {
            self.send_message();
        }
        if pill(
            ui,
            rect(r.right() - 150., r.bottom() - 18., 134., 18.),
            "Test connection",
            false,
        )
        .clicked()
        {
            let state = self.adapter.activity().state;
            self.loom_connected = state != State::Error;
            if self.loom_connected {
                self.notify("Connected to Loom", false);
            } else {
                self.notify("Loom offline", true);
            }
        }
        txt(
            &p,
            r.left() + 21.,
            r.bottom() - 14.,
            if self.loom_connected {
                "Loom connected"
            } else {
                "Local knowledge · No model connected"
            },
            10.,
            self.colors.muted,
        );
        if let Some(id) = open {
            self.open_note(&id);
        }
    }
    fn send_message(&mut self) {
        let manual = self.vault.as_ref().map(|v| v.settings.manual_chat).unwrap_or(false);
        let q = match mechanics::prepare_chat(&self.input, manual) {
            Ok(Some(text)) => text,
            Ok(None) => return,
            Err(notice) => {
                // A blocked send is a notice, not a completed operation.
                self.toast = Some((notice.into(), Instant::now(), false));
                return;
            }
        };
        self.input.clear();
        // The original shows this brief feedback even for an immediate offline reply.
        self.processing_until = self.started.elapsed().as_secs_f64() + mechanics::PROCESSING_SECONDS;
        let lower = q.to_lowercase();
        self.messages.push(Message {
            user: true,
            text: q.clone(),
            links: vec![],
        });
        let connected = self.adapter.activity().state != State::Error;
        self.loom_connected = connected;
        if connected {
            let intent = self
                .vault
                .as_ref()
                .map(|v| v.settings.intent.clone())
                .unwrap_or_default();
            let object_ids = if self.selected.is_empty() {
                Vec::new()
            } else {
                vec![self.selected.clone()]
            };
            let context = ContextPack {
                intent,
                object_ids,
                excluded_ids: Vec::new(),
                estimated_tokens: (q.chars().count() + 3) / 4,
            };
            match self.adapter.submit(&context, &q) {
                Ok(text) => self.messages.push(Message {
                    user: false,
                    text,
                    links: vec![],
                }),
                Err(e) => self.messages.push(Message {
                    user: false,
                    text: format!("Loom could not answer: {e}"),
                    links: vec![],
                }),
            }
            self.completed_until =
                self.started.elapsed().as_secs_f64() + mechanics::COMPLETION_SECONDS;
            return;
        }
        if lower.contains("challenge") || lower.contains("surely") {
            let body="The observed advantage may depend on task ordering, prompt design or experimental conditions. Does it generalize to other tasks?\n\nThis is an offline reasoning prompt based on the historical fixture, not a new measurement.";
            let result = self
                .vault
                .as_mut()
                .ok_or_else(|| "Vault unavailable".to_string())
                .and_then(|v| {
                    let id = v.create(
                        "Challenge: test the hidden assumptions",
                        body,
                        "question",
                        Actor::Agent,
                    )?;
                    v.relate(&id, "result", "references")?;
                    Ok(id)
                });
            match result{Ok(id)=>self.messages.push(Message{user:false,text:"Offline sparring prompt: task ordering and prompt design could affect this result. I saved a proposed challenge for your review.".into(),links:vec![id]}),Err(e)=>self.notify(e,true)}
        } else {
            let links =
                if lower.contains("memor") || lower.contains("learn") || lower.contains("summar") {
                    vec!["result".into(), "mastermind".into(), "challenge".into()]
                } else {
                    self.vault
                        .as_ref()
                        .map(|v| {
                            v.search(&q)
                                .iter()
                                .take(3)
                                .map(|n| n.meta.id.clone())
                                .collect()
                        })
                        .unwrap_or_default()
                };
            let text = if links.is_empty() {
                "No matching local knowledge yet. Create a note with Ctrl+N, or search with Ctrl+K. No model is connected to generate an answer."
            } else {
                "From the local historical fixture: memory enabled 59/100 successes; disabled 40/100. The observed difference is 19 percentage points, with approximately 4× latency and more than 2× token usage. These results do not establish generalization."
            };
            self.messages.push(Message {
                user: false,
                text: text.into(),
                links,
            });
        }
        self.completed_until = self.started.elapsed().as_secs_f64() + mechanics::COMPLETION_SECONDS;
    }
    fn workspace(&mut self, ui: &mut Ui, r: Rect) {
        let (w, h) = (r.width(), r.height());
        let p = ui.painter().clone();
        p.rect_filled(r, 0., self.colors.deep);
        self.top(ui, w, true);
        p.line_segment(
            [pos2(0., 82.), pos2(w, 82.)],
            Stroke::new(1.0_f32, self.colors.overlay(14)),
        );
        let sidebar = if w > 1000. { 242. } else { 0. };
        let mut nav = None;
        if sidebar > 0. {
            p.rect_filled(
                rect(0., 83., sidebar, h - 83.),
                0.,
                self.colors.surface(Color32::from_rgb(21, 23, 37)),
            );
            p.line_segment(
                [pos2(sidebar, 82.), pos2(sidebar, h)],
                Stroke::new(1.0_f32, self.colors.overlay(18)),
            );
            txt(&p, 26., 107., "Research Vault", 16., self.colors.text);
            icon(&p, "down", pos2(211., 117.), 15., self.colors.muted);
            if pill(ui, rect(18., 138., 205., 30.), "+  Capture a note", false).clicked() {
                self.dialog = Some(Dialog::New);
            }
            if pill(ui, rect(18., 172., 205., 30.), "+  Capture an idea", false).clicked() {
                self.new_title = "Idea: ".into();
                self.new_body.clear();
                self.new_kind = "note".into();
                self.dialog = Some(Dialog::New);
            }
            let sections = [
                ("nodes", "Knowledge", View::Knowledge),
                ("layers", "Canvas", View::Canvas),
                ("flask", "Experiments", View::Experiments),
                ("history", "Decisions", View::Decisions),
                ("activity", "Traces", View::Traces),
            ];
            for (i, (name, label, view)) in sections.iter().enumerate() {
                let rr = rect(14., 202. + i as f32 * 42., 214., 36.);
                let res = ui.interact(rr, Id::new(("sidebar", label)), Sense::click());
                if self.view == *view {
                    p.rect_filled(rr, 10., self.colors.accent(28));
                } else if res.hovered() {
                    p.rect_filled(rr, 10., self.colors.overlay(7));
                }
                icon(
                    &p,
                    name,
                    rr.min + vec2(23., 18.),
                    18.,
                    if self.view == *view { self.colors.purple } else { self.colors.muted },
                );
                txt(
                    &p,
                    rr.left() + 43.,
                    rr.top() + 8.,
                    *label,
                    14.,
                    if self.view == *view { self.colors.text } else { self.colors.second },
                );
                if res.clicked() {
                    nav = Some(view.clone());
                    self.folder = None;
                }
            }
            txt(&p, 26., 435., "VAULT LOCATIONS", 10., self.colors.muted);
            let folders = [
                ("00 Inbox", "00 Inbox"),
                ("10 Fleeting Notes", "10 Fleeting Notes"),
                ("20 Literature Notes", "20 Literature Notes"),
                ("30 Permanent Notes", "30 Permanent Notes"),
                ("40 Maps of Content", "40 Maps of Content"),
                ("50 Projects", "50 Projects"),
                ("Sessions", "50 Projects/Agent Memory/Sessions"),
                ("Agents", "50 Projects/Agent Memory/Agents"),
                ("60 Daily Notes", "60 Daily Notes"),
                ("70 Sources", "70 Sources"),
                ("80 Attachments", "80 Attachments"),
                ("90 Templates", "90 Templates"),
                ("99 Archive", "99 Archive"),
            ];
            let fr = rect(14., 462., 214., (h - 555.).max(80.));
            let mut pick = None;
            ui.allocate_new_ui(UiBuilder::new().max_rect(fr), |ui| {
                ScrollArea::vertical()
                    .id_salt("vault folders")
                    .max_height(fr.height())
                    .show(ui, |ui| {
                        for (label, prefix) in folders {
                            let (rr, res) = ui.allocate_exact_size(vec2(210., 30.), Sense::click());
                            if self.folder.as_deref() == Some(prefix) {
                                ui.painter().rect_filled(rr, 7., self.colors.overlay(9));
                            }
                            icon(
                                ui.painter(),
                                "chevron",
                                rr.min + vec2(10., 15.),
                                12.,
                                self.colors.muted,
                            );
                            icon(
                                ui.painter(),
                                "folder",
                                rr.min + vec2(29., 15.),
                                14.,
                                self.colors.muted,
                            );
                            txt(
                                ui.painter(),
                                rr.left() + 45.,
                                rr.top() + 7.,
                                label,
                                12.,
                                self.colors.second,
                            );
                            if res.clicked() {
                                pick = Some(prefix.to_string());
                            }
                        }
                    });
            });
            if let Some(f) = pick {
                self.folder = Some(f);
                self.view = View::Knowledge;
            }
            let pending = self.vault.as_ref().map(|v| v.pending()).unwrap_or(0);
            if pill(
                ui,
                rect(18., h - 76., 205., 40.),
                &format!("Memory garden  ·  {pending}"),
                false,
            )
            .clicked()
            {
                self.dialog = Some(Dialog::Review);
            }
        }
        if let Some(view) = nav {
            self.view = view;
        }
        let x = sidebar + 28.;
        let content = rect(x, 102., w - x - 28., h - 126.);
        if sidebar == 0. {
            let labels = [
                ("Knowledge", View::Knowledge),
                ("Canvas", View::Canvas),
                ("Experiments", View::Experiments),
                ("Decisions", View::Decisions),
                ("Traces", View::Traces),
            ];
            for (i, (s, v)) in labels.iter().enumerate() {
                if pill(
                    ui,
                    rect(
                        x + i as f32 * ((content.width() / 5.).min(120.)),
                        90.,
                        (content.width() / 5.).min(116.),
                        32.,
                    ),
                    s,
                    self.view == *v,
                )
                .clicked()
                {
                    self.view = v.clone();
                }
            }
        }
        let content = if sidebar == 0. {
            content.translate(vec2(0., 38.)).shrink2(vec2(0., 19.))
        } else {
            content
        };
        if self.folder.is_some() {
            self.note_list(ui, content, "folder");
        } else {
            match self.view {
                View::Knowledge => {
                    txt(
                        &p,
                        content.left() + 5.,
                        content.top() + 7.,
                        "Knowledge",
                        28.,
                        self.colors.text,
                    );
                    txt(
                        &p,
                        content.left() + 5.,
                        content.top() + 48.,
                        "Follow the evidence. Find the connections.",
                        13.,
                        self.colors.muted,
                    );
                    let count = self
                        .vault
                        .as_ref()
                        .map(|v| {
                            format!(
                                "{} objects  ·  {} relationships",
                                v.notes.len(),
                                v.ledger.edges.len()
                            )
                        })
                        .unwrap_or_default();
                    txt(
                        &p,
                        content.right() - 260.,
                        content.top() + 22.,
                        count,
                        12.,
                        self.colors.muted,
                    );
                    if pill(
                        ui,
                        rect(content.right() - 150., content.top() + 48., 144., 30.),
                        "Sync from Loom",
                        false,
                    )
                    .clicked()
                    {
                        self.sync_from_loom();
                    }
                    let gh = (content.height() * 0.51).max(260.);
                    self.graph(
                        ui,
                        rect(content.left(), content.top() + 88., content.width(), gh),
                    );
                    self.canvas(
                        ui,
                        rect(
                            content.left(),
                            content.top() + gh + 107.,
                            content.width(),
                            (content.height() - gh - 112.).max(180.),
                        ),
                        false,
                    );
                }
                View::Canvas => {
                    txt(
                        &p,
                        content.left() + 5.,
                        content.top() + 7.,
                        "Canvas",
                        28.,
                        self.colors.text,
                    );
                    txt(
                        &p,
                        content.left() + 5.,
                        content.top() + 48.,
                        "An experiment plan, grounded in shared knowledge.",
                        13.,
                        self.colors.muted,
                    );
                    self.canvas(
                        ui,
                        rect(
                            content.left(),
                            content.top() + 94.,
                            content.width(),
                            content.height() - 94.,
                        ),
                        true,
                    );
                }
                View::Experiments => self.note_list(ui, content, "experiment"),
                View::Decisions => self.note_list(ui, content, "decision"),
                View::Traces => self.traces(ui, content),
                _ => {}
            }
        }
    }
    fn graph(&mut self, ui: &mut Ui, r: Rect) {
        let p = ui.painter().clone();
        p.rect_filled(r, 16., self.colors.surface(Color32::from_rgb(19, 21, 35)));
        p.rect_stroke(r, 16., Stroke::new(1.0_f32, self.colors.overlay(17)));
        icon(&p, "nodes", r.min + vec2(24., 24.), 18., self.colors.purple);
        txt(&p, r.left() + 43., r.top() + 15., "Graph view", 14., self.colors.text);
        if self.focus_graph.is_some() {
            if pill(
                ui,
                rect(r.right() - 148., r.top() + 9., 136., 30.),
                "Show all knowledge",
                true,
            )
            .clicked()
            {
                self.focus_graph = None;
            }
        } else {
            txt(
                &p,
                r.right() - 200.,
                r.top() + 18.,
                "Select a node to inspect",
                11.,
                self.colors.muted,
            );
        }
        let notes = self
            .vault
            .as_ref()
            .map(|v| v.notes.clone())
            .unwrap_or_default();
        let edges = self
            .vault
            .as_ref()
            .map(|v| v.ledger.edges.clone())
            .unwrap_or_default();
        let visible: Vec<_> = notes
            .iter()
            .filter(|n| {
                self.focus_graph
                    .as_ref()
                    .map(|id| {
                        n.meta.id == *id
                            || edges.iter().any(|e| {
                                (e.from == *id && e.to == n.meta.id)
                                    || (e.to == *id && e.from == n.meta.id)
                            })
                    })
                    .unwrap_or(true)
            })
            .collect();
        let center = pos2(r.center().x, r.center().y + 18.);
        let radiusx = (r.width() * 0.31).min(340.);
        let radiusy = (r.height() * 0.31).min(150.);
        let mut positions = std::collections::HashMap::new();
        for (i, n) in visible.iter().enumerate() {
            let c = if n.meta.id == "result" {
                center
            } else {
                let a = (i as f32 / visible.len().max(1) as f32) * std::f32::consts::TAU - 1.6;
                center + vec2(a.cos() * radiusx, a.sin() * radiusy)
            };
            positions.insert(n.meta.id.clone(), c);
        }
        for e in &edges {
            if let (Some(a), Some(b)) = (positions.get(&e.from), positions.get(&e.to)) {
                p.line_segment(
                    [*a, *b],
                    Stroke::new(0.8f32, self.colors.overlay(65)),
                );
                let delta = (*b - *a).normalized();
                let end = *b - delta * 16.;
                p.add(Shape::line(
                    vec![
                        end - delta * 5. + vec2(-delta.y, delta.x) * 2.5,
                        end,
                        end - delta * 5. - vec2(-delta.y, delta.x) * 2.5,
                    ],
                    Stroke::new(1.0_f32, self.colors.overlay(60)),
                ));
            }
        }
        let mut open = None;
        for n in visible {
            let c = positions[&n.meta.id];
            let big = n.meta.id == "result";
            let radius = if big { 23. } else { 8. };
            let col = match n.meta.kind.as_str() {
                "result" | "memory" => self.colors.green,
                "experiment" => self.colors.blue,
                "question" => self.colors.amber,
                _ => self.colors.purple,
            };
            for i in (1..=6).rev() {
                p.circle_filled(c, radius + i as f32 * 2., col.gamma_multiply(0.012));
            }
            p.circle_filled(c, radius, col.gamma_multiply(if big { 0.82 } else { 0.9 }));
            p.circle_stroke(c, radius, Stroke::new(1.0_f32, col));
            let label = if big {
                "Agent Memory\nPerformance".to_string()
            } else {
                n.meta
                    .title
                    .replace("Experiment: ", "")
                    .replace("Understanding agent memory performance", "Active intent")
                    .replace("Agent Memory — Map of Content", "Map of Content")
                    .replace("Memory has a measurable trade-off", "Proposed memory")
            };
            let g = p.layout(
                label,
                FontId::proportional(if big { 14. } else { 11. }),
                self.colors.text,
                145.,
            );
            p.galley(pos2(c.x - g.size().x / 2., c.y + radius + 8.), g, self.colors.text);
            let response = ui.interact(
                Rect::from_center_size(c + vec2(0., 12.), vec2(130., 60.)),
                Id::new(("graph node", &n.meta.id)),
                Sense::click(),
            );
            response.widget_info(|| WidgetInfo::labeled(WidgetType::Button, true, &n.meta.title));
            if response.clicked() {
                open = Some(n.meta.id.clone());
            }
            response.on_hover_text(format!(
                "{} · {}\n{}",
                n.meta.kind, n.meta.status, n.meta.title
            ));
        }
        if let Some(id) = open {
            self.open_note(&id);
        }
    }
    fn canvas(&mut self, ui: &mut Ui, r: Rect, full: bool) {
        let p = ui.painter().clone();
        p.rect_filled(r, 16., self.colors.surface(Color32::from_rgb(18, 20, 32)));
        p.rect_stroke(r, 16., Stroke::new(1.0_f32, self.colors.overlay(17)));
        icon(&p, "layers", r.min + vec2(24., 24.), 18., self.colors.purple);
        txt(
            &p,
            r.left() + 43.,
            r.top() + 15.,
            "Canvas — Experiment plan",
            14.,
            self.colors.text,
        );
        if full
            && pill(
                ui,
                rect(r.right() - 160., r.top() + 9., 148., 30.),
                "Export JSON Canvas",
                false,
            )
            .clicked()
        {
            let res = self
                .vault
                .as_ref()
                .ok_or_else(|| "Vault unavailable".to_string())
                .and_then(|v| v.export_canvas());
            self.outcome(res, "Canvas exported to the vault's Artifacts folder");
        }
        let cp = p.with_clip_rect(r.shrink(1.));
        for ix in (12..r.width() as usize).step_by(20) {
            for iy in (57..r.height() as usize).step_by(20) {
                cp.circle_filled(
                    r.min + vec2(ix as f32, iy as f32),
                    0.6,
                    self.colors.overlay(18),
                );
            }
        }
        let ids = [
            "hypothesis",
            "mastermind",
            "result",
            "decision",
            "challenge",
            "followup",
        ];
        let titles = [
            "Hypothesis",
            "Experiment",
            "Evaluation",
            "Decision",
            "Challenge",
            "Follow-up experiment",
        ];
        let desc = [
            "Memory improves\ntask success.",
            "Mastermind · 200 games\nA/B: memory on / off",
            "Success · Latency\nToken usage",
            "Keep memory\nwith caveats",
            "Does this result\ngeneralize?",
            "Vary tasks, ordering\nand prompt design.",
        ];
        let colors = [self.colors.purple, self.colors.blue, self.colors.green, self.colors.amber, self.colors.purple, self.colors.blue];
        let cw = ((r.width() - 110.) / 4.).min(240.).max(100.);
        let ch = if full { 120. } else { 92. };
        let gap = (r.width() - cw * 4.) / 5.;
        let yy = r.top() + if full { 100. } else { 65. };
        let has_second = full || r.height() > 290.;
        let mut positions = Vec::new();
        for i in 0..6 {
            let row = if i < 4 { 0 } else { 1 };
            let col = if i < 4 { i } else { i - 3 };
            let base = pos2(
                r.left() + gap + (cw + gap) * col as f32,
                yy + row as f32 * (ch + 55.),
            );
            let loc = self
                .canvas_positions
                .get(ids[i])
                .copied()
                .unwrap_or(base - r.min.to_vec2());
            let min = if full { r.min + loc.to_vec2() } else { base };
            positions.push(Rect::from_min_size(min, vec2(cw, ch)));
        }
        for (a, b) in [(0, 1), (1, 2), (2, 3), (2, 4), (4, 5)] {
            if (!has_second && (a >= 4 || b >= 4)) || a >= positions.len() {
                continue;
            }
            let ra = positions[a];
            let rb = positions[b];
            let start = ra.right_center();
            let end = rb.left_center();
            let mid = (start.x + end.x) * 0.5;
            cp.add(Shape::line(
                vec![start, pos2(mid, start.y), pos2(mid, end.y), end],
                Stroke::new(1.4f32, colors[a].gamma_multiply(0.7)),
            ));
            cp.add(Shape::line(
                vec![end + vec2(-6., -4.), end, end + vec2(-6., 4.)],
                Stroke::new(1.4f32, colors[a]),
            ));
        }
        let mut open = None;
        for i in 0..if has_second { 6 } else { 4 } {
            let rr = positions[i];
            let response = ui.interact(
                rr,
                Id::new(("canvas", ids[i], full)),
                Sense::click_and_drag(),
            );
            if full && response.dragged() {
                let delta = response.drag_delta();
                let new = (rr.min + delta)
                    .clamp(r.min + vec2(10., 53.), r.max - vec2(cw + 10., ch + 10.));
                self.canvas_positions
                    .insert(ids[i].into(), new - r.min.to_vec2());
            }
            cp.rect_filled(rr, 10., self.colors.surface(Color32::from_rgb(31, 34, 51)));
            cp.rect_filled(
                rect(rr.left(), rr.top(), rr.width(), 31.),
                10.,
                colors[i].gamma_multiply(0.11),
            );
            cp.rect_stroke(
                rr,
                10.,
                Stroke::new(1_f32,
                    colors[i].gamma_multiply(if response.hovered() { 1. } else { 0.65 }),
                ),
            );
            icon(
                &cp,
                if i == 3 {
                    "history"
                } else if i == 2 {
                    "chart"
                } else {
                    "flask"
                },
                rr.min + vec2(17., 17.),
                16.,
                colors[i],
            );
            txt(
                &cp,
                rr.left() + 32.,
                rr.top() + 9.,
                titles[i],
                if cw < 170. { 11. } else { 13. },
                self.colors.text,
            );
            wrapped(
                &cp,
                rect(rr.left() + 13., rr.top() + 42., cw - 24., ch - 46.),
                desc[i],
                12.,
                self.colors.second,
            );
            if response.clicked() {
                open = Some(ids[i].to_string());
            }
        }
        if full {
            txt(
                &p,
                r.left() + 20.,
                r.bottom() - 31.,
                "Knowledge links · drag to arrange · select a card to inspect",
                12.,
                self.colors.muted,
            );
        }
        if let Some(id) = open {
            self.open_note(&id);
        }
    }
    fn note_list(&mut self, ui: &mut Ui, r: Rect, kind: &str) {
        let p = ui.painter().clone();
        let title = if kind == "folder" {
            self.folder.clone().unwrap_or_default()
        } else if kind == "experiment" {
            "Experiments".into()
        } else {
            "Decisions".into()
        };
        txt(&p, r.left() + 5., r.top() + 7., title, 28., self.colors.text);
        txt(
            &p,
            r.left() + 5.,
            r.top() + 49.,
            if kind == "experiment" {
                "Historical evidence and future questions, kept together."
            } else {
                "Every conclusion has a history."
            },
            13.,
            self.colors.muted,
        );
        if pill(
            ui,
            rect(r.right() - 150., r.top() + 5., 144., 36.),
            "+  New knowledge",
            false,
        )
        .clicked()
        {
            self.new_kind = if kind == "folder" { "note" } else { kind }.into();
            self.dialog = Some(Dialog::New);
        }
        let notes: Vec<_> = self
            .vault
            .as_ref()
            .map(|v| {
                v.notes
                    .iter()
                    .filter(|n| {
                        if kind == "folder" {
                            self.folder
                                .as_ref()
                                .map(|f| n.path.starts_with(f))
                                .unwrap_or(true)
                        } else {
                            n.meta.kind == kind
                        }
                    })
                    .cloned()
                    .collect()
            })
            .unwrap_or_default();
        let mut open = None;
        if kind == "experiment" && pill(ui, rect(r.left()+5., r.top()+73., 200., 30.), "Compare memory strategies", false).clicked() {
            self.dialog = Some(Dialog::Experiment);
        }
        let offset = if kind == "experiment" { 120. } else { 100. };
        let list = rect(r.left(), r.top() + offset, r.width(), r.height() - offset);
        ui.allocate_new_ui(UiBuilder::new().max_rect(list), |ui| {
            ScrollArea::vertical()
                .max_height(list.height())
                .show(ui, |ui| {
                    if notes.is_empty() {
                        ui.add_space(35.);
                        ui.label(
                            RichText::new("This space is ready for your first note.").color(self.colors.second),
                        );
                        ui.label(
                            RichText::new("Capture an idea now; connect it when you're ready.")
                                .size(13.)
                                .color(self.colors.muted),
                        );
                    }
                    for n in notes {
                        let (rr, res) =
                            ui.allocate_exact_size(vec2(list.width() - 12., 100.), Sense::click());
                        ui.painter()
                            .rect_filled(rr, 16., self.colors.surface(Color32::from_rgb(25, 28, 44)));
                        ui.painter().rect_stroke(
                            rr,
                            16.,
                            Stroke::new(1_f32,
                                self.colors.overlay(if res.hovered() { 45 } else { 18 }),
                            ),
                        );
                        icon(
                            ui.painter(),
                            if n.meta.kind == "experiment" {
                                "flask"
                            } else {
                                "file"
                            },
                            rr.min + vec2(30., 32.),
                            20.,
                            self.colors.purple,
                        );
                        txt(
                            ui.painter(),
                            rr.left() + 56.,
                            rr.top() + 19.,
                            &n.meta.title,
                            16.,
                            self.colors.text,
                        );
                        txt(
                            ui.painter(),
                            rr.left() + 56.,
                            rr.top() + 51.,
                            format!("{} · v{} · {}", n.meta.kind, n.meta.version, n.meta.status),
                            12.,
                            color_status(&n.meta.status, self.colors),
                        );
                        txt(
                            ui.painter(),
                            rr.right() - 194.,
                            rr.bottom() - 24.,
                            "View evidence and links",
                            11.,
                            self.colors.muted,
                        );
                        icon(
                            ui.painter(),
                            "chevron",
                            pos2(rr.right() - 25., rr.top() + 31.),
                            18.,
                            self.colors.second,
                        );
                        if res.clicked() {
                            open = Some(n.meta.id.clone());
                        }
                        ui.add_space(10.);
                    }
                });
        });
        if let Some(id) = open {
            self.open_note(&id);
        }
    }
    fn traces(&mut self, ui: &mut Ui, r: Rect) {
        let p = ui.painter().clone();
        txt(&p, r.left() + 5., r.top() + 7., "Traces", 28., self.colors.text);
        txt(
            &p,
            r.left() + 5.,
            r.top() + 50.,
            "Inspect what happened, and where it came from.",
            13.,
            self.colors.muted,
        );
        let empty = rect(r.left(), r.top() + 100., r.width(), 165.);
        p.rect_filled(empty, 16., self.colors.surface(Color32::from_rgb(25, 28, 44)));
        icon(&p, "activity", empty.min + vec2(35., 39.), 24., self.colors.purple);
        txt(
            &p,
            empty.left() + 62.,
            empty.top() + 24.,
            "No agent executions recorded",
            19.,
            self.colors.text,
        );
        wrapped(&p,rect(empty.left()+62.,empty.top()+61.,empty.width()-100.,65.),"This offline workbench has no connected Loom agent. No execution, token, cost or latency metrics have been invented.",14.,self.colors.second);
        txt(
            &p,
            r.left() + 5.,
            r.top() + 296.,
            "Local activity",
            19.,
            self.colors.text,
        );
        self.audit_list(
            ui,
            rect(
                r.left() + 5.,
                r.top() + 340.,
                r.width() - 10.,
                r.height() - 350.,
            ),
        );
    }
    fn audit_list(&self, ui: &mut Ui, r: Rect) {
        ui.allocate_new_ui(UiBuilder::new().max_rect(r), |ui| {
            ScrollArea::vertical()
                .id_salt("audit")
                .max_height(r.height())
                .show(ui, |ui| {
                    if let Some(v) = &self.vault {
                        if v.ledger.audit.is_empty() {
                            ui.label(
                                RichText::new(
                                    "Your edits, links and review decisions will appear here.",
                                )
                                .color(self.colors.muted),
                            );
                        }
                        for a in v.ledger.audit.iter().rev().take(100) {
                            let title = v
                                .get(&a.object)
                                .map(|n| n.meta.title.as_str())
                                .unwrap_or(&a.object);
                            ui.label(
                                RichText::new(format!("{}  ·  {}", a.action, title))
                                    .size(14.)
                                    .color(self.colors.second),
                            );
                            ui.label(
                                RichText::new(format!("{} · {} · {}", a.actor, a.at, a.detail))
                                    .size(12.)
                                    .color(self.colors.muted),
                            );
                            ui.separator();
                        }
                    }
                });
        });
    }
    fn dialogs(&mut self, ctx: &Context) {
        let Some(which) = self.dialog.clone() else {
            return;
        };
        let screen = ctx.screen_rect();
        let layer = ctx.layer_painter(LayerId::new(Order::Foreground, Id::new("modal scrim")));
        layer.rect_filled(screen, 0., Color32::from_black_alpha(102));
        let title = match which {
            Dialog::Search => "Search your workbench",
            Dialog::Activity => "Intelligence activity",
            Dialog::Intent => "Your active intent",
            Dialog::More => "More from your workbench",
            Dialog::Review => "Memory garden",
            Dialog::Note => "Knowledge object",
            Dialog::New => "Capture an idea",
            Dialog::Settings => "Local workspace",
            Dialog::Context => "Context pack",
            Dialog::Journal => "Activity journal",
            Dialog::Experiment => "Compare memory strategies",
            Dialog::Scene => "Scene preview",
        };
        let mut is_open = true;
        let width = if which == Dialog::Note { 760. } else { 620_f32 };
        let width = width.min(screen.width() - 48.);
        let frame = Frame::window(&ctx.style()).inner_margin(24.).rounding(20.);
        Window::new(title).id(Id::new("workbench dialog")).order(Order::Foreground).open(&mut is_open).collapsible(false).resizable(false).default_width(width).max_width(width).max_height(screen.height()-110.).anchor(Align2::CENTER_CENTER,vec2(0.,0.)).frame(frame).show(ctx,|ui|{
   ui.set_min_width(width-48.);ui.add_space(10.);
   match which {
    Dialog::Search=>{
     let field=ui.add_sized(vec2(ui.available_width(),40.),TextEdit::singleline(&mut self.query).hint_text("Search notes, findings, experiments...").font(FontId::proportional(16.)));if self.focus_search{field.request_focus();self.focus_search=false;}
     ui.add_space(10.);ui.horizontal(|ui|{if button(ui,"Home"){self.view=View::Home;self.dialog=None;}if button(ui,"Capture note"){self.dialog=Some(Dialog::New);}if button(ui,"Review memories"){self.dialog=Some(Dialog::Review);}});ui.separator();
     let results:Vec<_>=self.vault.as_ref().map(|v|v.search(&self.query).into_iter().map(|n|(n.meta.id.clone(),n.meta.title.clone(),n.meta.kind.clone(),n.meta.status.clone())).collect()).unwrap_or_default();let first=results.first().map(|n|n.0.clone());let mut open=None;
     ScrollArea::vertical().max_height(420_f32.min(screen.height()-340.)).show(ui,|ui|{if results.is_empty(){ui.label(RichText::new("No matching knowledge. Try another word or capture a new note.").color(self.colors.second));}for(id,title,kind,status)in results{let(rr,response)=ui.allocate_exact_size(vec2(ui.available_width(),63.),Sense::click());if response.hovered(){ui.painter().rect_filled(rr,12.,self.colors.overlay(8));}icon(ui.painter(),"file",rr.min+vec2(21.,26.),18.,self.colors.purple);txt(ui.painter(),rr.left()+43.,rr.top()+9.,title,14.,self.colors.text);txt(ui.painter(),rr.left()+43.,rr.top()+33.,format!("{kind} · {status}"),12.,self.colors.muted);if response.clicked(){open=Some(id);}}});
     ui.add_space(7.);ui.label(RichText::new("Ctrl+K  search       Ctrl+N  capture       Esc  close").size(12.).color(self.colors.muted));if field.has_focus()&&ui.input(|i|i.key_pressed(Key::Enter)){open=first;}if let Some(id)=open{self.open_note(&id);}
    },
    Dialog::Activity=>{
     let state=self.current_state();ui.horizontal(|ui|{let(rr,_)=ui.allocate_exact_size(vec2(66.,66.),Sense::hover());self.orb_image(ui.painter(),rr.center(),46.,true);ui.vertical(|ui|{ui.label(RichText::new(state.label()).size(25.));ui.label(RichText::new("Local knowledge environment").color(self.colors.second));});});ui.add_space(18.);
     ui.label(RichText::new("No remote agent is connected. The sphere reflects local changes and knowledge awaiting your review.").color(self.colors.second));ui.add_space(15.);
     let pending=self.vault.as_ref().map(|v|v.pending()).unwrap_or(0);ui.label(format!("{pending} proposals awaiting human review"));ui.label(RichText::new("Permissions: read local knowledge, edit drafts, propose links. No shell, network, Git or model execution.").color(self.colors.muted));ui.add_space(20.);if button(ui,"Review proposals"){self.dialog=Some(Dialog::Review);}if button(ui,"Inspect local activity"){self.view=View::Traces;self.dialog=None;}
    },
    Dialog::Intent=>{
     ui.label(RichText::new("What are you trying to understand?").size(19.));ui.add_space(7.);ui.add_sized(vec2(ui.available_width(),60.),TextEdit::multiline(&mut self.intent_draft).font(FontId::proportional(18.)));
     ui.add_space(12.);ui.horizontal(|ui|{if button(ui,"Save intent"){let res=self.vault.as_mut().ok_or_else(|| "Vault unavailable".to_string()).and_then(|v|v.set_intent(&self.intent_draft));if res.is_ok(){self.dialog=None;}self.outcome(res,"Active intent saved");}if button(ui,"Linked knowledge"){self.dialog=None;self.view=View::Knowledge;self.focus_graph=Some("intent".into());}});
     ui.add_space(18.);ui.label(RichText::new("Switch to a stored intent").color(self.colors.muted));let intents:Vec<_>=self.vault.as_ref().map(|v|v.notes.iter().filter(|n|n.meta.kind=="intent"||n.meta.kind=="project").map(|n|n.meta.title.clone()).collect()).unwrap_or_default();for title in intents{if ui.add(Button::new(&title).frame(false)).clicked(){self.intent_draft=title;}}
     if button(ui,"Create another intent"){self.new_kind="intent".into();self.dialog=Some(Dialog::New);}
    },
    Dialog::More=>{
     ui.label(RichText::new("Make room for a different way of thinking.").color(self.colors.second));ui.add_space(15.);
     ScrollArea::vertical().max_height((screen.height()-260.).max(150.)).show(ui,|ui|{
     for (title,subtitle,target) in [("Scene preview","Explore Unity-inspired scene controls and save a local preset.",Dialog::Scene),("Memory garden","Review proposed knowledge and preserve its history.",Dialog::Review),("Context pack","Inspect the knowledge a future agent would receive.",Dialog::Context),("Activity journal","Review meaningful changes recorded in this vault.",Dialog::Journal),("Workspace settings","Motion, local files and connection status.",Dialog::Settings)]{
      let(rr,response)=ui.allocate_exact_size(vec2(ui.available_width(),76.),Sense::click());if response.hovered(){ui.painter().rect_filled(rr,12.,self.colors.overlay(8));}txt(ui.painter(),rr.left()+12.,rr.top()+12.,title,16.,self.colors.text);wrapped(ui.painter(),rect(rr.left()+12.,rr.top()+39.,rr.width()-48.,34.),subtitle,12.,self.colors.muted);icon(ui.painter(),"chevron",pos2(rr.right()-16.,rr.center().y),16.,self.colors.second);if response.clicked(){if target==Dialog::Scene {self.open_scene();} else {self.dialog=Some(target);}}
     }
     });
    },
    Dialog::Review=>{
     ui.label(RichText::new("Proposed knowledge stays a proposal until you decide.").color(self.colors.second));ui.label(RichText::new("Approval records your review of the wording and evidence. It does not turn a historical fixture into a verified study.").size(12.).color(self.colors.muted));ui.add_space(15.);
     let notes:Vec<_>=self.vault.as_ref().map(|v|v.notes.iter().filter(|n|n.meta.status=="proposed").cloned().collect()).unwrap_or_default();let mut open=None;
     ScrollArea::vertical().max_height(400_f32.min(screen.height()-300.)).show(ui,|ui|{if notes.is_empty(){ui.label(RichText::new("You're all caught up.").size(19.));ui.label(RichText::new("New agent proposals will arrive here for your review.").color(self.colors.muted));}for n in notes{Frame::none().fill(self.colors.overlay(5)).rounding(16.).inner_margin(16.).show(ui,|ui|{ui.horizontal(|ui|{ui.label(RichText::new(&n.meta.kind).size(12.).color(self.colors.amber));ui.label(RichText::new("Needs your review").size(12.).color(self.colors.muted));});ui.label(RichText::new(&n.meta.title).size(19.));ui.label(RichText::new(n.body.chars().take(160).collect::<String>()).color(self.colors.second));if button(ui,"Inspect evidence & review"){open=Some(n.meta.id.clone());}});ui.add_space(12.);}});if let Some(id)=open{self.open_note(&id);}
     ui.add_space(14.);if button(ui,"Review history"){self.dialog=Some(Dialog::Journal);}
    },
    Dialog::Scene=>{
     let reduced=self.vault.as_ref().map(|v|v.settings.reduced_motion).unwrap_or(true);
     if self.scene.show(ui,self.orb.id(),self.colors,reduced){
      let result=self.vault.as_ref().ok_or_else(|| "Vault unavailable".to_string()).and_then(|v|self.scene.preset.save(&v.root));
      self.outcome(result,"Scene preset saved");
     }
    },
    Dialog::Experiment=>self.experiment_dialog(ui),
    Dialog::Note=>self.note_dialog(ui,screen.height()),
    Dialog::New=>{
     ui.label(RichText::new("Capture first. Connect when you're ready.").color(self.colors.second));ui.add_space(10.);ui.label("Title");ui.add_sized(vec2(ui.available_width(),36.),TextEdit::singleline(&mut self.new_title).hint_text("One idea, in your own words"));ui.horizontal(|ui|{ui.label("Kind");ComboBox::from_id_salt("new kind").selected_text(&self.new_kind).show_ui(ui,|ui|{for kind in KINDS {ui.selectable_value(&mut self.new_kind,kind.to_string(),*kind);}});});ui.add_space(8.);ui.add_sized(vec2(ui.available_width(),180.),TextEdit::multiline(&mut self.new_body).hint_text("What did you notice? What do you want to understand?"));ui.add_space(10.);
     if button(ui,"Create note"){let result=self.vault.as_mut().ok_or_else(|| "Vault unavailable".to_string()).and_then(|v|v.create(&self.new_title,&self.new_body,&self.new_kind,Actor::Human));match result {Ok(id)=>{self.new_title.clear();self.new_body.clear();self.open_note(&id);self.notify("Note saved to your vault",false);},Err(e)=>self.notify(e,true)}}
    },
    Dialog::Settings=>{
     ui.label(RichText::new("Appearance").size(16.));
     let (appearance_rect, _) = ui.allocate_exact_size(vec2(134., 34.), Sense::hover());
     self.appearance_switch(ui, appearance_rect);
     ui.add_space(12.);
     ui.label(RichText::new("Your knowledge stays on this computer.").size(19.));ui.add_space(10.);if let Some(v)=&self.vault {ui.label(RichText::new(v.root.display().to_string()).color(self.colors.second));ui.add_space(10.);let mut motion=v.settings.reduced_motion;if ui.checkbox(&mut motion,"Reduce motion — use static illumination").changed(){let res=self.vault.as_mut().unwrap().set_motion(motion);self.outcome(res,"Motion preference saved");}}
     ui.add_space(12.);
     let mut manual = self.vault.as_ref().map(|v| v.settings.manual_chat).unwrap_or(false);
     if ui.checkbox(&mut manual, "Keep chat as drafts (Manual)").changed() {
      let result = self.vault.as_mut().ok_or_else(|| "Vault unavailable".to_string()).and_then(|v| v.set_manual_chat(manual));
      self.outcome(result, "Chat preference saved");
     }
     ui.label(RichText::new("Manual keeps your draft when you press Send. Turn it off for local offline replies.").size(12.).color(self.colors.muted));
     ui.add_space(16.);ui.label(RichText::new("Connections").size(16.));ui.label(RichText::new("Loom: not connected\nNetwork activity: none").color(self.colors.second));ui.add_space(12.);ui.label(RichText::new("This first slice uses an offline knowledge retriever and labeled reasoning prompts. It never executes Markdown or canvas content.").color(self.colors.muted));ui.add_space(14.);
     if button(ui,"Refresh files from disk"){let res=self.vault.as_mut().ok_or_else(|| "Vault unavailable".to_string()).and_then(|v|v.reload());self.outcome(res,"Vault reloaded; external edits are now indexed");}
     if button(ui,"View shortcuts"){self.notify("Ctrl+K: search · Ctrl+N: capture · Ctrl+H: home · Esc: close",false);}
    },
    Dialog::Context=>{
     ui.label(RichText::new("Prepared context · no agent receives it yet").size(19.));ui.label(RichText::new("Select knowledge deliberately. Estimates use approximately four characters per token.").color(self.colors.muted));ui.add_space(12.);
     let ids=["intent","hypothesis","result","decision","challenge"];let mut tokens=0;for id in ids {if let Some(n)=self.vault.as_ref().and_then(|v|v.get(id)){tokens+=(n.body.chars().count()+3)/4;ui.label(format!("• {}",n.meta.title));ui.label(RichText::new(format!("{} · {}",n.meta.status,n.path)).size(11.).color(self.colors.muted));}}
     ui.add_space(16.);ui.label(RichText::new(format!("Approximately {tokens} tokens · local estimate")).color(self.colors.purple));ui.label(RichText::new("Excluded: attachments, credentials, raw traces and unrelated projects. Manual inclusion and transmission will be added with the runtime adapter.").color(self.colors.second));
    },
    Dialog::Journal=>{ui.label(RichText::new("A record of meaningful local changes.").color(self.colors.second));ui.add_space(15.);self.audit_list(ui,Rect::from_min_size(ui.cursor().min,vec2(ui.available_width(),380_f32.min(screen.height()-270.))));ui.add_space(380_f32.min(screen.height()-270.));}
   }
  });
        if !is_open {
            self.dialog = None;
        }
    }
    fn open_scene(&mut self) {
        let result = self.vault.as_ref().ok_or_else(|| "Vault unavailable".to_string())
            .and_then(|v| scene::Preset::load(&v.root));
        match result {
            Ok(preset) => self.scene = scene::ScenePreview { preset, ..Default::default() },
            Err(error) => self.notify(format!("Could not load scene preset: {error}"), true),
        }
        self.dialog = Some(Dialog::Scene);
    }
    fn record_experiment_choice(&mut self, choice: usize) -> Result<String, String> {
        let id = mechanics::record_choice(self.vault.as_mut().ok_or("Vault unavailable")?,
            &mut self.experiment_stage, choice)?;
        let (name, _) = mechanics::CONFIGURATIONS[choice];
        self.experiment_notice = format!("Recorded: you chose {name} for the next experiment.");
        self.notify("Experiment decision saved", false);
        Ok(id)
    }
    /// attention_panel closure, ELF 0x7e4410: dismiss without resolving the choice.
    fn defer_experiment_choice(&mut self) {
        self.dialog = None;
        self.experiment_notice = "Left for later. The experiment waits; nothing runs on its own.".into();
    }
    fn experiment_dialog(&mut self, ui: &mut Ui) {
        use mechanics::ExperimentStage;
        ui.label(RichText::new("Compare the two configurations").size(19.));
        ui.add_space(10.);
        for (name, description) in mechanics::CONFIGURATIONS {
            ui.label(RichText::new(name).color(self.colors.purple));
            ui.label(RichText::new(description).color(self.colors.second));
            ui.add_space(12.);
        }
        match self.experiment_stage {
            ExperimentStage::Baseline => {
                if button(ui, "Record baseline (demonstration)") {
                    self.experiment_stage = ExperimentStage::Comparison;
                    self.experiment_notice = "Baseline recorded in this demonstration. No server experiment ran.".into();
                }
            }
            ExperimentStage::Comparison => {
                if button(ui, "Prepare comparison") {
                    self.experiment_stage = ExperimentStage::Choose;
                    self.experiment_notice = "Two configurations ready. This is the decision waiting in Attention.".into();
                }
            }
            ExperimentStage::Choose => {
                ui.label(RichText::new("Nothing runs until you choose.").color(self.colors.amber));
                for (choice, label) in ["Choose A — write every turn", "Choose B — write when asked"].iter().enumerate() {
                    if button(ui, label) {
                        if let Err(e) = self.record_experiment_choice(choice) { self.notify(e, true); }
                    }
                }
                if button(ui, "Decide later") {
                    self.defer_experiment_choice();
                }
            }
            ExperimentStage::Recorded => {
                if button(ui, "Start again") {
                    self.experiment_stage = ExperimentStage::Baseline;
                    self.experiment_notice.clear();
                }
                if button(ui, "View recorded decisions") {
                    self.view = View::Decisions;
                    self.dialog = None;
                }
            }
        }
        ui.add_space(12.);
        ui.label(RichText::new(&self.experiment_notice).color(self.colors.second));
        ui.label(RichText::new("This demonstration records a choice for a future experiment. No agent or measurement runs here.").size(12.).color(self.colors.muted));
    }
    fn note_dialog(&mut self, ui: &mut Ui, height: f32) {
        let Some(note) = self.draft.clone() else {
            ui.label("This knowledge object is unavailable.");
            return;
        };
        let mut open_other = None;
        let mut save = false;
        let mut approve = None;
        let mut to_unlink = None;
        let mut link = false;
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(note.meta.kind.to_uppercase())
                    .size(11.)
                    .color(self.colors.purple),
            );
            ui.label(
                RichText::new(format!("{} · v{}", note.meta.status, note.meta.version))
                    .size(12.)
                    .color(color_status(&note.meta.status, self.colors)),
            );
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                if button(ui, if self.editing { "Preview" } else { "Edit note" }) {
                    self.editing = !self.editing;
                }
                if button(ui, "Show in graph") {
                    self.view = View::Knowledge;
                    self.focus_graph = Some(note.meta.id.clone());
                    self.folder = None;
                    self.dialog = None;
                }
            });
        });
        ui.add_space(12.);
        if self.editing {
            if let Some(d) = &mut self.draft {
                ui.add_sized(
                    vec2(ui.available_width(), 44.),
                    TextEdit::singleline(&mut d.meta.title).font(FontId::proportional(24.)),
                );
            }
        } else {
            ui.label(RichText::new(&note.meta.title).size(25.).color(self.colors.text));
        }
        ui.add_space(12.);
        let available = (height - 420.).clamp(190., 470.);
        ScrollArea::vertical()
            .id_salt("note content")
            .max_height(available)
            .show(ui, |ui| {
                if self.editing {
                    if let Some(d) = &mut self.draft {
                        ui.add_sized(
                            vec2(ui.available_width(), available - 20.),
                            TextEdit::multiline(&mut d.body)
                                .font(FontId::proportional(14.))
                                .desired_rows(14),
                        );
                    }
                } else {
                    for line in note.body.lines() {
                        if let Some(h) = line.strip_prefix("## ") {
                            ui.add_space(9.);
                            ui.label(RichText::new(h).size(19.).color(self.colors.text));
                            ui.add_space(3.);
                        } else if line.is_empty() {
                            ui.add_space(7.);
                        } else {
                            ui.label(RichText::new(line).size(14.).color(self.colors.second));
                        }
                    }
                }
                ui.add_space(17.);
                ui.separator();
                ui.add_space(5.);
                CollapsingHeader::new("Source & provenance")
                    .default_open(true)
                    .show(ui, |ui| {
                        ui.label(RichText::new(&note.meta.source).size(12.).color(self.colors.second));
                        ui.label(
                            RichText::new(format!(
                                "Author: {}\nStable ID: {}\nCreated: {} · Modified: {}\n{}",
                                note.meta.author,
                                note.meta.id,
                                note.meta.created,
                                note.meta.modified,
                                note.path
                            ))
                            .size(11.)
                            .color(self.colors.muted),
                        );
                    });
                ui.add_space(10.);
                ui.label(RichText::new("Connections & backlinks").size(16.));
                let edges = self
                    .vault
                    .as_ref()
                    .map(|v| {
                        v.ledger
                            .edges
                            .iter()
                            .filter(|e| e.from == note.meta.id || e.to == note.meta.id)
                            .cloned()
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default();
                if edges.is_empty() {
                    ui.label(
                        RichText::new("No connections yet. Link this idea to its evidence.")
                            .color(self.colors.muted),
                    );
                }
                for edge in edges {
                    let incoming = edge.to == note.meta.id;
                    let other = if incoming { &edge.from } else { &edge.to };
                    let title = self
                        .vault
                        .as_ref()
                        .and_then(|v| v.get(other))
                        .map(|n| n.meta.title.clone())
                        .unwrap_or(format!("Unresolved reference: {other}"));
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new(if incoming {
                                format!("← {}", edge.kind)
                            } else {
                                format!("{} →", edge.kind)
                            })
                            .size(12.)
                            .color(self.colors.muted),
                        );
                        if ui
                            .add(Button::new(RichText::new(title).color(self.colors.second)).frame(false))
                            .clicked()
                        {
                            open_other = Some(other.clone());
                        }
                        if ui
                            .small_button("×")
                            .on_hover_text("Remove relationship, preserving both notes")
                            .clicked()
                        {
                            to_unlink = Some(edge.clone());
                        }
                    });
                }
                ui.add_space(10.);
                ui.horizontal_wrapped(|ui| {
                    ComboBox::from_id_salt("relationship type")
                        .width(110.)
                        .selected_text(&self.relation_kind)
                        .show_ui(ui, |ui| {
                            for kind in RELATIONS {
                                ui.selectable_value(
                                    &mut self.relation_kind,
                                    kind.to_string(),
                                    *kind,
                                );
                            }
                        });
                    let titles = self
                        .vault
                        .as_ref()
                        .map(|v| {
                            v.notes
                                .iter()
                                .filter(|n| n.meta.id != note.meta.id)
                                .map(|n| (n.meta.id.clone(), n.meta.title.clone()))
                                .collect::<Vec<_>>()
                        })
                        .unwrap_or_default();
                    let selected = titles
                        .iter()
                        .find(|(id, _)| id == &self.relation_target)
                        .map(|(_, t)| t.as_str())
                        .unwrap_or("Choose knowledge");
                    ComboBox::from_id_salt("relationship target")
                        .width(250.)
                        .selected_text(selected)
                        .show_ui(ui, |ui| {
                            for (id, title) in titles {
                                ui.selectable_value(&mut self.relation_target, id, title);
                            }
                        });
                    if ui.button("Add link").clicked() {
                        link = true;
                    }
                });
                ui.add_space(12.);
                CollapsingHeader::new("Version history & review trail").show(ui, |ui| {
                    let dir = self
                        .vault
                        .as_ref()
                        .map(|v| v.root.join(format!(".loom/history/{}", note.meta.id)));
                    let mut versions = dir
                        .and_then(|d| std::fs::read_dir(d).ok())
                        .map(|es| es.flatten().map(|e| e.path()).collect::<Vec<_>>())
                        .unwrap_or_default();
                    versions.sort();
                    if versions.is_empty() {
                        ui.label(
                            RichText::new("First version. Future changes preserve this text.")
                                .size(12.)
                                .color(self.colors.muted),
                        );
                    }
                    for path in versions {
                        let name = path
                            .file_stem()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .into_owned();
                        CollapsingHeader::new(name).show(ui, |ui| {
                            if let Ok(raw) = std::fs::read_to_string(&path) {
                                let body =
                                    raw.split_once("\n---\n").map(|(_, b)| b).unwrap_or(&raw);
                                ui.label(RichText::new(body).size(12.).color(self.colors.second));
                            }
                        });
                    }
                    if let Some(v) = &self.vault {
                        for a in v.ledger.audit.iter().filter(|a| a.object == note.meta.id) {
                            ui.label(
                                RichText::new(format!("{} · {} · {}", a.action, a.actor, a.detail))
                                    .size(12.)
                                    .color(self.colors.muted),
                            );
                        }
                    }
                });
            });
        ui.add_space(16.);
        ui.separator();
        if self.editing {
            ui.horizontal(|ui| {
                if button(ui, "Save changes") {
                    save = true;
                }
                if button(ui, "Discard draft") {
                    self.draft = self
                        .vault
                        .as_ref()
                        .and_then(|v| v.get(&note.meta.id))
                        .cloned();
                    self.editing = false;
                }
            });
        } else if note.meta.status == "proposed" {
            ui.label(
                RichText::new("Review the wording and linked evidence before accepting.")
                    .size(12.)
                    .color(self.colors.amber),
            );
            ui.add_sized(
                vec2(ui.available_width(), 33.),
                TextEdit::singleline(&mut self.review_reason).hint_text("Review note (optional)"),
            );
            ui.horizontal(|ui| {
                if button(ui, "Approve memory") {
                    approve = Some(true);
                }
                if button(ui, "Reject proposal") {
                    approve = Some(false);
                }
                ui.label(
                    RichText::new("Human decision · preserved in history")
                        .size(11.)
                        .color(self.colors.muted),
                );
            });
        } else {
            ui.label(
                RichText::new(
                    "Saved locally · Source, history and relationships travel with this idea.",
                )
                .size(12.)
                .color(self.colors.muted),
            );
        }
        if let Some(edge) = to_unlink {
            let res = self.vault.as_mut().unwrap().unlink(&edge);
            self.outcome(res, "Relationship removed; both notes preserved");
        }
        if link {
            let res = self.vault.as_mut().unwrap().relate(
                &note.meta.id,
                &self.relation_target,
                &self.relation_kind,
            );
            self.outcome(res, "Relationship saved; backlink updated");
        }
        if save {
            let res = self
                .vault
                .as_mut()
                .unwrap()
                .save_note(self.draft.as_ref().unwrap(), Actor::Human);
            if res.is_ok() {
                self.draft = self
                    .vault
                    .as_ref()
                    .and_then(|v| v.get(&note.meta.id))
                    .cloned();
                self.editing = false;
            }
            self.outcome(res, "Changes saved; previous version preserved");
        }
        if let Some(yes) = approve {
            let res = self.vault.as_mut().unwrap().review(
                &note.meta.id,
                yes,
                Actor::Human,
                &self.review_reason,
            );
            if res.is_ok() {
                self.draft = self
                    .vault
                    .as_ref()
                    .and_then(|v| v.get(&note.meta.id))
                    .cloned();
            }
            self.outcome(
                res,
                if yes {
                    "Knowledge approved by you"
                } else {
                    "Proposal rejected; history preserved"
                },
            );
        }
        if let Some(id) = open_other {
            self.open_note(&id);
        }
    }
    fn self_test_tick(&mut self, ctx: &Context) {
        if self.self_test.is_none() || self.test_done {
            return;
        }
        match self.frames {
            12 => {
                self.view = View::Knowledge;
                let passed = self
                    .vault
                    .as_ref()
                    .map(|v| v.get("mastermind").is_some())
                    .unwrap_or(false);
                self.test_steps.push(serde_json::json!({"step":"move","passed":passed,"detail":"Navigated from home to the knowledge workspace, with the historical experiment available"}));
            }
            20 => {
                self.open_note("mastermind");
                let passed = self
                    .draft
                    .as_ref()
                    .map(|n| n.body.contains("59 successful"))
                    .unwrap_or(false);
                self.test_steps.push(serde_json::json!({"step":"open evidence","passed":passed,"detail":"Experiment opens with 59/100 versus 40/100 and explicit historical-fixture provenance"}));
            }
            30 => {
                let result = (|| -> Result<(), String> {
                    let v = self.vault.as_mut().ok_or("Vault failed")?;
                    let id =
                        v.create("Interaction test note", "first draft", "note", Actor::Human)?;
                    let mut n = v.get(&id).unwrap().clone();
                    n.body = "Persisted interaction test finding".into();
                    v.save_note(&n, Actor::Human)?;
                    v.relate(&id, "result", "references")?;
                    if !v.backlinks("result").iter().any(|e| e.from == id) {
                        return Err("Backlink missing".into());
                    }
                    let reopened = Vault::open(v.root.clone())?;
                    if reopened.get(&id).map(|n| n.body.as_str())
                        != Some("Persisted interaction test finding")
                    {
                        return Err("Persistence failed".into());
                    }
                    if reopened.search("interaction test finding").is_empty() {
                        return Err("Search failed".into());
                    }
                    let edge = Edge {
                        from: id,
                        to: "result".into(),
                        kind: "references".into(),
                    };
                    v.unlink(&edge)?;
                    v.review(
                        "memory",
                        true,
                        Actor::Human,
                        "Test reviewed fixture limitations",
                    )?;
                    v.review(
                        "challenge",
                        false,
                        Actor::Human,
                        "Test rejection preserves history",
                    )?;
                    if v.review("memory", true, Actor::Agent, "forbidden").is_ok() {
                        return Err("Permission boundary failed".into());
                    }
                    Ok(())
                })();
                self.test_steps.push(serde_json::json!({"step":"act","passed":result.is_ok(),"detail":result.err().unwrap_or("Created and edited a persisted note, linked evidence, verified backlinks and search, removed a link, approved and rejected proposals, and denied agent self-approval".into())}));
            }
            50 => {
                self.dialog = None;
                self.view = View::Home;
                let manual_result = (|| -> Result<(), String> {
                    self.vault.as_mut().ok_or("Vault failed")?.set_manual_chat(true)?;
                    let root = self.vault.as_ref().unwrap().root.clone();
                    if !Vault::open(root)?.settings.manual_chat {
                        return Err("Manual chat setting did not persist".into());
                    }
                    let messages = self.messages.len();
                    let notes = self.vault.as_ref().unwrap().notes.len();
                    let deadlines = (self.processing_until, self.completed_until);
                    self.input = "  Challenge our conclusion  ".into();
                    self.send_message();
                    if self.input != "  Challenge our conclusion  " || messages != self.messages.len()
                        || notes != self.vault.as_ref().unwrap().notes.len()
                        || deadlines != (self.processing_until, self.completed_until)
                        || self.toast.as_ref().map(|t| t.0.as_str()) != Some(mechanics::MANUAL_NOTICE) {
                        return Err("Manual send changed draft, conversation, notes or timers".into());
                    }
                    self.toast = None;
                    self.input = " \n\t".into();
                    self.send_message();
                    if self.toast.is_some() || self.input != " \n\t" {
                        return Err("Whitespace did not return before the Manual guard".into());
                    }
                    self.vault.as_mut().unwrap().set_manual_chat(false)?;
                    Ok(())
                })();
                self.test_steps.push(serde_json::json!({"step":"manual-chat","passed":manual_result.is_ok(),"detail":manual_result.err().unwrap_or("Verified persisted Manual mode preserves draft, messages, notes and deadlines; whitespace is a no-op before the guard".into())}));
                self.input = "Challenge our conclusion".into();
                self.send_message();
                let elapsed = self.started.elapsed().as_secs_f64();
                let timing = self.processing_until > elapsed
                    && self.processing_until <= elapsed + mechanics::PROCESSING_SECONDS
                    && self.completed_until > self.processing_until
                    && self.completed_until <= elapsed + mechanics::COMPLETION_SECONDS;
                let deadlines = (self.processing_until, self.completed_until);
                self.input = " \n\t".into();
                self.send_message();
                let empty_unchanged = deadlines == (self.processing_until, self.completed_until);
                self.input.clear();
                self.test_steps.push(serde_json::json!({"step":"conversation","passed":timing&&empty_unchanged&&self.messages.len()==4&&self.vault.as_ref().map(|v|v.pending()==1).unwrap_or(false),"detail":"Created a linked offline proposal; verified native 1.5/2.5-second feedback deadlines and whitespace-only no-op"}));
            }
            65 => {
                let result = (|| -> Result<(), String> {
                    use mechanics::ExperimentStage;
                    if self.record_experiment_choice(0).is_ok() {
                        return Err("Choice accepted before comparison was prepared".into());
                    }
                    for choice in 0..2 {
                        self.experiment_stage = ExperimentStage::Choose;
                        self.dialog = Some(Dialog::Experiment);
                        let count = self.vault.as_ref().ok_or("Vault failed")?.notes.len();
                        self.defer_experiment_choice();
                        if self.dialog.is_some() || self.experiment_stage != ExperimentStage::Choose
                            || self.vault.as_ref().ok_or("Vault failed")?.notes.len() != count
                        {
                            return Err("Deferral changed the choice or wrote a decision".into());
                        }
                        if self.current_state() != State::AwaitingApproval {
                            return Err("Pending decision failed to take priority over completion".into());
                        }
                        let id = self.record_experiment_choice(choice)?;
                        let v = self.vault.as_ref().ok_or("Vault failed")?;
                        let reopened = Vault::open(v.root.clone())?;
                        let note = reopened.get(&id).ok_or("Decision missing after reopening")?;
                        if self.experiment_stage != ExperimentStage::Recorded
                            || note.meta.kind != "decision"
                            || !note.body.contains(mechanics::CONFIGURATIONS[choice].0)
                            || !note.body.contains("No server experiment ran")
                            || !note.path.starts_with("50 Projects/Agent Memory/Decisions/")
                        {
                            return Err("Choice or demonstration provenance was not preserved".into());
                        }
                        if self.record_experiment_choice(choice).is_ok() {
                            return Err("Repeated choice accepted after recording".into());
                        }
                    }
                    let v = self.vault.as_mut().ok_or("Vault failed")?;
                    v.set_motion(true)?;
                    if !Vault::open(v.root.clone())?.settings.reduced_motion {
                        return Err("Reduced motion did not persist".into());
                    }
                    v.set_motion(false)?;
                    Ok(())
                })();
                self.test_steps.push(serde_json::json!({"step":"native mechanics","passed":result.is_ok(),"detail":result.err().unwrap_or("Verified attention priority, both saved strategy choices, phase guards, reduced-motion persistence and explicit no-execution provenance".into())}));
            }
            75 | 80 | 85 => {
                let light = self.frames != 80;
                self.set_appearance(ctx, light);
                let persisted = self.vault.as_ref()
                    .and_then(|v| Vault::open(v.root.clone()).ok())
                    .map(|v| v.settings.light_mode == light).unwrap_or(false);
                let passed = self.colors.light == light
                    && ctx.style().visuals.dark_mode != light && persisted;
                self.test_steps.push(serde_json::json!({
                    "step": format!("{} appearance at frame {}", if light { "White" } else { "Dark" }, self.frames),
                    "passed": passed,
                    "detail": "Switched the live workspace palette and native widgets, then reopened the vault to verify the saved appearance"
                }));
            }
            88 => {
                let result = (|| -> Result<(), String> {
                    let home_view = self.view.clone();
                    self.open_scene();
                    self.scene.preset.x = 0.4;
                    self.scene.preset.scale = 1.2;
                    let expected = self.scene.preset.clone();
                    let root = self.vault.as_ref().ok_or("Vault unavailable")?.root.clone();
                    self.scene.preset.save(&root)?;
                    self.scene = Default::default();
                    self.open_scene();
                    if self.scene.preset != expected || self.scene.playing || self.view != home_view {
                        return Err("Scene preset did not reopen independently of home".into());
                    }
                    self.dialog = None;
                    Ok(())
                })();
                self.test_steps.push(serde_json::json!({"step":"scene preview","passed":result.is_ok(),
                    "detail":result.err().unwrap_or("Opened scene inspector, edited and saved a transform, reopened preset with playback paused and home unchanged".into())}));
            }
            90 => {
                // Finish visual verification in the primary reference appearance.
                self.set_appearance(ctx, false);
                let s = self.current_state();
                self.test_steps.push(serde_json::json!({"step":"hud","passed":self.view==View::Home&&self.chat_open&&self.vault.is_some(),"detail":format!("Home renders active intent, sphere, conversation, six navigation controls and local state {}",s.label())}));
                self.test_done = true;
            }
            _ => {}
        }
    }
}
impl eframe::App for Workbench {
    fn update(&mut self, ctx: &Context, _frame: &mut eframe::Frame) {
        self.frames += 1;
        self.self_test_tick(ctx);
        if ctx.input(|i| i.modifiers.command && i.key_pressed(Key::K)) {
            self.open_search();
        }
        if ctx.input(|i| i.modifiers.command && i.key_pressed(Key::N)) {
            self.dialog = Some(Dialog::New);
        }
        if ctx.input(|i| i.modifiers.command && i.key_pressed(Key::H)) {
            self.dialog = None;
            self.view = View::Home;
        }
        if ctx.input(|i| i.key_pressed(Key::Escape)) {
            if self.editing {
                self.editing = false;
                self.draft = self
                    .vault
                    .as_ref()
                    .and_then(|v| v.get(&self.selected))
                    .cloned();
            } else {
                self.dialog = None;
            }
        }
        CentralPanel::default()
            .frame(Frame::none())
            .show(ctx, |ui| {
                let r = ui.max_rect();
                if self.dialog.is_some() { ui.disable(); }
                if self.view == View::Home {
                    self.home(ui, r);
                } else {
                    self.workspace(ui, r);
                }
                if !self.startup_error.is_empty() {
                    glass(ui.painter(), rect(48., 230., 620., 150.), 20.);
                    txt(
                        ui.painter(),
                        70.,
                        250.,
                        "Your vault needs attention",
                        19.,
                        self.colors.red,
                    );
                    wrapped(
                        ui.painter(),
                        rect(70., 289., 570., 80.),
                        &self.startup_error,
                        14.,
                        self.colors.second,
                    );
                }
            });
        self.dialogs(ctx);
        if let Some((message, at, error)) = &self.toast {
            if at.elapsed().as_secs() < 7 {
                Area::new(Id::new("feedback"))
                    .order(Order::Tooltip)
                    .anchor(Align2::CENTER_BOTTOM, vec2(0., if self.view == View::Home { -128. } else { -18. }))
                    .show(ctx, |ui| {
                        Frame::none()
                            .fill(self.colors.surface(Color32::from_rgb(27, 31, 49)))
                            .rounding(12.)
                            .stroke(Stroke::new(1_f32,
                                if *error {
                                    self.colors.red.gamma_multiply(0.5)
                                } else {
                                    self.colors.purple.gamma_multiply(0.4)
                                },
                            ))
                            .inner_margin(Margin::symmetric(18., 11.))
                            .show(ui, |ui| {
                                ui.set_max_width(ctx.screen_rect().width() - 80.);
                                ui.label(RichText::new(message).size(13.).color(if *error {
                                    self.colors.red
                                } else {
                                    self.colors.second
                                }));
                            });
                    });
            }
        }
        if let Some(path) = self.screenshot.clone() {
            if self.frames >= 120 && !self.screenshot_sent {
                ctx.send_viewport_cmd(ViewportCommand::Screenshot);
                self.screenshot_sent = true;
            }
            let events = ctx.input(|i| i.events.clone());
            for event in events {
                if let Event::Screenshot { image, .. } = event {
                    let bytes: Vec<u8> = image.pixels.iter().flat_map(|p| p.to_array()).collect();
                    if let Some(parent) = path.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    let result = image::save_buffer(
                        &path,
                        &bytes,
                        image.size[0] as u32,
                        image.size[1] as u32,
                        image::ColorType::Rgba8,
                    );
                    if let Err(e) = result {
                        eprintln!("Screenshot failed: {e}");
                    }
                    ctx.send_viewport_cmd(ViewportCommand::Close);
                }
            }
        }
        if self.test_done {
            if let Some(path) = self.self_test.take() {
                let passed = self.test_steps.iter().all(|v| v["passed"] == true);
                let json = serde_json::json!({"version":1,"passed":passed,"steps":self.test_steps});
                if let Some(p) = path.parent() {
                    let _ = std::fs::create_dir_all(p);
                }
                let _ = std::fs::write(path, serde_json::to_string_pretty(&json).unwrap());
                if self.screenshot.is_none() {
                    ctx.send_viewport_cmd(ViewportCommand::Close);
                }
            }
        }
        if self.screenshot.is_some() || self.self_test.is_some() {
            ctx.request_repaint_after(Duration::from_millis(10));
        } else if !self.vault.as_ref().map(|v| v.settings.reduced_motion).unwrap_or(true) {
            ctx.request_repaint_after(Duration::from_millis(mechanics::REPAINT_MS));
        } else {
            // Static illumination still needs a redraw when temporary feedback expires.
            let remaining = self.processing_until - self.started.elapsed().as_secs_f64();
            if remaining > 0.0 { ctx.request_repaint_after(Duration::from_secs_f64(remaining)); }
            let remaining = self.completed_until - self.started.elapsed().as_secs_f64();
            if remaining > 0.0 { ctx.request_repaint_after(Duration::from_secs_f64(remaining)); }
            if let Some((_, at, _)) = &self.toast {
                for expiry in [6.0, 7.0] {
                    let remaining = expiry - at.elapsed().as_secs_f64();
                    if remaining > 0.0 { ctx.request_repaint_after(Duration::from_secs_f64(remaining)); }
                }
            }
        }
    }
}
fn arg_value(args: &[String], key: &str) -> Option<String> {
    args.iter()
        .position(|a| a == key)
        .and_then(|i| args.get(i + 1))
        .cloned()
}
fn main() -> eframe::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--help") {
        println!("Living Workbench\n  --screenshot <file.png>  Capture after 120 frames, then exit\n  --self-test <file.json>   Exercise local knowledge workflow, then exit\n  --vault <directory>     Choose a local vault (default: Research Vault beside the app)\n  --view knowledge|canvas|experiments|decisions|traces\n  --scene-preview          Open the local scene inspector\n  --width N --height N     Initial window size");
        return Ok(());
    }
    let self_test = arg_value(&args, "--self-test").map(PathBuf::from);
    let screenshot = arg_value(&args, "--screenshot")
        .map(PathBuf::from)
        .or_else(|| self_test.as_ref().map(|path| path.with_extension("png")));
    let root = arg_value(&args, "--vault")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            if self_test.is_some() {
                PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(format!("test-data/{}", new_id()))
            } else {
                PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("Research Vault")
            }
        });
    let width = arg_value(&args, "--width")
        .and_then(|v| v.parse::<f32>().ok())
        .unwrap_or(1600.);
    let height = arg_value(&args, "--height")
        .and_then(|v| v.parse::<f32>().ok())
        .unwrap_or(900.);
    let view = match arg_value(&args, "--view").as_deref() {
        Some("knowledge") => View::Knowledge,
        Some("canvas") => View::Canvas,
        Some("experiments") => View::Experiments,
        Some("decisions") => View::Decisions,
        Some("traces") => View::Traces,
        _ => View::Home,
    };
    let unattended = screenshot.is_some() || self_test.is_some();
    let mut viewport = ViewportBuilder::default()
        .with_title("Loom — Living Workbench")
        .with_inner_size([width, height])
        .with_min_inner_size([620., 640.])
        .with_clamp_size_to_monitor_size(!unattended)
        .with_decorations(!unattended)
        .with_active(!unattended);
    #[cfg(target_os = "windows")]
    if unattended {
        viewport = viewport.with_window_level(WindowLevel::AlwaysOnBottom);
    }
    #[cfg(not(target_os = "windows"))]
    let _ = &mut viewport;
    let options = eframe::NativeOptions {
        viewport,
        renderer: eframe::Renderer::Glow,
        run_and_return: true,
        ..Default::default()
    };
    eframe::run_native(
        "Loom — Living Workbench",
        options,
        Box::new(move |cc| {
            let mut app = Workbench::new(cc, root, screenshot, self_test, view);
            if args.iter().any(|arg| arg == "--scene-preview") { app.open_scene(); }
            Ok(Box::new(app))
        }),
    )
}
