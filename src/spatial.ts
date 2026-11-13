import { invoke, isTauri } from "@tauri-apps/api/core";

export function installSpatialWorkbench() {
  const frame = document.querySelector<HTMLIFrameElement>("#spatial-frame")!;
  const status = document.querySelector<HTMLElement>("#spatial-status")!;
  const loadError = document.querySelector<HTMLElement>("#spatial-load-error")!;
  frame.addEventListener("load", () => {
    const doc = frame.contentDocument;
    if (!doc?.querySelector("#unity-canvas")) return;
    const style = doc.createElement("style");
    style.textContent = "html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#10121f}#unity-container{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;transform:none!important}#unity-canvas{width:100%!important;height:100%!important}#unity-footer{display:none}";
    doc.head.append(style);
  });
  let loaded = false;
  const loadButton = document.querySelector<HTMLButtonElement>("#spatial-load")!;
  async function load() {
    if (loaded) return;
    loaded = true;
    loadError.hidden = true;
    try {
      const response = await fetch("/spatial/index.html");
      if (!response.ok || !(await response.text()).includes("createUnityInstance")) throw new Error("Build the Unity WebGL player first (see the Unity README).");
      frame.src = "/spatial/index.html";
    } catch (error) {
      loaded = false;
      status.textContent = String(error);
      loadError.hidden = false;
    }
  }
  loadButton.addEventListener("click", load);
  let saving = false;
  window.addEventListener("message", async (event) => {
    if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
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
