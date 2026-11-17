#[allow(dead_code)]
mod adapter;
mod knowledge;
mod files;
#[path = "../../shared/navigation.rs"]
mod navigation;
mod work;
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
    Files,
    Work,
    Knowledge,
    Canvas,
    Experiments,
    Decisions,
    Activity,
}
#[derive(Clone, PartialEq)]
enum Dialog {
    Search,
    Intent,
    More,
    Review,
    Note,
    New,
    Settings,
    Journal,
    Scene,
}
struct Message {
    user: bool,
    text: String,
    links: Vec<String>,
}
struct Workbench {
    files: files::Files,
    work: work::Overview,
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
            .rounding(control_radius()),
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
        let (vault, startup_error) = match Vault::open_frontend(root) {
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
            files: Default::default(),
            work: Default::default(),
            vault,
            adapter: LoomHttpAdapter::new(),
            loom_connected: false,
            startup_error,
            view,
            dialog: None,
            chat_open: true,
            home_narrow: false,
            messages: Vec::new(),
            input: String::new(),
            query: String::new(),
            selected: String::new(),
            draft: None,
            editing: false,
            new_title: String::new(),
            new_body: String::new(),
            new_kind: "note".into(),
            intent_draft: String::new(),
            review_reason: String::new(),
            relation_target: String::new(),
            relation_kind: "references".into(),
            toast: None,
            colors,
            bg,
            orb,
            started: Instant::now(),
            processing_until: 0.0,
            completed_until: 0.0,
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
        } else if self.dialog == Some(Dialog::Review)
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
                    * 0.55 * (1. - t).powi(2)) as u8;
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
                        Color32::from_rgba_premultiplied(20, 16, 14, 24))));
                }
            }
        }
    }
    fn top(&mut self, ui: &mut Ui, w: f32, workspace: bool) {
        ui.allocate_new_ui(UiBuilder::new().max_rect(rect(160., 8., (w - 520.).max(140.), 26.)), |ui| {
            ui.horizontal(|ui| {
                ui.menu_button("File", |ui| {
                    if ui.button("Files & editor").clicked() { self.folder=None; self.view=View::Files; self.dialog=None; ui.close_menu(); }
                    if ui.button("Capture note").clicked() { self.dialog=Some(Dialog::New);ui.close_menu(); }
                    if ui.button("Go to Tauri environment").clicked() { if let Err(e)=files::open_tauri(){self.notify(e,true);} ui.close_menu(); }
                });
                ui.menu_button("View", |ui| {
                    for (label,view) in [("Home",View::Home),("Work",View::Work),("Files",View::Files),("Knowledge",View::Knowledge),("Canvas",View::Canvas),("Experiments",View::Experiments),("Decisions",View::Decisions),("Activity",View::Activity)] {
                        if ui.button(label).clicked(){self.folder=None;self.view=view;ui.close_menu();}
                    }
                });
            });
        });
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
                .map(|v| v.display_intent())
                .unwrap_or("Knowledge workspace");
            txt(&p.with_clip_rect(rect(160., 52., w - 520., 26.)), 160., 54., intent, 14., self.colors.second);
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
            .map(|v| v.display_intent().to_string())
            .unwrap_or("Your local research workspace".into());
        let rr = rect(48., 137., iw, 36.);
        let ir = ui.interact(rr, Id::new("Active human intent"), Sense::click());
        wrapped(&p, rr, if intent.is_empty() { "Set your intent".into() } else { intent }, 25., self.colors.text);
        if ir.clicked() {
            self.intent_draft = self
                .vault
                .as_ref()
                .map(|v| v.display_intent().to_string())
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
            self.view = View::Activity;
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
        glass(&p, nav, 28.);
        let labels = [
            ("nodes", "Knowledge"),
            ("layers", "Canvas"),
            ("flask", "Experiments"),
            ("history", "Decisions"),
            ("activity", "Activity"),
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
                    4 => self.view = View::Activity,
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
        glass(&p, r, panel_radius());
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
                                                .rounding(control_radius())
                                                .inner_margin(3.)
                                                .show(ui, |ui| {
                                                    for (i, id) in msg.links.iter().enumerate() {
                                                        let label = self.vault
                                                                .as_ref()
                                                                .and_then(|v| v.get(id))
                                                                .map(|n| n.meta.title.clone())
                                                                .unwrap_or(id.clone());
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
        self.loom_connected = self.adapter.activity().state != State::Error;
        if !self.loom_connected {
            self.notify("Loom is unavailable. Your draft is preserved.", true);
            return;
        }
        self.input.clear();
        self.processing_until = self.started.elapsed().as_secs_f64() + mechanics::PROCESSING_SECONDS;
        self.messages.push(Message { user: true, text: q.clone(), links: vec![] });
            let intent = self
                .vault
                .as_ref()
                .map(|v| v.display_intent().to_string())
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
                ("activity", "Activity", View::Activity),
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
                ("Activity", View::Activity),
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
                                v.ledger.edges.iter().filter(|e| v.get(&e.from).is_some() && v.get(&e.to).is_some()).count()
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
                    self.graph(ui, rect(content.left(), content.top()+88., content.width(), (content.height()-96.).max(100.)));
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
                        "Arrange the notes in your vault.",
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
                View::Work => { ui.allocate_new_ui(UiBuilder::new().max_rect(content), |ui| { self.work.ui(ui); }); },
                View::Files => { ui.allocate_new_ui(UiBuilder::new().max_rect(content), |ui| { self.files.ui(ui); }); },
                View::Experiments => self.note_list(ui, content, "experiment"),
                View::Decisions => self.note_list(ui, content, "decision"),
                View::Activity => self.traces(ui, content),
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
        if visible.is_empty() {
            wrapped(&p, rect(r.left()+24.,r.top()+72.,r.width()-48.,60.), "No notes yet. Capture a note or sync from Loom to build your graph.",14.,self.colors.muted);
            return;
        }
        let center = pos2(r.center().x, r.center().y + 18.);
        let radiusx = (r.width() * 0.31).min(340.);
        let radiusy = (r.height() * 0.31).min(150.);
        let mut positions = std::collections::HashMap::new();
        for (i, n) in visible.iter().enumerate() {
            let c = if n.meta.id == self.selected {
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
            let big = n.meta.id == self.selected;
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
        let notes = self.vault.as_ref().map(|v| v.notes.clone()).unwrap_or_default();
        let edges = self.vault.as_ref().map(|v| v.ledger.edges.clone()).unwrap_or_default();
        let mut open = None;
        let mut export = false;
        ui.allocate_new_ui(UiBuilder::new().max_rect(r).layout(Layout::top_down(Align::Min)), |ui| {
            ui.horizontal(|ui| {
                ui.heading("Canvas");
                if full && ui.add_enabled(!notes.is_empty(), Button::new("Export JSON Canvas")).clicked() { export = true; }
            });
            if notes.is_empty() {
                ui.label("No notes yet. Capture a note to start your canvas.");
                return;
            }
            ScrollArea::both().id_salt(("knowledge canvas", full)).max_height((r.height()-48.).max(40.)).show(ui, |ui| {
                let columns = ((r.width()-24.)/240.).floor().max(1.) as usize;
                let rows = notes.len().div_ceil(columns);
                let (area,_) = ui.allocate_exact_size(vec2((columns*240) as f32, (rows*148+16) as f32), Sense::hover());
                let painter = ui.painter().clone();
                let mut positions = std::collections::HashMap::new();
                for (i,note) in notes.iter().enumerate() {
                    let default = pos2((i%columns) as f32*240., (i/columns) as f32*148.);
                    let offset = self.canvas_positions.get(&note.meta.id).copied().unwrap_or(default);
                    let rect = Rect::from_min_size(area.min+offset.to_vec2(),vec2(220.,128.));
                    positions.insert(note.meta.id.clone(),rect);
                }
                for edge in &edges {
                    if let (Some(a),Some(b))=(positions.get(&edge.from),positions.get(&edge.to)) {
                        painter.line_segment([a.center(),b.center()],Stroke::new(1_f32,self.colors.purple));
                    }
                }
                for note in &notes {
                    let rect = positions[&note.meta.id];
                    let response = ui.interact(rect,Id::new(("canvas note",&note.meta.id,full)),Sense::click_and_drag());
                    if response.dragged() {
                        let new = (rect.min+response.drag_delta()-area.min).max(Vec2::ZERO);
                        self.canvas_positions.insert(note.meta.id.clone(),pos2(new.x,new.y));
                    }
                    painter.rect_filled(rect,control_radius(),self.colors.surface(Color32::from_rgb(31,34,51)));
                    painter.rect_stroke(rect,control_radius(),Stroke::new(1_f32,self.colors.overlay(45)));
                    let clip = painter.with_clip_rect(rect.shrink(10.));
                    txt(&clip,rect.left()+12.,rect.top()+10.,&note.meta.kind,12.,self.colors.purple);
                    wrapped(&clip,Rect::from_min_size(pos2(rect.left()+12.,rect.top()+32.),vec2(196.,44.)),&note.meta.title,14.,self.colors.text);
                    wrapped(&clip,Rect::from_min_size(pos2(rect.left()+12.,rect.top()+80.),vec2(196.,36.)),note.body.chars().take(120).collect::<String>(),12.,self.colors.second);
                    if response.clicked() { open=Some(note.meta.id.clone()); }
                }
            });
        });
        if export {
            let result=self.vault.as_ref().ok_or("Vault unavailable".to_string()).and_then(|v|v.export_canvas());
            self.outcome(result,"Canvas exported to the vault's Artifacts folder");
        }
        if let Some(id)=open {self.open_note(&id);}
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
                "Experiment notes you have recorded."
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
        let offset = 100.;
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
                            .rect_filled(rr, 12., self.colors.surface(Color32::from_rgb(25, 28, 44)));
                        ui.painter().rect_stroke(
                            rr,
                            12.,
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
        txt(ui.painter(), r.left()+5., r.top()+7., "Activity", 28., self.colors.text);
        txt(ui.painter(), r.left()+5., r.top()+50., "Edits, links and review decisions recorded in this vault.", 13., self.colors.muted);
        self.audit_list(ui, rect(r.left()+5., r.top()+88., r.width()-10., (r.height()-96.).max(0.)));
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
                        for a in v.ledger.audit.iter().rev().filter(|a| !v.is_hidden(&a.object)).take(100) {
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
            Dialog::Intent => "Your active intent",
            Dialog::More => "More from your workbench",
            Dialog::Review => "Memory garden",
            Dialog::Note => "Knowledge object",
            Dialog::New => "Capture an idea",
            Dialog::Settings => "Local workspace",
            Dialog::Journal => "Activity journal",
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
    Dialog::Intent=>{
     ui.label(RichText::new("What are you trying to understand?").size(19.));ui.add_space(7.);ui.add_sized(vec2(ui.available_width(),60.),TextEdit::multiline(&mut self.intent_draft).font(FontId::proportional(18.)));
     ui.add_space(12.);ui.horizontal(|ui|{if button(ui,"Save intent"){let res=self.vault.as_mut().ok_or_else(|| "Vault unavailable".to_string()).and_then(|v|v.set_intent(&self.intent_draft));if res.is_ok(){self.dialog=None;}self.outcome(res,"Active intent saved");}if button(ui,"Linked knowledge"){self.dialog=None;self.view=View::Knowledge;self.focus_graph=None;}});
     ui.add_space(18.);ui.label(RichText::new("Switch to a stored intent").color(self.colors.muted));let intents:Vec<_>=self.vault.as_ref().map(|v|v.notes.iter().filter(|n|n.meta.kind=="intent"||n.meta.kind=="project").map(|n|n.meta.title.clone()).collect()).unwrap_or_default();for title in intents{if ui.add(Button::new(&title).frame(false)).clicked(){self.intent_draft=title;}}
     if button(ui,"Create another intent"){self.new_kind="intent".into();self.dialog=Some(Dialog::New);}
    },
    Dialog::More=>{
     ui.label(RichText::new("Make room for a different way of thinking.").color(self.colors.second));ui.add_space(15.);
     ScrollArea::vertical().max_height((screen.height()-260.).max(150.)).show(ui,|ui|{
     for (title,subtitle,target) in [("Scene preview","Explore Unity-inspired scene controls and save a local preset.",Dialog::Scene),("Memory garden","Review proposed knowledge and preserve its history.",Dialog::Review),("Activity journal","Review meaningful changes recorded in this vault.",Dialog::Journal),("Workspace settings","Motion, local files and connection status.",Dialog::Settings)]{
      let(rr,response)=ui.allocate_exact_size(vec2(ui.available_width(),76.),Sense::click());if response.hovered(){ui.painter().rect_filled(rr,12.,self.colors.overlay(8));}txt(ui.painter(),rr.left()+12.,rr.top()+12.,title,16.,self.colors.text);wrapped(ui.painter(),rect(rr.left()+12.,rr.top()+39.,rr.width()-48.,34.),subtitle,12.,self.colors.muted);icon(ui.painter(),"chevron",pos2(rr.right()-16.,rr.center().y),16.,self.colors.second);if response.clicked(){if target==Dialog::Scene {self.open_scene();} else {self.dialog=Some(target);}}
     }
     });
    },
    Dialog::Review=>{
     ui.label(RichText::new("Proposed knowledge stays a proposal until you decide.").color(self.colors.second));ui.label(RichText::new("Approval records your review of the wording and evidence. It does not independently verify a claim.").size(12.).color(self.colors.muted));ui.add_space(15.);
     let notes:Vec<_>=self.vault.as_ref().map(|v|v.notes.iter().filter(|n|n.meta.status=="proposed").cloned().collect()).unwrap_or_default();let mut open=None;
     ScrollArea::vertical().max_height(400_f32.min(screen.height()-300.)).show(ui,|ui|{if notes.is_empty(){ui.label(RichText::new("You're all caught up.").size(19.));ui.label(RichText::new("No local notes are awaiting review.").color(self.colors.muted));}for n in notes{Frame::none().fill(self.colors.overlay(5)).rounding(16.).inner_margin(16.).show(ui,|ui|{ui.horizontal(|ui|{ui.label(RichText::new(&n.meta.kind).size(12.).color(self.colors.amber));ui.label(RichText::new("Needs your review").size(12.).color(self.colors.muted));});ui.label(RichText::new(&n.meta.title).size(19.));ui.label(RichText::new(n.body.chars().take(160).collect::<String>()).color(self.colors.second));if button(ui,"Inspect evidence & review"){open=Some(n.meta.id.clone());}});ui.add_space(12.);}});if let Some(id)=open{self.open_note(&id);}
     ui.add_space(14.);if button(ui,"Review history"){self.dialog=Some(Dialog::Journal);}
    },
    Dialog::Scene=>{
     let reduced=self.vault.as_ref().map(|v|v.settings.reduced_motion).unwrap_or(true);
     if self.scene.show(ui,self.orb.id(),self.colors,reduced){
      let result=self.vault.as_ref().ok_or_else(|| "Vault unavailable".to_string()).and_then(|v|self.scene.preset.save(&v.root));
      self.outcome(result,"Scene preset saved");
     }
    },
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
     ui.label(RichText::new("Manual keeps your draft when you press Send. Turn it off to send to Loom.").size(12.).color(self.colors.muted));
     ui.add_space(16.);ui.label(RichText::new("Last connection check").size(16.));
     ui.label(if self.loom_connected { "Loom responded to the last check" } else { "No successful Loom check in this window yet" });
     if button(ui,"Refresh files from disk"){let res=self.vault.as_mut().ok_or_else(|| "Vault unavailable".to_string()).and_then(|v|v.reload());self.outcome(res,"Vault reloaded; external edits are now indexed");}
     if button(ui,"View shortcuts"){self.notify("Ctrl+K: search · Ctrl+N: capture · Ctrl+H: home · Esc: close",false);}
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
                            .filter(|e| (e.from == note.meta.id || e.to == note.meta.id) && v.get(&e.from).is_some() && v.get(&e.to).is_some())
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
        if self.self_test.is_none() || self.test_done { return; }
        match self.frames {
            12 => {
                let result=(|| -> Result<(),String> {
                    let v=self.vault.as_mut().ok_or("Vault unavailable")?;
                    if !v.notes.is_empty() { return Err("New application vault must start empty".into()); }
                    self.selected=v.create("Interaction test note","First draft","note",Actor::Human)?;
                    self.relation_target=v.create("Supporting note","A saved supporting record","note",Actor::Human)?;
                    self.view=View::Knowledge;
                    Ok(())
                })();
                self.test_steps.push(serde_json::json!({"step":"empty start and capture","passed":result.is_ok(),"detail":result.err()}));
            }
            20 => {
                let id=self.selected.clone();self.open_note(&id);
                self.test_steps.push(serde_json::json!({"step":"inspect real note","passed":self.draft.as_ref().map(|n|n.body=="First draft").unwrap_or(false)}));
            }
            30 => {
                let result=(|| -> Result<(),String> {
                    let v=self.vault.as_mut().ok_or("Vault unavailable")?;
                    let mut n=v.get(&self.selected).ok_or("Captured note missing")?.clone();
                    n.body="Edited and persisted".into();v.save_note(&n,Actor::Human)?;
                    v.relate(&self.selected,&self.relation_target,"references")?;
                    let reopened=Vault::open_frontend(v.root.clone())?;
                    if reopened.get(&self.selected).map(|n|n.body.as_str())!=Some("Edited and persisted")
                        || !reopened.backlinks(&self.relation_target).iter().any(|e|e.from==self.selected) { return Err("Persistence or backlink missing".into()); }
                    v.unlink(&Edge{from:self.selected.clone(),to:self.relation_target.clone(),kind:"references".into()})?;
                    v.export_canvas()?;
                    Ok(())
                })();
                self.test_steps.push(serde_json::json!({"step":"save link reopen and export","passed":result.is_ok(),"detail":result.err()}));
            }
            50 => {
                self.dialog=None;self.view=View::Home;
                let result=(|| -> Result<(),String> {
                    let v=self.vault.as_mut().ok_or("Vault unavailable")?;v.set_manual_chat(true)?;
                    let root=v.root.clone();let messages=self.messages.len();
                    self.input="Preserve this draft".into();self.send_message();
                    if self.input!="Preserve this draft" || self.messages.len()!=messages || !Vault::open_frontend(root)?.settings.manual_chat { return Err("Manual draft guard failed".into()); }
                    self.vault.as_mut().unwrap().set_manual_chat(false)?;self.input.clear();self.toast=None;
                    Ok(())
                })();
                self.test_steps.push(serde_json::json!({"step":"manual draft","passed":result.is_ok(),"detail":result.err()}));
            }
            65 => {
                self.view=View::Canvas; self.dialog=None;
                self.test_steps.push(serde_json::json!({"step":"canvas real data","passed":self.vault.as_ref().map(|v|v.notes.len()==2).unwrap_or(false)}));
            }
            75 | 80 | 85 => {
                let light=self.frames!=80;self.set_appearance(ctx,light);
                let persisted=self.vault.as_ref().and_then(|v|Vault::open_frontend(v.root.clone()).ok()).map(|v|v.settings.light_mode==light).unwrap_or(false);
                self.test_steps.push(serde_json::json!({"step":format!("appearance {light}"),"passed":self.colors.light==light && ctx.style().visuals.dark_mode!=light && persisted}));
            }
            88 => {
                self.open_scene();self.scene.preset.x=0.4;let expected=self.scene.preset.clone();
                let result=self.vault.as_ref().ok_or("Vault unavailable".to_string()).and_then(|v|self.scene.preset.save(&v.root));
                self.scene=Default::default();self.open_scene();
                self.test_steps.push(serde_json::json!({"step":"scene preset","passed":result.is_ok() && self.scene.preset==expected && !self.scene.playing}));
                self.dialog=None;
            }
            90 => {
                self.set_appearance(ctx,false);self.view=View::Home;
                self.test_steps.push(serde_json::json!({"step":"hud","passed":self.chat_open&&self.vault.is_some()&&self.messages.is_empty()}));self.test_done=true;
            }
            _=>{}
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
                    glass(ui.painter(), rect(48., 230., 620., 150.), panel_radius());
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
                            .rounding(control_radius())
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
    // winit's Wayland focus_window is a no-op. XWayland provides reliable
    // cross-application focus for the paired desktop surfaces on Linux.
    #[cfg(target_os = "linux")]
    if std::env::var_os("DISPLAY").is_some() {
        std::env::remove_var("WAYLAND_DISPLAY");
        std::env::remove_var("WAYLAND_SOCKET");
    }
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--help") {
        println!("Living Workbench\n  --screenshot <file.png>  Capture after 120 frames, then exit\n  --self-test <file.json>   Exercise local knowledge workflow, then exit\n  --vault <directory>     Choose a local vault (default: Research Vault beside the app)\n  --view knowledge|canvas|experiments|decisions|activity\n  --scene-preview          Open the local scene inspector\n  --width N --height N     Initial window size");
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
        Some("files") => View::Files,
        Some("work") => View::Work,
        Some("knowledge") => View::Knowledge,
        Some("canvas") => View::Canvas,
        Some("experiments") => View::Experiments,
        Some("decisions") => View::Decisions,
        Some("activity") | Some("traces") => View::Activity,
        _ => View::Home,
    };
    let unattended = screenshot.is_some() || self_test.is_some();
    let navigation_instance = if unattended { None } else {
        match navigation::Instance::claim(navigation::WORKBENCH) {
            Ok(Some(instance)) => Some(instance),
            Ok(None) => return Ok(()),
            Err(error) => return Err(eframe::Error::AppCreation(Box::new(std::io::Error::other(error)))),
        }
    };
    let mut viewport = ViewportBuilder::default()
        .with_title("Loom — Living Workbench · Integrated")
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
            if let Some(instance) = navigation_instance {
                let ctx = cc.egui_ctx.clone();
                instance.serve(move || {
                    ctx.send_viewport_cmd(ViewportCommand::Minimized(false));
                    ctx.send_viewport_cmd(ViewportCommand::Focus);
                    ctx.request_repaint();
                });
            }
            let mut app = Workbench::new(cc, root, screenshot, self_test, view);
            if args.iter().any(|arg| arg == "--scene-preview") { app.open_scene(); }
            Ok(Box::new(app))
        }),
    )
}
