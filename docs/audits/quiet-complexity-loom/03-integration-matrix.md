# 03 — Complete Integration Matrix

Every feature and view in Quiet Complexity, traced through the full chain:
UI → frontend state → Tauri command → Rust → Loom gateway → Loom runtime →
response → frontend state → visible feedback. Classifications:

- **FULLY INTEGRATED** — end-to-end evidence (live or executed tests).
- **PARTIALLY INTEGRATED** — real path exists but context/attribution/
  verification incomplete.
- **UI ONLY** — local surface with no Loom counterpart by design.
- **BROKEN** — the path exists in code but cannot work against the server.
- **UNSUPPORTED** — Loom does not offer it (over HTTP or at all).
- **NOT VERIFIED** — correct path, not executable in this environment.

Source anchors: `src/main.ts` (UI), `src/api.ts` (bridge), `src-tauri/src/*.rs`
(backend), `pkg/**` / `proto/loom/v1/*.proto` (Loom).

## 1. Chat

| Item | Path | Evidence | Class |
|---|---|---|---|
| Send message (streaming) | `#chat-form` → `sendChat` (`main.ts:5346`) → `askLoomStream` (`api.ts:1167`) → `ask_loom_stream` (`loom_stream.rs:86`) → `POST /v1/weave:stream` | Live stream captured: tokens, cost, tools-loaded, 4 s, SSE `data:` framing matched | **PARTIALLY INTEGRATED** — real execution, identity fixed at `b1f16bd` (wire-verified; UI path not end-to-end tested); races/framing below |
| Session continuity (stream path) | `session_id` sent snake_case since `b1f16bd` → custom SSE handler decodes snake_case (`http.go:324`, generated JSON tags) | Pre-fix live proof: stream to `sess_008a09ea` created new session `sess_9735a0c1`. Post-fix HTTP probes: stream to `sess_d7f154c9` grew that session 2→4; owner-mismatch rejected | **FIXED in code — NOT VERIFIED through the UI path** (QC-03) |
| Agent routing (stream path) | `agent_id` sent snake_case since `b1f16bd` | Same probes: `internet-researcher` honored; `guide` on another agent's session → FailedPrecondition (enforced) | **FIXED in code — NOT VERIFIED through the UI path** (QC-03) |
| Token rendering / tool lines | `handleStreamEvent` (`main.ts:5043`), `renderToolLine` (:5076) | `partial_content`, `is_tool_started/completed` rendered incrementally; field names match `WeaveProgress` (snake_case) | **FULLY INTEGRATED** (tool events not exercised live) |
| Stream event registration | `sendChat` awaits `askLoomStream` before `activeStreams.set` (`main.ts:5371,5404`) | Unknown-id events silently discarded (`:5043-5045`); dropped terminal → `chatInFlight` never settles | **BROKEN — confirmed race** (issue 016) |
| HTTP body framing (all streams) | `run_stream` parses raw socket lines (`loom_stream.rs:365-460`); chunked decoding exists only in the unary reader (`lib.rs:1217-1328`) | Go SSE handler emits chunked bodies; events > ~2 KB split mid-payload → corrupted/dropped; split completion → false "disconnected" | **BROKEN — confirmed** (issue 017) |
| Failure reporting (stream path) | `weave_completed` requires stage 7/COMPLETED, surfaces top-level `error`; EOF-without-completion errors (`loom_stream.rs:302-312,481-483`) | Server emits HTTP-200 `data:` error events (`http.go:467`); live owner-mismatch exercised the error path | **PARTIALLY FIXED** — error-bearing events correct; FAILED-without-error, malformed frames, truncation-after-completion untested (QC-04) |
| Stop | `#chat-stop` → `cancelLoomStream` → cancel flag on 20 s read wake (`loom_stream.rs:131,370`) | Silent-stream cancellation within ~20 s; unknown id errors | **FULLY INTEGRATED** (code + unit test; not exercised live) |
| Unary fallback | `sendChatUnary` (`main.ts:5274`) → `ask_loom` → `ask_loom` (`lib.rs:1732`) → `POST /v1/weave` | Live unary: `text`, `sessionId`, `agentId`, `cost` returned in 4.8 s; session + agent honored (camelCase via protojson) | **FULLY INTEGRATED** |
| HITL cards (question + approve/deny) | `renderHitlCard` (`main.ts:5104`) → `answerClarification` → `POST /v1/clarifications/{sid}/answer` | Only non-empty `request_id` raises a card (matches proto contract); answer route verified live (405 for GET = registered) | **PARTIALLY INTEGRATED** — answer decode FIXED (QC-06); approvals still hit the wrong store (QC-07) |
| Chat context pack | `buildChatContext` (`main.ts:4867`): work/intent/open-file (≤4000 chars)/experiment/session/agent | Sent as `context` map; **`req.Context` is never read in the weave handler** (`multi_agent.go`, grep-verified) | **BROKEN-in-effect** — transmitted but never reaches the agent (QC-09) |
| Error surfacing / draft restore | `addChatError`, `finishStream` (:5198), draft re-restore | Failed-send path restores text **only when `st.text` is empty** (`:5218-5221`); partial replies on error not durably cached; recovery can overwrite a newer human draft | **PARTIALLY INTEGRATED** — draft restoration is conditional (critique §6); wording conflates rejection with disconnection (`:5213-5215`) |
| Chat cache + history reload | `chatCache` (localStorage) + `loadChatHistory` → `GET /v1/sessions/{id}/history` | History endpoint live-verified | **FULLY INTEGRATED** |
| Reply provenance label | `addChatMessage` evidenceKind branch (`main.ts:4982`) | **Backend never sends `evidenceKind`** (no field in Rust `ChatReply`) → branch is dead | **BROKEN-in-practice** (issue 008) |
| View trace | `reply.trace_id` button → `openTraceDialog` → `get_trace` | Server never returns `traceId` → button never appears | **BROKEN** (issue 004) |
| Session adoption after stream | `finishStream` → `refreshSessions` + newest-session heuristic (`main.ts:5036-5039`) | QC-03 fixed: the stream now uses the selected session, so the heuristic is a second layer — but it can still adopt a concurrently-updated other session and persist a wrong link | **OPEN (issue 007)** — root cause fixed at `b1f16bd`; heuristic guards remain |

