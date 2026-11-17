# Issue 012 — Eighteen bridge functions have no UI call site

- **Title:** Eighteen bridge functions have no UI call site
- **Severity:** P2 — unexposed capabilities and dead surface

## Problem statement

A call-site scan across `src/main.ts`, `src/knowledge.ts`, `src/spatial.ts`,
`src/app-menu.ts`, `src/theme.ts`, `src/sphere.ts` and `index.html` found
18 exported bridge functions never invoked by any UI code. Some are
redundant (the UI uses an equivalent path), most correspond to features
that are either missing from the UI or stranded behind broken endpoints.

Unused (never called):

- Task surface: `getLoomBoard`, `getLoomTask`, `updateLoomTask`,
  `transitionLoomTask`, `addLoomTaskDependency`, `removeLoomTaskDependency`,
  `boardReadyTasks`, `boardBlockedTasks`, `decomposeLoomTask`,
  `loomTaskContext` — decompose/dependencies/ready-blocked have **no UI at
  all**; the rest duplicate the kanban's claim/close/release/delete.
- Skills: none unused here (all three have forms) — but all 404 (issue 002).
- Apps: `getApp`, `updateApp` — update has no UI (create/delete/list do).
- Artifacts: `getArtifact` (the UI uses list + content + search).
- Schedules: `getWorkflowSchedule`, `pauseWorkflowSchedule`,
  `resumeWorkflowSchedule` (UI uses PATCH update),
  `cancelScheduledExecution` — **the server-side cancel for scheduled runs
  exists but no UI exposes it**.
- Tools: `requestToolPermissionCmd` — the tool permission request endpoint
  is wired but has no UI surface.

## Evidence and file references

- Scan result (this audit): zero references in the audited UI files for
  the 18 names listed; bridges in `src/api.ts:1095+`, `:1283-1303`,
  `:1325-1357`, `:1370-1385`.
- Endpoint liveness: `/v1/workflows/schedules/executions/{id}:cancel`
  (proto-registered), `/v1/tools:request-permission` (live validation
  probe), task endpoints (404 — issue 001).

## Root cause

**Confirmed (surface drift).** Phases added bridges faster than UI; the
7x7x7 pass registered commands without corresponding views in several
cases.

## Expected behavior

Every exposed server capability either has a UI or is deliberately absent
with a recorded reason; redundant bridges are removed or documented.

## Current behavior

Dead code plus three genuinely useful controls the user cannot reach
(schedule-execution cancel, tool permission request, task decomposition
once issue 001 lands).

## Proposed correction

- Wire the three high-value controls (cancel scheduled execution in the
  schedules row; permission request in the MCP tools drawer; decompose +
  dependencies + ready/blocked in the kanban once issue 001 is fixed).
- Remove or mark `#[allow(dead_code)]`-documented the redundant ones
  (pause/resume, single gets) after confirming no future use.
- Record the decision in DECISIONS.md.

## Affected components

- `src/main.ts`, `src/api.ts` (and `src-tauri/src/*` if any command is
  removed).

## Relevant Loom contracts

- `/v1/workflows/schedules/executions/{id}:cancel`,
  `/v1/tools:request-permission`, task RPCs (issue 001).

## Acceptance criteria

1. Each of the three controls has a visible UI path and a live test.
2. The remaining unused bridges are removed or documented with reasons.
3. No functional regression in the existing surfaces.

## Verification strategy

- Call-site scan as a CI check (grep-based or an import-usage test);
  live tests for the new controls.

## Dependencies

- Issue 001 for the task-side controls.

## Regression risks

- Low; removals are behind a scan + review.

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`1c6efb8`/`52c652a`). Schedule-history 'Cancel run' and tools 'Request permission…' dialogs now call the bridged commands; history reads protojson `executionId`; apps open detached with `noopener,noreferrer`.
