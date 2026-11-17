import { afterEach, expect, it, vi } from "vitest";
import { startSpatialPlayer } from "../public/spatial-player.js";

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const loading = { hidden: false };
  const status = { textContent: "Starting the bench…" };
  const canvas = {};
  const loader = { src: "", onload: async () => {}, onerror: () => {} };
  const postMessage = vi.fn();
  const parent = { postMessage };
  const listeners: Record<string, (event: unknown) => void> = {};
  const createUnityInstance = vi.fn();
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal("window", { parent, createUnityInstance, addEventListener: (type: string, handler: (event: unknown) => void) => { listeners[type] = handler; } });
  vi.stubGlobal("document", {
    querySelector: (selector: string) => selector === "#unity-canvas" ? canvas : selector === "#bench-loading" ? loading : status,
    createElement: () => loader,
    head: { append: vi.fn() },
  });
  return { loading, status, loader, postMessage, parent, listeners, createUnityInstance };
}

it("keeps the loading sphere visible at 100% until Unity actually resolves", async () => {
  const { loading, status, loader, postMessage, createUnityInstance } = setup();
  let ready: () => void;
  createUnityInstance.mockImplementation((_canvas, _config, progress) => {
    progress(1);
    return new Promise<void>(resolve => { ready = resolve; });
  });
  startSpatialPlayer();
  expect(loader.src).toBe("/spatial/Build/spatial.loader.js");
  const starting = loader.onload();
  expect(status.textContent).toBe("Preparing the bench…");
  expect(loading.hidden).toBe(false);
  expect(postMessage).not.toHaveBeenCalled();
  ready!();
  await starting;
  expect(loading.hidden).toBe(true);
  expect(postMessage).toHaveBeenCalledWith({ type: "loom-spatial-ready" }, "http://localhost");
});

it("reports runtime failure without marking Unity ready", async () => {
  const { loader, postMessage, createUnityInstance } = setup();
  createUnityInstance.mockRejectedValue(new Error("WebGL unavailable"));
  startSpatialPlayer();
  await loader.onload();
  expect(postMessage).toHaveBeenCalledTimes(1);
  expect(postMessage).toHaveBeenCalledWith({ type: "loom-spatial-error", message: "Error: WebGL unavailable" }, "http://localhost");
});

it("tells Unity the shell theme once the player is ready", async () => {
  const { loader, createUnityInstance } = setup();
  const sendMessage = vi.fn();
  createUnityInstance.mockResolvedValue({ SendMessage: sendMessage });
  startSpatialPlayer();
  await loader.onload();
  expect(sendMessage).toHaveBeenCalledWith("Resolute Workbench", "ApplyTheme", "dark");
});

it("reports a missing loader so the app can offer Retry", () => {
  const { loader, postMessage } = setup();
  startSpatialPlayer();
  loader.onerror();
  expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "loom-spatial-error" }), "http://localhost");
});

it("forwards vault counts to Unity and flushes a push sent before load", async () => {
  const { loader, parent, listeners, createUnityInstance } = setup();
  const sendMessage = vi.fn();
  createUnityInstance.mockResolvedValue({ SendMessage: sendMessage });
  startSpatialPlayer();
  const vault = (work: unknown, experiments: unknown) => ({ source: parent, origin: "http://localhost", data: { type: "loom-vault-changed", work, experiments } });
  listeners.message(vault(2, 1));
  expect(sendMessage).not.toHaveBeenCalled();
  await loader.onload();
  expect(sendMessage).toHaveBeenCalledWith("Resolute Workbench", "ApplyTheme", "dark");
  expect(sendMessage).toHaveBeenCalledWith("Resolute Workbench", "RefreshVault", JSON.stringify({ work: 2, experiments: 1 }));
  sendMessage.mockClear();
  listeners.message(vault(3, 1));
  expect(sendMessage).toHaveBeenCalledWith("Resolute Workbench", "RefreshVault", JSON.stringify({ work: 3, experiments: 1 }));
  listeners.message(vault("3", 1));
  expect(sendMessage).toHaveBeenCalledTimes(1);
  listeners.message({ ...vault(4, 1), origin: "http://elsewhere" });
  expect(sendMessage).toHaveBeenCalledTimes(1);
});

it("applies a theme change sent before load once Unity is ready", async () => {
  const { loader, parent, listeners, createUnityInstance } = setup();
  const sendMessage = vi.fn();
  createUnityInstance.mockResolvedValue({ SendMessage: sendMessage });
  startSpatialPlayer();
  const theme = (name: string) => ({ source: parent, origin: "http://localhost", data: { type: "loom-theme", theme: name } });
  listeners.message(theme("white"));
  listeners.message(theme("dark"));
  listeners.message(theme("white"));
  expect(sendMessage).not.toHaveBeenCalled();
  await loader.onload();
  expect(sendMessage.mock.calls.filter(call => call[1] === "ApplyTheme")).toHaveLength(1);
  expect(sendMessage).toHaveBeenCalledWith("Resolute Workbench", "ApplyTheme", "white");
});

it("queues the latest valid sphere state and accepts state only from its host", async () => {
  const { loader, parent, listeners, createUnityInstance } = setup();
  const sendMessage = vi.fn(); createUnityInstance.mockResolvedValue({ SendMessage: sendMessage });
  startSpatialPlayer();
  const state = (value: string) => ({ source: parent, origin: "http://localhost", data: { type: "loom-state", state: value } });
  listeners.message(state("executing")); listeners.message(state("attention"));
  listeners.message(state("invalid")); listeners.message({ ...state("error"), origin: "http://foreign" });
  await loader.onload();
  expect(sendMessage).toHaveBeenCalledWith("Resolute Workbench", "ApplyLoomState", "attention");
  sendMessage.mockClear(); listeners.message(state("completed"));
  expect(sendMessage).toHaveBeenCalledWith("Resolute Workbench", "ApplyLoomState", "completed");
});

it("applies the default background on load and a chosen one pushed before or after", async () => {
  const { loader, parent, listeners, createUnityInstance } = setup();
  const sendMessage = vi.fn(); createUnityInstance.mockResolvedValue({ SendMessage: sendMessage });
  startSpatialPlayer();
  const background = (id: string) => ({ source: parent, origin: "http://localhost", data: { type: "loom-background", background: id } });
  listeners.message(background("night"));
  expect(sendMessage).not.toHaveBeenCalled();
  await loader.onload();
  expect(sendMessage).toHaveBeenCalledWith("Resolute Workbench", "ApplyBackground", "night");
  sendMessage.mockClear();
  listeners.message(background("moss"));
  expect(sendMessage).toHaveBeenCalledWith("Resolute Workbench", "ApplyBackground", "moss");
  listeners.message({ ...background("dusk"), origin: "http://foreign" });
  expect(sendMessage).toHaveBeenCalledTimes(1);
});
