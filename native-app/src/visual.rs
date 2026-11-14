use eframe::egui::*;
pub const DEEP: Color32 = Color32::from_rgb(29, 27, 26);
fn shared_theme() -> &'static serde_json::Value {
    static THEME: std::sync::OnceLock<serde_json::Value> = std::sync::OnceLock::new();
    THEME.get_or_init(|| serde_json::from_str(include_str!("../../design-tokens.json")).expect("Valid shared design tokens"))
}
fn token_color(values: &serde_json::Value, name: &str) -> Color32 {
    let rgb = &values[name];
    Color32::from_rgb(rgb[0].as_u64().unwrap() as u8, rgb[1].as_u64().unwrap() as u8, rgb[2].as_u64().unwrap() as u8)
}
pub fn control_radius() -> f32 { shared_theme()["radius"]["control"].as_f64().unwrap() as f32 }
pub fn panel_radius() -> f32 { shared_theme()["radius"]["panel"].as_f64().unwrap() as f32 }
/// Semantic colors shared by native widgets and the custom painted workspace.
#[derive(Clone, Copy)]
pub struct Palette {
    pub light: bool,
    pub text: Color32,
    pub second: Color32,
    pub muted: Color32,
    pub purple: Color32,
    pub blue: Color32,
    pub green: Color32,
    pub amber: Color32,
    pub red: Color32,
    pub deep: Color32,
}
impl Palette {
    pub fn new(light: bool) -> Self {
        let theme = shared_theme();
        let values = &theme[if light { "white" } else { "dark" }];
        let color = |name: &str| token_color(values, name);
        Self { light, text: color("text"), second: color("second"), muted: color("muted"),
            purple: color("second"), blue: color("activity-ink"), green: color("success-ink"),
            amber: color("attention-ink"), red: color("error-ink"), deep: color("deep") }
    }

