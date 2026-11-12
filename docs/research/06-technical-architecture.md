# Deliverable 6 — Proposed Technical Architecture

## Decision: drive Loom, do not fork it

The IDE is a client of `looms serve` over gRPC + grpc-gateway (gRPC :60051 / HTTP :5006). No forked agent runtime. Streaming via Weave/StreamWeave + SSE (`handleStreamWeaveSSE`). Reuse sessions, agents, TaskService, workflows, bus/shared-memory, artifacts, GraphMemory, Judge, Teleprompter RPCs.

Challenge to the 4-layer hypothesis: keep Experience / Interaction / Agentic-Control / Loom, but make Agentic-Control a thin policy + state-mapping layer over Loom's existing admission/permissions/HITL/checkpoint/eventlog — not a second orchestrator.

```text
+-------------------------------------------------------+
| EXPERIENCE: Workspace (B default) + A mode + C canvas |
| Editor/diffs · Artifacts · Evidence · Decisions       |
+-------------------------------------------------------+
| INTERACTION: direct manipulation + commands + NL      |
| Context actions · Apply/Reject · autonomy slider      |
+-------------------------------------------------------+
| AGENTIC CONTROL (thin): Intent/Work/Trust/budgets     |
| Gates · checkpoints · provenance · L0-L4 policy       |
+-------------------------------------------------------+
| LOOM: agents/tools/models/memory/runtime/traces       |
| Weave · shuttle · admission · GraphMemory · Judge     |
+-------------------------------------------------------+
```

## State and persistence

- New IDE state (Intent versions, Work ledger, Trust scores, budgets, provenance links) as versioned SQLite/PG migration + FTS5, following Loom's `VACUUM INTO` upgrade path (`looms upgrade`). Do not bypass Loom storage backends.
- Session lease + `ErrEventConflict` + `CheckpointStore (caller,workflow-id)` give crash-only resume; IDE checkpoints map onto Loom checkpoints + hold-vs-park (`WithHITLPark`/`ResumeChat`).
- Timeline remains a read model over messages + `task_history` + `human_requests` (per `docs/architecture/task-timeline.md`).

## Control mapping

UX Control → admission Chain (`Allow/Ask/Deny` + `AskResolver` + `PostToolHooks` + audit stamp) + `PermissionChecker` (YOLO/Allowlist/prefix-*) + Crush-compatible `internal/permission` + `WeaveProgress.hitl_request` 4 states. Risky skills stay `approval_required` unless YOLO. Shell stays jailed (`pkg/shelljail`+`shellpolicy`).

## Context and provenance

- Per-turn Context = budgeted view over Intent/Work/Artifacts (mirror graph_memory 20% injection).
- Provenance chain Artifact → Evidence → tool-call/session; reuse artifacts FTS5 + eventlog tool-call granularity + GraphMemory lineage.
- Identity triple (user/agent/session) stamped on every write.

## Coordination and multi-agent

Reuse quad-modal bus/queue/shared-mem/interrupt (`docs/architecture/communication-system-design.md`) with value-vs-ref routing; 9 orchestration patterns incl. pair-programming; fork-join/swarm for experiments; `single-process non-goal distributed` constraint respected (no fake distributed claims). Concurrent-write serialization still unsolved — scope locks/branches/CRDT in P2.

## Observability

Reuse embedded/Hawk/NoOp tracers + PII redaction + queryable spans + `Instrumented*` wrappers. IDE adds decision-centric views: gates, denials, demotions, overspend, judge failures — not an event firehose.

## Security boundaries

Trusted `x-user-id` + PG RLS, `x-admin-token`; no auth in Loom proper; SQLite single-tenant (`docs/reference/security-model.md`). IDE must not weaken admission/permission/shelljail; budget raises and Memory consolidations are gated actions.

## Performance

Open risk: TPM-slot scheduler waits vs keystroke latency — unmeasured. P0 spike: measure scheduler internals (`pkg/llm/scheduler`) under interactive load before promising ambient L2 in the editor.

## Extensibility

New `shuttle.Tool`s; new fabric backends; new LLM providers; MCP server configs; YAML skills+patterns; Lua sandbox; judges/teleprompter; MCP Apps JSON→HTML panels (14 comps) after interactive spike. LSP is stub — scope real LSP separately; do not claim Loom LSP support.

## Trade-offs

- Thin control = less code, more Loom coupling (proto-first + buf breaking constrain changes).
- B-default = familiar + precise, but Intent visibility and multi-artifact plans need explicit design.
- C-canvas deferred to advanced: presence + grouping cost is real; cap at ~30 cards with disciplined grouping.
