# 06 — Unity and spatial audit

## Inspected path

`src/main.ts` installs `installSpatialWorkbench`; `src/spatial.ts` eagerly sets the local player iframe URL. `public/spatial-player.js` loads generated WebGL assets, creates Unity, applies motion/theme/state/counts, measures canvas size and posts ready/error. Unity `Assets/Loom/MemoryPalaceController.cs` creates the bench, raycasts child colliders to a MemoryAnchor and calls `LoomNavigate(selected.Key)` in WebGL. `Assets/Loom/Plugins/LoomVault.jslib` posts loom-spatial-select to the parent. The host routes Notes/Work/Code/Experiment/Agents/Evidence into existing HTML views.

This is meaningful host navigation, not direct Loom intelligence. Generic portal clicks choose a domain, not a backend work/agent/session ID. Do not claim object-level backend selection simply because a view opens. Notes editing is now in Tauri. The old LoomMemory function still exists in the plugin but current host intentionally ignores its retired note channel; this is retained historical code, not a current save feature.

## Contract and security findings

Both message directions check `event.source` and exact same-origin equality. Host selection accepts a string then routes through known domains; player state values are allowlisted. Counts and strings have type checks. The iframe is same-origin trusted code, not an isolation boundary against malicious local code; Tauri CSP is null and no exploitation claim was established. Keep origin/source checks and avoid widening them to wildcard origins for convenience.

The player queues theme/state/count messages before load and applies them on readiness; theme toggles and reduced-motion changes propagate. Quality messages are applied only after Unity is ready rather than queued: a choice made during startup may be lost. This is a source-observed low-priority edge, not a release-blocking integration failure; verify alongside startup before adding another settings abstraction. No extra implementation issue is opened for this minor observation.

Vault/work/experiment counts come from host records. Unity does not query remote memory, run tools or control agents; it is not expected to. Sphere color is driven by the host state resolver and ApplyLoomState. It reflects frontend knowledge of reachability/attention/activity, not all server jobs; false stream completion propagates to it (QC-04). No new sphere semantics or Q2 fallback are proposed.

## Build, rendering and resources

Unity recompile command succeeded with **up_to_date**, 0 errors/0 warnings. This is not a new WebGL compilation. Existing generated assets exist and npm build copied identical bytes to dist: wasm **25,530,904 bytes**, data **7,620,193 bytes**, framework **331,271 bytes**, loader **27,914 bytes**. [SHA-256 comparisons](evidence/player-assets.json) prove copying, not that the player was built from the pinned C# source.

Source includes quality tiers, capped DPR, dynamic camera aspect, URP lighting/post-processing, colliders/link.xml, shader preservation and reduced-motion handling. Previous Editor geometry/capture reports are historical evidence. They were not rerun or promoted to current live WebGL evidence. The browser inspection attempt timed out before a page/screenshot could be observed. No native Tauri surface was exposed by CUA. Therefore portal navigation inside the current packaged WebView, frame-time/GPU use, light/dark pixels and current player/source parity are NOT VERIFIED.

The iframe is retained across HTML view changes; no player Quit/explicit hidden-view suspension path was found in inspected host/player code. It may continue rendering while not visible. Measure that on hardware before calling it a performance defect; tiers and DPR do not establish a frame budget. Retry replaces the frame; normal browser unload cleanup was not profiled. Source remains runtime-built; baked GI/probes are explicitly deferred and are not integration defects.

## Required live acceptance

1. Open the actual Tauri window; verify Unity-first loading/ready/error/retry without another view flashing.
2. Select all six portals and a real work/note where applicable; verify the host's visible selection and keyboard alternative.
3. Change actual work/experiment counts and external vault relations; verify updates without manual refresh or lost drafts (QC-18).
4. Exercise theme/motion/quality during and after loading, resize the narrow center column, and verify readable controls.
5. Execute a contained Loom success/error/approval/stop through the host and compare sphere/text to authoritative backend events.
6. Measure foreground/hidden CPU/GPU/frame time and repeated Retry resource cleanup.

Keep the central sphere and keep Q2 deferred. Blocking reasons are environment/evidence gaps, not permission to implement a fallback or redesign the bench.
