import { afterEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { installSpatialWorkbench, notifySpatialVaultChanged } from "./spatial";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("accepts only its embedded player and reports vault read/save failures", async () => {
  let receive: (event: unknown) => Promise<void>;
  const player = { postMessage: vi.fn() };
  const frame = { contentWindow: player, addEventListener: vi.fn() };
  const status = { textContent: "" };
  const loadError = { hidden: true };
  const load = { addEventListener: vi.fn() };
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal("document", { querySelector: (selector: string) => selector === "#spatial-frame" ? frame : selector === "#spatial-status" ? status : selector === "#spatial-load-error" ? loadError : load });
  vi.stubGlobal("window", { addEventListener: (_: string, handler: typeof receive) => { receive = handler; } });
  installSpatialWorkbench();
  const event = { source: player, origin: "http://localhost", data: { type: "loom-memory", action: "read", object: "Notes" } };
  await receive!({ ...event, origin: "http://elsewhere" });
  await receive!({ ...event, source: {} });
  expect(invoke).not.toHaveBeenCalled();
  expect(frame).toHaveProperty("src", "/spatial-player.html?theme=dark");
  expect(loadError.hidden).toBe(true);
  vi.mocked(invoke).mockResolvedValueOnce("a saved idea");
  await receive!(event);
  expect(player.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ ok: true, body: "a saved idea" }), "http://localhost");
  vi.mocked(invoke).mockRejectedValueOnce("disk full");
  await receive!({ ...event, data: { ...event.data, action: "save", body: "new idea" } });
  expect(player.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ ok: false, message: "Could not save: disk full" }), "http://localhost");
});

it("accepts loading failures only from its player and lets the user retry", async () => {
  let receive: (event: unknown) => Promise<void>;
  const frame = { contentWindow: {}, addEventListener: vi.fn() };
  const status = { textContent: "" };
  const loadError = { hidden: true };
  const load = { addEventListener: vi.fn() };
  vi.stubGlobal("document", { querySelector: (selector: string) => selector === "#spatial-frame" ? frame : selector === "#spatial-status" ? status : selector === "#spatial-load-error" ? loadError : load });
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal("window", { addEventListener: (_: string, handler: typeof receive) => { receive = handler; } });
  installSpatialWorkbench();
  const event = { source: frame.contentWindow, origin: "http://localhost", data: { type: "loom-spatial-error", message: "Unity failed to start" } };
  await receive!({ ...event, source: {} });
  expect(loadError.hidden).toBe(true);
  await receive!(event);
  expect(loadError.hidden).toBe(false);
  expect(status.textContent).toBe("Unity failed to start");
  await load.addEventListener.mock.calls[0][1]();
  expect(frame).toHaveProperty("src", "/spatial-player.html?theme=dark");
  expect(loadError.hidden).toBe(true);
});

it("forwards Unity portal selections to the host and ignores foreign ones", async () => {
  const onSelect = vi.fn();
  let receive: (event: unknown) => Promise<void>;
  const player = { postMessage: vi.fn() };
  const frame = { contentWindow: player, addEventListener: vi.fn() };
  const status = { textContent: "" };
  const loadError = { hidden: true };
  const load = { addEventListener: vi.fn() };
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal("document", { querySelector: (selector: string) => selector === "#spatial-frame" ? frame : selector === "#spatial-status" ? status : selector === "#spatial-load-error" ? loadError : load });
  vi.stubGlobal("window", { addEventListener: (_: string, handler: typeof receive) => { receive = handler; } });
  installSpatialWorkbench(onSelect);
  const event = { source: player, origin: "http://localhost", data: { type: "loom-spatial-select", object: "Work" } };
  await receive!({ ...event, origin: "http://elsewhere" });
  await receive!({ ...event, source: {} });
  expect(onSelect).not.toHaveBeenCalled();
  await receive!(event);
  expect(onSelect).toHaveBeenCalledWith("Work");
});

it("pushes vault counts to the bench on demand and when the player reports ready", async () => {
  let receive: (event: unknown) => Promise<void>;
  const player = { postMessage: vi.fn() };
  const frame = { contentWindow: player, addEventListener: vi.fn() };
  const status = { textContent: "" };
  const loadError = { hidden: true };
  const load = { addEventListener: vi.fn() };
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal("document", { querySelector: (selector: string) => selector === "#spatial-frame" ? frame : selector === "#spatial-status" ? status : selector === "#spatial-load-error" ? loadError : load });
  vi.stubGlobal("window", { addEventListener: (_: string, handler: typeof receive) => { receive = handler; } });
  installSpatialWorkbench(undefined, () => ({ work: 3, experiments: 1 }));
  notifySpatialVaultChanged(3, 1);
  expect(player.postMessage).toHaveBeenCalledWith({ type: "loom-vault-changed", work: 3, experiments: 1 }, "http://localhost");
  player.postMessage.mockClear();
  await receive!({ source: player, origin: "http://localhost", data: { type: "loom-spatial-ready" } });
  expect(player.postMessage).toHaveBeenCalledWith({ type: "loom-vault-changed", work: 3, experiments: 1 }, "http://localhost");
});

it("passes the White theme to the player when the shell is White", async () => {
  const frame = { contentWindow: {}, addEventListener: vi.fn() };
  const status = { textContent: "" };
  const loadError = { hidden: true };
  const load = { addEventListener: vi.fn() };
  vi.stubGlobal("document", { documentElement: { dataset: { theme: "white" } }, querySelector: (selector: string) => selector === "#spatial-frame" ? frame : selector === "#spatial-status" ? status : selector === "#spatial-load-error" ? loadError : load });
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal("window", { addEventListener: () => {} });
  installSpatialWorkbench();
  expect(frame).toHaveProperty("src", "/spatial-player.html?theme=white");
});
