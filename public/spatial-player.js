export function startSpatialPlayer() {
  const loading = document.querySelector("#bench-loading");
  const status = document.querySelector("#bench-loading-text");
  const canvas = document.querySelector("#unity-canvas");
  let failed = false;
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
      await window.createUnityInstance(canvas, {
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
      window.parent.postMessage({ type: "loom-spatial-ready" }, location.origin);
    } catch (error) { fail(error); }
  };
  document.head.append(loader);
}
