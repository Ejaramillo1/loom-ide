# Quiet Complexity — Implementation map (Fase 1 deliverable)

Task `20261117-135303` · branch `tauri-prototype` · HEAD `102e8d3` · date 2026-11-17.

This is **Fase 1 only**: inspection and mapping. No production file was changed
except this document. It maps phases 2–8 of the "LOOM QUIET COMPLEXITY —
Atomic Frontend Correction and Implementation Specification" onto the real
files and line numbers of this repo, records what the specification assumes
that does not exist (or is named differently) here, and flags conflicts with
recorded decisions.

> **Honesty note on phase numbering.** The specification body is not a file in
> this repo (only Fase 1 — this task — reached me). The anchors I have from the
> task are: object names/forms (treasure chest / robot / flask / lupa /
> notebook / mini-computadora, platform, floating labels), the central sphere
> (mesh, diameter, material, shader, colour, opacity, lighting, animation,
> position, state-change), the six navigation callbacks, **Fase 5.10** (restore
> bottom navigation), the ring vision approved 15 Nov, and the chat living in
> `#right-col`. I map phases 2–8 onto the nine implementation areas the task
> lists (layout, theme colours, navigation, conversation panel, agent status
> panels, Unity iframe/player, sphere, scene construction, Unity↔Tauri
> communication) and mark every inferred boundary with "Fase (inferred)".

---

## 1. Tree state at inspection

