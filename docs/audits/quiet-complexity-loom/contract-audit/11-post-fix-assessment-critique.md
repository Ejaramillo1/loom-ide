# Critique of the post-fix assessment

Baseline: b1f16bd, 15 November 2026. Reviewed current source, the supplied assessment, evidence/post-fix-evaluation.md, both audit roadmaps, connection documentation and actual Loom proto. Re-ran loom_stream::tests: 4 passed, 0 failed, 94 filtered. No model turn or user-data mutation performed in this critique.

Verdict: a correct, focused improvement with helper-test and reported HTTP evidence; full transport/UI correctness remains partially verified. “All residual risks are small” and “exactly delivers QC-04” are premature.

## What is established

- The streaming builder now sends session_id/agent_id/enable_trace; the custom Go encoding/json handler expects those names. Unary gateway camelCase remains unchanged. The recorded session-continuity and owner-mismatch probes are useful backend-contract evidence.
- weave_completed rejects nonempty string error and recognizes numeric 7/string COMPLETED. EOF without an observed completion becomes an error for loom-stream only. Other event channels have no such terminal validation.
- clarification_ack requires success AND accepted and propagates a server error. Missing accepted is not an interoperability bug under this proto: omitted proto3 bool means false. Do not relax this check speculatively.
- Commit scope is one Rust file, +61/-10. Four current stream helper/validation tests pass. Full-suite numbers in the evaluation are reported evidence, not fresh executions of this critique. Unity was explicitly NOT rerun by that evaluator, so the headline “every check re-run” needs qualification.

## Corrections to the confidence claims

1. Direct HTTP probes do not invoke Rust run_stream, its HTTP framing, Tauri event delivery, frontend registration or rendering. Unless a retained test actually traverses that path, call this backend HTTP live verification, not end-to-end proof of the IDE fix. The evaluation narrative alone does not supply a replayable raw capture or executed client harness for those turns.
2. The tests exercise helpers, not the request builder or socket reader. They do not guard emitted JSON, real EOF, chunk decoding, cancellation or event delivery. “No regressions found” means within this limited coverage.
3. sendChat awaits askLoomStream before activeStreams.set. start_loom_stream spawns a thread and returns immediately. A quick error/progress/terminal event can arrive first and be discarded by handleStreamEvent. The UI can then remain busy forever. Register immutable request state before invocation, and clean up exactly once on start rejection.
4. run_stream feeds a raw HTTP socket into BufReader.lines without decoding Transfer-Encoding: chunked. HTTP chunk boundaries are independent of SSE/JSON lines. A split data prefix/JSON payload can be corrupted or ignored; NDJSON gateway responses are still discarded. Fix body framing before merely accepting bare JSON lines.
5. Terminal handling needs explicit tests for FAILED stage 8/string FAILED even without an error string, malformed frames, errors after completion, valid completion followed by truncation, and cancellation near EOF. Do not infer all such cases are already solved by checking a single error key.
6. finishStream restores the composer only when st.text is empty. Partial replies on an error are not durably cached by that branch. Thus “draft restored” is conditional, not a universal recovery guarantee. Do not overwrite a newer human draft during recovery.
7. Connected is a transport state, not turn success; showing connected beside a rejected turn can be correct. Improve wording only after lifecycle correctness. The error card’s “Could not reach Loom” for a validation rejection is misleading, not evidence of disconnection.
8. Identity loss is a high-value functional repair, but unenforced autonomy and a nonlocal unauthenticated deployment remain higher-severity control risks. A roadmap that defers those until after cosmetic/admin expansion is not justified by this patch.
9. The verification added a permanent turn to an existing session. It is disclosed, but repeat unattended testing must use an explicitly isolated disposable profile. Do not repeat live tests against that session or silently delete evidence to clean up.
10. Current connection docs still describe every stream as SSE and a universal 16 MB response bound. The stream reader does not enforce that bound. Update docs to actual contracts, preserving historical evidence rather than editing it into a success story.

## Scope and evidence limits

Loom source is readable at /home/ed/work/loom; standing write scope is only /home/ed/loom-ide-tauri. Registering peer HTTP services, adding an approval-store endpoint or trace fields needs a separately authorized Loom-side task. No prompt should silently override that boundary, invent backend_config permission enforcement, or equate advisory labels with real authorization.

Primary source references: src-tauri/src/loom_stream.rs::ask_loom_stream/start_loom_stream/run_stream/weave_completed/clarification_ack; src/main.ts::sendChat/handleStreamEvent/finishStream; Loom proto/loom/v1/loom.proto::ExecutionStage/AnswerClarificationResponse; docs/LOOM_CONNECTION_MODEL.md. Exact source locations must be resolved again before implementation because the branch may advance.
