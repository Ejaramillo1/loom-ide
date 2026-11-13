import { afterEach, expect, it, vi } from "vitest";
import { startSpatialPlayer } from "../public/spatial-player.js";

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const loading = { hidden: false };
  const status = { textContent: "Starting the bench…" };
  const canvas = {};
  const loader = { src: "", onload: async () => {}, onerror: () => {} };
  const postMessage = vi.fn();
  const createUnityInstance = vi.fn();
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal("window", { parent: { postMessage }, createUnityInstance });
  vi.stubGlobal("document", {
    querySelector: (selector: string) => selector === "#unity-canvas" ? canvas : selector === "#bench-loading" ? loading : status,
    createElement: () => loader,
    head: { append: vi.fn() },
  });
  return { loading, status, loader, postMessage, createUnityInstance };
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

it("reports a missing loader so the app can offer Retry", () => {
  const { loader, postMessage } = setup();
  startSpatialPlayer();
  loader.onerror();
  expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "loom-spatial-error" }), "http://localhost");
});
