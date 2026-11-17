# QC-13 — Workflow completion can attach output to the wrong work

Severity: **P1**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

Start captures startedFromWork, but the streaming completion handler passes the current selectedWorkId. Switching from work A to B during a run attributes A's execution to B.

## Evidence

- [src/main.ts:1834](/home/ed/loom-ide-tauri/src/main.ts:1834) (`async function runWorkflow(`)
- [src/main.ts:1901](/home/ed/loom-ide-tauri/src/main.ts:1901) (`function handleWorkflowStreamEvent(`)
- [src/main.ts:1859](/home/ed/loom-ide-tauri/src/main.ts:1859) (`function finishWorkflowRun(`)

## Root cause

Streaming run state retains progress but not its originating work ID. Unary execution correctly uses its captured origin.

## Expected behavior

Every result remains tied to the work/intent that started it, independent of navigation.

## Proposed correction

Keep startedFromWork in the existing per-run state and use it for completion and errors. Keep cancellation/request identity bound to that same run.

## Affected components

Workflow stream state and evidence association maps.

## Relevant Loom contracts

WorkflowProgress.execution_id and local WorkItem ID. Extracted current handler test demonstrates selection-at-completion behavior.

## Acceptance criteria

- Start under A, select B, finish: output belongs only to A.
- A second run cannot adopt the previous run's origin or completion.

## Verification strategy

Run the committed extracted-handler probe, then add a regression using the actual state path and a delayed contained workflow.

## Dependencies

QC-05 for live stream delivery.

## Regression risks

Do not infer origin from current view or newest execution.


---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`7f93a2f` + `0722fdd`). `workflowStreamOrigin` captured at start; persisted ownership maps; test stream-consumers.test.ts:27.
