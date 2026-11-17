# Issue 004 — Trace ids never reach the IDE; the observability surface is unreachable

- **Title:** Trace ids never reach the IDE; the observability surface is unreachable
- **Severity:** P1 — Evidence/observability integration is dead in practice

## Problem statement

The IDE's "View trace" button only renders when a chat reply carries a
`trace_id` (`main.ts:4969`), and the only source of that field is the
unary `POST /v1/weave` response. Loom never populates
`WeaveResponse.TraceId` — confirmed in code and in a live response with
`enableTrace: true`. Streaming turns (`WeaveProgress`) have no trace field
at all. Result: although the server stores spans (1 h, in-memory) and
`GET /v1/traces/{id}` works, no client can ever learn a trace id, so the
trace dialog is unreachable and the philosophy's "evidence one click away"
promise cannot be met.

## Evidence and file references

- Live unary weave (2026-11-15, `/tmp/opencode/weave-unary-live.json`):
  response contains `text`, `sessionId`, `agentId`, `cost`,
  `contextState` — **no `traceId`** despite `enableTrace: true`.
- `pkg/server/multi_agent.go:1138-1179`: a span is created, attributed,
  ended, and recorded — but the response built at `:1194-1200` sets only
  `Text`, `SessionId`, `AgentId`, `ContextState`, `Cost`. Nothing in the
  file assigns `TraceId` (grep-verified).
- `proto/loom/v1/loom.proto:815-842`: `WeaveResponse.trace_id` (field 4)
  exists; `WeaveProgress` has no trace field.
- `pkg/server/server.go:683`: `Server.GetTrace` is `Unimplemented`; the
  working implementation is `MultiAgentServer.GetTrace`
  (`pkg/server/observability_rpc.go:211`) over a 1-hour in-memory store.
- Live: `GET /v1/traces/bogus` → 404 "trace \"bogus\" not found" (route works).
- IDE side: `src-tauri/src/lib.rs:1779-1784` reads
  `trace_id`/`traceId`; `main.ts:4969-4976` renders the button;
  `main.ts:4241` the dialog.

## Root cause

**Confirmed (Loom-side).** The response builder omits the field. (Also
true that the IDE's streamed path could never show traces regardless —
WeaveProgress lacks the field — so a stream-side fix is a proto change.)

## Expected behavior

A chat turn produces a trace id the IDE displays, and "View trace" opens
the span list.

## Current behavior

No trace button ever appears; the dialog exists but is unreachable.

## Proposed correction

1. **Loom-side (one line):** in `multi_agent.go`, set
   `resp.TraceId = span.TraceID` (inside the `if span != nil` branch).
2. Optionally (proto change, upstream agreement): add `trace_id` to the
   completion `WeaveProgress`.
3. IDE: nothing required beyond what exists; optionally fall back to
   session-level observability (e.g. list spans by session) once the
   server exposes it.

## Affected components

- Loom: `pkg/server/multi_agent.go`; possibly `proto/loom/v1/loom.proto`
- IDE: none required (`lib.rs`, `main.ts` already wired)

## Relevant Loom contracts

- `WeaveResponse.trace_id` (loom.proto:826); `GetTrace` RPC +
  `GET /v1/traces/{trace_id}`; `pkg/observability` span model.

## Acceptance criteria

1. A live unary weave with `enableTrace: true` returns a non-empty
   `traceId` matching a span in the server's store.
2. The IDE's chat shows "View trace" and the dialog renders the spans.
3. (If adopted) the stream completion event carries the same id.

## Verification strategy

- Live weave → `GET /v1/traces/{id}` round-trip; UI-level CDP test of the
  trace dialog.

## Dependencies

- Loom-side change (small); Eduardo's approval to patch the local Loom
  checkout.

## Regression risks

- Minimal — additive field; ensure the empty-traceId case (tracer nil)
  still serializes as absent, matching existing gateway tests.

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (Loom `8082078` + IDE). `WeaveResponse.TraceId` is populated from the active span in both Weave and StreamWeave (multi_agent.go:1244/1577). `ChatReply.trace_id` decodes it, and the UI renders "View trace ›" when present (main.ts:5247).
