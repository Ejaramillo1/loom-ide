# Issue 015 — Stale citations and unreachable provenance copy

- **Title:** Stale citations and unreachable provenance copy
- **Severity:** P3 — documentation and dead copy

## Problem statement

Two documentation/truth-drift items:

1. The philosophy cites Loom docs at `documentation/architecture/*` and
   `documentation/guides/*` paths. In the current Loom checkout those
   files live under `docs/architecture/` and `docs/guides/` (verified:
   `weaver-system.md`, `task-system.md`, `human-in-the-loop.md` all exist
   under `docs/`; there is no `documentation/` directory). The citations
   are stale and erode auditability of the philosophy's "Loom hooks".
2. The attention dialog's non-experiment branch says
   "This item comes from the Loom server." (`main.ts:3213`). The backend's
   `get_attention` only ever produces local `decision` items; the
   `finding` kind (the intended future Loom surface) is never produced.
   The sentence is unreachable copy implying a source that does not exist.

## Evidence and file references

- `docs/01-design-philosophy.md` — multiple `documentation/…` references.
- `/home/ed/work/loom` — files exist under `docs/…`; no `documentation/`.
- `src/main.ts:3209-3214` (provenance copy), `src-tauri/src/lib.rs:539-563`
  (`get_attention` — decisions only), `src/api.ts:83-87`
  (AttentionItem kinds).

## Root cause

**Confirmed.** Path drift after Loom reorganised docs; dead copy left
behind from the reserved `finding` design.

## Expected behavior

Citations resolve to real files; UI copy only describes reachable states.

## Current behavior

Broken doc links; a claim of server provenance that can never render.

## Proposed correction

- Update the philosophy's paths to `docs/…` (and re-verify each cited
  file exists).
- Change the attention dialog's fallback to match reality
  ("This item is a local attention item.") or reserve the server wording
  behind the `finding` kind actually existing.

## Affected components

- `docs/01-design-philosophy.md`, `src/main.ts:3209-3214`.

## Relevant Loom contracts

- None (documentation only).

## Acceptance criteria

1. Every `documentation/` reference resolves (or is removed).
2. The attention dialog has no unreachable provenance claim.

## Verification strategy

- Link-check grep for `documentation/`; code review of the dialog branch.

## Dependencies

- None.

## Regression risks

- None.

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** STILL OPEN. Re-verified 2026-11-16: philosophy still cites `documentation/architecture/*` (docs/01-design-philosophy.md:28-58); the attention dialog provenance copy at main.ts:3431 is unchanged. P3.
