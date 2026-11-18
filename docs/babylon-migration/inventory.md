# Babylon migration — contract & visual inventory (v2, Stage 1.1)

v2 goal: **functional parity with the existing frontend contract** and
**visual fidelity to the approved Quiet Complexity reference**, not parity
with the Unity diorama. The Unity implementation is a source of *technical*
discovery (events, states, APIs), never a source of *style*. The Babylon
scene renders **only the sphere**; every navigation destination the diorama
served today is preserved in existing DOM controls.

Initial inventory: `main` (base `bf11bd3` + `ded26b6` merge). The state
palette below is historical; current colors and size/background/navigation
decisions are recorded in `decisions.md` §§2, 5, 10–11. The sphere now emits
`loom-spatial-select` with object `Overview` for pointer or keyboard activation.

## 1. Host ↔ renderer contract (complete, both directions)

### Host → iframe (postMessage from `window` to `frame.contentWindow`)

| Message | Payload | Sender | Effect |
|---|---|---|---|
| `loom-state` | `{ state }` | `src/spatial.ts` `notifySpatialState` (← `main.ts:8093`) | sphere state tint |
| `loom-theme` | `{ theme: "white"\|"dark" }` | `src/theme.ts:20` | light/dark palette |
| `loom-vault-changed` | `{ work, experiments }` | `src/spatial.ts` `notifySpatialVaultChanged` (← `main.ts:269`) | counts (kept for the contract; the sphere does not display them) |
| `loom-quality` | `{ tier }` | `main.ts:5345` | quality tier |
| `loom-background` | `{ background }` | `src/spatial.ts` `notifySpatialBackground` (← `main.ts:5452`) | background |

Theme also arrives via the `?theme=` URL param (`src/spatial.ts:21-24`).

### iframe → host (postMessage from `frame.contentWindow` to `window`)

| Message | Payload | Host handler | Effect |
|---|---|---|---|
| `loom-spatial-ready` | `{}` | `src/spatial.ts:29` | hide load error; push real vault counts + state + background |
| `loom-spatial-error` | `{ message }` | `src/spatial.ts:39` | show load error with message |
| `loom-spatial-select` | `{ object }` | `src/spatial.ts:44` | `onSpatialSelect(object)` → navigation |
| `loom-memory` | (retired) | `src/spatial.ts:48` | **deliberately ignored** (notes editing lives in the Tauri Notes view) |

### Validation already in place

- Host: `event.source === frame.contentWindow && event.origin === location.origin` (`src/spatial.ts:28`).
- Player: same check on the other side (`public/spatial-player.js`, my `src/spatial/bridge.ts`).
- v2 adds **payload shape + size validation** on the player side (Stage 1.3).

### Unity player method surface (reproduced for completeness)

`ApplyLoomState`, `ApplyTheme`, `RefreshVault`, `ApplyQuality`,
`ApplyBackground`, `ApplyCanvasSize`, `ApplyReducedMotion`.

### Pre-ready semantics (must be reproduced)

`public/spatial-player.js` holds the latest pending value for
`theme`/`background`/`state`/`vault` and flushes them once the player is
ready; `quality` sent before ready is dropped; canvas size is reported on
load and on every resize. `loom-spatial-ready` is emitted only after the
scene is actually up.

## 2. Navigation destinations (preserve in DOM, not meshes)

The diorama's clickable objects map to views via `onSpatialSelect`
(`main.ts:8300`):

| Object (was a mesh) | Destination |
|---|---|
| Work | `setMode("work")` |
| Code | `setMode("code")` |
| Experiments | `setMode("experiment")` |
| Evidence | `setMode("knowledge")` + `knowledge.showEvidence()` |
| Agents | `setMode("agents")` |
| Notes | `setMode("knowledge")` |

These six routes already exist in the bottom navigation and the View menu
(`#view-work`, `#view-code`, `#view-experiment`, `#view-knowledge`,
`#view-agents`). **Nothing new to build** — the Babylon player simply does
not emit `loom-spatial-select`, and the host handler stays as-is for the
Unity fallback. (Confirmed in Phase 2 Stage 2.1, when the composition
brings these panels back.)

## 3. The sphere (the only Babylon object)

Source: `docs/01-design-philosophy.md` §6-§7, `design-tokens.json`,
`unity-memory-palace/Assets/Loom/MemoryPalaceController.cs` (technical
reference only — not style).

- Large, simple, pearl, **slightly translucent**, ~24–26% of the reference
  viewport diameter (adjusted to the space between panels).
- Fine internal curved lines with a sense of flow (`orb-line` `#D8BFB4`).
- Moderate rim glow; soft shadow and low-intensity reflection below (CSS).
- Slow, organic, nearly-imperceptible motion at rest; subtle breathing.
- State = **discreet** emissive tint + equivalent text (DOM), never a loud
  full recolor. Pearl base `#F8EEE6`, metallic ≈ 0.12.
- `prefers-reduced-motion` freezes animation.

State → tint (white / dark), from `design-tokens.json`:

| State | Tint |
|---|---|
| idle, listening, processing | purple `[161,134,116]` / `[185,164,144]` |
| exploring, executing | blue `[106,145,204]` / `[139,166,204]` |
| attention | amber `[217,166,95]` |
| completed | green `[120,155,137]` / `[147,177,159]` |
| error | red `[184,117,112]` / `[211,146,138]` |

## 4. Explicitly NOT migrated (superseded)

The six diorama meshes (notebook, flask, toolbox, laptop, robot,
magnifier), their portals, floating 3D labels, the 10 relation lines, the
rectangular platform, and the four 3D themed environments. These were
rejected by the visual review; the renderer has two themes: light and dark.
The later implementation repair retains Charcoal/Dusk/Moss/Night as **host
CSS tints only**, per `decisions.md` §5. They are not Babylon environments.

## 5. Loose ends closed by this inventory

- `loom-theme` sender: **active** — `src/theme.ts:20`.
- `loom-spatial-select` destinations: table in §2.
- `loom-memory`: retired, ignored at `src/spatial.ts:48`.
- `loom-quality` sender: `main.ts:5345`.