## 2. Sessions

| Item | Path | Evidence | Class |
|---|---|---|---|
| List | `listSessions` → `list_sessions` (`lib.rs:1372`) `?limit=500` | Live: `{sessions,totalCount}`; camelCase + string int64 parsed | **FULLY INTEGRATED** |
| Create (with name/agent) | `createSession` → `create_session` (`lib.rs:1384`) | Live: created named session with agentId | **FULLY INTEGRATED** |
| History | `getSessionHistory` → `get_session_history` (`lib.rs:1416`) | Live: `{messages:[{role,content,...}]}` | **FULLY INTEGRATED** |
| Detail | `getSession` → `get_session` (`lib.rs:1514`) | Live: detail parsed (ISO strings, float cost) | **FULLY INTEGRATED** |
| Work↔session binding | `setWorkSession` (local work.json) + auto-link on reply | Code verified; local store is the record | **PARTIALLY INTEGRATED** (server has no work/session relationship — local metadata) |
| Delete / Resume / Resolve gap | `deleteSession`/`resumeSession`/`resolveSessionGap` (`loom_http.rs:786+`) | Routes registered (proto); not executed (destructive/mutating) | **NOT VERIFIED** |
| Live subscription | `sessionSubscribe` → `GET /v1/sessions/{id}:subscribe` | Live capture: NDJSON `{"result":...}` — **parser discards it**; switching sessions does not cancel the previous subscription (leak, QC-17) | **BROKEN** (issue 003, QC-17) |
| Model switch | session-detail select → `switchModel` → `POST /v1/sessions/{id}:switch-model` | Route registered; not executed; **sends only `model`, omitting `provider`/`agent_id`** (QC-21) | **PARTIALLY INTEGRATED** (shape defect) |

## 3. Agents

| Item | Path | Evidence | Class |
|---|---|---|---|
| List + selection | `listAgents` → `list_agents` (`lib.rs:1406`); selector sends **name** | Live: 3 agents; weave with `agentId:"guide"` routed to guide | **FULLY INTEGRATED** |
| Detail | `getAgent` → `get_agent` (`lib.rs:1561`) | Live | **FULLY INTEGRATED** |
| Presets | `listAgentPresets` → `agent_presets_list` (`loom_http.rs:350`) | Live: real presets | **FULLY INTEGRATED** |
| Weaver describe-to-create | `describeAgent` → `askLoom` (weave) → `createAgent` → `POST /v1/agents` | Real weave call; **the create posts a bare config; `CreateAgentRequest` expects `{"config": …}`** (QC-08) | **BROKEN** (shape; create cannot work as written) |
| Start/Stop/Reload/Delete | `agentActions` (`main.ts:3623`) → `agent_start/stop/reload/delete` (`loom_http.rs:293+`) | Routes registered (proto); not executed | **NOT VERIFIED** |
| Agent task-context | `loomTaskContext` bridge → `GET /v1/agents/{id}/task-context` | **404 live** (TaskService unregistered); bridge has no UI call site | **BROKEN** (issues 001, 012) |