    pub fn overlay(self, alpha: u8) -> Color32 {
        let color = token_color(&shared_theme()[if self.light { "white" } else { "dark" }], "overlay");
        Color32::from_rgba_unmultiplied(color.r(), color.g(), color.b(), alpha)
    }
    pub fn surface(self, _dark: Color32) -> Color32 {
        token_color(&shared_theme()[if self.light { "white" } else { "dark" }], "surface")
    }
    pub fn accent(self, alpha: u8) -> Color32 {
        Color32::from_rgba_unmultiplied(self.purple.r(), self.purple.g(), self.purple.b(), alpha)
    }
}
fn palette(ctx: &Context) -> Palette {
    ctx.data(|d| d.get_temp::<Palette>(Id::new("appearance"))).unwrap_or(Palette::new(false))
}
pub fn apply_appearance(ctx: &Context, colors: Palette) {
    ctx.data_mut(|d| d.insert_temp(Id::new("appearance"), colors));
    let values = &shared_theme()[if colors.light { "white" } else { "dark" }];
    let mut style = Style::default();
    style.visuals = if colors.light { Visuals::light() } else { Visuals::dark() };
    style.visuals.override_text_color = Some(colors.text);
    style.visuals.panel_fill = colors.deep;
    style.visuals.error_fg_color = colors.red;
    style.visuals.warn_fg_color = colors.amber;
    style.visuals.window_fill = colors.surface(Color32::from_rgb(25, 29, 48));
    style.visuals.window_rounding = Rounding::same(panel_radius());
    style.visuals.window_stroke = Stroke::new(1_f32, colors.overlay(33));
    style.visuals.window_shadow = Shadow { offset: vec2(0., 18.), blur: 48., spread: 0.,
        color: Color32::from_rgba_unmultiplied(65, 48, 38, if colors.light { 26 } else { 45 }) };
    style.visuals.selection.bg_fill = token_color(values, "selection");
    style.visuals.selection.stroke = Stroke::new(1_f32, colors.text);
    style.visuals.widgets.inactive.bg_fill = token_color(values, "control");
    style.visuals.widgets.inactive.bg_stroke = Stroke::new(1_f32, colors.overlay(25));
    style.visuals.widgets.inactive.rounding = Rounding::same(control_radius());
    style.visuals.widgets.hovered.bg_fill = token_color(values, "hover");
    style.visuals.widgets.hovered.rounding = Rounding::same(control_radius());
    for widget in [&mut style.visuals.widgets.noninteractive, &mut style.visuals.widgets.inactive,
        &mut style.visuals.widgets.hovered, &mut style.visuals.widgets.active, &mut style.visuals.widgets.open] {
        widget.rounding = Rounding::same(control_radius());
        widget.fg_stroke.color = colors.text;
    }
    style.visuals.widgets.inactive.weak_bg_fill = token_color(values, "control");
    style.visuals.widgets.hovered.weak_bg_fill = token_color(values, "hover");
    style.visuals.widgets.noninteractive.weak_bg_fill = token_color(values, "surface");
    style.visuals.widgets.active.weak_bg_fill = token_color(values, "selection");
    style.visuals.widgets.open.weak_bg_fill = token_color(values, "selection");
    style.visuals.widgets.active.bg_fill = colors.accent(60);
    style.visuals.widgets.open.bg_fill = colors.accent(38);
    style.visuals.extreme_bg_color = token_color(values, "reading");
    style.spacing.item_spacing = vec2(10., 10.);
    style.spacing.button_padding = vec2(14., 8.);
    for (kind, size) in [(TextStyle::Body, 14.), (TextStyle::Button, 14.), (TextStyle::Small, 12.)] {
        style.text_styles.insert(kind, FontId::proportional(size));
    }
    style.animation_time = 0.15;
    ctx.set_style(style);
}
pub fn color_status(s: &str, colors: Palette) -> Color32 {
    match s {
        "approved" => colors.green,
        "proposed" => colors.amber,
        "rejected" => colors.red,
        "recorded" => colors.blue,
        _ => colors.purple,
    }
}
pub fn txt(p: &Painter, x: f32, y: f32, text: impl Into<String>, size: f32, color: Color32) {
    p.text(
        pos2(x, y),
        Align2::LEFT_TOP,
        text.into(),
        FontId::proportional(size),
        color,
    );
}
pub fn wrapped(p: &Painter, r: Rect, text: impl Into<String>, size: f32, color: Color32) {
    let g = p.layout(text.into(), FontId::proportional(size), color, r.width());
    p.galley(r.min, g, color);
}
pub fn glass(p: &Painter, r: Rect, radius: f32) {
    let colors = palette(p.ctx());
    for i in (1..=10).rev() {
        let spread = i as f32 * 1.2;
        p.rect_filled(
            r.expand(spread).translate(vec2(0., 5.)),
            radius + spread,
            Color32::from_rgba_unmultiplied(65, 48, 38, 1),
        );
    }
    p.rect_filled(r, radius, { let c = colors.surface(DEEP); Color32::from_rgba_unmultiplied(c.r(), c.g(), c.b(), 242) });
    p.rect_stroke(r, radius, Stroke::new(1.0_f32, colors.overlay(33)));
    p.line_segment(
        [
            r.min + vec2(radius, 1.),
            pos2(r.right() - radius, r.top() + 1.),
        ],
        Stroke::new(0.7f32, colors.overlay(18)),
    );
}
pub fn pill(ui: &mut Ui, r: Rect, label: &str, active: bool) -> Response {
    let colors = palette(ui.ctx());
    let res = ui.interact(
        r,
        ui.id().with((label, r.min.x.to_bits(), r.min.y.to_bits())),
        Sense::click(),
    );
    let col = if active {
        colors.accent(38)
    } else if res.hovered() {
        colors.overlay(13)
    } else {
        Color32::TRANSPARENT
    };
    ui.painter().rect_filled(r, control_radius(), col);
    if active {
        ui.painter().rect_stroke(
            r,
            control_radius(),
            Stroke::new(1.0_f32, colors.accent(60)),
        );
    }
    ui.painter().text(
        r.center(),
        Align2::CENTER_CENTER,
        label,
        FontId::proportional(13.),
        if active { colors.text } else { colors.second },
    );
    res.on_hover_cursor(CursorIcon::PointingHand)
}
pub fn icon(p: &Painter, name: &str, c: Pos2, s: f32, col: Color32) {
    let k = s / 24.;
    let st = Stroke::new(1.75 * k, col);
    let pt = |x: f32, y: f32| c + vec2((x - 12.) * k, (y - 12.) * k);
    let line = |coords: &[(f32, f32)]| {
        p.add(Shape::line(
            coords.iter().map(|&(x, y)| pt(x, y)).collect(),
            st,
        ));
    };
    match name {
        "search" => {
            p.circle_stroke(pt(10.5, 10.5), 6.5 * k, st);
            line(&[(15.5, 15.5), (21., 21.)]);
        }
        "bell" => {
            line(&[
                (5., 17.),
                (7., 14.),
                (7., 9.),
                (8., 5.),
                (12., 3.),
                (16., 5.),
                (17., 9.),
                (17., 14.),
                (19., 17.),
                (5., 17.),
            ]);
            line(&[(10., 21.), (14., 21.)]);
        }
        "chat" => {
            p.rect_stroke(Rect::from_min_max(pt(3., 4.), pt(21., 18.)), 4. * k, st);
            line(&[(8., 18.), (4., 22.), (4., 16.)]);
        }
        "down" => line(&[(7., 9.), (12., 14.), (17., 9.)]),
        "chevron" => line(&[(9., 6.), (15., 12.), (9., 18.)]),
        "close" => {
            line(&[(6., 6.), (18., 18.)]);
            line(&[(18., 6.), (6., 18.)]);
        }
        "nodes" => {
            line(&[(12., 4.), (4., 18.), (20., 18.), (12., 4.)]);
            for (x, y) in [(12., 4.), (4., 18.), (20., 18.)] {
                p.circle_filled(pt(x, y), 3. * k, palette(p.ctx()).deep);
                p.circle_stroke(pt(x, y), 3. * k, st);
            }
        }
        "layers" => {
            line(&[(2., 8.), (12., 2.), (22., 8.), (12., 14.), (2., 8.)]);
            line(&[(2., 12.), (12., 18.), (22., 12.)]);
            line(&[(2., 16.), (12., 22.), (22., 16.)]);
        }
        "flask" => {
            line(&[(9., 3.), (15., 3.)]);
            line(&[
                (10., 3.),
                (10., 10.),
                (4., 20.),
                (5., 22.),
                (19., 22.),
                (20., 20.),
                (14., 10.),
                (14., 3.),
            ]);
            line(&[(7., 16.), (17., 16.)]);
        }
        "history" => {
            p.circle_stroke(c, 9. * k, st);
            line(&[(12., 6.), (12., 12.), (16., 15.)]);
            line(&[(2., 3.), (2., 8.), (7., 8.)]);
        }
        "activity" => line(&[
            (1., 12.),
            (6., 12.),
            (9., 4.),
            (13., 21.),
            (16., 9.),
            (19., 12.),
            (23., 12.),
        ]),
        "grid" => {
            for x in [3., 14.] {
                for y in [3., 14.] {
                    p.rect_stroke(
                        Rect::from_min_size(pt(x, y), vec2(7. * k, 7. * k)),
                        1. * k,
                        st,
                    );
                }
            }
        }
        "file" => {
            line(&[
                (5., 2.),
                (14., 2.),
                (20., 8.),
                (20., 22.),
                (5., 22.),
                (5., 2.),
            ]);
            line(&[(14., 2.), (14., 8.), (20., 8.)]);
            line(&[(9., 13.), (16., 13.)]);
            line(&[(9., 17.), (16., 17.)]);
        }
        "chart" => {
            line(&[(4., 21.), (4., 13.), (8., 13.), (8., 21.)]);
            line(&[(10., 21.), (10., 8.), (14., 8.), (14., 21.)]);
            line(&[(16., 21.), (16., 3.), (20., 3.), (20., 21.)]);
        }
        "send" => {
            line(&[(3., 3.), (22., 12.), (3., 21.), (7., 12.), (3., 3.)]);
            line(&[(7., 12.), (17., 12.)]);
        }
        "plus" => {
            line(&[(12., 4.), (12., 20.)]);
            line(&[(4., 12.), (20., 12.)]);
        }
        "folder" => line(&[
            (3., 6.),
            (3., 21.),
            (21., 21.),
            (21., 7.),
            (12., 7.),
            (10., 3.),
            (3., 3.),
            (3., 6.),
        ]),
        "check" => line(&[(4., 12.), (9., 17.), (20., 6.)]),
        "arrow" => {
            line(&[(4., 12.), (20., 12.)]);
            line(&[(14., 6.), (20., 12.), (14., 18.)]);
        }
        "back" => {
            line(&[(20., 12.), (4., 12.)]);
            line(&[(10., 6.), (4., 12.), (10., 18.)]);
        }
        "link" => {
            line(&[
                (9., 8.),
                (13., 4.),
                (17., 4.),
                (20., 7.),
                (20., 11.),
                (16., 15.),
            ]);
            line(&[
                (15., 16.),
                (11., 20.),
                (7., 20.),
                (4., 17.),
                (4., 13.),
                (8., 9.),
            ]);
            line(&[(8., 16.), (16., 8.)]);
        }
        "shield" => {
            line(&[
                (12., 2.),
                (21., 6.),
                (20., 15.),
                (17., 19.),
                (12., 22.),
                (7., 19.),
                (4., 15.),
                (3., 6.),
                (12., 2.),
            ]);
            line(&[(8., 12.), (11., 15.), (16., 9.)]);
        }
        "user" => {
            p.circle_stroke(pt(12., 8.), 4. * k, st);
            line(&[
                (4., 22.),
                (4., 18.),
                (8., 15.),
                (16., 15.),
                (20., 18.),
                (20., 22.),
            ]);
        }
        _ => {
            p.circle_stroke(c, 8. * k, st);
            line(&[(12., 7.), (12., 13.)]);
            p.circle_filled(pt(12., 17.), 0.8 * k, col);
        }
    }
}
pub fn icon_button(ui: &mut Ui, r: Rect, name: &str, label: &str) -> Response {
    let colors = palette(ui.ctx());
    let res = ui.interact(r, ui.id().with(label), Sense::click());
    if res.hovered() || res.has_focus() {
        ui.painter()
            .rect_filled(r, 12., colors.overlay(12));
    }
    icon(ui.painter(), name, r.center(), 20., colors.second);
    res.widget_info(|| WidgetInfo::labeled(WidgetType::Button, true, label));
    res.on_hover_text(label)
        .on_hover_cursor(CursorIcon::PointingHand)
}
fn pixel(c: [f32; 3]) -> Color32 {
    Color32::from_rgb(
        c[0].clamp(0., 255.) as u8,
        c[1].clamp(0., 255.) as u8,
        c[2].clamp(0., 255.) as u8,
    )
}
pub fn atmosphere(colors: Palette) -> ColorImage {
    let (w, h) = (1600, 900);
    let mut img = ColorImage::new([w, h], colors.deep);
    let base = colors.deep;
    let surface = colors.surface(DEEP);
    for y in 0..h {
        let fy = y as f32 / h as f32;
        for x in 0..w {
            let fx = x as f32 / w as f32;
            let glow = (-((fx - 0.39) / 0.39).powi(2) - ((fy - 0.56) / 0.37).powi(2)).exp();
            let lift = fy * 0.25 + glow * 0.25;
            let mut c = [0.; 3];
            for i in 0..3 { c[i] = base[i] as f32 + (surface[i] as f32 - base[i] as f32) * lift; }
            if fy > 0.655 {
                let d = (fy - 0.655) / 0.345;
                let streak = (d * 155. + (fx * 12.).sin() * 2.).sin() * 0.5
                    + (d * 360. + fx * 5.).sin() * 0.25;
                let reflection =
                    (-((fx - 0.39375) / (0.06 + 0.07 * d)).powi(2)).exp() * (1. - d).powf(1.4);
                let ripples = (d * 195. + (fx * 65.).sin() * 0.8).sin();
                let reflected_light = reflection * (-((d - 0.23) / 0.24).powi(2)).exp()
                    * (0.6 + 0.4 * (d * 260. + fx * 8.).sin());
                let water_light = (-((fx - 0.39375) / 0.32).powi(2)).exp();
                for (i, v) in c.iter_mut().enumerate() {
                    *v += streak * (0.2 + water_light * 0.3)
                        + (reflection * (9. + ripples * 5.)) * [0.35, 0.32, 0.28][i];
                    *v += reflected_light * [6., 5., 4.][i];
                    *v -= d * 2.;
                }
            }
            img.pixels[y * w + x] = pixel(c);
        }
    }
    img
}
pub fn sphere() -> ColorImage {
    let size = 720;
    let pearl = token_color(&shared_theme()["white"], "orb-pearl");
    let highlight = token_color(&shared_theme()["white"], "orb-highlight");
    let thread = token_color(&shared_theme()["white"], "orb-line");
    let mut img = ColorImage::new([size, size], Color32::TRANSPARENT);
    for y in 0..size {
        for x in 0..size {
            let u = (x as f32 - size as f32 / 2.) / (size as f32 * 0.38);
            let v = (y as f32 - size as f32 / 2.) / (size as f32 * 0.38);
            let r = (u * u + v * v).sqrt();
            if r > 1.31 {
                continue;
            }
            if r > 1. {
                let glow = (-((r - 1.) / 0.14).powi(2)).exp() * 0.065;
                img.pixels[y * size + x] =
                    Color32::from_rgba_unmultiplied(pearl.r(), pearl.g(), pearl.b(), (glow * 180.) as u8);
                continue;
            }
            let z = (1. - r * r).max(0.).sqrt();
            let angle = v.atan2(u);
            let fres = (1. - z).powf(3.);
            let rim = (-((r - 0.988) / 0.015).powi(2)).exp();
            let upper = (-((u + 0.5) / 0.6).powi(2) - ((v + 0.6) / 0.45).powi(2)).exp();
            let violet = (-((u + 0.4) / 0.65).powi(2) - ((v - 0.72) / 0.25).powi(2)).exp();
            let right = (-((u - 0.8) / 0.25).powi(2) - ((v + 0.1) / 0.6).powi(2)).exp();
            let cyan = (-((u - 0.48) / 0.6).powi(2) - ((v - 0.78) / 0.34).powi(2)).exp();
            let drift = (u * 2.7 + v * 4.6 + z * 3.).sin();
            let wisps = (v * 71. + u * 19. + ((u * 2.5 + v * 3.8).sin()) * 17. + z * 22.).sin();
            let threads = wisps.max(0.).powf(8.) * (0.5 + 0.5 * drift) * 3.;
            let light = (z * 0.18 + rim * 0.12 + upper * 0.5).clamp(0., 1.);
            let wave = (v * 10. + u * 6. + z * 7.).sin() * 3. + threads;
            let mut c = [0.; 3];
            for i in 0..3 {
                c[i] = pearl[i] as f32 + (highlight[i] as f32 - pearl[i] as f32) * light
                    - (pearl[i] as f32 - thread[i] as f32) * fres * 0.5
                    + wave * 0.25 + (violet + right + cyan) * 1.5;
            }
            let edge = if r > 0.998 { (1. - r) / 0.002 } else { 1. };
            let al = (235. + 20. * fres) * edge;
            let _ = angle;
            img.pixels[y * size + x] = Color32::from_rgba_unmultiplied(
                c[0].clamp(0., 255.) as u8,
                c[1].clamp(0., 255.) as u8,
                c[2].clamp(0., 255.) as u8,
                al.clamp(0., 255.) as u8,
            );
        }
    }
    img
}

#[cfg(test)]
mod theme_tests {
    use super::*;
    #[test]
    fn appearances_read_the_shared_palette_and_geometry() {
        for light in [false,true] {
            let colors=Palette::new(light);
            let tokens=&shared_theme()[if light {"white"}else{"dark"}];
            assert_eq!(colors.text,token_color(tokens,"text"));
            assert_eq!(colors.deep,token_color(tokens,"deep"));
            assert_ne!(colors.text,colors.deep);
        }
        assert_eq!(control_radius(),10.);
        assert_eq!(panel_radius(),22.);
    }
}
