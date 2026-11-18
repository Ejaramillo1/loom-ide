// Entry point for the Babylon spatial player iframe. Builds the scene and
// wires the postMessage bridge; mirrors spatial-player.js' load/ready/error
// flow.

import "@babylonjs/core/Culling/ray";
import { createBench } from "./bench";
import { startSpatialBridge } from "./bridge";

const canvas = document.querySelector<HTMLCanvasElement>("#babylon-canvas")!;
const loading = document.querySelector<HTMLElement>("#bench-loading");
const status = document.querySelector<HTMLElement>("#bench-loading-text");

function themeFromParams(): "white" | "dark" {
  return new URLSearchParams(location.search).get("theme") === "white" ? "white" : "dark";
}
function backgroundFromParams(): string {
  return new URLSearchParams(location.search).get("background") || "charcoal";
}

try {
  if (status) status.textContent = "Starting the bench…";
  // The bench is built before the bridge listens, so no message can be
  // dropped; the bridge still holds a pending queue for safety.
  const bench = createBench(canvas);
  const bridge = startSpatialBridge(
    { window, document, canvas, themeFromParams, backgroundFromParams },
    bench,
    () => window.parent.postMessage({ type: "loom-spatial-ready" }, window.location.origin),
  );
  if (status) status.textContent = "Preparing the bench…";
  const dispose = () => { bridge.dispose(); bench.dispose(); };
  window.addEventListener("pagehide", dispose, { once: true });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    bridge.fail("The graphics context was lost. Reload the spatial view to recover.");
    dispose();
  }, { once: true });
  const fail = (error: unknown) => {
    const message = `Could not render the sphere: ${String(error)}`;
    if (status) status.textContent = message;
    if (loading) loading.hidden = false;
    bridge.fail(message);
    dispose();
  };
  const overview = () => window.parent.postMessage({ type: "loom-spatial-select", object: "Overview" }, location.origin);
  canvas.addEventListener("click", event => {
    const rect = canvas.getBoundingClientRect();
    if (bench.scene.pick(event.clientX - rect.left, event.clientY - rect.top)?.hit) overview();
  });
  canvas.setAttribute("role", "button");
  canvas.setAttribute("aria-label", "Return to Overview");
  canvas.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); overview(); }
  });
  void bench.ready.then(() => {
    bridge.ready();
    if (loading) loading.hidden = true;
  }).catch(fail);
} catch (error) {
  const message = String(error);
  if (status) status.textContent = `Could not start the bench: ${message}`;
  window.parent.postMessage({ type: "loom-spatial-error", message }, window.location.origin);
}
