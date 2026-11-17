# 06 — Unity and Spatial Audit

## 1. Architecture (verified)

```text
Tauri webview (index.html)
  └─ <iframe id="spatial-frame" src="/spatial-player.html?theme=…">
       ├─ spatial-player.js (host page: loads Unity loader, mediates)
       │    └─ Unity WebGL instance (spatial.loader.js / spatial.data /
       │       spatial.wasm 25.5 MB, URP, IL2CPP, WebGL 2.0)
       │       └─ Assets/Loom/MemoryPalaceController.cs  (single controller)
       │          └─ Assets/Loom/Plugins/LoomVault.jslib  (Unity→JS bridge)
       └─ postMessage bridge (validated both directions)
```

- The player is served same-origin from the bundled frontend
  (`public/spatial/` copied into `dist/` by Vite before packaging — the
  release process depends on this copy step, noted in DESIGN_PROGRESS).
- Host ↔ player messages: `loom-state`, `loom-theme`, `loom-vault-changed`,
  `loom-quality` (host→player); `loom-spatial-ready`,
  `loom-spatial-error`, `loom-spatial-select` (player→host).
- **Origin/source validation on both sides**: host checks
  `event.source === frame.contentWindow && event.origin === location.origin`
  (`spatial.ts:19`); player checks `event.source === window.parent &&
  event.origin === location.origin` (`spatial-player.js`). Unknown or
  retired channels are deliberately ignored (the old loom-memory note
  channel was removed when note editing moved into Tauri).
- The retired spatial-memory Rust bridge was unregistered; `spatial.rs`
  remains only with its tests (decision recorded).

## 2. What is real vs. decorative

| Element | Connected to real behavior? |
|---|---|
| Portal → navigation (Work / Code / Experiments / Evidence / Agents / Notes) | ✅ `loom-spatial-select` → `setMode(...)`; portals are colliders raycast in `MemoryPalaceController`; the WebGL collider-stripping bug (fixed via `link.xml`, recorded in DESIGN_PROGRESS) is guarded by the headless check (`colliderErrors: 0`) |
| Sphere states | ✅ pushed from `currentLoomState()` — derived from real app state: in-flight chat (`processing`), running workflow/experiment arms (`executing`), attention items/pending vault proposals (`attention`), connection loss (`error`), draft text (`listening`), completion (`completed`). Live-observed pill transition `Server reachable → Connected to Loom` in the CDP UI test |
| Vault counts on the bench | ✅ `loom-vault-changed` carries real work/experiment counts; pre-load pushes are queued and flushed on ready |
| Theme sync | ✅ `data-theme` → player `?theme=` + `ApplyTheme` on load and change |
| Quality tiers | ✅ View menu → `loom-quality` → URP asset switch (High/Balanced/Low: renderScale 1/0.85/0.75, MSAA 4/2/1, bloom off on Low) |
| Reduced motion | ✅ matchMedia in the player + `ApplyReducedMotion`; pauses dust motes and portal orbit |
| Camera framing | ✅ canvas-measured aspect drives the camera on load/resize (`ApplyCanvasSize`) |
| Water, dust, glass, PBR props | Decorative by design (`aria-hidden` water; documented) |

## 3. Verification evidence

- Unity C# recompile: clean (0 errors, 0 warnings) — executed this audit.
- Editor self-check (CheckWorkbench, Play Mode): 6 portals, 148 physical
  mesh parts, child selection, reduced motion, both themes, 3 camera
  aspects — recorded passes in `docs/checks/*.log` and DESIGN_PROGRESS.
- Headless WebGL check (`docs/headless-check.json`): HTTP 200, spatial
  view visible, **0 collider errors**, 0 console errors.
- Editor pixel captures exist (`docs/bench-shots/`, fixed 1280×548, light
  + dark + no-post) — the first pixel-level evidence of the bench.
- **Blocked:** real-window pixel check of the Tauri window (D14,
  environment permission) and a Unity-failure fallback panel (Q2,
  deferred decision). Reported as limitations, per audit rules.

## 4. Findings

1. **No Unity-failure fallback.** If the WebGL player cannot load, the
   host shows the load-error state with a retry button (good), but the
   user cannot continue without the bench in the Spatial view (Q2 remains
   an open decision). P3, decision-gated.
2. **Wasm weight.** 25.5 MB wasm + ~4.2 MB JS bundle (Monaco included).
   Cached by the webview after first load; the 3 s vault-signature poll
   and DPR cap keep steady-state cost low. P3, monitor.
3. **Bridge trust model.** The player page is same-origin bundled content;
   with `"csp": null` (issue 010) the iframe runs with full webview
   privileges. Hardening: add a CSP that allows only the bundled sources.
4. **Selection loop is one-way.** Portal clicks navigate the app; app-side
   selection does not highlight the corresponding bench object (no
   `loom-select` host→player message exists). Not required by any recorded
   decision; do not invent semantics (the philosophy explicitly forbids
   fabricating meanings for unresolved design decisions). P3, design note.
5. **State freshness.** The bench's sphere follows the shell's derived
   state, which is recomputed on UI events — a genuinely event-driven
   indicator, not a polled or animated fake. Confirmed in code and by the
   live pill observation.

## 5. Unity integration verdict

**FULLY INTEGRATED as a spatial interface to the application**: navigation
is real, state is real, synchronization is bidirectional, message
validation exists, and the self-checks are honest about what they do not
cover (pixel fidelity in the real window). The bench is not evidence of
Loom execution itself — it reflects the IDE's state, which is the correct
and documented semantics ("The sphere is the Loom connection/state
indicator, not a mascot").
