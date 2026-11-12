# Deliverable 5 — Loom Architecture Assessment (read-only)

## Identity (observed)

- Module `github.com/teradata-labs/loom`, `go 1.26.0`, `VERSION 1.4.0` (`go.mod`, `VERSION`).
- Binaries are local dev builds embedding `v1.4.1-0.20261110231235-ab46f76f1bd9` (REA `ev_b0c6a2ce…`).
- `bin/loom` 83448768 B sha256 `0e40eab9…`; `bin/loom-mcp` 52967288 B `c484104d…`; `bin/looms` 111129704 B `534da3e0…` (all ELF x86-64, not stripped).
- Toolchain: go1.26.8 + GCC Ubuntu 15.2.0 (Craft `ev_87746008…`, `ev_7c12dba5…`).
- Hardening (REA): ET_EXEC PIE-off, NX/SSP/FORTIFY-on, RELRO-partial, CET-off, no rpath, not stripped.
- Release: `.github/workflows/release.yml` 12-entry matrix (loom/looms/loom-standalone × linux/darwin/win), `CGO_ENABLED=1`, `-tags fts5`. Runtime: `docker/Dockerfile.runtime` (`looms serve`, :60051+:5006, distroless). Bench/LME via ACR refs. Packaging: brew/choco/scoop/winget.
- `cmd/`: 12 entry pkgs incl. loom, looms, loom-mcp, loom-standalone, loom-bench-server/harness, loom-longmemeval (each `main.go`).

## Execution model (existing)

- `pkg/agent.Agent`: `Chat`/`ChatWithProgress`/`ChatWithContentBlocks` → `chat()` (`pkg/agent/agent.go:1908-1946`); fabric backend, `shuttle.Registry`+`Executor`, `PermissionChecker`, admission Chain, `hitlPark`, `eventLog`, `sessionLocks`.
- Registry: GUID-stable agents, fsnotify hot-reload, per-role providers, skills/MCP wiring (`pkg/agent/registry.go`).
- Sessions: `session_store.go`/`session_storage.go`, `SubscribeToSession` streaming, `resume_session.go`, park-and-resume (`park.go`, `hitl_*`, `ResourceAwaitHandler`).
- Orchestration: `pkg/orchestration.Orchestrator` + pipeline/parallel/fork-join/conditional/debate/swarm/iterative builders, HITL gates (`hitl_gate.go`), `resume.go`, capability leveling. Scheduler: cron-backed (`pkg/scheduler/scheduler.go`). Tasks: `pkg/task` Manager/store/timeline + TaskService.

## APIs and services (existing)

- 11 proto services in `proto/loom/v1` (~163 rpc lines; README claims 151 — unverified): LoomService (97 RPCs incl. Weave/StreamWeave), TaskService (19), ToolRegistry/Judge/GraphMemory/Learning/LLMScheduler/MemoryLayer/SkillsImport/Teleprompter, AdminService.
- `WeaveProgress.hitl_request` 4 card states. HTTP via grpc-gateway + custom SSE (`pkg/server/http.go` `handleStreamWeaveSSE`, Swagger, CORS, `/apps/`).
- Defaults gRPC :60051 / HTTP :5006.

## Tools (existing)

- `shuttle.Tool` (`tool.go`): Name/Description/InputSchema/Execute/Backend + `ConcurrencySafe` opt-in; `Registry`; `Executor` with shared-memory large-result threshold, PermissionChecker, admission Chain, dynamic MCP/builtin registration.
- Builtins `pkg/shuttle/builtin`: file_read/write, edit_files, shell_execute (+jailed), http/grpc clients, web_search, send_message/publish, shared_memory, workspace, agent_management, parse_document, vision, workflow_viz.
- Model-facing: `manage_skills_tool.go`, `load_pattern_tool.go`, `recall_tool.go`, `task_board_tool.go`, `decision_tool.go`, `graph_memory_tool.go`, `lua_tool.go`/`lua_host.go`.

## Models (existing)

- Canonical `pkg/types`: ToolCall/Message/Usage/LLMResponse/LLMProvider/StreamingLLMProvider (+thought signatures, multimodal ContentBlock).
- 11 providers (anthropic/azureopenai/bedrock/bedrockmantle/gemini/huggingface/litellm/mistral/ollama/openai) via `factory.ProviderFactory`, `catalog`, TPM scheduler (`pkg/llm/scheduler` + `llm_scheduler.proto`), rate limiters, `instrumented_provider`, per-role providers, mid-session `SwitchModel`.

## Memory/context (existing)

