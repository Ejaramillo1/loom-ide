# Babylon migration — decisions (v2, updated 17 November 2026)

Recorded 2026-11-17, base `main` (contains `bf11bd3` and the `ded26b6`
merge). The original nine decisions replace v1 (D1–D5); §§10–11 and the
updates to §§2, 5 and 8 record the subsequent user requests. The v1 plan
is superseded by the critical review (`Plan_migracion_…_revision_critica.md`,
annex AR-01…AR-12).

## 1 — Engine

Babylon.js, only for the permitted spatial visualization (the sphere). No
second 3D frontend; Babylon does not become the UI.

## 2 — Central object

One pearl sphere with procedural curved lines and minimal motion. The
diorama (six objects, portals, labels, relation lines) **does not migrate**;
its functional navigation routes stay in DOM. The sphere returns to Overview;
Work, Experiments, Evidence, Agents, Knowledge and Code remain HTML shortcuts
around it. The separate floating mode menu is removed (latest user instruction).

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

Light and dark remain the only renderer themes. The implementation repair
retained the existing Charcoal, Dusk, Moss and Night preferences as subtle
host CSS atmosphere tints, preserving saved choices. Charcoal uses the base
atmosphere; the other three change a radial gradient. This supersedes the
earlier deferral of those controls. No themed 3D scenes, HDRIs or additional
Babylon backgrounds are introduced. The player canvas remains transparent.

## 6 — Interface

DOM/CSS/TypeScript. No text or cards in 3D. Babylon renders only the sphere
and its minimal ambience; background gradient, shadow, reflection and
typography live in CSS/DOM. The conversation lives in the right column of the
Overview, toggled from the header, and extends flush to the bottom of the
window, leaving the shell gap; longer responses scroll inside the log. The
sphere stage retains at least 260px. No separate resizing observer or
alternate conversation is introduced.

The decorative top-right avatar sphere and Agentic Collaboration card are
removed. Overview has no empty sidebar: the context column appears only when
Attention has an item. Agents remains available from its orbital control.
The catalogue, intent and autonomy controls remain in Work/Experiment via the
Work shortcut; Overview has no Work list/search or Intent disclosure.

## 7 — Loom

Read-only, no exceptions. The frontend/Rust adapter conforms to Loom's
existing contracts; no code, configuration, schema, or execution changes.

## 8 — Unity removal

The subsequent user instruction to get rid of Unity authorized retiring it
as the active renderer: Babylon is now the only loader target. Historical
Unity files remain preserved; deletion and machine-wide uninstallation are
outside this repair. `npm run test:spatial` replaces Unity recompile and
CheckWorkbench in the repository judge and AGENTS gates. No Unity fallback
view is introduced.

## 9 — Visual reference

The latest approved Quiet Complexity capture
(`docs/babylon-migration/reference/agent-memory-experiment-dashboard.png`,
SHA-256 `413f5ee2…`), not Unity. Frozen in `reference.md`.

## 10 — Sphere size

The sphere diameter is 60% of the **smaller iframe dimension**, not 60% of
the application width. Camera sizing and CSS shadow/reflection use that same
rule. The iframe now shares vertical space with the conversation, so the
sphere's share of the full viewport varies with reply length and screen size.
The earlier 25–29% desktop figures describe the former three-region layout.
Orbital controls now size from stage height instead of stretching across the
whole workspace. The layout does not claim exact reference-image proportions.

## 11 — State appearance

The pearl blends state pigment into its surface and rim instead of adding
light that clips to white. `src/spatial/state-colors.ts` is the renderer palette
source. Eight states must have pairwise-distinct rendered rim means in both
themes at High and Low quality. Motion is frozen for these pixel assertions.
Colors supplement the existing state text; they do not replace it.

## Deferred (recorded, not decided here)

- Removing the iframe and integrating the scene directly into `main.ts`.
- Loom-as-judge driving the Babylon scene directly.
- Godot stays archived as a discarded alternative.
- New 3D environments/HDRIs; the retained CSS preferences do not authorize them.