## 4. Work (local work items)

| Item | Path | Evidence | Class |
|---|---|---|---|
| Work CRUD, status, criteria | `work.rs`-backed `WorkStore` (app-data `work.json`) | Local by design; tested | **UI ONLY** (local object; Loom has no work object — tasks are the server counterpart) |
| Work↔session link | see §2 | — | PARTIALLY INTEGRATED |
| Work artifacts | `loadWorkArtifacts` → `listArtifacts(session_id)` | Live session-filtered list | **FULLY INTEGRATED** (attachment list itself is local) |
| Kanban (Loom tasks beside local work) | `buildLoomBoardsSection` (`main.ts:2375`) → `task_boards_list`/`loom_tasks_list` → `/v1/boards`, `/v1/tasks` | **Live 404** — service not HTTP-registered | **BROKEN** (issue 001) |
| Task claim/close/release/delete | `taskCard` (`main.ts:2463`) → same 404 family | — | **BROKEN** (issue 001) |
| Task decompose / dependencies / ready / blocked | bridges exist, **no UI** | — | **BROKEN + unexposed** (issues 001, 012) |

## 5. Intent

| Item | Path | Evidence | Class |
|---|---|---|---|
| Intent CRUD, acceptance, active | `IntentStore` (app-data `intents.json`), versioning + history | Local; tested | **UI ONLY** — closest Loom counterpart is a task-board goal; no server intent object exists |
| Autonomy ceiling cascade | `set_work_autonomy` / `update_intent` (`lib.rs:225,355`) | Local rule enforced; tested | **UI ONLY** — **not** transmitted to Loom permission system (issue 005) |
| Intent in chat context | `active_intent` string in context pack | Transmitted; effect NOT VERIFIED | PARTIALLY INTEGRATED |

## 6. Models & providers

| Item | Path | Evidence | Class |
|---|---|---|---|
| Models list | `listModels` → `list_models` (`lib.rs:1579`) | Live catalog (floats, camelCase) | **FULLY INTEGRATED** |
| Providers list | `listProviders` → `list_providers` (`lib.rs:1590`) | Live `{}` — no named providers on this server; parser handles empty | **FULLY INTEGRATED** (empty here) |
| Provider A/B dialog | `openAbtestDialog`/`startAbtest` (`main.ts:2065,2095`) → `provider_abtest` → `/v1/providers:abtest` | Stream payloads **discarded** (framing); provider list empty on this server → no checkboxes | **BROKEN** (issues 003) |
| Session model switch | §2 | NOT VERIFIED | — |

## 7. Tools

| Item | Path | Evidence | Class |
|---|---|---|---|
| Tools list (inspector) | `listTools` → `list_tools` (`lib.rs:1532`) | Live 18 tools | **FULLY INTEGRATED** |
| MCP per-server tools drawer | `listMcpServerTools` → `GET /v1/mcp/servers/{n}/tools` | Route registered; no servers configured → empty list | **PARTIALLY INTEGRATED** (NOT VERIFIED with a real server) |
| Register tool | `registerTool` → `POST /v1/tools:register` | Live validation error proves route | **FULLY INTEGRATED** (mutation not executed) |
| Tool permission request | `requestToolPermissionCmd` bridge → `POST /v1/tools:request-permission` | Live validation error proves route; **no UI call site** | **PARTIALLY INTEGRATED** (issue 012) |

## 8. Memory

| Item | Path | Evidence | Class |
|---|---|---|---|
| GraphMemory browsing | none | gRPC-only service; agent-side `graph_memory` tool exists (live tool list) | **UNSUPPORTED over HTTP** — honestly unwired |
| Vault sync from Loom | `syncKnowledge` → `knowledge_sync_from_loom` (`knowledge.rs:1064`) mirrors sessions/agents/artifacts into markdown | Endpoints live-verified; sync itself not executed (writes user vault) | **PARTIALLY INTEGRATED** (one-way, snapshot, skip-existing) |
| Context state | completion events | Live `context_state` (tokens, tools) rendered? No — not surfaced in UI beyond raw events | PARTIALLY INTEGRATED (data arrives; not presented) |

## 9. Code (workspace + editor)

| Item | Path | Evidence | Class |
|---|---|---|---|
| File tree, read, save, create | `workspace.rs` confined fs (canonicalize + boundary, atomic write, optimistic concurrency, 1 MB cap) | Code + tests | **UI ONLY** (local; correct and safe) |
| Monaco editor | `monaco.ts` | Build passes; theme follows Dark/White | **UI ONLY** |
| Ask Loom about text | `#code-ask` → first 280 chars via chat | Chat path verified | **PARTIALLY INTEGRATED** (truncated context, no file identity) |

