import { describe, expect, it, vi } from "vitest";
import { startSpatialBridge, type BenchApi, type BridgeEnv } from "./bridge";

function fakeEnv() {
  const listeners: Record<string, ((e: any) => void)[]> = {};
  const posted: { type: string; message?: string }[] = [];
  const body = { dataset: {} as Record<string, string> } as unknown as Document["body"];
  const canvas = {
    getBoundingClientRect: () => ({ width: 401.6, height: 800 }),
  } as unknown as HTMLElement;
  const media = { matches: false, addEventListener: vi.fn() };
  const parent = { postMessage: (msg: any) => posted.push(msg) };
  const window = {
    parent,
    location: { origin: "http://localhost:1420" },
    addEventListener: (t: string, f: any) => (listeners[t] ??= []).push(f),
    removeEventListener: vi.fn(),
    matchMedia: () => media,
    postMessage: (msg: any, _origin: string) => posted.push(msg),
  } as unknown as Window;

  const env: BridgeEnv = {
    window,
    document: { body } as unknown as Document,
    canvas,
    themeFromParams: () => "dark",
    backgroundFromParams: () => "charcoal",
  };

  const api: BenchApi = {
    applyLoomState: vi.fn(),
    applyTheme: vi.fn(),
    applyBackground: vi.fn(),
    refreshVault: vi.fn(),
    applyQuality: vi.fn(),
    applyCanvasSize: vi.fn(),
    applyReducedMotion: vi.fn(),
  };

  const dispatch = (data: unknown, origin = "http://localhost:1420") => {
    for (const f of listeners["message"] ?? []) f({ source: parent, origin, data });
  };

  return { env, api, dispatch, posted, media };
}

