# Binding visual reference — Quiet Complexity (v2)

The Babylon migration is measured against the **latest approved Quiet
Complexity capture**, not against Unity. This file freezes that reference.

## Frozen asset

| Field | Value |
|---|---|
| File | `docs/babylon-migration/reference/agent-memory-experiment-dashboard.png` |
| SHA-256 | `413f5ee22f9dc7385a521de231a5f1b51cc0001541a3bc79a109cfda791160e7` |
| Size | 1,603,284 bytes |
| Dimensions | 1671 × 941 px (8-bit RGB PNG) |
| Provenance | `/home/ed/Downloads/Agent Memory Experiment Dashboard.png` (and the identical `…(1).png`), downloaded 11 Nov 2026 |
| Approval | Referred to by the v2 migration plan as `Agent_Memory_Experiment_Dashboard_1.png` |

Any drift is detectable via the SHA-256. Pixel-level evaluations must be
performed against this exact file, at its native viewport.

## What the reference shows (textual record)

This model cannot ingest image pixels, so the description below is taken
from the v2 plan and `docs/01-design-philosophy.md` §6 (the approved visual
language), which both describe this capture:

- Warm ivory background with soft **diagonal light at the upper left** and a
  **discreet water reflection at the bottom**.
- A small header with dynamic intent: `You are working on: [intent]`.
- On the **left**: a discreet Work list and a contextual chat (compact but
  present).
- At the **center**: a **large pearl sphere** with very fine flowing curved
  lines; no large intent text block, no rows of buttons around it.
- On the **right**: a small **Agentic Collaboration** panel and an
  **Attention** panel (human decisions only).
- At the **bottom**: compact `Code · Experiment · Work` navigation.

## What the reference explicitly excludes

- Trees, rocks, scenery objects, ceiling skylight, noisy textures.
- Notebook, flask, toolbox/chest, laptop, robot, magnifier **meshes**.
- Floating 3D labels, a rectangular platform, portal ring.
- A giant center intent text, dashboard card/metric/button clutter.

## Superseded reference

`docs/APPROVED_VISUAL_REFERENCE.md` still points to
`docs/loom-unified-workbench-reference.webp` (the six-physical-object
"diorama" composition). That reference is **superseded for the Spatial
view** by the Quiet Complexity capture above (the ring vision, approved 15
Nov, is superseded by the Quiet Complexity direction of 17 Nov). The
`APPROVED_VISUAL_REFERENCE.md` wording and the amendment will be reconciled
in Stage 3.2, not now.

## Palette (from `design-tokens.json`)

| Token | White | Dark | Use |
|---|---|---|---|
| orb-base | `[248,238,230]` `#F8EEE6` | same | sphere pearl material |
| orb-pearl | `[235,220,211]` `#EBDBD3` | same | sphere secondary |
| orb-highlight | `[255,249,243]` | same | rim highlight |
| orb-line | `[216,191,180]` `#D8BFB4` | same | fine curved lines |
| orb-activity | `[169,189,217]` | `[169,189,217]` | exploring/executing tint |
| orb-attention | `[230,195,141]` | `[230,195,141]` | attention/amber tint |
| purple | `[161,134,116]` | `[185,164,144]` | idle/listening/processing |
| blue | `[106,145,204]` | `[139,166,204]` | exploring/executing |
| green | `[120,155,137]` | `[147,177,159]` | completed |
| amber | `[217,166,95]` | `[217,166,95]` | attention |
| red | `[184,117,112]` | `[211,146,138]` | error |

State tint is applied **discreetly** (a subtle emissive rim/tint), never a
loud full recolor of the pearl sphere (v2 risk H3).
