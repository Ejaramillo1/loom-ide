import { afterEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { installSpatialWorkbench, notifySpatialVaultChanged, notifySpatialBackground } from "./spatial";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("accepts only its embedded player and ignores the retired memory channel", async () => {
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
  // The retired loom-memory note channel is ignored (notes are edited in
  // the Tauri Notes view now); it must never reach a command.
  const event = { source: player, origin: "http://localhost", data: { type: "loom-memory", action: "read", object: "Notes" } };
  await receive!({ ...event, origin: "http://elsewhere" });
  await receive!({ ...event, source: {} });
  await receive!(event);
  expect(invoke).not.toHaveBeenCalled();
  expect(player.postMessage).not.toHaveBeenCalled();
  expect(frame).toHaveProperty("src", "/spatial-player-babylon.html?theme=dark&background=charcoal");
  expect(loadError.hidden).toBe(true);
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
  expect(frame).toHaveProperty("src", "/spatial-player-babylon.html?theme=dark&background=charcoal");
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
  expect(frame).toHaveProperty("src", "/spatial-player-babylon.html?theme=white&background=charcoal");
});

it("carries the chosen background into the player URL and re-pushes it on ready", async () => {
  let receive: (event: unknown) => Promise<void>;
  const player = { postMessage: vi.fn() };
  const frame = { contentWindow: player, addEventListener: vi.fn() };
  const status = { textContent: "" };
  const loadError = { hidden: true };
  const load = { addEventListener: vi.fn() };
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal("document", { documentElement: { dataset: {} }, querySelector: (selector: string) => selector === "#spatial-frame" ? frame : selector === "#spatial-status" ? status : selector === "#spatial-load-error" ? loadError : load });
  vi.stubGlobal("window", { addEventListener: (_: string, handler: typeof receive) => { receive = handler; } });
  installSpatialWorkbench(undefined, undefined, undefined, () => "dusk");
  expect(frame).toHaveProperty("src", "/spatial-player-babylon.html?theme=dark&background=dusk");
  notifySpatialBackground("night");
  expect(player.postMessage).toHaveBeenCalledWith({ type: "loom-background", background: "night" }, "http://localhost");
  player.postMessage.mockClear();
  await receive!({ source: player, origin: "http://localhost", data: { type: "loom-spatial-ready" } });
  expect(player.postMessage).toHaveBeenCalledWith({ type: "loom-background", background: "dusk" }, "http://localhost");
});

it("falls back to the Unity player behind ?player=unity", () => {
  const frame = { contentWindow: {}, addEventListener: vi.fn() };
  const status = { textContent: "" };
  const loadError = { hidden: true };
  const load = { addEventListener: vi.fn() };
  vi.stubGlobal("document", { querySelector: (selector: string) => selector === "#spatial-frame" ? frame : selector === "#spatial-status" ? status : selector === "#spatial-load-error" ? loadError : load });
  vi.stubGlobal("location", { origin: "http://localhost", search: "?player=unity" });
  vi.stubGlobal("window", { addEventListener: () => {} });
  installSpatialWorkbench();
  expect(frame).toHaveProperty("src", "/spatial-player.html?theme=dark&background=charcoal");
});
