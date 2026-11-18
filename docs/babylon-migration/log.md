# Babylon migration — bitácora (v2)

Base `main`. The v1 plan (diorama parity with Unity) is **superseded** by the
critical review (`Plan_migracion_…_revision_critica.md`, AR-01…AR-12). This
log records the v2 rework of Fase 1. The v1 pilot commits (`f5c539e`,
`72d48ab`) and v1 evidence (`babylon-{idle,error,dusk}.png`, showing the
diorama) remain in history as superseded.

## Stage 1.1 — Reference freeze + contract inventory + decisions

- **Binding reference frozen**: `docs/babylon-migration/reference/
  agent-memory-experiment-dashboard.png` (1671×941, SHA-256 `413f5ee2…`),
  copied from `~/Downloads/Agent Memory Experiment Dashboard.png`. Described
  textually in `reference.md` (this model cannot ingest image pixels, so the
  pixel-level judgment stays with Eduardo/the judge). The `~/workspace/…`
  path in the plan does not exist on this machine.
- **Contract inventory** (`inventory.md`): every host↔renderer message,
  sender, receiver, payload, validation, and pre-ready semantics, verified in
  the repo. Loose ends closed: `loom-theme` sender is `src/theme.ts:20`
  (active); `loom-spatial-select` → `onSpatialSelect` destinations table
  (Work/Code/Experiments/Evidence/Agents/Notes → `setMode`); `loom-memory`
  retired (`src/spatial.ts:48`); `loom-quality` sender `main.ts:5345`.
- **Decisions 1–9** (`decisions.md`): engine (sphere only), central object,
  deps (core exact only), container (iframe + Vite multi-page), backgrounds
  (light/dark only), interface (DOM/CSS, no 3D text), Loom read-only, Unity
  removal conditioned, visual reference (Quiet Complexity).

## Stage 1.2 — Sphere-only scene

- `src/spatial/bench.ts` rewritten: **one sphere** (pearl `#F8EEE6`,
  fine flowing curved lines via `DynamicTexture`, soft specular, discreet
  uniform emissive state tint), slow rotation (~1.15°/s) + breathing,
  transparent canvas. **Zero props, zero 3D labels, zero platform**.
- `spatial-player-babylon.html`: CSS atmospheric background (light/dark
  gradient + diagonal light), soft shadow + reflection under the sphere,
  favicon data-URI (0 console errors).
- Bundle measured: **1351 KB gzip** for the Babylon entry (the v1 ~350 KB
  figure was a hypothesis; this is the real, measured number — core engine
  dominates, flagged for Stage 2.2).
- Verified headless (Chromium + SwiftShader): ready emitted, loading hidden,
  opaque sphere at center, **transparent** corners (CSS background shows
  through), 0 console errors, in both `vite dev` and `vite build` + `vite
  preview` (AR-03).

## Stage 1.3 — Bridge with payload validation

- `src/spatial/bridge.ts`: kept source/origin guard; added payload shape +
  size validation (bounded string fields, finite/non-negative vault counts
  clamped like Unity's `RefreshVault`, strict `white`/`dark` theme, unknown
  types ignored).
- `src/spatial/bridge.test.ts`: 15 cases (pending queue, latest-wins,
  canvas-size report, reduced motion, source/origin, ready/error, plus the
  new validation cases).
- State → tint verified headless: idle/error/completed/attention/exploring
  shift the sphere center distinctly and in the correct direction, all
  discreet over pearl (no loud recolor).

## Checks

- `npm test -- --run` — **137 passed** (15 files).
- `npm run build` — green (two entries).
- Deps: `@babylonjs/core@9.37.0` exact, only (loaders/gui/inspector removed).
- Unity untouched (fallback).

## Decisión pendiente (go/no-go de Eduardo)

Fase 1 v2 cumple sus criterios: la esfera aparece en dev y en el bundle
(Vite preview), sin diorama, y el puente funciona en ambos sentidos. Riesgo a
vigilar: tamaño de bundle (1351 KB gzip) y fidelidad pixel del look (la
comparación visual es de Eduardo/juez, no del agente).
