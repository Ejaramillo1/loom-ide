# 02 — Loom Capability Map

Verified against `/home/ed/work/loom` @ `ab46f76f` (VERSION 1.4.0) **and**
the live server on `127.0.0.1:5006` (2026-11-15). Evidence levels:
**Supported** (implemented in Loom) · **Exposed** (reachable through the
HTTP gateway) · **Integrated** (called correctly by the IDE) ·
**Verified** (demonstrated live or by executed tests). Includes the
parallel audit's contract findings (QC refs preserved).

## 1. Services and transports

Proto-first: 15 services in `proto/loom/v1/*.proto`. The HTTP gateway
(`pkg/server/http.go:113`) registers **exactly one**:

| Service | File | HTTP-registered | Notes |
|---|---|---|---|
| **LoomService** | `loom.proto` | ✅ **yes** | the entire HTTP surface (~38 path patterns) |
| TaskService | `task.proto` | ❌ no (gRPC only) | 19 HTTP annotations inert — issue 001/QC-10 |
| SkillsImportService | `skills_import.proto` | ❌ no | 3 annotations inert — issue 002/QC-10 |
| ToolRegistryService | `tools.proto` | ❌ no | `RegisterTool` duplicated into LoomService |
| GraphMemory / Judge / Learning / LLMScheduler / MemoryLayer / Teleprompter / Admin | various | ❌ no | gRPC only |
| collaboration.proto | — | — | messages only, no service |

Loom's own docs state this plainly: `docs/reference/http-server.md:42,51`
(scrub commit `cbc590b`, 2026-06-29 — months before the IDE's
tasks/skills work).

**Two wire formats coexist (critical contract fact):**

- **grpc-gateway (all unary LoomService routes):** protojson — camelCase,
  int64 as strings, base64 bytes.
- **Custom SSE handler (`/v1/weave:stream` only):** request decoding via
  standard `encoding/json` with the **generated proto JSON tags**
  (`session_id`, snake_case) — response events snake_case `data:`-framed.
  **The IDE now sends snake_case on this path** (`b1f16bd`), matching the
  decoder; the unary path stays camelCase. HTTP-level probes verified
  identity is honored (happy path + FailedPrecondition owner-mismatch);
  the patched UI path is not end-to-end tested (QC-03, critique §1).
- **Transport framing of the SSE handler:** one `Fprintf`+`Flush` per
  event through Go `net/http` → HTTP/1.1 **chunked** body; events larger
  than the server's ~2 KB write buffer split mid-payload. The IDE's
  stream reader does not decode chunked framing (issue 017).
- **Gateway server-streaming RPCs** (subscribe, workflow stream, abtest,
  patterns stream): NDJSON `{"result": …}\n`, no SSE framing
  (grpc-gateway v2.33 `ForwardResponseStream`; live-captured, QC-05).

## 2. Weave / conversations

- `WeaveRequest` (`loom.proto:747`): `query`, `session_id`,
  `backend_config`, `max_rounds`, `timeout_seconds`, `context`
  (map<string,string> "for prompt interpolation"), `force_pattern`,
  `enable_trace`, `agent_id`.
  - **`context` is parsed but unused by the chat path** — `multi_agent.go`
    contains no reference to `req.Context` (grep-verified, QC-09). The
    IDE's context pack therefore never reaches the agent.
- `WeaveResponse` (`loom.proto:815`): `text`, `result`, `session_id`,
  `trace_id`, `cost`, `metadata`, `corrections`, `agent_id`,
  `context_state`. **`trace_id` is never populated** (`multi_agent.go:
  1194-1200` builds the response without it; live unary with
  `enableTrace:true` returned no `traceId`) — issue 004.
- `WeaveProgress` (`loom.proto:845`): stage/progress/message/tool fields/
  token fields/hitl_request/cost/context_state; **no session or trace
  field**. The proto documents that only a `hitl_request` with non-empty
  `request_id` is answerable; heartbeats and pre-creation pings must not
  raise prompts (the IDE implements this correctly).
