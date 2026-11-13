import { afterEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { installSpatialWorkbench } from "./spatial";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("accepts only its embedded player and reports vault read/save failures", async () => {
  let receive: (event: unknown) => Promise<void>;
  const player = { postMessage: vi.fn() };
  const frame = { contentWindow: player, addEventListener: vi.fn() };
  const status = { textContent: "" };
  const load = { addEventListener: vi.fn() };
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal("document", { querySelector: (selector: string) => selector === "#spatial-frame" ? frame : selector === "#spatial-status" ? status : load });
  vi.stubGlobal("window", { addEventListener: (_: string, handler: typeof receive) => { receive = handler; } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "createUnityInstance" }));
  installSpatialWorkbench();
  const event = { source: player, origin: "http://localhost", data: { type: "loom-memory", action: "read", object: "Notes" } };
  await receive!({ ...event, origin: "http://elsewhere" });
  await receive!({ ...event, source: {} });
  expect(invoke).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledWith("/spatial/index.html");
  expect(frame).toHaveProperty("src", "/spatial/index.html");
  expect(load).toHaveProperty("hidden", true);
  vi.mocked(invoke).mockResolvedValueOnce("a saved idea");
  await receive!(event);
  expect(player.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ ok: true, body: "a saved idea" }), "http://localhost");
  vi.mocked(invoke).mockRejectedValueOnce("disk full");
  await receive!({ ...event, data: { ...event.data, action: "save", body: "new idea" } });
  expect(player.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ ok: false, message: "Could not save: disk full" }), "http://localhost");
});
