// Luminous sphere for the Loom IDE — canvas 2D, no dependencies.
// Matches the reference: a cream/white sphere with fine flowing contour
// lines, a soft glow, and a faint reflection on the water below.
// The sphere is deliberately calm: slow light drift, no timers pretending
// to be agent progress. State comes from the app (idle / listening /
// processing / attention), which only changes the glow tint and caption.

export type SphereState =
  | "idle"
  | "listening"
  | "processing"
  | "executing"
  | "attention"
  | "completed";

const TINTS: Record<SphereState, { glow: string; ring: string }> = {
  idle: { glow: "255, 250, 240", ring: "255, 255, 255" },
  listening: { glow: "235, 242, 255", ring: "210, 226, 250" },
  processing: { glow: "226, 236, 250", ring: "190, 210, 240" },
  executing: { glow: "214, 228, 248", ring: "170, 196, 235" },
  attention: { glow: "250, 238, 214", ring: "240, 210, 160" },
  completed: { glow: "238, 246, 238", ring: "205, 230, 205" },
};

export class Sphere {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: SphereState = "idle";
  private raf = 0;
  private start = performance.now();
  private running = false;
  private reducedMotion: boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }

  setState(state: SphereState) {
    this.state = state;
    // Under reduced motion there is no animation loop, so repaint now or
    // the tint freezes on the first state.
    if (this.reducedMotion) this.draw(0);
  }

  startAnimation() {
    if (this.running) return;
    this.running = true;
    if (this.reducedMotion) {
      this.draw(0);
      return;
    }
    const tick = (now: number) => {
      if (!this.running) return;
      this.draw((now - this.start) / 1000);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    // When the Experiment view is hidden the canvas reports 0x0; keep the
    // last good size instead of drawing into a 1px canvas (negative radii).
    if (rect.width < 10 || rect.height < 10) return;
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.draw(this.reducedMotion ? 0 : (performance.now() - this.start) / 1000);
  }

  private draw(t: number) {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    // Sphere occupies the upper ~62% of the canvas; the rest is reflection.
    const R = Math.min(W * 0.42, H * 0.30);
    if (R < 1) return; // canvas too small to draw into
    const cy = H * 0.34;
    const horizon = cy + R * 1.06;
    const tint = TINTS[this.state];

    ctx.clearRect(0, 0, W, H);

    // Slow breathing of the light: the highlight drifts a few px.
    const breathe = Math.sin(t * 0.45) * R * 0.03;
    const drift = Math.sin(t * 0.22) * R * 0.05;

    // ---- halo glow behind the sphere ----
    const halo = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.75);
    halo.addColorStop(0, `rgba(${tint.glow}, 0.55)`);
    halo.addColorStop(0.55, `rgba(${tint.glow}, 0.18)`);
    halo.addColorStop(1, `rgba(${tint.glow}, 0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    // ---- reflection on the water (flipped, faded) ----
    const reflH = H - horizon;
    if (reflH > 4) {
      ctx.save();
      ctx.translate(0, horizon * 2);
      ctx.scale(1, -1);
      ctx.globalAlpha = 0.16;
      this.paintSphere(cx, cy, R, tint, t, breathe, drift, true);
      ctx.restore();
      // Fade the reflection downward: erase it progressively so the
      // real page background shows through (no painted rectangle).
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      const fade = ctx.createLinearGradient(0, horizon, 0, H);
      fade.addColorStop(0, "rgba(0,0,0,0)");
      fade.addColorStop(0.35, "rgba(0,0,0,0.3)");
      fade.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, horizon, W, reflH);
      ctx.restore();
      // A few horizontal shimmer lines across the reflection.
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = Math.max(1, R * 0.004);
      for (let i = 0; i < 5; i++) {
        const y = horizon + reflH * (0.18 + i * 0.16) + Math.sin(t * 0.7 + i * 1.7) * 1.5;
        const w = R * (1.15 - i * 0.14);
        ctx.beginPath();
        ctx.moveTo(cx - w, y);
        ctx.lineTo(cx + w, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ---- the sphere itself ----
    this.paintSphere(cx, cy, R, tint, t, breathe, drift, false);

    // ---- soft contact shadow under the sphere ----
    const shadow = ctx.createRadialGradient(cx, horizon, R * 0.1, cx, horizon, R * 0.85);
    shadow.addColorStop(0, "rgba(120, 100, 80, 0.14)");
    shadow.addColorStop(1, "rgba(120, 100, 80, 0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(cx, horizon + R * 0.02, R * 0.85, R * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Paints the sphere body (gradient + flowing contour lines), clipped to its circle. */
  private paintSphere(
    cx: number,
    cy: number,
    R: number,
    tint: { glow: string; ring: string },
    t: number,
    breathe: number,
    drift: number,
    isReflection: boolean,
  ) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    // Body: bright top-left, warm mid, slightly deeper lower edge.
    const body = ctx.createRadialGradient(
      cx - R * 0.38 + drift,
      cy - R * 0.42 + breathe,
      R * 0.08,
      cx,
      cy,
      R * 1.05,
    );
    body.addColorStop(0, "#fffefb");
    body.addColorStop(0.35, "#faf5ec");
    body.addColorStop(0.68, "#efe6d8");
    body.addColorStop(0.92, "#e0d3c0");
    body.addColorStop(1, "#d8c9b4");
    ctx.fillStyle = body;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    // Fine flowing contour lines — the reference's signature detail.
    // Sine curves across the sphere, denser near the middle, fading at the rim.
    const lines = 16;
    for (let i = 0; i < lines; i++) {
      const f = i / (lines - 1); // 0 top .. 1 bottom
      const y = cy - R * 0.92 + f * R * 1.84;
      const halfChord = Math.sqrt(Math.max(0, R * R - (y - cy) * (y - cy)));
      if (halfChord < R * 0.05) continue;
      const amp = R * 0.16 * Math.sin(f * Math.PI);
      const phase = t * (isReflection ? 0.12 : 0.25) + i * 0.55;
      const alpha = 0.16 * Math.sin(f * Math.PI) + 0.03;
      ctx.beginPath();
      const steps = 48;
      for (let s = 0; s <= steps; s++) {
        const x = cx - halfChord + (2 * halfChord * s) / steps;
        const yy =
          y +
          Math.sin((s / steps) * Math.PI * 2 + phase) * amp * 0.28 +
          Math.sin((s / steps) * Math.PI + phase * 0.5) * amp * 0.5;
        if (s === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = `rgba(122, 102, 82, ${alpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(0.7, R * 0.0022);
      ctx.stroke();
    }

    // Bright rim light on the upper-left edge.
    const rim = ctx.createRadialGradient(
      cx - R * 0.55,
      cy - R * 0.6,
      R * 0.1,
      cx - R * 0.3,
      cy - R * 0.35,
      R * 0.95,
    );
    rim.addColorStop(0, `rgba(${tint.ring}, 0.85)`);
    rim.addColorStop(0.5, `rgba(${tint.ring}, 0.18)`);
    rim.addColorStop(1, `rgba(${tint.ring}, 0)`);
    ctx.fillStyle = rim;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    // Gentle inner shadow at the lower-right edge for roundness.
    const inner = ctx.createRadialGradient(
      cx + R * 0.55,
      cy + R * 0.6,
      R * 0.2,
      cx + R * 0.3,
      cy + R * 0.3,
      R * 1.0,
    );
    inner.addColorStop(0, "rgba(120, 96, 70, 0.16)");
    inner.addColorStop(1, "rgba(120, 96, 70, 0)");
    ctx.fillStyle = inner;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    ctx.restore();

    // Crisp outer edge: thin light rim.
    ctx.beginPath();
    ctx.arc(cx, cy, R - 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = Math.max(1, R * 0.004);
    ctx.stroke();
  }
}
