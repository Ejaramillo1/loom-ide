# Issue 013 — IDE turns ride the batch slot band (no X-Loom-Slot-Origin)

- **Title:** IDE turns ride the batch slot band (no X-Loom-Slot-Origin)
- **Severity:** P3 — scheduling semantics

## Problem statement

Loom's slot scheduler/door admission distinguishes `interactive` turns
(human waiting; bypass the door, ride the interactive band) from `batch`
turns via the client-asserted `X-Loom-Slot-Origin` header (or gRPC
metadata). The IDE's raw HTTP client never sends the header, so every IDE
chat and stream is treated as batch. With door admission enabled
(`llm.max_active_conversations > 0`), a human's message can queue behind
batch work instead of being answered promptly.

## Evidence and file references

- `src-tauri/src/lib.rs:1235-1238` (request headers built: only Host,
  Content-Type, Content-Length, Connection) and `loom_stream.rs:336-340`.
- `docs/reference/streaming.md` (Loom): "Send `X-Loom-Slot-Origin:
  interactive` when a human is actively waiting… batch-origin turns queue
  FIFO at the admission door once the active-turn ceiling is reached. The
  value is client-asserted and trusted as-is."
- Current server config shows no `llm.max_active_conversations` — impact
  latent on this machine, real wherever the door is on.

## Root cause

**Confirmed (omission).** The client predates the slot-origin contract.

## Expected behavior

Chat sends and weave streams assert `interactive`; background syncs stay
batch.

## Current behavior

All IDE traffic is batch-classified.

## Proposed correction

- Add the header to `loom_http_raw` (or per-call) for weave/chat/stream
  requests; leave pure GET refreshes unmarked (batch default).

## Affected components

- `src-tauri/src/lib.rs`, `src-tauri/src/loom_stream.rs`.

## Relevant Loom contracts

- `X-Loom-Slot-Origin` header / `loom-slot-origin` metadata
  (`docs/reference/streaming.md`).

## Acceptance criteria

1. Chat/stream requests carry the header (observable in a local proxy or
   server log).
2. Read refreshes remain unmarked.

## Verification strategy

- Unit assertion on the request builder; live capture with a loopback
  proxy if desired.

## Dependencies

- None.

## Regression risks

- Minimal — additive header, client-asserted by design.

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`7f93a2f`). `X-Loom-Slot-Origin: interactive` sent on both chat paths; background streams stay batch.