- Error events: the SSE handler emits HTTP-200 `data:` events with
  `stage: "EXECUTION_STAGE_FAILED"` and an `error` field
  (`http.go:467`). Since `b1f16bd` the IDE surfaces these (and
  EOF-without-completion) as errors on the weave stream; FAILED without
  an error string, malformed frames and truncation-after-completion
  remain untested (QC-04, partially fixed).
- HITL answer: `POST /v1/clarifications/{session_id}/answer`;
  `AnswerClarificationResponse` = `{success, error, accepted}` — **no
  `status` field**. Since `b1f16bd` the IDE requires `success &&
  accepted`, which is correct under proto3 bool semantics (a missing
  `accepted` means false); do not relax (QC-06, fixed). Approvals belong
  to a separate request store with a distinct `RespondToRequest` handle
  (proto comment at `loom.proto:868`); delivering approve/deny through
  the clarification endpoint answers the wrong store (QC-07, strongly
  supported).

## 3. Agents

- HTTP: list/get/create/start/stop/reload/delete + `GET /v1/presets/agents`.
- `CreateAgentRequest` = `{config: AgentConfig, config_path}` — the IDE
  posts the **bare config object** instead of wrapping it (QC-08); agent
  creation cannot work as written.
- Live: list/detail verified (3 agents); routing by agent **name**
  verified on the **unary** path (`agentId:"guide"` → guide's uuid);
  the stream path now carries `agent_id` correctly in the request
  (`b1f16bd`), wire-verified via HTTP probes (QC-03).

## 4. Sessions

- HTTP: list/get/create/delete/history/subscribe/switch-model/resume/
  resolveExecutionGap. Live: list/history/detail/create verified;
  camelCase + string int64s; unnamed by default.
- `SwitchModelRequest` = `{session_id, agent_id, provider, model}` — the
  IDE's session-detail selector sends only `model` (QC-21).
- `:subscribe` is a gateway NDJSON stream (QC-05).

## 5. Workflows, schedules, tasks

- Workflows: list/execute/executions (+ stream) + `templates/workflows`.
  Executions carry no work attribution or workflow name (server-side).
  Live: lists return `{}` (none configured); bogus ref → 404 with
  `{"error":{"code":5,…}}` (different envelope from unary errors).
- Schedules: full CRUD/trigger/pause/resume/history + execution cancel.
  Live: list `{}`; mutations not exercised.
- Tasks: TaskService gRPC-only at runtime (issue 001/QC-10); the IDE's
  shapes for updates/ready/blocked also mismatch the proto messages
  (QC-11).

## 6. Artifacts

- List (`?session_id=&limit=`), get, delete, search, content (base64
  bytes + optional inner base64 layer), stats. Live: all read paths
  verified incl. content decode.
- The IDE's artifact search has a stale-result race (QC-15).

## 7. Models and providers

- `GET /v1/models` — live catalog (camelCase, float costs).
- `GET /v1/providers` — live `{}` on this server (no named providers).
- `POST /v1/providers:abtest` — gateway NDJSON stream (QC-05); the dialog
  has no providers to select on this server.

## 8. Tools

- `GET /v1/tools` — live 18 builtins. `POST /v1/tools:register` and
  `POST /v1/tools:request-permission` — routes verified live via
  validation errors; the permission request has no UI (issue 012).
- Enforcement: `shuttle.PermissionChecker`, admission chain, jailed
  `shell_execute` — untouched by the IDE's autonomy dial (QC-01).

## 9. Patterns, skills, MCP, apps

- Patterns (LoomService): list/get/create/load/stream — read paths
  live-verified.
- Skills (SkillsImportService): **404 over HTTP** (issue 002/QC-10).
- MCP servers (LoomService): list/get/add/update/delete/restart/health/
  test/tools — list/health/get verified live; add/test/health responses
  are decoded against a single `McpServer` row shape while the endpoints
  return different contracts (QC-12).
- Apps (LoomService): list/get/create/update/delete/component-types +
  HTML at `/apps/{name}`. `CreateUIAppRequest` = `{name, display_name,
  description, spec: UIAppSpec}` — **declarative spec, not HTML**; the
  IDE sends `{name, html}` (QC-22).
- Bus routes registered but RPCs stubbed (live 501 on ListTopics).
- Shared memory routes registered (live validation); Lua routes
  registered (disabled in this config); neither surfaced in the IDE.

## 10. Observability

- Tracers (embedded SQLite/Hawk/OTel), spans, PII redaction;
  `GET /v1/traces/{id}` implemented by `MultiAgentServer.GetTrace`
  (1-hour in-memory store) while `Server.GetTrace` is Unimplemented.
- **No trace id ever reaches a client** (issue 004).

## 11. Memory and context

- 5-layer memory + segmented memory (docs/architecture/memory-systems.md);
  GraphMemory gRPC-only (agent-side `graph_memory` tool is in the live
  tool list); live completion events carry real `context_state`
  (tokens, loaded tools).

## 12. Permissions and HITL

- Approval holds with park-and-resume, durable workflow checkpoints,
  `hitl.db`; the only HITL surface the IDE consumes is the chat card path
  — correctly gated on non-empty `request_id`, but answering via the
  wrong store for approvals (QC-07) and decoding the wrong response
  shape (QC-06). No HTTP endpoint lists pending HITL requests
  (collaboration.proto has no service).

## 13. Contract hazard table (merged, verified)

| Hazard | Where | IDE handling | Verdict |
|---|---|---|---|
| int64 as string | gateway responses | `de_i64` tolerant parser | ✅ tested + live |
| camelCase vs snake_case | gateway vs custom SSE | struct aliases for unary; **snake_case stream requests since `b1f16bd`** | ✅ QC-03 fixed in code (wire-verified; UI path unverified) |
| HTTP chunked bodies (streams) | Go SSE handler writes chunked; >~2 KB events split mid-payload | **no chunk decoding in the stream reader** | ❌ issue 017 (confirmed) |
| base64 (+ inner layer) | artifact content | two-layer RFC 4648 decoder | ✅ tested + live |
| `{}` for empty lists | workflows/providers/mcp/schedules | serde defaults | ✅ live |
| Two error envelopes | unary vs streamed errors | stream path falls back to raw snippet | ⚠ cosmetic |
| NDJSON `{"result":…}` streams | gateway server-streaming | **discarded — `data:`-only parser** | ❌ QC-05 (live) |
| HTTP-200 error events | weave SSE | **surfaced since `b1f16bd`**; remaining terminal shapes untested | ⚠ QC-04 partially fixed |
| `AnswerClarificationResponse` has no `status` | clarifications | **requires `success && accepted` since `b1f16bd`** (correct) | ✅ QC-06 fixed |
| `CreateAgentRequest` wraps `config` | agent create | **bare config posted** | ❌ QC-08 |
| `CreateUIAppRequest` is declarative | app create | **HTML posted** | ❌ QC-22 |
| `req.Context` unused by chat | weave | context pack dead | ❌ QC-09 |
| `WeaveResponse.trace_id` never set | weave | trace UI unreachable | ❌ issue 004 |
| Executions unattributed | workflow executions | local volatile maps | ⚠ QC-13/14 |

## 14. Unused-by-IDE HTTP surface

Shared-memory CRUD, bus topics (stubbed), Lua scripts (disabled), schedule
execution cancel (bridged, no UI), tool permission request (bridged, no
UI), session model switch (UI exists; omits provider — QC-21), admin
endpoints (gRPC, out of scope).

## 15. What the IDE advertises that Loom does not support

Tasks/skills over HTTP (annotations ≠ registration), per-intent autonomy
enforcement, an attention inbox from Loom, trace ids on chat turns,
HTML-based app creation, and a context pack that influences the default
agent.
