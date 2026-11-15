# QC-04 — Failed or truncated chat streams are reported as completed

Severity: **P1**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

Loom emits an error inside HTTP 200 SSE. The UI treats that event as progress, marks Loom verified, then takes EOF as done and shows completion. An abrupt close is also not distinguished from a successful terminal event.

## Evidence

- [src/main.ts:5043](/home/ed/loom-ide-tauri/src/main.ts:5043) (`function handleStreamEvent(`)
- [src/main.ts:5176](/home/ed/loom-ide-tauri/src/main.ts:5176) (`function finishStream(`)
- [src-tauri/src/loom_stream.rs:312](/home/ed/loom-ide-tauri/src-tauri/src/loom_stream.rs:312) (`fn run_stream(`)
- [loom/pkg/server/http.go:467](/home/ed/work/loom/pkg/server/http.go:467) (`func (s *sseStreamWrapper) writeError(`)

## Root cause

The Rust reader returns Ok on EOF regardless of application stage; the frontend ignores event.error and failed stage. The unary fallback only handles invoke/start rejection, not asynchronous endpoint rejection.

## Expected behavior

Success requires an explicit successful terminal application event; failures preserve partial output as partial, restore drafts when needed, and never mark completion.

## Proposed correction

Track terminal state and structured errors in the existing stream path. Fail incomplete streams and validate framing/content type. Register request state before events can arrive. Only use fallback when it cannot duplicate an already accepted operation.

## Affected components

Stream transport, chat handler, state pill/sphere and draft handling.

## Relevant Loom contracts

WeaveProgress.stage; custom SSE error payload. Empty-query live probe returned HTTP 200 with EXECUTION_STAGE_FAILED. Extracted current handler reproduces the false completion route.

## Acceptance criteria

- Server error, invalid JSON, EOF before completion and a rejected endpoint never show completed.
- A real completed stream shows its final answer.
- Stop and partial output stay distinct from failure/success.

## Verification strategy

Replay evidence/live-contract-probes.json through the production handlers, plus early-close, malformed-frame and cancellation tests; repeat through Tauri against an isolated server.

## Dependencies

None.

## Regression risks

Do not automatically replay a POST after uncertain execution; preserve partial replies and drafts.
