# Loom connection audit

> **Superseded.** This 13 Nov audit described the pre-cleanup state. The
> build-plan and 7x7x7 passes rewrote the surface; the old body (55
> commands, 24 HTTP endpoints, "tasks are gRPC-only") is removed here
> because every one of its headline numbers is false today.

## Current state (15 Nov 2026)

The living surface is documented in `docs/DESIGN_PROGRESS.md`,
`docs/LOOM_CONNECTION_MODEL.md` and `docs/DECISIONS.md`. The key facts:

- **Commands and endpoints:** ~100 Tauri command functions are registered;
  40+ HTTP endpoints are wired. Tasks and skills are 100% HTTP (`task.proto`
  has 19 `google.api.http` annotations; `skills_import.proto` has 3).
- **Streaming:** six SSE endpoints ride one consumer (`loom_stream.rs`):
  `/v1/weave:stream`, `/v1/workflows:stream`, `/v1/sessions/{id}:subscribe`,
  `/v1/providers:abtest`, `/v1/patterns:stream`,
  `/v1/boards/{id}/updates:stream`.
- **Connection model:** a body-validated `/v1/health` probe runs at startup,
  on demand, after a stream error (one shot at 3 s) and every 10 s while
  offline; `LOOM_ADDR` overrides the address without recompiling; transient
  GET failures retry once.
- **Chat context:** the prepared context pack (active work, intent, open
  file, session/agent ids) travels with every query on both the stream and
  unary paths.
- **Decisions:** the ten 15 Nov decisions (Monaco, promptfoo + Docling, Rust
  gRPC client with Judge first, static Q2 panel, two-direction harness MCP,
  full task migration, avatar wiring, unified state surfaces, the "blocks"
  relation type, workflow streaming before ABTest) are registered in
  `docs/DECISIONS.md`.
