import type { SphereState } from "./sphere";

export function installSpatialWorkbench(
  onSpatialSelect?: (object: string) => void,
  getVaultCounts?: () => { work: number; experiments: number },
  getState?: () => SphereState,
  getBackground?: () => string,
) {
  const frame = document.querySelector<HTMLIFrameElement>("#spatial-frame")!;
  const status = document.querySelector<HTMLElement>("#spatial-status")!;
  const loadError = document.querySelector<HTMLElement>("#spatial-load-error")!;
  const loadButton = document.querySelector<HTMLButtonElement>("#spatial-load")!;
  function load() {
    loadError.hidden = true;
    const theme = document.documentElement?.dataset?.theme === "white" ? "white" : "dark";
    const background = getBackground?.() || "charcoal";
    frame.src = `/spatial-player.html?theme=${theme}&background=${encodeURIComponent(background)}`;
  }
  loadButton.addEventListener("click", load);
  window.addEventListener("message", async (event) => {
    if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
    if (event.data?.type === "loom-spatial-ready") {
      loadError.hidden = true;
      // The bench shows real vault counts from the start, not just after
      // the first change: the WebGL player cannot read the vault itself.
      const counts = getVaultCounts?.();
      if (counts) notifySpatialVaultChanged(counts.work, counts.experiments);
      if (getState) notifySpatialState(getState());
      if (getBackground) notifySpatialBackground(getBackground());
      return;
    }
    if (event.data?.type === "loom-spatial-error" && typeof event.data.message === "string") {
      status.textContent = event.data.message;
      loadError.hidden = false;
      return;
    }
    if (event.data?.type === "loom-spatial-select" && typeof event.data.object === "string") {
      onSpatialSelect?.(event.data.object);
      return;
    }
    // Anything else from the player (including the retired loom-memory
    // note channel — editing now lives in the Tauri Notes view) is
    // deliberately ignored.
  });
  void load();
}

/** Push the vault's current work/experiment counts to the bench, so its
    portal descriptions update without a manual refresh (audit A5). The
    player forwards this to Unity's RefreshVault; a push sent before the
    player is ready is held and flushed on load. */
export function notifySpatialVaultChanged(work: number, experiments: number): void {
  const frame = document.querySelector<HTMLIFrameElement>("#spatial-frame");
  frame?.contentWindow?.postMessage({ type: "loom-vault-changed", work, experiments }, location.origin);
}

/** Connection and activity use the same rule in the header and on the bench. */
export function notifySpatialState(state: SphereState): void {
  const frame = document.querySelector<HTMLIFrameElement>("#spatial-frame");
  frame?.contentWindow?.postMessage({ type: "loom-state", state }, location.origin);
}

/** Push the chosen scene background (charcoal/dusk/moss/night) to the bench,
    so the skybox follows the Settings choice without a manual refresh. A push
    sent before the player is ready is held and flushed on load. */
export function notifySpatialBackground(background: string): void {
  const frame = document.querySelector<HTMLIFrameElement>("#spatial-frame");
  frame?.contentWindow?.postMessage({ type: "loom-background", background }, location.origin);
}
