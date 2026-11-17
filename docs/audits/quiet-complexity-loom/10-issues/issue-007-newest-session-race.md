# Issue 007 — Streamed chats can bind the wrong session to a work item

- **Title:** Streamed chats can bind the wrong session to a work item
- **Severity:** P2 — session identity race
- **Status (2026-11-15):** the root cause (streamed `sessionId`/`agentId`
  dropped by the server's snake_case decoder — QC-03) is **FIXED** at
  commit `b1f16bd`, live-verified (see
  `evidence/post-fix-evaluation.md`). The heuristic-adoption guards in
  this issue remain open as the second defensive layer.

## Problem statement

Streamed weave completions carry no session id (WeaveProgress has no such
field — verified in the proto and live). The IDE adopts the session via
`newestSessionId()` — "the most recently updated session in the list"
(`main.ts:5036-5039`) — and links it to the work item that sent the
message (`finishStream`, `main.ts:5237-5253`). If any other session is
updated concurrently (another work item's chat, a background agent turn,
or a session created mid-stream), the wrong session can be adopted and
persisted into `work.json`, silently pointing that work item's
conversation, artifacts, and history at someone else's thread.

## Evidence and file references

- `src/main.ts:5036-5039` (`newestSessionId`), `:5237` (`sessionId ?? selectedSessionId ?? newestSessionId()`), `:5241-5253` (persist via `setWorkSession`).
- `proto/loom/v1/loom.proto:845` — `WeaveProgress` has no session/trace fields (confirmed live: the completion event carries `partial_result`, `cost`, `context_state` — no session id).
- Contrast: the unary path adopts the server-returned `session_id` (correct).

## Root cause

**Confirmed.** The streaming wire format lacks session identity, so the
frontend guessed. The guess is order-based and racy — and the parallel
audit found the deeper root cause: the streamed request's `sessionId`/
`agentId` are **silently dropped by the server's snake_case decoder**
(contract-audit QC-03, live-proven), so *every* streamed turn starts a
new session on the default agent and the adoption heuristic then binds
the work item to that fresh session. Fix QC-03 first; this issue's
guards are the second layer.

## Expected behavior

The work item's session link is only ever the session that actually served
the turn — or the link stays unchanged and the user is told the session is
unknown.

## Current behavior

Best-effort newest-session adoption; a concurrent update can steal the
link.

## Proposed correction

- Adopt only sessions **created since the turn started** (filter by
  `created_at`/first-seen rather than most-recently-updated), and prefer
  the session whose agent matches the turn's answering agent (the
  completion event's `agentId`/context can be cross-checked).
- If no unambiguous session exists: do not persist a link; surface "The
  conversation session could not be identified" instead of silently
  binding.
- Longer term (Loom-side, decision-gated): add `session_id` to the
  completion `WeaveProgress` (same proto change family as issue 004).

## Affected components

- `src/main.ts` (finishStream, newestSessionId); optionally
  `proto/loom/v1/loom.proto`.

## Relevant Loom contracts

- `WeaveProgress` fields (loom.proto:845+); `Session` (id, agentId).

## Acceptance criteria

1. A streamed turn whose session was created by the turn is adopted
   correctly even when another session updates concurrently (unit-testable
   with mocked lists).
2. Ambiguous cases leave the existing link untouched and notify the user.
3. No silent mis-binding in the race scenario.

## Verification strategy

- Unit tests over the adoption logic with scripted session lists; a live
  two-work-item concurrent chat if feasible.

## Dependencies

- None (IDE-only); the proto addition is optional and decision-gated.

## Regression risks

- Low-medium: session adoption touches the chat cache and artifact
  scoping; guard with existing chat-cache tests plus the new adoption
  tests.

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`58cce7b`). The done branch never adopts the newest/current selection; an honest identity note renders when the wire reports no session id (main.ts:5723). Tests: chat-lifecycle.test.ts:240/268.
