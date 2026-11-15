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

## Portal click bug (assistant, 14 Nov ~19:45, Eduardo: agents/experiments/notes/evidence don't navigate)

- Symptom: clicking the bench portals for Agents, Experiments, Evidence and Notes did not navigate the app.
- Root cause: `stripEngineCode` is enabled and IL2CPP's managed stripper removes the `SphereCollider` and `CapsuleCollider` types. `GameObject.CreatePrimitive` adds those colliders through an `AddComponent` call the stripper cannot see, so the physical parts rendered but had no colliders to raycast against (WebGL console: 21 "SphereCollider doesn't exist", 12 "CapsuleCollider doesn't exist"). The robot is built almost entirely of Sphere/Capsule parts, so it was unclickable; the flask, magnifier, and notebook lost their prominent parts too.
- Fix: added `Assets/link.xml` preserving `BoxCollider`, `SphereCollider`, `CapsuleCollider` and `MeshCollider` (all primitive collider types). Editor Play Mode never stripped these, so the existing CheckWorkbench self-check could not catch it — verification is the WebGL console after rebuild.

## Rotation + resolution (assistant, 14 Nov ~20:00, Eduardo: assets should rotate for selection, and the render is blurry)

- Rotation: the six portals now orbit the sphere (12°/s) so each can be brought to the front to select. The ring pauses when a portal is hovered or selected, and under reduced motion. Each portal faces outward from the sphere (a gentle yaw offset remains), and the existing hover/selection lift and scale are preserved. `Animate` gained an `orbitAngle` parameter; `CheckWorkbench.cs` call sites updated.
- Resolution (blur): the WebGL build defaults to the "Mobile" quality level (`m_PerPlatformDefaultQuality.WebGL: 0`), whose renderer (`Mobile_RPAsset`) rendered at `m_RenderScale: 0.8` — 80% resolution upscaled, the main cause of the blur. Set both renderers to `m_RenderScale: 1` and `m_MSAA: 4` (the editor also synced `QualitySettings.antiAliasing` to 4). Unity already follows the display's pixel density, so no `devicePixelRatio` override was needed.

## Critique pass (assistant, 14 Nov ~21:00, Eduardo: apply the UI critique)

- Removed the compact Canvas `scale(0.62)` (13px text had become ~8px); the bench canvas now scrolls at full reading size.
- Combined the two stacked bench panels (Graph + Canvas) into one pane with a Graph/Canvas toggle, so the landing screen no longer duplicates the same knowledge twice.
- The bench starts on the Spatial (Unity) view — Unity-first, per Eduardo — and Experiment remains a bottom-nav tab rather than the landing.
- Unity no longer shrinks its UI (`GUI.matrix` scale removed) and no longer draws its own title/instructions (they live in the host header); the object-memory note panel is drawn at real size.
- Recorded but deferred in this pass: moving the object-memory note editor from Unity IMGUI into the host HTML, the full "AI experimentation workbench" layout restructure (slim experiment sidebar, main question/variants/run workspace), and reducing the decorative shell chrome — each is larger than a point fix and will be separate commits.
