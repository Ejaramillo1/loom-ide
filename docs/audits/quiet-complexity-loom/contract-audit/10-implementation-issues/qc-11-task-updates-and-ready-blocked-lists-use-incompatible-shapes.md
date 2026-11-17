# QC-11 — Task updates and ready/blocked lists use incompatible shapes

Severity: **P1**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

loom_task_update sends the task fields at top level although UpdateTaskRequest expects task. Ready/blocked responses use readyTasks/blockedTasks; tasks_of instead wraps an unrecognized response object as one task.

## Evidence

- [src-tauri/src/loom_tasks.rs:143](/home/ed/loom-ide-tauri/src-tauri/src/loom_tasks.rs:143) (`pub async fn loom_task_update(`)
- [src-tauri/src/loom_tasks.rs:73](/home/ed/loom-ide-tauri/src-tauri/src/loom_tasks.rs:73) (`fn tasks_of(`)
- [loom/proto/loom/v1/task.proto:430](/home/ed/work/loom/proto/loom/v1/task.proto:430) (`message UpdateTaskRequest`)
- [loom/proto/loom/v1/task.proto:536](/home/ed/work/loom/proto/loom/v1/task.proto:536) (`message GetReadyFrontResponse`)

## Root cause

Several distinct protobuf envelopes are normalized using a permissive generic JSON fallback, concealing invalid response shapes.

## Expected behavior

Task updates validate an UpdateTaskRequest; ready/blocked lists contain actual tasks or an honest empty list.

## Proposed correction

Use the actual task envelope and optional update mask. Decode tasks, readyTasks and blockedTasks at their individual boundaries; reject unknown object shapes. Check dependency envelopes and response status booleans while adding contract fixtures.

## Affected components

Task command module; task board detail/actions.

## Relevant Loom contracts

UpdateTaskRequest.task/update_mask; GetReadyFrontResponse.ready_tasks; GetBlockedTasksResponse.blocked_tasks. These defects are latent behind QC-10 on the current live gateway.

## Acceptance criteria

- Updating a task persists the selected fields.
- Ready/blocked lists preserve task IDs and render no blank response-object row.
- Unknown response shapes surface a contract error.

## Verification strategy

Use generated protojson fixtures for every task endpoint, then an isolated board dependency/transition scenario.

## Dependencies

QC-10 for live HTTP verification.

## Regression risks

Never interpret absent or malformed task data as a successful empty result.