- `memory.go`, `MemoryCompressor`, `segmented_memory.go`, `context_compilation.go`, token counters/limits; 5-layer ROM/Kernel/L1/L2/Swap/Learned + tiered Shared Memory (`docs/architecture/memory-systems.md`).
- GraphMemory: entities/edges/salience/FTS5, agent-scoped, immutable audit (`docs/architecture/graph-memory.md`); `GraphMemoryStore` CRUD + Relate/Neighbors/Remember/Recall/Forget/Supersede/Consolidate/Lineage/Decay/ContextFor/VectorRecall.
- Artifacts: `sessions/<id>/` dirs, CASCADE FK, FTS5 search (`docs/architecture/artifacts.md`); skills menu injected at creation, bodies on demand.

## Observability (existing)

- `pkg/observability.Tracer` + hawk/otel/noop/mock implementations, auto-select, instrumentation wrappers (`InstrumentedProvider/Backend/Executor`), PII redaction, SQLite queryable spans, `GetTrace`/`GetSystemStats` RPCs.

## Permissions (existing)

- `shuttle.PermissionChecker` (RequireApproval/YOLO/AllowedTools/DisabledTools/DefaultAction/Timeout; exact+prefix `*`).
- Admission Chain (`pkg/shuttle/admission_chain.go`): hooks+postHooks+AskResolver, Admit/Preflight/Observe, AskGrant, PersistedDecision deny/audit stamping.
- `internal/permission.Service` (Crush-compatible Grant/GrantPersistent/Deny/Subscribe/AutoApproveSession, TUI-side).
- `shell_execute` jailed via `pkg/shelljail`+`shellpolicy` (+`shelljail.Main` gate in looms main); auth interceptor + Supabase auth; `server.allow_time_override`/`allow_assistant_override` replay gates.

## UIs (existing)

- `loom` TUI (`internal/tui`, Bubble Tea chat + dialogs/permissions/filepicker; chat, not editor). HTTP Swagger + SSE + MCP Apps at `/apps/` (`pkg/mcp/apps` JSON-spec → standalone HTML, 14 components, in-mem registry). `web/index.html` landing only. `loom-mcp` exposes Loom as MCP tools + `ui://` resources. `workflow-viz` CLI/tool.

## Extension points (existing)

New `shuttle.Tool`+Registry; new `fabric.ExecutionBackend`; new LLM provider via factory+catalog; MCP servers via config + `pkg/mcp/*`; YAML skills (`MANUAL/AUTO/HYBRID/ALWAYS`, `EAGER/LAZY/ALWAYS`, hot-reload) + YAML patterns (158 files) + `prompts/`; Lua tools/scripts; workflow builders; judges/evals/teleprompter; Tracer/SpanExporter; admission Hooks/PostToolHooks.

## Constraints (observed)

`-tags fts5` mandatory; proto-first + buf breaking; `-race` all tests; no role-prompting; tracing required; SQLite default w/ versioned migrations + `VACUUM INTO` upgrade via `looms upgrade`.

## Capability map for the IDE

- **Existing:** Weave/StreamWeave+SSE streaming; sessions/agents/tasks/workflows/bus/shared-mem/artifacts/GraphMemory/Judge/Teleprompter RPCs; admission+permissions+hold-vs-park+checkpoints+eventlog; tracers; FTS5; MCP Apps panels.
- **Extension opportunity:** new IDE shuttle.Tools; new skill/pattern packs; new judges/teleprompter templates; MCP Apps JSON panels (after interactive-capability spike); versioned SQLite/PG migration for Intent/Work/Trust/budgets/provenance.
- **Architectural gap:** persistent Intent/Work/Trust objects; nested-budget composition; concurrent-write serialization; Trust formula; L4 digest standard; Memory-write approval rule; real LSP (`internal/lsp/lsp.go` is stub, disconnected, zero diagnostics).
- **Research hypothesis:** evidence-to-skill pipeline reuse (`pkg/apprentice`+weaver); TPM-scheduler vs keystroke latency; interactive (non-static) MCP Apps runtime.

## Unresolved (bounded)

`pkg/server/multi_agent.go` Weave internals; agent chat-loop body; session_store/eventlog impls; decision-router semantics; MCP manager/client; `looms.yaml` full schema; storage schemas; TUI components; MCP Apps runtime.js; Lua API; per-provider quirks; `project/orchestration/communication/storage.proto` shapes; `hitl_gate.go`+`resume.go`; scheduler internals; evals/LongMemEval; `internal/agent` vs `pkg/agent` split; exact per-service RPC count (151 vs ~163).
