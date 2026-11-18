// The postMessage bridge for the spatial player — a faithful reproduction
// of the contract in public/spatial-player.js, but scene-agnostic so the
// message handling and pending queue are testable without WebGL.

export const SPATIAL_STATES = [
  "idle", "listening", "processing", "executing", "exploring",
  "attention", "completed", "error",
] as const;

export type SpatialState = (typeof SPATIAL_STATES)[number];

export interface BenchApi {
  applyLoomState(state: string): void;
  applyTheme(theme: "white" | "dark"): void;
  applyBackground(id: string): void;
  refreshVault(work: number, experiments: number): void;
  applyQuality(tier: string): void;
  applyCanvasSize(width: number, height: number): void;
  applyReducedMotion(reduced: boolean): void;
}

export interface BridgeEnv {
  window: Window;
  document: Document;
  canvas: HTMLElement;
  /** Reads the URL `theme` query param (default "dark" if not "white"). */
  themeFromParams(): "white" | "dark";
  /** Reads the URL `background` query param (default "charcoal"). */
  backgroundFromParams(): string;
}

/** Starts the message bridge. Returns `ready()` (call after the scene is
    built) and `fail(message)`. Pending messages are queued and flushed on
    ready, matching the Unity player's "latest wins" semantics. */
export function startSpatialBridge(
  env: BridgeEnv,
  api: BenchApi,
  readyFn: () => void,
) {
  const { window, document, canvas } = env;
  const theme = env.themeFromParams();
  const background = env.backgroundFromParams();
  if (document.body) document.body.dataset.theme = theme;
  if (document.documentElement) document.documentElement.style.colorScheme = "normal";

  let ready = false;
  let disposed = false;
  let pendingQuality: string | null = null;
  let pendingTheme: "white" | "dark" | null = null;
  let pendingBackground: string | null = null;
  let pendingState: string | null = null;
  let pendingVault: { work: number; experiments: number } | null = null;

  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const applyMotion = () => api.applyReducedMotion(motion?.matches === true);
  motion?.addEventListener?.("change", applyMotion);

  const reportSize = () => {
    if (!ready) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      api.applyCanvasSize(Math.round(rect.width), Math.round(rect.height));
    }
  };
  window.addEventListener?.("resize", reportSize);

  const receive = (event: MessageEvent) => {
    if (disposed) return;
    // Origin/source guard (kept from the Unity contract; see src/spatial.ts:28).
    if (event.source !== window.parent || event.origin !== window.location.origin) return;
    const d = event.data as Record<string, unknown> | undefined;
    // Payload shape validation: a plain object with a bounded string type.
    if (!d || typeof d !== "object" || Array.isArray(d)) return;
    const type = d.type;
    if (typeof type !== "string" || type.length > 64) return;

    if (type === "loom-state") {
      if (typeof d.state !== "string" || d.state.length > 32) return;
      if (!(SPATIAL_STATES as readonly string[]).includes(d.state)) return;
      if (ready) api.applyLoomState(d.state);
      else pendingState = d.state;
    } else if (type === "loom-theme") {
      if (d.theme !== "white" && d.theme !== "dark") return;
      const next = d.theme;
      if (document.body) document.body.dataset.theme = next;
      if (document.documentElement) document.documentElement.style.colorScheme = "normal";
      if (ready) api.applyTheme(next);
      else pendingTheme = next;
    } else if (type === "loom-vault-changed") {
      if (typeof d.work !== "number" || typeof d.experiments !== "number") return;
      if (!Number.isFinite(d.work) || !Number.isFinite(d.experiments)) return;
      const work = Math.floor(Math.max(0, d.work));
      const experiments = Math.floor(Math.max(0, d.experiments));
      if (ready) api.refreshVault(work, experiments);
      else pendingVault = { work, experiments };
    } else if (type === "loom-quality") {
      if (!["High", "Balanced", "Low"].includes(String(d.tier))) return;
      if (ready) api.applyQuality(d.tier as string);
      else pendingQuality = d.tier as string;
    } else if (type === "loom-background") {
      if (typeof d.background !== "string" || d.background.length > 32) return;
      if (document.body) document.body.dataset.background = d.background;
      if (ready) api.applyBackground(d.background);
      else pendingBackground = d.background;
    }
    // Unknown types (including the retired loom-memory) are ignored.
  };
  window.addEventListener?.("message", receive);
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(reportSize) : null;
  observer?.observe(canvas);

  return {
    ready(): void {
      if (ready || disposed) return;
      ready = true;
      if (pendingQuality) api.applyQuality(pendingQuality);
      api.applyTheme(pendingTheme ?? theme);
      if (document.body) document.body.dataset.background = pendingBackground ?? background;
      api.applyBackground(pendingBackground ?? background);
      applyMotion();
      if (pendingState) api.applyLoomState(pendingState);
      if (pendingVault) api.refreshVault(pendingVault.work, pendingVault.experiments);
      pendingTheme = pendingBackground = pendingState = null;
      pendingVault = null;
      reportSize();
      readyFn();
    },
    dispose(): void {
      disposed = true;
      ready = false;
      observer?.disconnect();
      window.removeEventListener?.("message", receive);
      window.removeEventListener?.("resize", reportSize);
      motion?.removeEventListener?.("change", applyMotion);
    },
    fail(message: string): void {
      window.parent.postMessage({ type: "loom-spatial-error", message }, window.location.origin);
    },
  };
}
