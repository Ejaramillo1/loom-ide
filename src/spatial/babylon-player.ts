// Entry point for the Babylon spatial player iframe. Builds the scene and
// wires the postMessage bridge; mirrors spatial-player.js' load/ready/error
// flow.

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
  bridge.ready();
  if (loading) loading.hidden = true;
} catch (error) {
  const message = String(error);
  if (status) status.textContent = `Could not start the bench: ${message}`;
  window.parent.postMessage({ type: "loom-spatial-error", message }, window.location.origin);
}
