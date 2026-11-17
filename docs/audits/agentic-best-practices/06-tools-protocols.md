# 06 — Tools & Protocols Assessment

## Tool contracts

Tools are **Loom's**, not the IDE's. The IDE's role is to (a) surface
tool-call lifecycle events from the weave stream, (b) manage the MCP
server registry that Loom can expose tools through, and (c) route human
approvals. It correctly does **not** invent its own tool executor.

| Contract field | Where enforced | Evidence |
|---|---|---|
| Purpose / schema | Loom tool registry; MCP servers | IDE surfaces tool-call events, does not define schemas |
| Authorization | Loom admission chain + decision layer + shelljail (server) | client-side autonomy dial is **not** enforced (QC-01) |
| Preconditions / side effects | Loom (server) | not re-checked client-side (correct for a thin client) |
| Result / receipts | Loom `WeaveProgress` tool events → tool lines in chat | re-emitted by `read_response_events` |
| Errors | Stream error envelopes (`{"error":…}` NDJSON + SSE) | decoded and surfaced |
| Idempotency | Loom (server) | the IDE never replays a failed POST |

## MCP management (the one protocol surface the IDE owns)

`mcp_servers_list/get/add/update/delete/restart/health_check/test/tools`
(`loom_tasks.rs` / MCP module) form a complete CRUD + test surface:

- `mcp_server_add` unwraps the `server` envelope and checks `success`
  (QC-12 fixed).
- `mcp_server_test` decodes `success`/`message`/`error`/`tool_count`; a
  failure is never rendered as a pass.
- `mcp_server_update` preserves the row's enabled state (issue 009 fixed).
- `mcp_servers_health_check` merges the name-keyed map into existing rows.

**Gap:** the IDE manages MCP *servers* but does not yet consume them as a
**Loom-as-MCP-server ↔ harness** connection (DECISIONS D5), and it does not
pin/display the MCP spec version. The reference's "a link labeled `latest`
can change" warning applies: the IDE's MCP response decoding hand-parses a
few shapes and should be pinned to a spec revision when D5 lands.

## Interoperability boundary (the critical §6 question)

**Verdict: the IDE interacts with Loom through its supported HTTP gateway,
not a fragile bypass.** Specifically:

- Unary calls use the grpc-gateway's protojson JSON (camelCase).
- The stream uses Loom's documented `POST /v1/weave:stream` custom SSE
  handler (snake_case `encoding/json`).
- Both wire formats are now **pinned by tests** (the snake_case identity
  contract and the camelCase unary contract each have a negative assertion
  that the *wrong* casing is absent).

The one genuinely custom adapter is the HTTP/1.1 chunked + NDJSON + SSE
framing decoder in `loom_stream.rs`, which exists because Go's `net/http`
writes streamed responses as chunked transfer encoding with a custom
`encoding/json` envelope. It is a **compatibility layer of necessity**,
narrowly scoped, and covered by 28 tests (including a real loopback TCP
fixture and a byte-faithful live probe). This is the correct resolution per
the restriction order: use Loom's interface correctly → reuse another
supported interface → correct the adapter — the IDE did the third, and did
not propose changing Loom.

## Duplication in tools/protocols

None. The IDE adds no tool, no skill, no protocol of its own beyond the
MCP server registry, which Loom does not itself provide as a UI. No
competing tool-execution or permission system exists.
