# Babylon migration — decisions (v2, Stage 1.1)

Recorded 2026-11-17, base `main` (contains `bf11bd3` and the `ded26b6`
merge). These nine decisions replace the v1 decisions (D1–D5); the v1 plan
is superseded by the critical review (`Plan_migracion_…_revision_critica.md`,
annex AR-01…AR-12).

## 1 — Engine

Babylon.js, only for the permitted spatial visualization (the sphere). No
second 3D frontend; Babylon does not become the UI.

## 2 — Central object

One pearl sphere with procedural curved lines and minimal motion. The
diorama (six objects, portals, labels, relation lines) **does not migrate**;
its functional navigation routes stay in DOM.

## 3 — Dependencies

Only `@babylonjs/core` at first, **exact** version `9.37.0` (no caret),
with `package-lock.json` and reproducible `npm ci`. `@babylonjs/loaders`,
`@babylonjs/gui`, and `@babylonjs/inspector` only when justified and
approved. Apache 2.0. These are new dependencies and need explicit approval.

> v1 installed `@babylonjs/{core,loaders,gui}@^9.37.0` + `inspector`
> (devDependency). v2 corrects this to `@babylonjs/core@9.37.0` only.

## 4 — Container

Temporary iframe for compatibility (change one variable at a time), with
its entry processed by Vite (multi-page: `spatial-player-babylon.html`
outside `public/`, declared in `rollupOptions.input`). The iframe is not
removed in the first phase.

## 5 — Backgrounds

Light and dark, coherent with Quiet Complexity. The four inherited themed
backgrounds (charcoal/dusk/moss/night) go to separate evaluation; they are
not a migration requirement.

## 6 — Interface

DOM/CSS/TypeScript. No text or cards in 3D. Babylon renders only the sphere
and its minimal ambience; background gradient, shadow, reflection and
typography live in CSS/DOM.

## 7 — Loom

Read-only, no exceptions. The frontend/Rust adapter conforms to Loom's
existing contracts; no code, configuration, schema, or execution changes.

## 8 — Unity removal

After green tests, approved captures, a verifiable local backup, zero lost
features, and **explicit approval**. Not automatic. Until then Unity stays
as a labeled fallback.

## 9 — Visual reference

The latest approved Quiet Complexity capture
(`docs/babylon-migration/reference/agent-memory-experiment-dashboard.png`,
SHA-256 `413f5ee2…`), not Unity. Frozen in `reference.md`.

## Deferred (recorded, not decided here)

- Removing the iframe and integrating the scene directly into `main.ts`.
- Loom-as-judge driving the Babylon scene directly.
- Godot stays archived as a discarded alternative.
- The four themed backgrounds: separate evaluation.
