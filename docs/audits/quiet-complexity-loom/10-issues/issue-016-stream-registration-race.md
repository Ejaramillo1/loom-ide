# Issue 016 — Chat stream events can arrive before reply state registration and are discarded

- **Title:** Chat stream events can arrive before reply state registration and are discarded, leaving chat busy
- **Severity:** P1 — primary chat path reliability
- **Status (2026-11-15):** **Confirmed** at source against `b1f16bd`.
  Companion critique item:
  `contract-audit/11-post-fix-assessment-critique.md` §3.

## Problem statement

`sendChat` awaits the `askLoomStream` Tauri invoke **before** inserting the
reply's `StreamReplyState` into `activeStreams`. The Rust side
(`start_loom_stream`) spawns the reader thread and returns `Ok(())`
immediately, so the thread can emit events — including the terminal
`error` event — before the frontend continuation runs
`activeStreams.set(requestId, state)`. `handleStreamEvent` silently drops
every event whose request id is not registered. If the *terminal* event is
dropped this way, `finishStream` never runs: `chatInFlight` is never
decremented, the empty reply bubble stays, the Stop button never appears,
and `cancel_loom_stream` has already removed its flag entry, so Stop
reports "No stream with that request id is running." The chat panel is
stuck busy until the app reloads.

The trigger is realistic, not theoretical: with Loom stopped, the thread's
`TcpStream::connect` fails in microseconds and the terminal `error` event
is emitted almost immediately — well within the IPC round-trip window of
the `askLoomStream` invoke. Event delivery to the webview listener and the
invoke promise continuation are two independent asynchronous paths with no
ordering guarantee between them.

## Evidence and file references

- `src/main.ts:5346-5409` — `sendChat`: `chatInFlight++` at 5356;
  `await askLoomStream(...)` at 5371; `activeStreams.set(requestId, state)`
  at 5404.
- `src/main.ts:5043-5045` — `handleStreamEvent`: `const st =
  activeStreams.get(p.requestId); if (!st || st.finished) return;`
  (silent discard for unknown ids).
- `src/main.ts:5176-5186` — `finishStream` is the **only** place
  `chatInFlight` decrements (`if (activeStreams.size === 0)`).
- `src-tauri/src/loom_stream.rs:33-70` — `start_loom_stream` spawns the
  reader thread and returns immediately; the thread emits the terminal
  event and removes its cancel entry.
- `src-tauri/src/loom_stream.rs:130-149` — `cancel_loom_stream` errors for
  an unknown request id.

## Root cause

**Confirmed.** Request-scoped state is registered after an `await` over a
command whose backend work starts on a separate thread before the command
returns; there is no buffering or replay of early events.

## Expected behavior

An event for a request either arrives after registration or is buffered
and replayed. The terminal event settles the in-flight count exactly once
in every outcome (success, error, cancel, invoke rejection). Sending a
message with Loom offline shows the error note and leaves the composer and
Stop in consistent states.

## Current behavior

Early events are discarded. If the terminal event is among them, the UI is
busy forever with an empty assistant bubble and no error note.

## Proposed correction

1. Build the `StreamReplyState` and insert it into `activeStreams`
   **before** invoking `askLoomStream`; set `activeStreamId` before the
   invoke as well. If the invoke rejects, remove the state and settle
   `chatInFlight` exactly once, then run the existing unary fallback only
   when the rejection is invoke-level (pre-spawn, no POST accepted) —
   which is the only rejection `ask_loom_stream` can return today.
2. Add an exactly-once settle guard (`state.finished` plus a shared
   settled flag) so the unary fallback and a racing terminal event cannot
   double-decrement `chatInFlight`.
3. Optionally (defense in depth): buffer `loom-stream` events for unknown
   request ids for one tick and replay them after registration; drop the
   buffer when no registration follows within a short window.

## Affected components

- `src/main.ts` — `sendChat`, `handleStreamEvent`, `finishStream`.
- `src-tauri/src/loom_stream.rs` — `start_loom_stream` (terminal emit
  ordering is fine; the fix is frontend-side).

## Relevant Loom contracts

None server-side. The contract at risk is the Tauri event envelope
`{ requestId, kind: progress|done|error|cancelled, event?, error? }`
defined in `loom_stream.rs` and consumed in `main.ts`.

## Acceptance criteria

1. An event emitted before registration is not discarded (buffered or
   registration precedes the invoke).
2. A terminal event always settles the chat exactly once — `chatInFlight`
   returns to 0 in every outcome.
3. Sending a message while Loom is stopped shows the error note; the chat
   is not stuck busy; the composer can be used again.
4. Stop still reports unknown request ids as an error.
5. All existing frontend tests (63/63) and Rust tests (96 passed / 2
   ignored) still pass.

## Verification strategy

- Vitest unit tests over `sendChat`/`handleStreamEvent` with a stubbed
  `askLoomStream` that resolves *after* a synthetic terminal event is
  delivered.
- A Rust loopback TCP fixture in `loom_stream::tests` that emits a
  terminal event before `start_loom_stream` returns, asserted at the
  event-envelope level.
- Manual check (safe profile only): chat with the Loom service stopped.

## Dependencies

None.

## Regression risks

Medium — the fallback path also decrements `chatInFlight` (in its
`finally`), so the settle guard must cover both paths; the existing chat
cache tests are the safety net for the rest of the reply lifecycle.

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`58cce7b`). Reply state registered before the invoke (main.ts:5931 vs 5938) with an explicit issue-016 comment; `settleStreamState` settles exactly once; unary fallback only on pre-spawn rejection and skipped when a terminal raced. Tests: chat-lifecycle.test.ts:176/199/221/284/301.