- Branch `tauri-prototype`, HEAD `102e8d3` ("Document footer removal and chat
  widening in DESIGN_PROGRESS.md"), ahead of `origin/tauri-prototype` by 3.
- `git status`: **working tree clean**, nothing uncommitted at start.
- `git log --oneline -3`:
  - `102e8d3` Document footer removal and chat widening in DESIGN_PROGRESS.md
  - `779a257` Update tests: footer removal, Spatial View item, chat widening
  - `7018eab` Remove footer nav; add Spatial to View menu; widen/resize chat column

## 2. Baseline verification (non-destructive, run in this session)

| Check | Command | Result |
|---|---|---|
| Frontend tests | `npm test -- --run` | **121 passed** (14 files), vitest 5.1.0 |
| Frontend build | `npm run build` | clean (6.01s; only the expected >500 kB chunk warning for the Monaco bundle) |
| Tauri Rust lib | `cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib` | **143 passed / 2 ignored** |
| native-app | `cargo test --offline --locked --manifest-path native-app/Cargo.toml` | **22 passed** |
| fmt (src-tauri only) | `cargo fmt --check --manifest-path src-tauri/Cargo.toml` | exit 0 (clean). `native-app` is outside the fmt gate per `docs/DECISIONS.md` |
| Unity recompile | `unity recompile --project-path "$PWD/unity-memory-palace" --format json` | success, **0 errors / 0 warnings** (up_to_date) |
| CheckWorkbench (Play Mode) | `unity command editor.playmode start` + `script eval --file Tools/CheckWorkbench.cs` + `playmode stop` | green: `tier=High portals=6 physicalParts=154 colliderErrors=0 palette=true themes=2 backgrounds=4 cameraAspects=3 glassVariant=true` |
| Preview smoke | `node src-tauri/target/fold-preview-smoke.mjs` | **FAILS (known, not fixed in this phase)** — see below |

**Known smoke failure.** `src-tauri/target/fold-preview-smoke.mjs:7` asserts
`data-mode="knowledge"`, but the app opens in **`spatial`** (`index.html:15`
`<div class="scene" data-mode="spatial">`, `src/main.ts:216` `let mode: Mode =
"spatial"`). The assertion is obsolete (it predates the Unity-first/Spatial
home decision). Recorded here as a known baseline failure per the task; **not
corrected in Fase 1**.

---

## 3. Real names vs. specification names

The specification's object vocabulary does not fully match the approved
design (`docs/APPROVED_VISUAL_REFERENCE.md:11`). Real names win:

| Specification name | Real name (repo) | Source |
|---|---|---|
| treasure chest (Work) | **toolbox** (wooden, hammer/screwdriver) | `MemoryPalaceController.cs:679-701` |
| mini-computadora (Code) | **laptop** (aluminium, hinged display) | `MemoryPalaceController.cs:662-678` |
| robot (Agents) | robot (articulated, matches) | `MemoryPalaceController.cs:711-731` |
| flask (Experiments) | flask (glass, matches) | `MemoryPalaceController.cs:702-710` |
| lupa (Evidence) | **magnifying glass + documents** | `MemoryPalaceController.cs:732-762` |
| notebook (Notes) | notebook (matches) | `MemoryPalaceController.cs:642-661` |
| plataforma | **"Resolute work surface"** (bench cube) + "Reflective floor" | `MemoryPalaceController.cs:430-439` |
| etiquetas flotantes | **IMGUI screen-space portal labels** (not 3D TextMesh) | `MemoryPalaceController.cs:915-929` |

The six portal identities and accent colours live in the `Portals` array,
`MemoryPalaceController.cs:66-74`:

```csharp
new("Work", ..., Amber), new("Code", ..., Blue), new("Experiments", ..., Green),
new("Evidence", ..., Red), new("Agents", ..., Purple), new("Notes", ..., Pearl),
```

---

## 4. Implementation map, phases 2–8

Each section: **files:lines** to touch → **what the spec assumes that differs**
→ **conflicts with recorded decisions**.

### Fase 2 — Layout principal (shell grid, header/main, full-bleed) (inferred)

Files/regions:
- `index.html:10-325` — `.scene` (line 15), `.topbar` header (19-41), `.main`
  (44), `.left-col` (49), `.center` (74), `.right-col` (223), `#view-spatial`
  (75-81).
- `src/style.css:156-167` `.scene` (`height:100dvh`, `grid-template-rows: auto
  minmax(0,1fr)`, single clamped column).
- `src/style.css:586-613` `.main` grid (`--left-w minmax(520px,1fr)
  --right-w`; flat `minmax(0,1fr) var(--right-w)` for code/agents/artifacts/
  knowledge).
- `src/style.css:40-45` geometry tokens (`--header-h`, `--left-w`, `--right-w`,
  `--spatial-chat-w`, `--shell-pad`). Note `--footer-h` **no longer exists**
  (removed in `7018eab`).
- `src/style.css:815-820` Spatial full-bleed (`.scene[data-mode="spatial"]
  .main` single column; `#spatial-frame { flex:1; width:100% }`).
- `src/style.css:3902-3915` Spatial desktop/compact conversation column.

Assumptions that differ: the spec's "bottom navigation" row does not exist —
the shell is exactly **two rows** (header + main); the main grid already
reaches the bottom edge (`docs/DESIGN_PROGRESS.md:225-233`). No footer
element, no `mode-nav`/`mode-btn`, no `--footer-h` remain.

Conflicts: restoring any bottom nav contradicts the removal rationale
"the six destinations duplicated the six scene portals" (`DESIGN_PROGRESS.md:227`).
See Fase 5.10.

### Fase 3 — Colores de tema (tokens, CSS variables, Unity palette) (inferred)

Files/regions:
- `design-tokens.json:1-27` — `radius`, `dark`, `white` palettes (the
  single source; includes `orb-*` sphere tokens at `dark:11-13` /
  `white:23-25`).
- `src/theme.ts:9-24` `apply()` — sets `data-theme`, `--theme-*` and
  `--theme-*-rgb` vars, `--radius-*`, pushes `loom-theme` to the player.
- `src/theme.ts:35-39` `setAppearance()`, `40-46` `[data-appearance]` click
  handlers, `47-49` storage sync.
- `src/style.css:10-54` `:root` semantic tokens mapped from `--theme-*`
  (`--bg`, `--reading`, `--surface`, `--ink`, `--muted`, `--line`, `--warm`,
  `--agent`, `--attention`, `--ok`, `--danger`, `--radius-*`).
- `src/style.css:3833-3841` "Quiet Complexity" shared treatments.
- Unity palette mirror: `MemoryPalaceController.cs:14-61` (White + Dark
  colour constants, three-point rig colours, `SphereEmission`/`AccentEmission`),
  `127-168` `ApplyTheme`, `252-267` `PortalColorDark`, `114-122`
  `PaletteMatchesDesignTokens`.

Assumptions that differ: the specification may expect a central theme file
named `theme.ts` with tokens inline; here tokens are externalised in
`design-tokens.json` and loaded `?raw` (`theme.ts:1-2`), and the Unity side
**duplicates** the palette as C# constants rather than reading the JSON at
runtime.

Conflicts: the palette is shared with `native-app` through
`design-tokens.json` (`style.css:11`, `DECISIONS.md`); any colour change must
keep `PaletteMatchesDesignTokens` true or the Unity self-check goes red.
The state colours (amber/green/red/blue/purple) are semantic, not cosmetic —
see Fase 7.

### Fase 4 — Navegación (modes, View menu, spatial-select) (inferred)

Files/regions:
- `src/main.ts:163` `type Mode` (`code|experiment|work|agents|artifacts|spatial|knowledge`).
- `src/main.ts:216` initial `mode = "spatial"`.
- `src/main.ts:7907-7936` `setMode()` — hides/shows `#view-*`, toggles
  `mode-*` body classes and `.scene[data-mode]`, re-homes the search slot,
  `applyRightPane()`.
- `src/main.ts:7721-7733` `ALL_VIEWS` and `VIEW_MENU_MODES`
  (`["spatial","code","experiment","work","agents","knowledge"]`).
- `src/main.ts:7766-7784` View menu mode items (the **only** remaining
  textual navigation after the footer removal).
- `src/main.ts:8111-8121` the spatial-select callback (the Unity→view router):
  ```ts
  case "Work": setMode("work"); break;
  case "Code": setMode("code"); break;
  case "Experiments": setMode("experiment"); break;
  case "Evidence": setMode("knowledge"); knowledge?.showEvidence?.(); break;
  case "Agents": setMode("agents"); break;
  case "Notes": setMode("knowledge"); break;
  ```
- Unity side: `MemoryPalaceController.cs:865-885` `PickMemory()` raycast →
  `LoomNavigate(selected.Key)`, and `900-906` the "Open note in Notes" button.

Assumptions that differ: the spec assumes a six-way bottom nav
(Spatial/Work/Code/Experiment/Agents/Evidence). That nav was **removed** in
`7018eab`/`102e8d3` because Unity is now the navigation surface; "Spatial"
joined the View menu as the home entry (`DESIGN_PROGRESS.md:232-233`).

Conflicts: any Fase 4 change that adds a second navigation surface duplicates
the portals (audit A6, "no duplicated action", `UNITY_FIRST_AUDIT.md:46-48`).
The spec's "Evidence" destination maps to the Knowledge view's Evidence tab
(not a top-level `#view-evidence` — no such view exists).

### Fase 5 — Panel de conversación + paneles de estado del agente (inferred)

Files/regions:
- Conversation: `index.html:285-315` `#chat-panel` (scope, session bar,
  `#chat-log`, `#chat-form`, stop button). `index.html:32-35` header
  `#chat-toggle`.
- Right-column behaviour: `src/main.ts:3757-3761` pane state; `3769-3822`
  width model + `expandChatOnReply()` (widens into the bench on the first
  stream event); `3840-3859` `applyRightPane()`; `3864-3892`
  `openRight`/`closeRight`; `3906-3909` `focusChat()`; `3944-3983`
  `installRightResize()` (drag/keyboard resize).
- Agent/session status panels: `index.html:233-283` `#inspector-context`
  sections (`attention-list`, `inspector-session-detail`,
  `inspector-agent-detail`, `inspector-tools`, `inspector-models`,
  `inspector-providers`, `inspector-artifact-stats`, `inspector-server-config`,
  `inspector-storage-status`).
- Renderers: `src/main.ts:3187` `renderInspectorContext()`, `3199`
  `renderInspectorSessionDetail()`, `3215` `renderInspectorAgentDetail()`,
  `3231` `renderInspectorTools()`.
- Layout: `src/style.css:1615-1628` `.right-col`, `3902-3915` Spatial chat
  column (`--spatial-chat-w`; `order:-1` puts conversation on the **left** in
  Spatial).

Assumptions that differ: the spec may assume a chat in a fixed right column in
every view; here the chat is one tab of a shared `#right-col`, and in Spatial
it is **repositioned to the left** (conversation left / bench right,
`APPROVED_VISUAL_REFERENCE.md:17-20` amendment and `DESIGN_PROGRESS.md:201-223`).
The panel also auto-widens during a reply (`expandChatOnReply`, `3816`).

Conflicts: the approved ring vision (15 Nov) places the six objects around the
sphere with the conversation occupying the left column — no change to
`#right-col` should assume a three-column Spatial (Knowledge rail removed,
`DESIGN_PROGRESS.md:201-223`).

**Fase 5.10 — restore bottom navigation.** Direct conflict. The footer was
removed (`7018eab`) precisely because it duplicated the six portals; restoring
it would re-introduce audit A6 duplication and would need a new destination
for "Spatial" that does not exist as a footer concept. If this sub-phase is
still required, the smallest compliant change is a **View-menu-only** entry,
not a footer; the map records the removal as the standing decision
(`DECISIONS.md` "Home view: Spatial", `DESIGN_PROGRESS.md:225-233`).

### Fase 6 — iframe/player Unity (embedding, loading, error) (inferred)

Files/regions:
- `index.html:75-81` `#view-spatial` with `#spatial-load-error`,
  `#spatial-status`, `#spatial-load` (Retry) and `#spatial-frame` iframe.
- `src/spatial.ts:3-46` `installSpatialWorkbench()` — builds the player URL,
  handles `loom-spatial-ready` / `loom-spatial-error` / `loom-spatial-select`
  messages, flushes initial vault/state/background on ready.
- `src/spatial.ts:52-69` `notifySpatialVaultChanged`, `notifySpatialState`,
  `notifySpatialBackground` (host → player pushes).
- `public/spatial-player.html` (the iframe document), `public/spatial-player.js:1-114`
  (`startSpatialPlayer`: loads `/spatial/Build/spatial.loader.js`,
  `createUnityInstance`, DPR cap 2×, pending-value flush, `ApplyTheme` /
  `ApplyBackground` / `ApplyLoomState` / `RefreshVault` / `ApplyQuality` /
  `ApplyCanvasSize` / `ApplyReducedMotion` SendMessage calls, resize bridge).
- `public/spatial-player.css:1-41` (loading sphere, dark/white).
- `src/main.ts:5341-5346` `setQualityTier`, `5352-5366` `BACKGROUNDS` +
  `setBackground` (quality/background reach the player over the bridge).

Assumptions that differ: the spec calls this an "iframe/player Unity"; the
repo uses an iframe (`#spatial-frame`) whose source is a Vite-served
`spatial-player.html`, and the WebGL build is injected from
`public/spatial/Build/` (copied into `dist/spatial/Build`). The player is a
`postMessage` boundary; it cannot read the vault itself (`spatial.ts:24-27`).

Conflicts: quality tier (High/Balanced/Low) and scene background
(charcoal/dusk/moss/night) are **View-menu settings**, not per the spec's
possible fixed values; they persist and are pushed live (`DECISIONS.md`
"Quality tiers" / "renderScale stays tier-driven").

### Fase 7 — Esfera central + construcción de la escena Unity (inferred)

Sphere (the specification's detailed list — mesh, diameter, material, shader,
colour, opacity, lighting, animation, position, state-change):

- Mesh/diameter/position: `MemoryPalaceController.cs:441-445`
  `GameObject.CreatePrimitive(PrimitiveType.Sphere)` named "Loom sphere",
  position `(0, 1.75, 0)`, `localScale = 2.35` (unit sphere × 2.35 ⇒
  ~2.35 world-units diameter).
- Material/shader/colour/opacity: `445-450` `Material("Loom sphere",
  Rgb(248,238,230), 0.55f, 0.02f)`, `_Metallic = 0.12`, `_EMISSION` keyword
  enabled (IL2CPP canary). Shader is `LoomLit` (URP Lit), loaded from
  `Resources/LoomLit.mat`; opacity is **opaque** (no transparent sphere).
- Lighting: three-point rig `405-428` (warm key / cool fill / white rim);
  HDR camera + global Volume `457-483` (ACES, bloom threshold 1.15 / intensity
  0.3, grade, vignette). Sphere emission discipline at `63` `SphereEmission=1.0f`.
- Animation: `334-343` `Update()` — `sphere.Rotate(0, 1.2°/s, 0)`, breathing
  scale `2.35 × (1 + sin(t·0.35)·0.004)`, HDR emission pulse
  `liveStateColor * (1.0 + 0.12·sin(t·1.1))`; all paused under reduced motion.
- State-change mechanism (colour = Loom state, amber/green/red/blue/purple):
  `171-178` `StateColor(state, dark)` (`attention→amber`, `completed→green`,
  `error→red`, `exploring/executing→blue`, else→purple), `180-194`
  `ApplyLoomState` (`sphereMaterial.color = Lerp(Pearl, color, 0.4)`,
  `_EmissionColor = color × SphereEmission`). Host-side state source:
  `src/loom-state.ts:4-10` `loomState()`, `src/main.ts:7861-7867`
  `currentLoomState()`, `7869-7905` `renderStatusPill()` (also pushes to
  player). Status-dot colours in CSS `style.css:3883-3888`.
- **There is a second, dead sphere:** `src/sphere.ts:29-260` `Sphere` (Canvas 2D).
  It is **not rendered** anywhere; only the `SphereState` type is imported
  (`DECISIONS.md` "Still open"). The specification's "sphere" is the **Unity**
  sphere, not this Canvas class. `src/main.ts:372-376` `setSphereState` drives
  the shared state, not a 2D canvas.

Scene construction (six objects, platform, labels):

- `MemoryPalaceController.cs:305-308` `Awake()` → `353-526` `BuildWorld()`.
- Platform/floor: `430-439` ("Reflective floor" Plane 5×4; "Resolute work
  surface" Cube 13.5×0.34×7.8 at y=0.18).
- Orbit rings: `452-453` `CreateOrbit("Inner/Outer orbit", …)`, `814-833`.
- Six anchors: `516-520` `placements[]`, `521` loop →
  `565-600` `CreateAnchor()` → `603-764` `BuildPhysicalPortal()` switch
  (Notes 642 / Code 662 / Work 679 / Experiments 702 / Agents 711 / Evidence 732).
- Floating labels: `887-908` `OnGUI()`, `915-929` `DrawPortalLabels()`
  (screen-space IMGUI, always on top), `931-963` `EnsureStyles()` (rounded
  backing plate). Labels are **not** 3D TextMesh and do **not** orbit with the
  objects (`DESIGN_PROGRESS.md:190-199`).
- Hover/select interaction: `1138-1181` `MemoryAnchor` (`Animate`: lift/scale,
  accent emissive pulse 1.35× idle → ~1.75× hover → ~2× selected); `835-863`
  `ReadPointer`/`MoveCamera` (pointer parallax, zoom 7.5–15, framing
  `max(1, 1/aspect)`).

Assumptions that differ: the spec's "treasure chest" and "mini-computadora" are
"toolbox" and "laptop" here (§3). The spec's "platform" is the bench cube, and
"floating labels" are IMGUI screen-space labels, not 3D world labels. The ring
vision (15 Nov) is implemented as **orbit rotation** (`orbitAngle += 12°/s`,
`346`), not a static ring.

Conflicts: the sphere is the **single** live Loom-state indicator (decision D6,
`UNITY_FIRST_AUDIT.md:90-92`, `DECISIONS.md` "Sphere: kept… decorative copies
kept by decision"). Any change to its colour semantics must go through
`StateColor`, not hardcode a colour. Baked GI/probes are **deferred**
(`DECISIONS.md` "Lightmap baking") — the scene is built at runtime in `Awake`.

### Fase 8 — Comunicación Unity↔Tauri (bridge + Loom client) (inferred)

Files/regions:
- Unity → Tauri: `unity-memory-palace/Assets/Loom/Plugins/LoomVault.jslib:12-14`
  `LoomNavigate(object)` → `postMessage({type:'loom-spatial-select'})`; declared
  `MemoryPalaceController.cs:105-107` (`[DllImport("__Internal")]`), invoked at
  `882` and `903-904`. (`LoomVault.jslib:2-11` `LoomMemory` is the retired
  note-editing channel — editing moved to Tauri, `spatial.ts:41-43`.)
- Player → host: `public/spatial-player.js:32-56` message listener.
- Host bridge: `src/spatial.ts:20-44` message listener (routes
  `loom-spatial-select` to the `onSpatialSelect` callback in `main.ts:8111-8121`).
- Host → player pushes: `src/spatial.ts:52-69`; consumed by
  `spatial-player.js` → `SendMessage("Resolute Workbench", …)` → controller
  methods `ApplyTheme`/`ApplyBackground`/`ApplyLoomState`/`RefreshVault`/
  `ApplyQuality`/`ApplyCanvasSize`/`ApplyReducedMotion`
  (`MemoryPalaceController.cs:127-250`).
- Loom HTTP client (Tauri↔Loom, not Unity↔Tauri): `src/api.ts:860-907`
  `invokeCmd`/`loomRequest`; endpoints `/v1/health`, `/v1/weave`,
  `/v1/weave:stream` (SSE), `/v1/sessions`, `/v1/agents`, `/v1/tools`,
  `/v1/models`, `/v1/providers`, `/v1/artifacts`, `/v1/server/*`,
  `/v1/workflows`, `/v1/tasks`, etc. (see `api.ts` exports from line 872).

Assumptions that differ: the spec's "comunicación Unity→Tauri" is a **one-way
navigate** signal plus host→player control pushes; there is no synchronous
return channel (the retired `loom-memory`/`loom-memory-result` pair is the only
former two-way bridge and is unused). Vault counts are pushed by the host, not
read by Unity (`RefreshVault`, `283-303`; `spatial.ts:24-27`).

Conflicts: Loom owns model/tool execution; the IDE is a thin client
(`docs/audits/quiet-complexity-loom/01-executive-audit.md:3`). The Rust gRPC
client (Judge first) is a decided Phase-5 transport (`DECISIONS.md` #3) and is
**out of scope** for this frontend-only map. No Loom-side change is authorised
(§4 guardrails).

---

## 5. Cross-cutting notes for phases 2–8

- **No React / no new dependencies.** Frontend is vanilla TS; Monaco is the
  one agreed dependency (`DECISIONS.md` #1). Any phase-2–8 work stays in
  `index.html`, `src/*.ts`, `src/style.css`, `public/spatial-player.*`, and
  `unity-memory-palace/Assets/Loom/*`.
- **Honest empty states.** Phases touching Work/Experiments/Agents/Evidence
  must keep the one-line-empty-state pattern (`UNITY_FIRST_AUDIT.md:123-133`),
  never seed data.
- **fmt scope** is `src-tauri` only (`DECISIONS.md` "Rust formatting gate").
- **Sphere/state colours** are semantic; the pill is the precise text state and
  the sphere the ambient colour state, both from one shared `SphereState`
  (`DECISIONS.md` #8).
- **Q2 (Unity-failure fallback view) is deferred** — do not implement it in any
  phase here (`DECISIONS.md` #4, `APPROVED_VISUAL_REFERENCE.md:15`).

## 6. Decisions taken this session (Fase 1)

1. Phase boundaries 2–8 are **inferred** from the task's own anchors and the
   nine implementation areas, because the spec body is not a file in the repo;
   every inferred boundary is marked "(inferred)" in §4.
2. Real object names (toolbox, laptop, magnifying glass, notebook, robot,
   flask) recorded over the spec's treasure-chest/mini-computadora (§3).
3. The preview-smoke failure (`data-mode="knowledge"` vs `spatial`) is
   recorded as a known baseline and **not** fixed, per the task.
4. The dead Canvas `Sphere` class (`src/sphere.ts`) is documented as **not** the
   specification's sphere — the Unity sphere is.
5. No production file was modified; only this map is added.
