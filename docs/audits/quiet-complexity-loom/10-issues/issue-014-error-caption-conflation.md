# Issue 014 — Error-state caption conflates vault failure with Loom failure

- **Title:** Error-state caption conflates vault failure with Loom failure
- **Severity:** P3 — misleading status wording

## Problem statement

`currentLoomState()` maps `knowledgeFailed` (the markdown vault failed to
load) into the **error** sphere state, and the error caption reads
"Needs attention — check the connection or local activity." In the
browser preview the vault is deliberately unavailable, so a perfectly
healthy Loom connection is permanently presented with an error caption
that names "the connection" first. In the desktop app, a vault problem
would likewise taint the Loom status wording.

## Evidence and file references

- `src/main.ts:6756` — `knowledgeFailed || … ? "error"`.
- `src/main.ts:173` — `CAPTIONS.error`.
- Observed live in the headless UI test: pill title
  "A verified Loom response was received from localhost:5006. Needs
  attention — check the connection or local activity." — a *connected*
  state carrying an error caption.

## Root cause

**Confirmed.** One caption serves two different failure domains.

## Expected behavior

Loom-connection wording reflects Loom state; vault problems get vault
wording.

## Current behavior

A healthy, verified Loom connection can display "check the connection"
wording.

## Proposed correction

- Split the caption by the dominant cause: if `knowledgeFailed` alone,
  use vault wording ("Knowledge vault unavailable — open Knowledge to
  retry"); keep the connection wording for actual Loom drops.

## Affected components

- `src/main.ts` (CAPTIONS + currentLoomState).

## Relevant Loom contracts

- None (IDE wording).

## Acceptance criteria

1. With the vault unavailable and Loom verified, the caption names the
   vault, not the connection.
2. With Loom offline, the current wording remains.

## Verification strategy

- Browser-preview CDP check (vault always unavailable there) + unit test
  on currentLoomState.

## Dependencies

- None.

## Regression risks

- Minimal (string + branch).

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`1c6efb8`). Rejection vs disconnection split by `isLoomConnectionError` on both paths: "Loom rejected the turn/message" vs "Loom stopped answering / Could not reach Loom". Test: chat-lifecycle.test.ts:356.