describe("spatial bridge (postMessage contract)", () => {
  it("queues a state sent before ready and flushes it on ready", () => {
    const { env, api, dispatch } = fakeEnv();
    const ready = vi.fn();
    const bridge = startSpatialBridge(env, api, ready);
    dispatch({ type: "loom-state", state: "error" });
    expect(api.applyLoomState).not.toHaveBeenCalled();
    bridge.ready();
    expect(api.applyLoomState).toHaveBeenCalledWith("error");
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it("latest theme/background wins before ready; applied after", () => {
    const { env, api, dispatch } = fakeEnv();
    const bridge = startSpatialBridge(env, api, vi.fn());
    dispatch({ type: "loom-theme", theme: "white" });
    dispatch({ type: "loom-theme", theme: "dark" });
    dispatch({ type: "loom-background", background: "dusk" });
    bridge.ready();
    expect(api.applyTheme).toHaveBeenCalledWith("dark");
    expect(api.applyBackground).toHaveBeenCalledWith("dusk");
  });

  it("queues vault counts and flushes them on ready", () => {
    const { env, api, dispatch } = fakeEnv();
    const bridge = startSpatialBridge(env, api, vi.fn());
    dispatch({ type: "loom-vault-changed", work: 3, experiments: 5 });
    bridge.ready();
    expect(api.refreshVault).toHaveBeenCalledWith(3, 5);
  });

  it("quality before ready is retained for renderer startup", () => {
    const { env, api, dispatch } = fakeEnv();
    const bridge = startSpatialBridge(env, api, vi.fn());
    dispatch({ type: "loom-quality", tier: "Low" });
    bridge.ready();
    expect(api.applyQuality).toHaveBeenCalledWith("Low");
  });

  it("applies theme/background defaults from params on ready", () => {
    const { env, api } = fakeEnv();
    const bridge = startSpatialBridge(env, api, vi.fn());
    bridge.ready();
    expect(api.applyTheme).toHaveBeenCalledWith("dark");
    expect(api.applyBackground).toHaveBeenCalledWith("charcoal");
  });

  it("reports the measured canvas size on ready", () => {
    const { env, api } = fakeEnv();
    const bridge = startSpatialBridge(env, api, vi.fn());
    bridge.ready();
    expect(api.applyCanvasSize).toHaveBeenCalledWith(402, 800);
  });

  it("applies reduced motion on ready and on change", () => {
    const { env, api, media } = fakeEnv();
    const bridge = startSpatialBridge(env, api, vi.fn());
    bridge.ready();
    expect(api.applyReducedMotion).toHaveBeenCalledWith(false);
    media.matches = true;
    (media.addEventListener as ReturnType<typeof vi.fn>).mock.calls[0][1]();
    expect(api.applyReducedMotion).toHaveBeenCalledWith(true);
  });

  it("ignores messages from the wrong source or origin", () => {
    const { env, api, dispatch } = fakeEnv();
    startSpatialBridge(env, api, vi.fn());
    dispatch({ type: "loom-state", state: "error" }, "http://evil.example");
    expect(api.applyLoomState).not.toHaveBeenCalled();
  });

  it("fail() posts loom-spatial-error with the message", () => {
    const { env, api, posted } = fakeEnv();
    const bridge = startSpatialBridge(env, api, vi.fn());
    bridge.fail("boom");
    expect(posted).toEqual([{ type: "loom-spatial-error", message: "boom" }]);
  });

  it("applies a valid state immediately once ready", () => {
    const { env, api, dispatch } = fakeEnv();
    const bridge = startSpatialBridge(env, api, vi.fn());
    bridge.ready();
    dispatch({ type: "loom-state", state: "attention" });
    expect(api.applyLoomState).toHaveBeenCalledWith("attention");
  });

  it("ignores unknown message types (including retired loom-memory)", () => {
    const { env, api, dispatch } = fakeEnv();
    const bridge = startSpatialBridge(env, api, vi.fn());
    bridge.ready();
    dispatch({ type: "loom-memory", note: "x" });
    dispatch({ type: "not-a-message" });
    expect(api.applyLoomState).not.toHaveBeenCalled();
    expect(api.refreshVault).not.toHaveBeenCalled();
  });

  it("rejects non-object payloads and oversized fields", () => {
    const { env, api, dispatch } = fakeEnv();
    const bridge = startSpatialBridge(env, api, vi.fn());
    bridge.ready();
    dispatch("a plain string" as unknown as Record<string, unknown>);
    dispatch({ type: "loom-state", state: "e".repeat(64) });
    dispatch({ type: "loom-background", background: "x".repeat(64) });
    expect(api.applyLoomState).not.toHaveBeenCalled();
    // ready() applied the default background once; the oversized one must not
    // add a second call.
    expect(api.applyBackground).toHaveBeenCalledTimes(1);
    expect(api.applyBackground).toHaveBeenCalledWith("charcoal");
  });

  it("rejects an invalid theme value", () => {
    const { env, api, dispatch } = fakeEnv();
    const bridge = startSpatialBridge(env, api, vi.fn());
    bridge.ready();
    dispatch({ type: "loom-theme", theme: "sepia" });
    expect(api.applyTheme).toHaveBeenCalledTimes(1);
    expect(api.applyTheme).toHaveBeenCalledWith("dark");
  });

  it("clamps negative finite vault counts to zero (Unity parity)", () => {
    const { env, api, dispatch } = fakeEnv();
    const bridge = startSpatialBridge(env, api, vi.fn());
    bridge.ready();
    dispatch({ type: "loom-vault-changed", work: -3, experiments: 5 });
    expect(api.refreshVault).toHaveBeenCalledWith(0, 5);
  });

  it("rejects non-finite vault counts", () => {
    const { env, api, dispatch } = fakeEnv();
    const bridge = startSpatialBridge(env, api, vi.fn());
    bridge.ready();
    dispatch({ type: "loom-vault-changed", work: Number.NaN, experiments: 5 });
    expect(api.refreshVault).not.toHaveBeenCalled();
  });
});

it("disposal removes listeners and prevents later messages or ready", () => {
 const {env,api,dispatch}=fakeEnv();
 const ready=vi.fn();
 const bridge=startSpatialBridge(env,api,ready);
 bridge.dispose();
 dispatch({type:"loom-state",state:"error"});
 bridge.ready();
 expect(api.applyLoomState).not.toHaveBeenCalled();
 expect(ready).not.toHaveBeenCalled();
 expect(env.window.removeEventListener).toHaveBeenCalledWith("message",expect.any(Function));
});
