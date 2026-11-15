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

## Build plan application (assistant, 14 Nov ~23:30, Eduardo: apply the Beautiful Loom IDE build plan)

The 17-section build plan (`/home/ed/Downloads/Beautiful Loom IDE build plan.html`, written against head cc61643) was applied in phase order. Decision-gated items were left per the standing defaults (§16: Q2 deferred, D6 kept, no Loom-side changes, no task migration, markdown vault stays the store). Everything else landed unless noted:

- **Phase 0**: home view already resolved (Spatial, `650441a`); reports already regenerated. Orphan sweep removed `get_collaboration` (no Loom RPC backs it — collaboration.proto has messages only) and `knowledge_pending_count` (the bell derives its count from the listing); fixed a double-registered `knowledge_archive`. The release binary rebuild happens last, at the end of this session.
- **Phase 3 (streaming)**: `ask_loom_stream`/`cancel_loom_stream` consume `POST /v1/weave:stream` (SSE) over the existing raw HTTP client and re-emit `WeaveProgress` as Tauri events; the chat renders tokens incrementally, shows tool calls in flight, has a Stop button, and renders HITL cards — clarification answers and tool approvals both deliver through the clarification-answer path (the hold's `request_id` is its handle). The unary path is the fallback. Connection errors trigger a one-shot re-probe and the status pill is now the re-check control. Replies carry their `trace_id` with a "View trace" span view. Sessions gain Resume/Delete.
- **Phase 4**: Agents view is a control panel (start/stop/reload/delete, Weaver describe-to-create with a JSON review form, presets); an MCP tab lists/adds/tests/health-checks/restarts/deletes servers with a per-server tools drawer; an Apps tab surfaces Loom's embedded apps. The Loom-as-MCP-server ↔ MuseBridge harness connection is deferred (cross-project; no harness changes without a decision).
- **Phase 5**: a Patterns shelf in Knowledge (HTTP pattern list/detail). Judge/tasks/graph-memory stay unwired — all gRPC-only, and the transport decision requires a Loom-side change (§16 standing default: not without confirmation). Skills stay unwired for the same reason.
- **Phase 2 (frontend)**: the disk watcher polls `knowledge_signature` (note/pending counts + newest mtime) every 3 s; drafts and open dialogs always win. Canvas card positions persist in the app data dir (durable layouts). The Unity canvas clamps `devicePixelRatio` to 1.5 (backing-store cap, not a sharpness claim). The Unity IMGUI note editor is demoted: selecting an object navigates, and the card offers "Open note in Notes" — text editing lives in the Tauri Notes view; the dead spatial-memory bridge (no frontend listener ever existed) was unregistered, `spatial.rs` kept with its tests.
- **Phases 1–2 (Unity beauty)**: HDR camera + one global Volume (ACES, Bloom 1.05/0.45/0.7, grade, vignette 0.25); a three-point rig (warm key, cool fill, white rim); the sphere pulses on HDR emission (2.6×) instead of a light; per-surface PBR values per §5.2; accent materials emit at 1.35×; the flask/lens glass sits in an explicit render queue (3010) after contact shadows (3000); a soft contact-shadow decal grounds every object; the dark backdrop moved to #0A0E14 with cool dim ambient. Quality tiers: High/Balanced/Low as three URP assets (renderScale 1/0.85/0.75, MSAA 4/2/1), three quality levels, WebGL+Standalone default High; WebGL 2.0 only; SSAO (0.5, downsample, 4 samples) on both renderers; preloaded shader-variant canaries (`_EMISSION`, transparent keywords) plus `_EMISSION` on the shipped LoomLit material.
- **Deferred, honestly**: lightmap baking, baked reflection probes and light probe groups — the bench is built at runtime in `Awake`, and baked GI needs an authored static scene; realtime probes are unsupported on WebGL. Monaco and any benchmark component — the repo rule (and now `docs/01-design-philosophy.md`) requires Eduardo's decision per dependency. Workflow streaming and the ABTest wiring were left for a later pass. D14 (real-window pixel check) remains environment-blocked.

## Build plan completion pass (assistant, 15 Nov ~00:30, Eduardo: read everything — not all implemented)

A second read of the build plan against the repo found the remaining gaps; the implementable ones now land:

- **Camera bookmarks (§8.2)**: `Tools/CaptureBookmarks.cs` drives Play Mode, freezes the controller, and captures front / three-quarter / top-down views (plus a no-post control and the light theme) at a fixed 1280×548 buffer into `docs/bench-shots/` — the first pixel-level evidence of the bench (Editor captures, not the Tauri window; D14 stays blocked).
- **Found and fixed by those captures**: the runtime camera had no `UniversalAdditionalCameraData`, so post-processing and MSAA silently no-op'd — the sphere rendered as a flat white disc (the original complaint). Attaching the camera data explicitly turned the grade on; pixel checks now show the #0A0E14 backdrop, a warm pearl sphere with zero clipped pixels, and a post/no-post delta. The first grade crushed the scene (70% ≤ 20 luminance), so post-exposure moved to +0.35 with a shadows lift and stronger key/fill — now ~59% dark with clear bright props.
- **Dust motes (§5.7)**: <100 additive particles near the sphere, paused under reduced motion.
- **Reading light (§5.5)**: a dedicated soft spot over the Evidence documents — the legibility surface.
- **Framing (§5.8)**: FOV 48 → 42; fog density 0.009 → 0.005.
- **PBR maps (§5.2)**: generated tileable 256 px base + normal pairs for wood, paper and brushed metal (analytic height fields; `_NORMALMAP` added to the preloaded canaries); values documented in `docs/BENCH_MATERIALS.md`.
- **Glass (§5.3)**: the magnifier lens moved to the opaque fallback (tinted, smoothness 0.95); the flask stays the only large transparent at queue 3010.
- **Selection (§5.5)**: accent emissive pulse — 1.35× idle, ~1.75× hover, ~2× selected — under the sphere's 2.0× hero.
- **Tiers (§5.7/§7.4)**: the Low tier now uses its own renderer with SSAO removed; WebGL data caching on, exceptions none, managed stripping High, IL2CPP OptimizeSize.
- **Workflow streaming (§14.2)**: `execute_workflow_stream` over `/v1/workflows:stream` with live progress in the Workflows section; the unary path remains the fallback.
- **Session subscription (§13/§14.2)**: the selected session subscribes to live updates; the detail pane shows Resume/Resolve-gap for interrupted sessions.
- **Provider A/B (§13/§14.5)**: a "Compare providers" dialog in Experiments streams each provider's answer with score/latency/cost and the winner.
- **Workflow scheduling (§13)**: list/create/pause/resume/trigger/delete/history for cron schedules, HTTP-bound.
- **Tool detail (§14.1)**: the MCP tools drawer shows each tool's parameter schema.
- **Look-dev from the URP 3D Sample (§3)**: still not imported — needs a Unity Hub template download; the documented values stand in. Baked GI/probes stay out (runtime-built scene). D14, Q2, Monaco, the gRPC-only services and the harness connection remain blocked as before.

## 7x7x7 remaining-work plan pass (assistant, 15 Nov ~02:00)

The 343-item remaining-work plan (`docs/REMAINING_WORK_PLAN_7X7X7.md`) was
audited against the repo. Its two corrections drove this pass: tasks and
skills are 100% HTTP (no transport decision), and the blur had causes in
code. Implemented:

- **Loom tasks + boards** (`loom_tasks.rs`): boards CRUD, task CRUD,
  claim/release/close/transition, dependencies, ready/blocked, decompose,
  task context; a kanban in Work beside local work (labelled by source)
  with live board updates.
- **Skills** (HTTP): add/classify/bulk-import shelf in Knowledge — honest
  that Loom has no list endpoint.
- **Apps CRUD + component types, tool register + permission request, TLS
  status/renew, storage migration, schedule pause/resume + execution
  cancel, pattern stream, task stream.**
- **Connection model**: Stop cancels silent streams within ~20 s; unknown
  request ids error; non-JSON chunks and non-2xx bodies are reported;
  `LOOM_ADDR` override; one retry on transient GET failures; visible
  Reconnecting state; continuous re-probe while offline; documented in
  `docs/LOOM_CONNECTION_MODEL.md`.
- **Chat context pack**: active work, intent, open file and session/
  agent ids travel with every query (stream and unary).
- **Sharpness**: DPR cap raised to 2×; soft shadows + 8 m shadow distance
  + opaque texture on the shipped renderer; AA field 4 on all tiers;
  high-quality bloom; 512 px PBR maps; larger labels; self-check runs at
  the shipping High tier; per-light rig captures; tier selector in the
  View menu with bloom off on Low.
- **Docs**: `docs/DECISIONS.md` (open + taken), `docs/BACKLOG.md`,
  connection model, and the §7.3 corrections across the older reports.

Measured live against the running server: first stream event at **10.37 s**
on the local CPU qwen3:4b (the Phase-3 "under a second" target is
model/hardware-bound, not IDE-bound — the IDE renders tokens as they
arrive). The unary weave did not complete in 15 minutes on the same model
— the blocking-wait the streaming path replaces, measured and registered.
Trace lookup awaits a completing turn; the GetTrace endpoint exists in the
proto and the trace view is wired, but no live trace id was obtainable
from a streamed turn (WeaveProgress carries no trace id).

Still open, all registered: D14 real-window captures (permission), Q2
fallback, Monaco/benchmark dependencies, the gRPC-only services, the
harness MCP connection, and every decision in `docs/DECISIONS.md`.

## Build sizes at head (15 Nov ~01:00)

- `public/spatial/Build/spatial.wasm`: 25,530,368 bytes (was 35 MB before
  IL2CPP OptimizeSize + managed stripping High; the §7.4 settings paid).
- `dist/spatial/Build` matches `public/spatial/Build` (`cmp` on wasm and
  data files, identical hashes).
- Release binary rebuilt at head (see below; ~24 MB, grown with the new
  backend surfaces).

## Judge tooling status (§6.7)

- `judge/JUDGE_PROMPT_TEMPLATE.md` and `judge/run-judge.sh` are in the repo
  (Eduardo's draft; the script is now executable).
- `/home/ed/judge/` exists with `runs/` and `verdicts/`; the `opencode`
  CLI reports v2.2.7. A real short pass is Eduardo's to run from the
  laptop terminal — the script itself warns against running it through
  the harness shell.
