# Live verification evidence log

Date: **2026-11-15**. All probes below ran against the real Loom server
(`looms serve`, pid 220399, v1.4.0, binary `/home/ed/.local/bin/looms`,
built 2026-11-10 from `/home/ed/work/loom` @ `ab46f76`) listening on
`0.0.0.0:5006` (HTTP) / `:60051` (gRPC). Health at audit start:

```json
{"status":"healthy","components":{"openai/deepseek-v4-pro":{"status":"healthy","lastCheck":"1794759053","latencyMs":"1576"}},"version":"1.4.0"}
```

Config: `/home/ed/.loom/looms.yaml` — provider `openai`, model
`deepseek-v4-pro` via `litellm_endpoint: http://localhost:4000`;
observability embedded SQLite enabled; 3 agents (weaver, guide,
internet-researcher); no workflows, no MCP servers, no named providers,
no schedules configured.

## Automated checks (see `evidence/checks.json`)

| Check | Command | Result |
|---|---|---|
| Frontend tests | `npm test -- --run` | 0 (vitest) |
| Frontend build | `npm run build` | 0 (tsc + vite) |
| Tauri Rust tests | `cargo test --offline --locked -p` lib | 0 |
| Native-app tests | `cargo test --manifest-path native-app/Cargo.toml` | 0 |
| rustfmt | `cargo fmt --check` | 0 |
| Unity recompile | `unity recompile --format json` | 0 |
| Live gateway contract test | `cargo test --lib live_gateway_responses_parse -- --ignored` | 0 (live, 2026-11-15) |

## Live HTTP probes

Working (route registered in LoomService, correct data returned):

- `GET /v1/health` — healthy body, per-component status.
- `GET /v1/sessions?limit=3` — `{"sessions":[...],"totalCount":1}`; sessions
  carry camelCase keys and string int64s (`createdAt`).
- `POST /v1/sessions` with `{"name":"audit-probe-session","agentId":"<uuid>"}`
  — created `sess_2c29a01f`, name and agentId accepted.
