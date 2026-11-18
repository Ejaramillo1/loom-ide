# Babylon migration — decisions (Stage 1.1)

Recorded 2026-11-17, base `main` @ `70b5212` (contains `bf11bd3` and the
`ded26b6` merge; `tauri-prototype` is an ancestor).

## D1 — Dependencies (approved)

- `@babylonjs/core`, `@babylonjs/loaders`, `@babylonjs/gui` at `^9.37.0`
  (first-party packages republish under one version; do not mix).
- `@babylonjs/inspector` as a **devDependency** (debug only).
- License Apache 2.0. These are the only new dependencies of the
  migration. `@babylonjs/loaders` is installed now so a later glTF path
  (if one ever appears) needs no re-approval, but the objects are
  procedural and do not use it.

## D2 — Architecture

The Babylon player lives in the same iframe Unity uses today:
`public/spatial-player-babylon.html` + a TypeScript module under
`src/spatial/`, reproducing the exact `postMessage` contract of
`public/spatial-player.js`. `main.ts`'s message flow does not change.
Direct integration into `main.ts` (no iframe) is a later simplification,
out of scope.

## D3 — Object origin: procedural

The inventory confirms the scene is 100% procedural (Unity primitives +
lathe + generated 512px PBR maps; no `.fbx`/`.obj`/`.glb` in `Assets/`).
Babylon reproduces each object with `MeshBuilder` primitives +
`CreateLathe` + `PBRMaterial`, and the generated textures with procedural
`DynamicTexture`/height-field textures in Fase 2. No glTF import.

## D4 — Labels: Babylon GUI

`AdvancedDynamicTexture` (screen-space) reproduces the IMGUI behaviour:
labels always on top, rounded reading plate, skip when behind the camera.
DOM overlay labels are not used.

## D5 — Unity fallback

Unity stays behind a flag through Fases 1–2 (`?player=unity`); the
player is switched to Babylon by default in Stage 2.3. Full removal is
decided in Stage 3.3, not before.

## Deferred (recorded, not decided here)

- Removing the iframe and integrating the scene directly in `main.ts`.
- Godot is archived as a discarded alternative.
- Loom-as-judge driving the Babylon scene directly.