## 10. Experiments

| Item | Path | Evidence | Class |
|---|---|---|---|
| Definitions/arms/decisions | `ExperimentStore` (app-data `experiments.json`) | Local; tested | **UI ONLY** |
| Run arm | `runExperimentArm` (`main.ts:6520`) → `askLoom` → real `/v1/weave`; stores Loom's reply as the arm result | Same verified chat path; honest "chat-backed run" framing | **PARTIALLY INTEGRATED** (prose result, not a benchmark — documented) |
| Side-by-side comparison | `buildArmComparison` | Displays stored replies | PARTIALLY INTEGRATED (no independent measurement) |
| Provider A/B | see §6 | BROKEN | — |

## 11. Workflows & schedules

| Item | Path | Evidence | Class |
|---|---|---|---|
| Workflow list | `listWorkflows` → `list_workflows` (`lib.rs:1435`) | Live `{}` (none configured) parsed to empty | **FULLY INTEGRATED** (read path) |
| Run (stream first) | `runWorkflow` (`main.ts:1834`) → `execute_workflow_stream` → `/v1/workflows:stream` | Stream payloads **discarded**; run completes via done + polling | **PARTIALLY INTEGRATED** — live progress **BROKEN**, execution path NOT VERIFIED (no workflows) |
| Run (unary fallback) | `runWorkflowUnary` (`main.ts:1927`) → `execute_workflow` | Route verified (bogus ref 404) | NOT VERIFIED (execution) |
| Execution list + polling | `refreshExecutionsList`, `pollWorkflowExecution` (5×1.5 s cap) | Route verified | **FULLY INTEGRATED** (read path) |
| Dismiss | stops local tracking; server run continues — labeled honestly | Code | PARTIALLY INTEGRATED (no server cancel exists for plain runs) |
| Schedules list/create/toggle/trigger/history/delete | `renderSchedules` (`main.ts:2141`) → schedule commands (`loom_http.rs:411+`) | List live (`{}`); mutations NOT VERIFIED | **PARTIALLY INTEGRATED** |
| Schedule execution cancel | `cancelScheduledExecution` bridge — **no UI** | — | UNEXPOSED (issue 012) |
| Workflow name in error | `finishWorkflowRun` (`main.ts:1893`) | `runningWorkflow` nulled before use → `Workflow "" failed` | DEFECT (issue 006) |
| Run attribution | stream path passes `selectedWorkId` at completion (`main.ts:1914`) | Execution can be linked to the wrong work item if the user switches mid-run | DEFECT (issue 006) |

## 12. Artifacts

| Item | Path | Evidence | Class |
|---|---|---|---|
| Workspace list | `refreshArtifacts` → `list_artifacts` (`lib.rs:1495`, limit 200) | Live | **FULLY INTEGRATED** |
| Session-scoped (per work) | `loadWorkArtifacts` | Live session filter | **FULLY INTEGRATED** |
| Detail | `get_artifact` (`lib.rs:1640`) | Live `{"artifact":{...}}` | **FULLY INTEGRATED** |
| Content | `get_artifact_content` (`lib.rs:1660`) + two-layer base64 | Live single-layer content; two-layer tested | **FULLY INTEGRATED** |
| Search | `searchArtifactsView` → `search_artifacts` (`lib.rs:1683`) | Route registered; search itself not executed; **no request token — an older query's response can overwrite a newer one** (QC-15) | PARTIALLY INTEGRATED (race defect) |
| Stats | `get_artifact_stats` (`lib.rs:1701`) | Live | **FULLY INTEGRATED** |
| Attach/detach to work | `toggleArtifact` → `set_work_artifacts` (local) | Local list; in-flight dedupe set | PARTIALLY INTEGRATED (local relationship) |

## 13. Evidence

| Item | Path | Evidence | Class |
|---|---|---|---|
| Evidence feed | `evidenceItems` (`main.ts:2795`): decided experiments (**recorded**) + workflow outputs (**observed**) | Real labels; rendered in Knowledge › Evidence + work detail | **PARTIALLY INTEGRATED** — no trace/test/citation chain (issues 004, 008) |
| Work-scoped evidence | `executionWorkIds` / `experimentWorkIds` in-memory maps | Lost on restart; stream path misattributes (issue 006) | PARTIALLY INTEGRATED |

## 14. Observability / traces

