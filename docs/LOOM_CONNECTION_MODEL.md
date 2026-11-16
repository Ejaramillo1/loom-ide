# Loom connection model

The contract between the IDE backend and the Loom server — probes, timeouts,
retries, stream behaviour and the states the user sees. Written so a future
audit checks the code against this document, not the other way around.

## Address and auth

- Address: `127.0.0.1:5006` by default; the `LOOM_ADDR` environment variable
  overrides it without recompiling (§2.2.4).
- Auth: none. Loom's auth is server-side; the IDE talks to localhost
  unauthenticated — fine locally, not portable. **Decision registered: no
  client auth until a non-local deployment names it.**

## Timeouts (per operation)

| Operation | Timeout |
| --- | --- |
| TCP connect | 2 s |
| Write | 5 s |
| Read, GET | 4 s |
| Read, POST (unary) | 180 s |
| Stream read wake | 20 s (re-checked on every wake; heartbeats keep it warm) |
| Stream global cap | 30 min |

## Retries

- One retry, after 500 ms, for transient connection failures — **GETs only**.
  A failed POST is never replayed: it may have executed server-side.
- Streams are not auto-retried: replaying a weave re-executes the turn.
  A dropped stream is shown as an error ("Loom stopped answering"), never as
  silence.

## Probe and connection states

- `get_loom_status` probes `/v1/health` once at startup, on demand (clicking
  the header pill), after a stream connection error (one shot at 3 s), and
  every 10 s while offline. The probe result validates the body shape
  (status/components), not just the HTTP code.
- Pill states, in order: **Checking Loom…** (first probe pending) →
  **Connected to Loom** (a Loom-level response verified since the last
  drop) → **Server reachable** (probe OK, nothing verified yet) →
  **Reconnecting…** (a drop was detected; probes continue) → **Loom
  offline** (probes failing).
- A connection drop invalidates the previous "verified" claim: the pill
  never shows a stale Connected.

## Streams

- Endpoints: `/v1/weave:stream`, `/v1/workflows:stream`,
  `/v1/sessions/{id}:subscribe`, `/v1/providers:abtest`,
  `/v1/patterns:stream`, `/v1/boards/{id}/updates:stream`. All ride one SSE
  consumer (`loom_stream.rs`) that re-emits `data:` payloads as Tauri
  events keyed by request id.
- Stop: `cancel_loom_stream` sets a flag checked on every wake — a silent
  stream cancels within ~20 s. Unknown request ids are an error.
- Non-JSON `data:` chunks are counted and reported in a final progress
  event, never dropped silently. Non-2xx stream responses carry the
  server's error body.
- `event:`, `id:` and `retry:` SSE lines are deliberately discarded: every
  event this app renders arrives in `data:` payloads.

## Response limits

- 16 MB per response; larger bodies error. Both readers decode HTTP body
  framing before parsing: chunked bodies (sizes, trailers, zero chunk)
  and Content-Length bodies are read to EOF within the read timeout —
  the stream reader gained the same framing the unary reader always had
  (commit bdb92bb).

## Cancellation of the unary fallback

- The unary `POST /v1/weave` path has no server-side cancel; Stop works on
  the streaming path (the default). The unary path exists only as the
  fallback for a server that does not stream.
