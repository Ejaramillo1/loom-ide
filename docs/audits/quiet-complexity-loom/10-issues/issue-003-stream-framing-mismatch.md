# Issue 003 — Non-weave Loom streams silently discard every payload

- **Title:** Non-weave Loom streams silently discard every payload (NDJSON vs SSE framing)
- **Severity:** P1 — core streaming features silently non-functional
- **Status (2026-11-15):** Confirmed, unchanged. Implement the fix on the
  decoded-body seam introduced for issue 017 (HTTP chunk framing): body
  framing first, then dispatch SSE vs NDJSON line formats per endpoint.

## Problem statement

The single SSE consumer in `loom_stream.rs` parses only `data:`-prefixed
lines. Only `/v1/weave:stream` uses that framing (custom handler). Every
other stream the IDE consumes is a grpc-gateway server-streaming RPC that
emits **NDJSON**: one `{"result": {…}}` JSON object per line, `\n`
delimited, no `data:` prefix. All such payloads are discarded as
"event:/id:/retry: lines", so the streams produce zero progress events
and end with `done`. There is no error — the features are simply inert.

Affected, verified:

- `GET /v1/sessions/{id}:subscribe` → session detail never live-refreshes.
- `POST /v1/workflows:stream` → "live progress" never updates (run still
  completes; results arrive after done via polling).
- `POST /v1/providers:abtest` → the A/B dialog never receives any answer,
  score, latency, cost, or winner; it renders an empty comparison.
- `GET /v1/patterns:stream` → pattern shelf never auto-refreshes.
- `POST /v1/skills:bulkImport` and `GET /v1/boards/{id}/updates:stream`
  would have the same problem if their routes existed (issues 001/002).

## Evidence and file references

- Live capture (`/tmp/opencode/subscribe-raw.log`, 2026-11-15): while a
  weave updated the session, the subscribe stream emitted
  `{"result":{"sessionId":"sess_008a09ea","agentId":"…","newMessage":{…}}}`
  lines with no `data:` prefix.
- grpc-gateway v2.33.0 source (Go module cache),
  `runtime/handler.go:ForwardResponseStream`: writes
  `marshaler.Marshal({"result": msg})` then a `\n` delimiter then flushes.
- IDE parser: `src-tauri/src/loom_stream.rs:426-435` — the only payload
  branch is `line.starts_with("data:")`; everything else (including bare
  JSON) is discarded; the comment mislabels these as `event:`/`id:`/
  `retry:` lines.
- Contrast: `/v1/weave:stream` is the one custom SSE handler
  (`pkg/server/http.go:133,315`; `sseStreamWrapper.Send` writes
  `data: …\n\n`).

## Root cause

**Confirmed.** One consumer assumed the custom weave handler's wire format
was universal (the parallel audit independently found the same defect —
contract-audit QC-05). The connection-model doc
(`docs/LOOM_CONNECTION_MODEL.md`) lists all six streams as "SSE" without
distinguishing framing.

## Expected behavior

Every stream's payloads are decoded and re-emitted as Tauri events, so the
UI renders live session updates, workflow progress, A/B results, and
pattern refreshes.

## Current behavior

Progress events never arrive; streams idle until the server closes them;
the UI shows "Running…" (workflows), an empty A/B dialog, and static
session detail.

## Proposed correction

In `run_stream`: treat every non-empty line that is not `:`-prefixed and
not `event:`/`id:`/`retry:` as a candidate payload — accept both
`data: {json}` lines and bare `{json}` lines; when the parsed object is an
envelope with a single `result` key, unwrap it before re-emitting. Keep
the existing skip-counter and terminal-event guarantees. Add unit tests
using the captured live subscribe bytes and the gateway's envelope shape.

## Affected components

- `src-tauri/src/loom_stream.rs`
- Frontend handlers (already correct once events arrive):
  `main.ts:1996` (session), `:1901` (workflow), `:2009` (abtest),
  `:4844` (patterns), `:4852` (skills)
- `docs/LOOM_CONNECTION_MODEL.md` (document the two framings)

## Relevant Loom contracts

- grpc-gateway v2.33.0 `ForwardResponseStream` (NDJSON `{"result":…}\n`)
- `docs/reference/streaming.md` (weave SSE only)

## Acceptance criteria

1. With a live session update, the subscribe stream produces a `progress`
   event and the session detail refreshes.
2. A workflow stream (any server with a workflow) updates the progress
   line per event.
3. A provider A/B run renders both providers' text and the winner.
4. Unit tests cover: `data:` lines, bare JSON lines, `{"result":…}`
   envelopes, mixed garbage (still counted, not dropped silently).

## Verification strategy

- Unit tests with captured fixtures; live re-run of the subscribe test
  from this audit; A/B test once providers are configured.

## Dependencies

- None (IDE-only). Independent of issues 001/002.

## Regression risks

- Low: the chat path (`data:` framing) must remain byte-identical — guard
  with the existing live weave-stream capture as a fixture test.

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`bdb92bb`). `read_response_events` (loom_stream.rs:851) unwraps gateway NDJSON `{"result": …}` and `{"error": …}` envelopes on the decoded-body seam. Fixtures: `ndjson_result_envelopes_are_unwrapped`, `ndjson_error_envelope_surfaces_the_message`.
