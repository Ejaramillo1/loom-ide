# QC-03 — Streaming chat loses the selected session and agent

Severity: **P1**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

The normal chat path sends sessionId, agentId and enableTrace to the custom SSE handler. Its Go encoding/json decoder ignores these names, so turns may start a new session on the default agent.

## Evidence

- [src-tauri/src/loom_stream.rs:86](/home/ed/loom-ide-tauri/src-tauri/src/loom_stream.rs:86) (`pub fn ask_loom_stream(`)
- [loom/pkg/server/http.go:324](/home/ed/work/loom/pkg/server/http.go:324) (`json.NewDecoder(r.Body).Decode(&req)`)
- [loom/gen/go/loom/v1/loom.pb.go:397](/home/ed/work/loom/gen/go/loom/v1/loom.pb.go:397) (`json:"session_id,omitempty"`)

## Root cause

The hand-written SSE handler uses generated Go JSON tags, unlike grpc-gateway protojson. Both formats exist in this server.

## Expected behavior

The selected session and immutable agent identity reach StreamWeave unchanged.

## Proposed correction

Use snake_case for this custom SSE endpoint, or deliberately change its decoder to accept protojson aliases while preserving its documented output. Keep unary gateway requests distinct.

## Affected components

Rust chat stream request builder; Loom custom SSE handler.

## Relevant Loom contracts

WeaveRequest.session_id / agent_id / enable_trace; evidence/contract_probe.go demonstrates loss using the exact generated type.

## Acceptance criteria

- Two turns reuse the chosen session.
- A non-default chosen agent actually executes both turns.
- Conflicting session-owner/agent requests surface the server error rather than rerouting.

## Verification strategy

Run the committed Go contract probe, then a contained two-agent/two-turn UI test and inspect persisted session ownership.

## Dependencies

QC-04 must also correctly surface routing errors.

## Regression risks

Do not change response naming: SSE progress is snake_case while gateway JSON uses camelCase.
