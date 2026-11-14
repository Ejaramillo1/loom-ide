export function startSpatialPlayer() {
  const loading = document.querySelector("#bench-loading");
  const status = document.querySelector("#bench-loading-text");
  const canvas = document.querySelector("#unity-canvas");
  const theme = new URLSearchParams(location.search).get("theme") === "white" ? "white" : "dark";
  if (document.body) document.body.dataset.theme = theme;
  let unityInstance = null;
  let failed = false;
  // Vault counts pushed before the player is ready: flushed once it loads.
  let pendingVault = null;
  // Theme changes sent before the player is ready: the latest one wins and
  // is applied once Unity loads, so a toggle during load is not lost.
  let pendingTheme = null;
  let pendingState = null;
  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const applyMotion = () => unityInstance?.SendMessage?.("Resolute Workbench", "ApplyReducedMotion", motion?.matches ? "true" : "false");
  motion?.addEventListener?.("change", applyMotion);
  window.addEventListener?.("message", (event) => {
    if (event.source !== window.parent || event.origin !== location.origin) return;
    if (event.data?.type === "loom-state" && ["idle", "listening", "processing", "executing", "exploring", "attention", "completed", "error"].includes(event.data.state)) {
      if (unityInstance) unityInstance.SendMessage("Resolute Workbench", "ApplyLoomState", event.data.state);
      else pendingState = event.data.state;
    }
    if (event.data?.type === "loom-theme" && typeof event.data.theme === "string") {
      const next = event.data.theme === "white" ? "white" : "dark";
      if (document.body) document.body.dataset.theme = next;
      if (unityInstance) unityInstance.SendMessage("Resolute Workbench", "ApplyTheme", next);
      else pendingTheme = next;
    }
    if (event.data?.type === "loom-vault-changed" && typeof event.data.work === "number" && typeof event.data.experiments === "number") {
      const payload = JSON.stringify({ work: event.data.work, experiments: event.data.experiments });
      if (unityInstance) unityInstance.SendMessage("Resolute Workbench", "RefreshVault", payload);
      else pendingVault = payload;
    }
  });
  function fail(error) {
    failed = true;
    const message = String(error);
    status.textContent = `Could not start the bench: ${message}`;
    loading.hidden = window.parent !== window;
    window.parent.postMessage({ type: "loom-spatial-error", message }, location.origin);
  }
  const loader = document.createElement("script");
  loader.src = "/spatial/Build/spatial.loader.js";
  loader.onerror = () => fail("Unity player unavailable. Build the WebGL player and try again.");
  loader.onload = async () => {
    try {
      if (typeof window.createUnityInstance !== "function") throw new Error("Unity player unavailable. Build the WebGL player and try again.");
      unityInstance = await window.createUnityInstance(canvas, {
        dataUrl: "/spatial/Build/spatial.data",
        frameworkUrl: "/spatial/Build/spatial.framework.js",
        codeUrl: "/spatial/Build/spatial.wasm",
        streamingAssetsUrl: "/spatial/StreamingAssets",
        companyName: "Loom",
        productName: "Resolute Workbench",
        productVersion: "0.1.0",
        showBanner: (message, type) => {
          if (type === "error") fail(message);
          else console.warn(message);
        },
      }, (progress) => {
        if (!failed) status.textContent = progress < 1
          ? `Starting the bench… ${Math.round(progress * 100)}%`
          : "Preparing the bench…";
      });
      if (failed) return;
      loading.hidden = true;
      unityInstance?.SendMessage?.("Resolute Workbench", "ApplyTheme", pendingTheme ?? theme);
      pendingTheme = null;
      applyMotion();
      if (pendingState) unityInstance?.SendMessage?.("Resolute Workbench", "ApplyLoomState", pendingState);
      pendingState = null;
      if (pendingVault) {
        unityInstance?.SendMessage?.("Resolute Workbench", "RefreshVault", pendingVault);
        pendingVault = null;
      }
      window.parent.postMessage({ type: "loom-spatial-ready" }, location.origin);
    } catch (error) { fail(error); }
  };
  document.head.append(loader);
}
