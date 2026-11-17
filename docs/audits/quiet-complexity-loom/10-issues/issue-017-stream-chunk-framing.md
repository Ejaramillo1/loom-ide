# Issue 017 — The stream reader does not decode HTTP chunked framing; large SSE events can be corrupted or dropped

- **Title:** The stream reader does not decode HTTP chunked framing; large SSE events can be corrupted or dropped
- **Severity:** P1 — primary chat path and all six other streams
- **Status (2026-11-15):** **Confirmed** at source against `b1f16bd`
  (no chunk decoding in `run_stream`); the >2 KB split trigger is
  **strongly supported** (Go `net/http` chunked writer splits writes that
  exceed its internal ~2048-byte response buffer). Companion critique
  item: `contract-audit/11-post-fix-assessment-critique.md` §4.

## Problem statement

`run_stream` feeds the **raw TCP socket** into `BufReader::lines()` and
parses SSE from those lines. The Loom SSE handler
(`sseStreamWrapper.Send`) writes each event with `fmt.Fprintf` and
immediately `Flush()`es through Go's `net/http` — which, with no
Content-Length on a streaming response, emits the body as HTTP/1.1
**chunked transfer encoding**. Each flushed write becomes one chunk, but a
write larger than the server's internal response buffer (~2048 bytes) is
split across multiple chunks *mid-payload*.

The reader therefore observes chunk-size hex lines (discarded only by
accident of the catch-all branch) and, for large events, a JSON payload
split at a chunk boundary. The split halves never form a valid JSON line:
the event is counted as a skipped chunk and its content is lost. If the
split hits the completion event (which carries `cost` and `context_state`
and is typically the largest event of a turn), a successful turn ends with
"Loom disconnected before confirming completion" — a false failure. Small
turns work today only because small events happen to flush as single
chunks; nothing in the protocol guarantees that.

Secondary defects in the same reader: no response-size bound on the
stream path (the 16 MB cap exists only in the unary reader, contrary to
`docs/LOOM_CONNECTION_MODEL.md`); chunk trailers are not handled; and an
invalid `LOOM_ADDR` panics the reader thread via
`addr.parse().unwrap()`.

## Evidence and file references

- `src-tauri/src/loom_stream.rs:341-460` — `TcpStream` → `BufReader::lines`
  with no transfer-encoding awareness; `data:` line parsing at 452-454.
- `src-tauri/src/lib.rs:1217-1328` — `loom_http_raw`, the unary reader,
  which **does** decode chunked bodies and enforce the 16 MB cap — the
  existing in-tree seam the stream reader should reuse.
- `pkg/server/http.go:430-451` — `Send`: one `Fprintf` + `Flush` per event
  (chunked body, no Content-Length); `writeError` at 467-490 and
  `writeHeartbeat` at 456-465 behave the same.
- Go `net/http` server response writer: buffered chunk writer splits
  writes larger than its internal buffer (~2048 bytes) into separate
  chunks (stdlib behavior; exact constant re-verified at implementation
  time).
- `docs/LOOM_CONNECTION_MODEL.md:63-66` — claims "16 MB per response" and
  "Chunked bodies read to EOF" for the connection model; true of the
  unary reader only (critique §10).

## Root cause

**Confirmed.** HTTP body framing (chunked or content-length) is decoded
nowhere on the stream path; line framing is applied directly to the
transfer-encoded byte stream.

## Expected behavior

Body framing is decoded before SSE/NDJSON line parsing; a JSON payload
split across chunk boundaries parses exactly as if it arrived in one
chunk; every stream has a bounded buffer; invalid addresses fail with an
error, not a panic.

## Current behavior

Events smaller than the server's write buffer parse (single-chunk flush).
Events larger than ~2 KB can be corrupted or dropped; a split completion
event turns a successful turn into a false failure; NDJSON gateway
streams are discarded regardless (issue 003, separate defect on the same
reader).

## Proposed correction

1. Give `run_stream` the same body-framing handling the unary reader
   already has: parse the response head; decode
   `Transfer-Encoding: chunked` (sizes, CRLF, trailers, zero chunk)
   incrementally as bytes arrive; honor Content-Length when present.
   Feed **decoded body bytes** into a small shared SSE/NDJSON line
   splitter (issue 003's dispatch lands on top of this).
2. Apply a per-stream size bound (16 MB, matching the documented model,
   or an explicitly documented per-event bound).
3. Replace `addr.parse().unwrap()` with a `Result` (map to the existing
   "Loom is unavailable" error path).
4. Preserve the existing behavior that matters: cancel checks on every
   read wake, the 20 s wake timeout, heartbeat skipping, non-2xx error
   body capture, skipped-chunk reporting.

## Affected components

- `src-tauri/src/loom_stream.rs` — `run_stream` (and its tests).
- `src-tauri/src/lib.rs` — optionally factor the chunk decoder into a
  shared helper used by both readers.

## Relevant Loom contracts

- `pkg/server/http.go` `sseStreamWrapper.Send` / `writeError` /
  `writeHeartbeat` — chunked SSE, snake_case `data:` JSON.
- grpc-gateway NDJSON `{"result": …}` framing for the five non-SSE
  streams (issue 003 / QC-05).

## Acceptance criteria

Loopback TCP fixtures (no Loom required):

1. 200 OK with Content-Length body: events parse.
2. Chunked body with an event split across chunk boundaries: parses
   exactly as an unsplit event.
3. Chunked body with CRLF trailers and a zero chunk: clean EOF.
4. Truncated mid-chunk body: explicit error, never a false completion.
5. An event larger than 2048 bytes parses; a split completion event still
   completes the turn.
6. Invalid `LOOM_ADDR` returns an error (no panic).

## Verification strategy

Rust unit/integration tests with a minimal local TCP fixture server
(permitted loopback fixture — no live Loom, no model calls). A live check
against a disposable isolated profile is optional and not required for
acceptance; direct HTTP probes against a shared server do **not** prove
the patched reader path (critique §1).

## Dependencies

None. Implement body framing before the NDJSON dispatch of issue 003 so
both defects are fixed on the same reader without rework.

## Regression risks

Medium — the reader is shared by all seven streams. Guard with the
existing stream tests plus the new fixtures; keep the 30-minute cap and
cancel semantics intact while restructuring the read loop.

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`bdb92bb`). `BodyDecoder` decodes chunked/Content-Length/EOF framing before SSE/NDJSON line parsing; 13 fixtures incl. split-across-chunk-boundaries, trailers/zero-chunk, truncated-mid-chunk, real loopback TCP; live chunked weave verified (doc 13 §1c).
