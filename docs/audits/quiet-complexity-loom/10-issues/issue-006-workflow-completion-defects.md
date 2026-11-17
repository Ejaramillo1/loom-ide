# Issue 006 — Workflow completion defects: wrong attribution and lost name

- **Title:** Workflow completion defects: wrong attribution and lost name
- **Severity:** P2 — evidence attribution and error reporting

## Problem statement

Two defects in the workflow completion path:

1. **Attribution race.** The streamed path calls
   `finishWorkflowRun(currentRunSeq, selectedWorkId, …)` at *completion*
   (`main.ts:1914`). `selectedWorkId` is whatever work is selected at that
   moment, not the work the run started from. If the user switches work
   while a workflow streams, the execution (and its Evidence row) is
   linked to the wrong work item. The unary path correctly captures
   `startedFromWork` at start and passes it through (`main.ts:1842,1927`).
2. **Lost name in errors.** In the error branch, `runningWorkflow` is set
   to `null` *before* the template uses it, so the user sees
   `Workflow "" failed: …` (`main.ts:1890-1893`).
3. **Volatile attribution.** `executionWorkIds`/`experimentWorkIds` are
   in-memory (`main.ts:291-292`); work↔execution links die on restart.

## Evidence and file references

- `src/main.ts:1842` (`startedFromWork` captured), `:1914` (streamed path
  passes `selectedWorkId`), `:1872-1873` (map writes), `:1890-1893`
  (null-before-use).
- `src/main.ts:2795-2823` (evidenceItems reads the volatile maps).

## Root cause

**Confirmed.** The streamed completion handler was written to use ambient
selection state; the null-before-use is an ordering slip in the error
branch; the maps were never persisted.

## Expected behavior

- An execution's Evidence row always belongs to the work it started from.
- The error names the workflow.
- Attribution survives restarts (persisted with the work record).

## Current behavior

- Wrong-work attribution after a mid-run work switch (streamed path).
- `Workflow "" failed`.
- Attribution lost on restart.

## Proposed correction

- Capture `startedFromWork` in `runWorkflow` (already there) and thread it
  through `handleWorkflowStreamEvent` into `finishWorkflowRun`.
- Reorder: capture `const failedName = runningWorkflow` before nulling;
  interpolate `failedName`.
- Persist `executionWorkIds` (and `experimentWorkIds`) — smallest change:
  a JSON map beside `work.json` (e.g. `execution-attributions.json`) or a
  field on the work item; load at startup.

## Affected components

- `src/main.ts` (workflow + evidence paths); optional new store file in
  `src-tauri/src/store.rs` or reuse `work.json`.

## Relevant Loom contracts

- Workflow executions carry no work attribution (`docs/loom-integration.md`;
  live list shape) — the IDE owns the mapping, so it must persist it.

## Acceptance criteria

1. A streamed run started from work A while work B is selected still
   appears under A's Evidence.
2. A failed workflow names the workflow in the error.
3. Restart preserves execution↔work links.

## Verification strategy

- Unit tests for the completion handler with mocked selection switches;
  restart test for persistence.

## Dependencies

- None (IDE-only).

## Regression risks

- Low; the unary path's correct behavior is the reference.

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED. `workflowStreamOrigin` is captured at start; `EXEC_WORK_KEY` ownership maps persist (`0722fdd`); stream-consumers.test.ts pins QC-13 (wrong-work attribution); run records link execution↔work.
