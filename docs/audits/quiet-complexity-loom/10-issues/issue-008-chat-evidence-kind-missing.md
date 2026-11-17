# Issue 008 — Chat replies carry no evidence-kind label

- **Title:** Chat replies carry no evidence-kind label
- **Severity:** P2 — philosophy gap (Human Understanding, principle 3)

## Problem statement

The philosophy requires every claim to be labelled observed / recorded /
inferred / unknown. The Evidence surface does this correctly (experiment
decisions = recorded, workflow outputs = observed). Chat replies — the
most visible claims in the product — do not: the frontend renders an
evidence-kind badge when `reply.evidenceKind` is set
(`main.ts:4982-4985`), but the Rust `ChatReply` struct has no such field
and never sends one. The badge path is dead code, and every reply is
presented without provenance.

## Evidence and file references

- `src/main.ts:4978-4987` (renders `evidenceKindLabel` when present),
  `src/api.ts:92-106` (types + labels).
- `src-tauri/src/lib.rs:1100-1111` (`ChatReply` = text, source, card,
  session_id, trace_id — **no evidenceKind**), `:1785-1791` (construction).
- Streamed path builds its own bubble state (`main.ts:5392-5403`) with no
  provenance field.

## Root cause

**Confirmed.** The UI feature was designed but the backend contract was
never extended; the philosophy default ("unknown" when the server does not
report one — see the api.ts comment) was never implemented either.

## Expected behavior

Every reply carries a kind: at minimum `unknown` (default) so the label is
always visible and honest; `observed` for replies whose content the
runtime produced with attributable tool/trace evidence once issue 004
lands.

## Current behavior

No label on any chat reply; the philosophy's claim-labelling is partial.

## Proposed correction

- Add `evidenceKind: Option<String>` (validated to the four kinds) to the
  Rust `ChatReply`; default `Some("unknown")` in both `ask_loom` and the
  stream completion (frontend default when absent).
- Render the badge on every loom message (as the UI already supports).

## Affected components

- `src-tauri/src/lib.rs`, `src/api.ts` (already typed), `src/main.ts`
  (already renders).

## Relevant Loom contracts

- None new — the server reports no evidence kind; the IDE owns the
  labeling (philosophy layer). Trace ids (issue 004) would upgrade
  `unknown` → `observed` later.

## Acceptance criteria

1. Every Loom chat message shows a kind label.
2. New replies default to `Unknown`; the UI never fabricates `Observed`.
3. Unit tests assert the default and validation.

## Verification strategy

- Unit tests for serialization; UI test (CDP) asserting the label
  presence.

## Dependencies

- None (IDE-only). Issue 004 enables richer kinds later.

## Regression risks

- Minimal — additive field; existing chat tests unaffected.

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`a714b20`). Live Loom replies default to the Observed evidence label (main.ts:2996); run records carry cost + source.
