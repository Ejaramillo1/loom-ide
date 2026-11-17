# Post-fix evaluation — commit b1f16bd ("fix: preserve streaming identity and validate Loom outcomes")

Evaluation date: **2026-11-15** · tree verified clean at `b1f16bd` (no
uncommitted non-audit changes). Evaluated against the same evidence
standard as the master audit: source review, fresh test runs, and live
probes against the running Loom v1.4.0 server.

## Claim-by-claim verification

| Claim | Verdict | Evidence |
|---|---|---|
| Streaming preserves the selected session and agent | **VERIFIED LIVE** | `loom_stream.rs` now sends `session_id`/`agent_id`/`enable_trace` (snake_case), matching the custom SSE handler's `encoding/json` decoder (generated proto tags). Live happy path: stream addressed to `sess_d7f154c9` + `internet-researcher` completed with `stage:7` and grew that session 2→4 conversations, no new session. Live mismatch path: `session_id:sess_d7f154c9` + `agent_id:guide` → server rejected with `FailedPrecondition: session belongs to a different agent` — identity is now *enforced*, not dropped |
| Server errors no longer count as successful completion | **VERIFIED (code + live + tests)** | `run_stream` tracks `completed` via `weave_completed()` (stage 7 numeric / `EXECUTION_STAGE_COMPLETED` string; matches `loom.proto:1019`). A non-empty top-level `error` field returns `Err` immediately; EOF without completion returns `Err("Loom disconnected before confirming completion.")` → terminal `error` event. Live: the agent-mismatch error event exercised exactly this path at the HTTP level. Unit tests: `weave_requires_completion_and_surfaces_application_errors` |
| Premature disconnects no longer count as completion | **VERIFIED (code)** | EOF → `completed == false` → error terminal event; draft restoration handled by the existing frontend error branch. Not unit-tested (needs a TCP fixture) — see residual risks |
| Clarification answers validate Loom's actual acceptance fields | **VERIFIED (contract + tests)** | `clarification_ack` requires `success == true && accepted == true` per `AnswerClarificationResponse` (`loom.proto:1370`); server `error` surfaces; unit test `clarification_requires_explicit_acceptance`. Not exercised live (no hold raised) |

## Checks (all re-run fresh during this evaluation)

- Frontend: **63/63** vitest, 8 files — exit 0
- Tauri: **96 passed, 2 ignored** — exit 0 (includes the two new unit tests)
- Native: **22 passed** — exit 0
- `cargo fmt --check`, `cargo check` — exit 0
- Live gateway contract test (`live_gateway_responses_parse`, `--ignored`) — **passed** against the running server
- Unity recompile was not re-run in this evaluation (no C# changes in the commit); the prior pass was 0 errors/0 warnings

## Scope and sequencing assessment

- The commit touches **only `src-tauri/src/loom_stream.rs`** (+61/−10): the
  exact scope of QC-03, QC-04, QC-06. Correct minimal surface.
- **Decision "shared transport first" is sound**: matching the custom SSE
  handler's snake_case decoding fixes identity without any Loom-side
  change. Trade-off: the IDE now depends on that decoder's tags — if Loom
  ever switches the SSE handler to protojson (camelCase), this silently
  breaks again. Recommend recording the wire-format fact in
  `docs/LOOM_CONNECTION_MODEL.md` (two formats coexist; stream requests
  are snake_case, unary requests are camelCase) and adding a body-level
  unit test asserting the emitted keys.
- **No regression in the unary path**: `ask_loom` (lib.rs) still sends
  camelCase to the protojson gateway — verified live earlier (`agentId:
  "guide"` routed correctly). Correct separation.
- **Concurrent audit files preserved**: the parallel pass's docs were
  committed in `8e696a7`; this audit's merged set remains untracked
  alongside them. No design defaults changed.

## Residual risks and gaps (post-fix)

1. **No unit test guards the wire fix itself.** Nothing asserts the
   streamed request body contains `"session_id"`/`"agent_id"`. A future
   edit could regress QC-03 silently. Add a body-encoding test.
2. **EOF-without-completion branch untested.** The `Err("Loom
   disconnected before confirming completion.")` path has no unit test;
   a loopback-TCP fixture would close that gap.
3. **`clarification_ack` requires both fields.** A server that returns
   `{"success": true}` without `accepted` (e.g. a future/older version)
   would report a delivered answer as failed. Conservative-honest choice;
   acceptable, worth a comment.
4. **Error wording**: a validation rejection surfaces as "Loom stopped
   answering: rpc error: code = FailedPrecondition…" — accurate content,
   slightly misleading wrapper for non-disconnect errors. Cosmetic.
5. **QC-04 frontend nuance**: the pill still marks `loomVerified` on any
   progress event. Defensible (a response *was* verified), but the pill
   can read "Connected to Loom" while the turn itself shows an error
   note. Consider distinguishing transport verification from turn outcome
   in the pill title.
6. **Still open (correctly disclosed)**: autonomy enforcement (QC-01),
   stored approvals (QC-07 — approve/deny still routes through the
   clarification endpoint), gateway NDJSON streams (QC-05), management
   request shapes (QC-08/11/12/21/22), inert context pack (QC-09),
   durable evidence links (QC-13/14, issue 006), trace ids (issue 004).
7. **Live graphical execution not checked** — same environment
   limitation as the audit (no real-window pixel pass); the UI-level CDP
   test in this audit's evidence remains the strongest UI verification.

## Verdict

**The three fixes are correct, minimal, and verified.** The identity fix
is the single most important repair in the audit — it restores session
continuity and agent routing on the primary path, live-proven in both
the happy and the rejection case. Failure-reporting and clarification
decoding now follow Loom's actual contracts. No regressions found in the
touched paths; test coverage is good but should gain two small additions
(wire-encoding assertion, disconnect fixture). The commit is a genuine
step toward the completion criteria in `00-final-assessment.md` — items
1, 2 and 6 (HITL decoding half) — with the remaining roadmap phases
unchanged.
