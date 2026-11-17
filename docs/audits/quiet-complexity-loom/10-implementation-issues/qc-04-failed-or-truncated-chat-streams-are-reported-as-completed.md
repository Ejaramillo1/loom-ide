# QC-04 — Failed or truncated chat streams are reported as completed

Severity: **P1**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Status (2026-11-15)

**PARTIALLY FIXED at `b1f16bd` — partial verification.** `run_stream`
now tracks completion via `weave_completed` (stage 7 / `"EXECUTION_STAGE_COMPLETED"`), surfaces a non-empty top-level `error` immediately, and
treats EOF-without-completion as an error on the weave stream only. The
four helper tests pass, and the live owner-mismatch rejection exercised
the error path at the HTTP level. **Still unverified/untested:** FAILED
stage without an error string, malformed frames, errors after completion,
completion followed by truncation, cancellation near EOF, and real EOF/
chunk-decode behavior (issues 016/017). "Draft restored" is conditional —
the composer is restored only when `st.text` is empty, so partial replies
on error are not durably cached and a newer human draft can be
overwritten (critique §5, §6).

## Status (2026-11-16)

**FIXED for the tested terminal shapes** (`de3b4fc` reader rebuild +
fixtures; `bdb92bb` framing decoder). Fixture-pinned cases: error text
(`weave_requires_completion_and_surfaces_application_errors`), stage-8/
FAILED without error text (`failed_stage_without_error_text_is_an_error`),
EOF before completion (`loom_stream_eof_without_completion_is_an_error`),
truncation mid-chunk (`truncated_mid_chunk_is_an_explicit_error`), error
after completion (`error_after_completion_is_an_error_not_a_success`),
cancel after completion (`cancel_after_completion_data_still_reports_
cancelled`), cancel during silence (`cancel_during_silence_stops_the_
reader`). Partial replies stay visibly partial and drafts survive
(`chat-lifecycle.test.ts`, 15 tests, extracted handlers + mocked
bridges). **Not yet distinct fixtures:** malformed JSON `data:` frames,
completion-then-truncation, cancellation exactly at EOF (tracked in
`15-execution-plan.md` W-7). Not "all terminal shapes tested" — the
tested list above is the accurate claim.

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


---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED + TESTED. `weave_completed` (loom_stream.rs:316) rejects error text, stage 8/`EXECUTION_STAGE_FAILED`, EOF-before-completion; fixtures cover error-after-completion (:1371), cancel-near-EOF (:1388), truncated-mid-chunk, chunked/trailer/real-TCP.