- `GET /v1/sessions/{id}/history` — `{sessionId, messages:[{id,role,content,timestamp}]}`.
- `GET /v1/sessions/{id}` — detail with `totalCostUsd` float, string int64s.
- `GET /v1/agents` — 3 running agents (uuid ids + names).
- `GET /v1/agents/{id}` — works; bogus id → 404 with available list.
- `GET /v1/models` — full model catalog (camelCase, float costs).
- `GET /v1/tools` — 18 builtin tool definitions.
- `GET /v1/artifacts?limit=3` — artifacts with `sizeBytes` as string.
- `GET /v1/artifacts/{id}` — `{"artifact":{...}}`.
- `GET /v1/artifacts/{id}/content` — base64 body (decoded correctly by the
  IDE's two-layer decoder; verified by unit test `artifact_content_decodes_both_layers`).
- `GET /v1/artifacts/stats` — `{"totalFiles":2,"totalSizeBytes":"13868"}`.
- `GET /v1/patterns` — real pattern library (e.g. `doc_generation`).
- `GET /v1/patterns/{name}` — full pattern body.
- `GET /v1/apps` — embedded MCP apps list; `GET /v1/apps/{name}` works.
- `GET /v1/mcp/servers` — `{}` (none configured); `GET /v1/mcp/servers/{name}`
  → 404 "server not found" (route live).
- `GET /v1/mcp/servers:health` — `{}`.
- `GET /v1/server/config`, `GET /v1/server/storage` — real config/status.
- `GET /v1/server/tls` — `{}`.
- `GET /v1/workflows` / `GET /v1/workflows/executions` — `{}` (none exist).
- `GET /v1/workflows/schedules` — `{}`; `GET /v1/workflows/schedules/{id}` →
  404 "schedule not found" (route live).
- `GET /v1/workflows/executions/{id}` → 404 "workflow execution not found" (route live).
- `GET /v1/presets/agents`, `GET /v1/templates/workflows` — real presets/templates.
- `GET /v1/apps/component-types` — real component registry.
- `POST /v1/tools:register` `{}` → 400 "tool definition is required" (route live).
- `POST /v1/tools:request-permission` `{}` → 400 "session_id is required" (route live).
- `POST /v1/clarifications/{id}/answer` (GET method) → 405 (route live, POST-only).
- `GET /v1/traces/bogus` → 404 `trace "bogus" not found` (route live).
- `POST /v1/workflows:execute` with bogus ref → 404 (route live; body
  `{"error":{"code":5,...}}` — different error envelope than unary routes).
- `GET /v1/shared-memory/system/keys` → 400 namespace validation (route live).
- `GET /v1/bus/topics` → **501 "method ListTopics not implemented"** (route
  registered, RPC stubbed).
- `GET /v1/lua-scripts` → 400 "Lua scripts are disabled on this server" (route live).

## Live end-to-end chat

**Streaming weave** (`POST /v1/weave:stream`, SSE): completed in ~4 s; first
token at ttft 1537 ms; events `data: {"stage":3,...,"partial_content":"p",...}`
→ `"pong"`, completion event with `partial_result`, `cost`
(`total_cost_usd:0.0078425`, model `deepseek-v4-pro`, provider `openai`), and
`context_state` listing 18 loaded tools. Framing is `data: <json>\n\n`
(snake_case) — matches the IDE's parser exactly. Saved:
`/tmp/opencode/weave-stream-live.log`.

**Unary weave** (`POST /v1/weave`): completed in 4.8 s; response
`{"text":"echo","sessionId":"sess_008a09ea","agentId":"<uuid>","cost":{...},"contextState":{...}}`.
**No `traceId` field** despite `enableTrace: true` (see issue 004).

**Agent routing by name**: `POST /v1/weave {"agentId":"guide"}` returned
guide's uuid — the IDE's name-based agent selector works.

**UI-level test (headless Chromium + CDP)**: drove the real UI at
`http://localhost:1420` (vite preview of the built frontend, `/api/loom`
proxy → live Loom): typed `Reply with exactly the single word: ui-pong`,
submitted; the reply `ui-pong` rendered with source label
`Live — answered by the Loom server`; the status pill transitioned
`Server reachable` → **`Connected to Loom`** with the verified-response title.
DOM assertions saved in `/tmp/opencode/ui-chat-live.json`; screenshot at
`evidence/ui-chat-live.png`. This is the complete loop
UI → request → Loom runtime → response → state update → visible feedback.

## Live probes that FAIL (the integration breaks)

- `GET/POST /v1/boards` → **404 `{"code":5,"message":"Not Found"}`**.
  TaskService is not registered in the HTTP gateway.
- `GET /v1/tasks` (all variants), `POST /v1/tasks:decompose`,
  `GET /v1/agents/{id}/task-context`, `GET /v1/boards/{id}/ready|blocked` →
  **404 Not Found**.
- `POST /v1/skills`, `POST /v1/skills/{name}:classify`,
  `POST /v1/skills:bulkImport` → **404 Not Found**. SkillsImportService is
  not registered in the HTTP gateway.
- `GET /v1/sessions/{id}:subscribe` — stream emits **NDJSON** chunks
  `{"result":{"sessionId":...,"newMessage":{...}}}` with `\n` delimiters and
  **no `data:` prefix** (captured live while a weave updated the session;
  saved `/tmp/opencode/subscribe-raw.log`). The IDE's SSE consumer only
  parses `data:` lines, so every payload is discarded. Same framing applies
  to all gateway-streamed RPCs: `/v1/workflows:stream`,
  `/v1/providers:abtest`, `/v1/patterns:stream`,
  `/v1/boards/{id}/updates:stream`, `/v1/skills:bulkImport`
  (grpc-gateway v2.33.0 `ForwardResponseStream` writes
  `{"result": ...}\n` — verified in the vendored gateway source).
- `GET /v1/patterns:stream` — 0 bytes in 5 s (headers deferred until the
  first message; subscription idle).

## Source-level confirmations

- `pkg/server/http.go:113` — the HTTP gateway registers **only**
  `RegisterLoomServiceHandlerFromEndpoint`. No TaskService, no
  SkillsImportService, no ToolRegistryService, no other service handler.
- `docs/reference/http-server.md:42,51` (Loom's own docs, scrubbed against
  code in commit `cbc590b`, 2026-06-29): "Only LoomService is registered
  with the HTTP gateway (other gRPC services like ToolRegistryService are
  gRPC-only)" and "`/swagger-ui` also lists endpoints for services such as
  TaskService and SkillsImportService that are *not* HTTP-registered".
- `pkg/server/multi_agent.go:1194-1200` — `WeaveResponse` is built without
  `TraceId`; nothing in the file ever assigns it.
- `pkg/server/server.go:683` — `Server.GetTrace` returns `Unimplemented`;
  the working implementation is `MultiAgentServer.GetTrace`
  (`pkg/server/observability_rpc.go:211`) backed by a 1-hour in-memory store.
- IDE's `docs/DECISIONS.md` and `docs/DESIGN_PROGRESS.md` record the premise
  "tasks and skills are 100% HTTP (19 / 3 `google.api.http` annotations)" —
  the premise is false for the running gateway (annotations exist, handlers
  do not).

## Addendum — parallel-audit confirmations (same day)

- **QC-03 (session/agent identity dropped on the stream path) — live
  proof.** `POST /v1/weave:stream` with camelCase
  `{"sessionId":"sess_008a09ea","agentId":"guide"}`: the turn completed,
  but the session list afterwards showed a **new session
  `sess_9735a0c1`** (agent `internet-researcher`) while `sess_008a09ea`
  was untouched. Root cause: `handleStreamWeaveSSE` decodes the request
  with standard `encoding/json` using the generated proto tags
  (`json:"session_id,omitempty"` — snake_case), so camelCase keys are
  ignored. The unary gateway path accepts camelCase (verified earlier:
  `agentId:"guide"` routed correctly).
- **QC-04 (failures shown as completed) — code-confirmed.**
  `sseStreamWrapper.writeError` emits HTTP-200 `data:` events with
  `stage:"EXECUTION_STAGE_FAILED"`; the IDE ignores non-token events and
  treats EOF as `done`.
- **QC-06 (clarification decode) — contract-confirmed.**
  `AnswerClarificationResponse` = `{success, error, accepted}` (no
  `status`); the IDE requires `status` and therefore errors on every
  delivered answer.
- **QC-08 (agent create shape) — contract-confirmed.** `CreateAgentRequest`
  = `{config: AgentConfig, config_path}`; the IDE posts the bare config.
- **QC-09 (context pack inert) — source-confirmed.** No reference to
  `req.Context` exists in `pkg/server/multi_agent.go`; the weave handler
  calls `ag.Chat(ctx, sessionID, req.Query)` only.
- **QC-22 (app create shape) — contract-confirmed.** `CreateUIAppRequest`
  = `{name, display_name, description, spec: UIAppSpec}`; the IDE sends
  `{name, html}`.
- **QC-21 (model switch) — contract-confirmed.** `SwitchModelRequest`
  carries `provider` and `agent_id`; the IDE sends only `model`.
- **QC-15 (artifact search race) / QC-16 (vault path compiled in) /
  QC-17 (subscription leak) — source-confirmed** (`searchArtifactsView`
  has no request token; `env!("CARGO_MANIFEST_DIR")` vault root;
  `ensureSessionSubscription` never cancels the previous stream).

## Limitations (what was NOT executed)

- No workflow run (server has zero workflows configured).- No workflow schedule create/trigger, no agent start/stop/reload/delete,
  no MCP server CRUD, no app create/update/delete, no skill import, no
  session delete/resume/resolve-gap, no TLS renew, no storage migration —
  destructive/mutating or nothing configured to act on. Route existence was
  verified where possible (404/400 responses prove registration).
- No HITL card was raised in any live test turn (none of the test prompts
  triggered a hold), so the clarification-answer path is verified by code
  and route registration only.
- No real-window pixel check of the Tauri window (environment-blocked, as
  in prior audits); Unity evidence is the Editor self-check, the headless
  WebGL check, and Editor captures in `docs/bench-shots/`.
- No live test of `switch_model` (session mutation).
