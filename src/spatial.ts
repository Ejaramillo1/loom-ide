import { invoke, isTauri } from "@tauri-apps/api/core";

export function installSpatialWorkbench() {
  const frame = document.querySelector<HTMLIFrameElement>("#spatial-frame")!;
  const status = document.querySelector<HTMLElement>("#spatial-status")!;
  const loadError = document.querySelector<HTMLElement>("#spatial-load-error")!;
  const loadButton = document.querySelector<HTMLButtonElement>("#spatial-load")!;
  function load() {
    loadError.hidden = true;
    frame.src = "/spatial-player.html";
  }
  loadButton.addEventListener("click", load);
  let saving = false;
  window.addEventListener("message", async (event) => {
    if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
    if (event.data?.type === "loom-spatial-ready") {
      loadError.hidden = true;
      return;
    }
    if (event.data?.type === "loom-spatial-error" && typeof event.data.message === "string") {
      status.textContent = event.data.message;
      loadError.hidden = false;
      return;
    }
    if (event.data?.type !== "loom-memory") return;
    if (saving) return;
    saving = true;
    let message: string;
    let body = "";
    let ok = false;
    const { action, object } = event.data;
    try {
      if (!isTauri()) throw new Error("Open Loom in Tauri to use your vault.");
      if (typeof object !== "string" || (action !== "read" && action !== "save")) throw new Error("Invalid memory request");
      if (action === "read") {
        body = await invoke<string>("read_spatial_memory", { object });
        message = body ? "Latest memory from your vault." : "No memory yet. Leave a thought here.";
      } else {
        if (typeof event.data.body !== "string") throw new Error("Invalid memory");
        await invoke("save_spatial_memory", { object, body: event.data.body });
        message = "Saved to Living Workbench vault.";
      }
      ok = true;
    } catch (error) { message = `Could not ${action === "read" ? "open" : "save"}: ${String(error)}`; }
    saving = false;
    frame.contentWindow?.postMessage({ type: "loom-memory-result", action, ok, body, message }, location.origin);
  });
  void load();
}
