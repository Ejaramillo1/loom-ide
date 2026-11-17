# QC-05 — Non-chat subscriptions use the wrong streaming protocol

Severity: **P1**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

Workflow, provider comparison, session, pattern and task/skill streams all use the SSE-only reader. Loom registers only weave:stream as custom SSE; gateway streams use newline JSON envelopes instead.

## Evidence

- [src-tauri/src/loom_stream.rs:154](/home/ed/loom-ide-tauri/src-tauri/src/loom_stream.rs:154) (`pub fn execute_workflow_stream(`)
- [src-tauri/src/loom_stream.rs:312](/home/ed/loom-ide-tauri/src-tauri/src/loom_stream.rs:312) (`fn run_stream(`)
- [loom/pkg/server/http.go:133](/home/ed/work/loom/pkg/server/http.go:133) (`rootMux.HandleFunc("/v1/weave:stream"`)
- [loom/gen/go/loom/v1/loom.pb.gw.go:7113](/home/ed/work/loom/gen/go/loom/v1/loom.pb.gw.go:7113) (`forward_LoomService_StreamWorkflow_0              = runtime.ForwardResponseStream`)

## Root cause

The reader accepts only data: lines and discards other body lines. Consumers also expect unwrapped snake_case fields rather than gateway result envelopes and protojson fields.

## Expected behavior

Each supported stream delivers actual progress, application errors and terminal state to its existing UI.

## Proposed correction

Retain one small shared transport but decode HTTP chunking, choose SSE versus gateway newline JSON by the response contract, unwrap result/error, and normalize only at the existing feature boundary. Verify workflow, session, A/B, pattern and later task/skill contracts individually.

## Affected components

loom_stream.rs; all stream handlers and event interfaces in api.ts/main.ts.

## Relevant Loom contracts

Loom generated ForwardResponseStream bindings; WorkflowProgress, SessionUpdate, ABTestEvent and PatternUpdate. Live validation replies from workflows:stream and providers:abtest are application/json error envelopes, not SSE.

## Acceptance criteria

- Workflow progress and execution ID arrive.
- A/B responses display real provider output, score/cost and winner using actual event fields.
- Session and pattern updates refresh the intended objects; gateway stream errors are visible.

## Verification strategy

Capture safe isolated gateway streams and replay byte-split/chunked frames, both JSON naming formats and result/error envelopes. Then exercise each UI feature.

## Dependencies

QC-04 for terminal semantics; QC-10 before task/skill live streams exist.

## Regression risks

Do not repair this by treating all unknown lines as success or by inventing empty results.


---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`bdb92bb`). NDJSON `{"result":…}`/`{"error":…}` envelopes dispatch on the decoded-body seam; consumer decoding wired for workflow/A-B. Maps to issue 003.