| Item | Path | Evidence | Class |
|---|---|---|---|
| Trace dialog | `openTraceDialog` (`main.ts:4241`) → `get_trace` → `GET /v1/traces/{id}` | Route live (404 for bogus); server stores spans 1 h; **no trace id ever reaches the IDE** | **BROKEN** (issue 004) |

## 15. Unity / Spatial (see also 06)

| Item | Path | Evidence | Class |
|---|---|---|---|
| Player embed + load/error states | `spatial.ts` ↔ `spatial-player.html/js` ↔ `MemoryPalaceController.cs` | Headless WebGL check: 200, 0 collider errors; messages origin-checked both sides | **FULLY INTEGRATED** (bridge) |
| Portal navigation | `loom-spatial-select` → `setMode` per portal | `LoomVault.jslib:13`; host validates origin | **FULLY INTEGRATED** (code; Editor self-check passed) |
| State push (pill → bench) | `notifySpatialState` ← `currentLoomState()` | Real app state (chat in flight, workflow, attention, connection) | **FULLY INTEGRATED** |
| Vault counts, theme, quality, reduced motion | `loom-vault-changed` / `loom-theme` / `loom-quality` / `ApplyReducedMotion` | Handlers exist in controller; pending-flush for pre-load pushes | **FULLY INTEGRATED** (code; pixel check blocked) |

## 16. Sphere

| Item | Path | Evidence | Class |
|---|---|---|---|
| State derivation | `currentLoomState` (`main.ts:6755`) + `loomState` (`loom-state.ts`) | Derived from real state only; live UI test observed pill state transitions | **FULLY INTEGRATED** (as an indicator) |
| Caption accuracy | `CAPTIONS` (`main.ts:172`) | "error" caption conflates vault failure with Loom failure (issue 014) | PARTIALLY INTEGRATED |

## 17. Attention

| Item | Path | Evidence | Class |
|---|---|---|---|
| Decision inbox | `get_attention` (local experiments, ≥2 done arms, no choice) | Real local decisions; tested | **UI ONLY** (Loom has no attention list endpoint — `collaboration.proto` has no service) |
| HITL cards in chat | see §1 | — | FULLY INTEGRATED (unexercised live) |
| "finding" kind | reserved; backend never produces it; dialog copy says "comes from the Loom server" (unreachable) | `main.ts:3213` | DEAD COPY (issue 015) |

## 18. Autonomy

| Item | Path | Evidence | Class |
|---|---|---|---|
| Dial + justification + history | `buildAutonomyDial`/`openAutonomyDialog` (`main.ts:839-990`) | Local rules enforced (ceiling, justification on raise, instant down) | **UI ONLY** — not enforced by Loom (issue 005) |
| Cascade on intent change | `update_intent` auto-tightening with history | Tested | **UI ONLY** |
| Transmission | `active_work_autonomy` string in context pack | Effect NOT VERIFIED | PARTIALLY INTEGRATED |

## 19. Settings / appearance / connection

| Item | Path | Evidence | Class |
|---|---|---|---|
| Theme, quality tiers, layers | `theme.ts`, View menu, localStorage | Local; tested | **UI ONLY** |
| Status pill + re-probe | `renderStatusPill` (`main.ts:6763`), 10 s offline re-probe, one-shot 3 s after stream drop | Live-observed transition; matches `LOOM_CONNECTION_MODEL.md` | **FULLY INTEGRATED** |

## 20. Knowledge / Patterns / Skills / Apps / MCP / Admin (consolidated)

| Item | Class |
|---|---|
| Vault (notes, graph, canvas, review, activity) | **UI ONLY** (markdown vault; honest local-first) |
| Patterns shelf (list/detail/create/load) | **FULLY INTEGRATED** for read paths (live); create/load routes registered, not executed |
| Pattern updates stream | **BROKEN** (framing; shelf still refreshes on open — cosmetic) |
| Skills shelf (add/classify/bulk import) | **BROKEN** — all 404 (issue 002) |
| Apps tab (list/open/create/delete/component types) | **PARTIALLY INTEGRATED** — list/detail/open live; **create posts `{name, html}` to a declarative-spec API** (QC-22); delete route registered, not executed; update has no UI |
| MCP servers tab (list/add/edit/delete/restart/health/test/tools) | **PARTIALLY INTEGRATED** — routes verified; CRUD NOT VERIFIED (none configured); edit forces `enabled: true` (issue 009) |
| Server admin (TLS status/renew, storage migrate, config, storage status) | **PARTIALLY INTEGRATED** — config/storage live; renew/migrate NOT VERIFIED (destructive) |
