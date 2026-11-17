# 04 — Architecture & Orchestration Assessment

## Execution model

Quiet Complexity is a **fixed-workflow UI over a delegated agent loop** —
exactly the "combine patterns when justified" shape the reference
recommends:

- **Fixed workflow (the IDE):** the human selects work → session → agent →
  intent, then sends a message; the UI deterministically renders stream
  events, settles exactly once, and records a run. There is no model-driven
  control flow *inside* the IDE.
- **Agent loop (Loom):** `Weave`/`StreamWeave` runs Loom's single-agent-
  with-tools loop (`ag.Chat(ChatWithProgress)`), with its own turns, tool
  calls, and termination — the IDE neither duplicates nor subverts it.

This is the correct division: the IDE owns *human agency, local planning
objects, and client durability*; Loom owns *execution, tools, memory, and
workflows*. Reintroducing an orchestration layer in the IDE would be an
anti-pattern, and the audit recommends against it.

## State ownership

| State | Owner | Notes |
|---|---|---|
| Work / intent / acceptance / autonomy | IDE local (`work.json`, `intents.json`) | Human-planning objects; migration to Loom tasks is decided (D6) |
| Experiments / A-B decisions | IDE local (`experiments.json`) | No Loom equivalent |
| Vault notes | IDE local (markdown) | One-way mirror from Loom sessions/agents/artifacts |
| Sessions / agents / artifacts / patterns / tools / models / workflows | **Loom** | Read through the gateway; the IDE caches nothing as a system of record |
| Run records / chat cache | IDE local (localStorage) | Client durability, capped (200 runs) |
| In-flight streams | IDE in-memory (`activeStreams`, `workflowStreamOrigin`) | Volatile by design; settle-once guards the counter |

The only genuine overlap is work/intent vs Loom tasks, which has a recorded
resolution. No message broker, no second state manager, no custom
orchestration layer.

## Orchestration properties

| Property | Finding | Evidence |
|---|---|---|
| Agent lifecycle | Owned by Loom (create/select/status via gateway) | `list_agents`/`get_agent`/`create_agent` |
| Task execution | Delegated to Loom `Weave`; IDE tracks a client-side run record | `recordRunStart`/`recordRunSettle` |
| Workflow coordination | Loom workflows (list/execute/status); IDE attributes results to the originating work | `workflowStreamOrigin` + persisted ownership map |
| Task routing | Manual (human picks agent/session); no auto-router | intended |
| Delegation / parallel | None in the IDE; Loom orchestrator owns it | not applicable |
| Shared state | Loom sessions (server); IDE local stores (client) | two scopes, no conflict |
| Error propagation | Reader errors → `handleStreamEvent` → typed captions (rejection vs disconnection) | `isLoomConnectionError` |
| Cancellation | Cooperative: `cancel_loom_stream` sets a flag checked every read wake; Stop ≠ backend abort (documented) | `cancel_during_silence_stops_the_reader` |
| Timeouts | 2 s connect, 5 s write, 4 s GET read, 180 s POST read, 20 s stream wake, 30 min cap; per-turn `timeout_seconds` sent | `loom_http_raw` + `WeaveRequest` |
| Completion verification | Stage 7 required; stage 8/EOF/truncation are errors; exactly-once settle | `weave_completed` + 28 stream tests |

## Execution contract (reference's "run contract")

The reference's run contract maps as follows:

| Contract field | Where it lives | Gap |
|---|---|---|
| Objective | Intent statement + acceptance criteria | client only; not sent to Loom as a formal goal |
| Inputs | query + session/agent + context pack | bounded, labeled untrusted |
| Allowed actions | **Loom** tools + autonomy dial (client) | dial not enforced (QC-01) |
| State / run ID | `runId` client + `session_id` server | no shared run identity across the boundary |
| Limits | `max_rounds`/`timeout_seconds` now sent | `max_rounds` has no server consumer |
| Completion | stage 7 / verified outcome | content not independently graded |
| Output | answer + cost + trace + evidence kind | receipts (artifacts) surfaced but not linked to the run |

The contract is **present but partially client-side**; the most important
gap is that the human's "allowed actions" intent is not enforced by the
runtime (see `07`, QC-01).

## Architectural complexity verdict

**Not unnecessarily complicated.** The IDE is a thin client with ~141 Tauri
commands that are almost all direct gateway calls or local CRUD. The only
custom machinery is the stream reader (justified by Loom's custom SSE
handler, now well-tested) and the local planning stores (a deliberate
human-centered layer, with a migration decision in place). No competing
agent abstractions, no service wrappers, no message broker, no duplicate
telemetry.
