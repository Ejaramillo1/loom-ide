# 03 — Loom Integration Assessment

Classification: **FULLY** / **PARTIALLY** / **BROKEN** / **UI ONLY** /
**UNSUPPORTED** / **NOT VERIFIED**. A feature is only "FULLY" when an
operation provably reaches Loom and its result returns to the UI. Current
state: IDE `c58777f`, Loom `8082078` (v1.4.0). Deep evidence:
`../quiet-complexity-loom/` (`00`–`14`, `evidence/`).

## Execution path (both directions, as implemented)

```
Human Interaction
  → UI (main.ts sendChat / handleStreamEvent / finishStream)
  → Tauri command (ask_loom_stream | ask_loom)
  → Rust stream reader (loom_stream.rs run_stream: connect→write→decode chunked/NDJSON/SSE→re-emit)
  → Loom HTTP gateway (POST /v1/weave:stream | /v1/weave)
  → Loom runtime (Weave/StreamWeave → ag.Chat(ChatWithProgress))
  → agents / tools / memory / workflows
  → WeaveProgress events → WeaveResponse
  ← stream events re-emitted as `loom-stream` Tauri events
  ← handleStreamEvent renders partial_content, cost, tool lines, HITL cards
  ← finishStream settles exactly once, adopts session, links work, records run
  ← Human feedback (Stop / Approve / Deny / next message)
```

The path is real and traversed for chat (live-verified at audit time and
byte-faithfully re-verified against Loom `8082078` in the prior corpus).

## Feature map

| Feature | Status | Evidence |
|---|---|---|
| **Chat / conversation** | **FULLY** | Streaming tokens + unary fallback; identity (snake_case `session_id`/`agent_id`) test-pinned and live-verified (same-session reuse 2→4); completion truth (stage 7 required, stage 8/EOF/truncation are errors); chunked framing; settle-once |
| **Sessions** (list/create/history/detail) | **FULLY** | `list_sessions`/`create_session`/`get_session_history`/`get_session`; live probes |
| **Agents** (list/detail/select) | **FULLY** | `list_agents`/`get_agent`; live probes |
| **Artifacts** (list/detail/content/stats/search/attach) | **FULLY** | `list_artifacts`/`get_artifact`/`get_artifact_content`/`search_artifacts`/`get_artifact_stats`; live probes |
| **Patterns / apps / models / tools / providers** | **FULLY** | List/detail paths live-verified; `/apps/{name}` opened in a browser window |
| **Workflows** (list/execute/status) | **PARTIALLY** | List/execute/executions wired; live *progress* verified only by fixtures (no live run executed — nothing configured); attribution fixed + tested |
| **Task boards / tasks** | **FULLY** (since Loom `8082078`) | TaskService HTTP-registered; live `/v1/tasks` 200 (15), `/v1/boards` 200 (5) |
| **Skills import** | **FULLY** (since Loom `8082078`) | SkillsImportService registered; live 400-validation instead of 404 |
| **Experiments / A/B** | **PARTIALLY** | Chat-backed arms real; provider A/B decodes camelCase `ABTestEvent`; no live A/B run executed |
| **Context → prompt** | **FULLY** (since Loom `8082078`) | `requestContextSection` consumes `WeaveRequest.context`, bounded 1200/600, labeled untrusted |
| **Trace / observability** | **FULLY** (since Loom `8082078`) | `WeaveResponse.TraceId` populated; `get_trace` + "View trace" UI |
| **Human approvals (HITL)** | **PARTIALLY** | `POST /v1/human-requests/{id}:respond` route + IDE routing live-verified; a full approve→tool-executes round-trip not executed |
| **Autonomy enforcement** | **UNSUPPORTED** | Four levels stored/labeled client-side; Loom weave path enforces nothing (QC-01) |
| **gRPC-only families** (judge, graph memory, memory layer, learning, LLM scheduler, teleprompter, task decompose/dependencies) | **UNSUPPORTED (not wired)** | No Rust gRPC client (DECISIONS D3 deferred); these are unreachable from the IDE |
| **Loom-as-MCP-server ↔ harness** | **NOT VERIFIED** | DECISIONS D5 decided, not implemented |
| **Message bus / admin** | **UI ONLY / UNSUPPORTED** | RPCs stubbed or admin-only; not exposed |

## "Are we rebuilding Loom?" — the duplication audit

The IDE **does not** re-implement any agent capability: it has no agent
loop, no tool executor, no workflow engine, no memory index, no model
client of its own. What it *does* store locally is a **human-planning and
durability layer**, not competing agent infrastructure:

| Local store | Purpose | Overlaps with | Resolution |
|---|---|---|---|
| `intents.json` / `work.json` | Person-owned goals + work items with acceptance/autonomy | Loom tasks/boards (now HTTP) | DECISIONS D6: full migration to Loom tasks (explicit, never silent) |
| `experiments.json` | Local A/B decision records | Loom (no direct equivalent) | Local by design |
| `Research Vault` (markdown) | Human knowledge notes | Loom artifacts / graph memory (gRPC, unwired) | One-way mirror (Loom→vault); graph memory deferred |
| run records + chat cache (localStorage) | Client durability for UI restart | Loom session history + trace | Complementary (client-side, not a system of record) |

**Verdict on duplication:** there is *partial* storage overlap (work/intent
vs tasks, vault vs artifacts/memory), already owned by a recorded migration
decision. There is **no** duplication of the agent runtime, orchestration,
tools, or memory — those are Loom's, used through supported interfaces. The
custom SSE/NDJSON chunk decoder in `loom_stream.rs` is an adapter required
because Loom's stream endpoint uses a hand-rolled `encoding/json` handler;
it is now pinned by 28 tests including a real loopback TCP fixture, so it is
fragile-by-nature but not fragile-by-neglect.
