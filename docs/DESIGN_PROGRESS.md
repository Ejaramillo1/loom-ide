# Approved design implementation progress

2026-11-14 — baseline `fe0c01e`, branch `tauri-prototype`, in-place implementation.

- Read approved reference, fold report, frontend and Unity source. The reference documents/image and implementation prompt were already untracked and are preserved.
- Scope: `index.html`, `src/main.ts`, `src/knowledge.ts`, `src/style.css`, relevant frontend tests, Unity controller and self-check, these reports. Generated WebGL files stay ignored and must be copied into `dist` by Vite before desktop packaging.
- Reuse the single conversation pane, Knowledge listing, note dialog, graph/canvas renderers and handlers. Spatial receives a left conversation and a right stacked Knowledge rail. Small widths retain drawers. Other modes retain their inspector behavior.
- Replace portal silhouettes with composed physical meshes/materials in the existing URP pipeline. Preserve sphere, palette, motion, selection, bridge and counts.
- Risks to check: duplicate DOM IDs, keyboard/focus behavior on mode changes, hidden drafts, stale canvas positions/edges, narrow Unity camera framing, child collider selection, material theme changes.
- No backend/native-app source changes, user data writes, packages, Q2 decision, binary inspection, push or history rewriting.

Implementation underway. Verification and local phase commits follow.

## Implemented and checked

- Spatial now composes the existing conversation pane left, Unity center, and shared Knowledge Graph above Canvas right. Desktop composition begins at 1100px; conversation and Knowledge use mutually exclusive drawers below that. Other modes retain their 1440px inspector breakpoint and remembered Context/Conversation state.
- Both Knowledge surfaces use the existing listing, graph/canvas renderers, note dialog, draft guards, focus, positions and actions. Distinct SVG arrow IDs avoid cross-surface collisions. Failed vault loads clear the bench previews with an explicit unavailable state. Refreshed-away notes cannot leave dangling canvas edges.
- Physical portal source implemented: notebook with layered ruled leaves and bookmark, laptop with hinged display/keys/trackpad, wooden toolbox with hardware/hammer/screwdriver, glass flask, articulated robot, and magnifier/documents. URP materials only; no dependency or imported asset. Physical objects retain orientation; existing hover/selection lift and scale remain. Camera framing accounts for a narrow center column.
- First Unity self-check passed: 6 portals, 148 physical mesh parts, child selection, reduced motion, both themes, and viewport bounds at 3 aspect ratios. This is geometry/math validation, not visual inspection.
- Frontend: 58 tests passed (including 5 shared Knowledge renderer/interaction regressions and 3 shell routing/drawer/focus regressions); build passed. Rust: 89 passed / 2 ignored in Tauri; 22 passed in preserved native-app. Tauri rustfmt passed.
- Rust window-registration tests require loopback sockets. Initial sandbox runs failed only those tests; authorized runs with loopback available passed unchanged. Unity startup required normal host access and completed successfully.
- Final C# compile: zero errors, zero warnings. Final self-check, WebGL build, desktop packaging, asset verification and local commits in progress.

## Build review correction

- Frontend phase committed locally as `7e6099f`; hook reran and passed TypeScript/Vite.
- Source review found URP unused-variant stripping enabled. A saved `Resources/LoomGlass` material is needed to retain the transparent shader variant used by the flask/lens. Extending the existing material creation tool and self-check; the current WebGL build is allowed to finish, then a final rebuild will include this fix. No build interruption or rendering claim.

## Takeover (assistant, 14 Nov ~16:30, Eduardo: just code, no approvals)

- Reviewed the uncommitted Unity diff (physical portals, placements, camera framing, child-collider routing, accent-driven theme/emission). No surprises; nothing outside the approved scope.
- CheckWorkbench self-check in Play Mode passed: 6 portals, 148 physical parts, palette true, child selection true, reduced motion true, 2 themes, 3 camera aspects, glass variant true, visual rendering not inspected.
- D9 empty states unified (audit pattern: one line stating what is missing plus the next step, naming an existing control, never a second creation button): Agents/Evidence/Artifacts single-line states, "No work selected" and "No experiment selected" merged to one line, "No experiments yet" points at New experiment, offline wording unified to "The Loom server is offline." everywhere. States that already matched the pattern were left alone.
- D12 verified by inspection, no fix needed: `.scene` is `100dvh` with the middle row `minmax(0, 1fr)`; `.center` and `.view` are full-height flex columns; `#spatial-frame` is `flex: 1`; the player canvas is `width/height 100%`. No fixed height or aspect box anywhere in the chain, so the bench fills the Spatial center column. Pixel-level confirmation remains blocked (see DESIGN_BLOCKERS.md).
- Frontend re-verified with the D9 edits: vitest 58/58 (8 files), npm build clean. Rust: lib 89 passed / 2 ignored, native-app 22/22, fmt clean.
- Final WebGL rebuild with the LoomGlass fix succeeded 16:38 (`spatial.wasm` 35,049,618 bytes). Tauri release build running; dist asset check and local commits follow.
