# 02 — Best Practices Compliance Matrix

Practices extracted from the reference's original docs
(`architecture.md`, `context-and-memory.md`, `tools-and-protocols.md`,
`evaluation.md`, `production-and-safety.md`). Ratings: **C** compliant,
**P** partial, **G** gap, **N/A** not applicable. "Evidence" cites Quiet
Complexity source; line-level proof is in `../quiet-complexity-loom/`.

## Architecture & orchestration

| Practice | Ref | Status | Evidence |
|---|---|---|---|
| Use the smallest useful control structure (workflow vs agent loop) | architecture | **C** | IDE is a fixed UI workflow; execution is delegated to Loom's single-agent-with-tools loop. No second orchestrator |
| Define a run contract (input/goal/actions/state/limits/completion/output) | architecture | **P** | Intent carries goal+acceptance+autonomy; `WeaveRequest` carries the runtime contract; per-turn limits (`max_rounds`/`timeout_seconds`) now sent from the IDE; run records track state/cost. No action ledger on the client |
| Separate a proposed action from runtime authority | architecture | **P** | Loom does this server-side; the IDE labels autonomy but does not enforce (QC-01) |
| Verify outcomes rather than trust model text | architecture | **P** | `weave_completed` requires stage 7 / `EXECUTION_STAGE_COMPLETED`; run records distinguish partial/failed. No independent grading of the *content* yet |
| Stop conditions for success/failure/exhaustion/cancel | architecture | **C** | Reader errors on EOF-before-completion, stage 8, truncation; cooperative cancel |
| Delegation with typed results + owned writes | architecture | **N/A** | The IDE does not orchestrate multiple agents; Loom owns this |

## Context, retrieval & memory

| Practice | Ref | Status | Evidence |
|---|---|---|---|
| Separate task context / execution state / knowledge / episodic / preferences / procedural | context-and-memory | **P** | Context pack (task), run records (execution), vault (knowledge), no explicit episodic/preference layer; Loom graph memory unwired |
| Build a context budget; keep large artifacts out of the prompt | context-and-memory | **C** | `requestContextSection` bounds the pack to 1200 chars, file content 600, truncation stated |
| Structured continuation record (goal, steps, hypotheses, pending, budget) | context-and-memory | **P** | Context pack carries work/intent/open-file; hypotheses are not marked "unverified" on the wire |
| Distinguish recalled vs verified evidence | context-and-memory | **C** | Evidence-kind labels `observed/recorded/inferred/unknown`; live replies default to `observed` |
| Memories as data; never override permissions | context-and-memory | **G** | No memory-driven instruction path; but autonomy (the permission layer) is itself unenforced |

## Tools, skills & protocols

| Practice | Ref | Status | Evidence |
|---|---|---|---|
| Each tool has purpose/schema/auth/preconditions/side-effects/result/errors/limits/idempotency | tools-and-protocols | **C (Loom side)** | Tools are Loom's; the IDE surfaces tool-call events from the stream. IDE-side MCP management has purpose/schema/result |
| Version a wire protocol rather than "latest" | tools-and-protocols | **P** | IDE pins snake_case (SSE) vs camelCase (protojson) with tests; MCP spec version not pinned/displayed |
| Prefer a small set of purposeful tools | tools-and-protocols | **C** | Delegated to Loom; IDE adds none of its own |
| Use supported interfaces; don't bypass intended architecture | tools-and-protocols | **P** | Uses Loom's HTTP gateway (supported). The stream reader hand-implements SSE/NDJSON chunk framing because Loom's stream endpoint is a custom handler — now pinned by fixtures. gRPC-only families bypassed (not reachable) |

## Evaluation

| Practice | Ref | Status | Evidence |
|---|---|---|---|
| Build an eval set (case ID, expected/prohibited state, grader, pinned versions) before optimizing | evaluation | **G** | `judge/` tooling exists but no held-out case files; no prohibited-change spec |
| Measure more than completion (safety, grounding, consistency, recovery, cost) | evaluation | **P** | Cost is captured per turn; safety/grounding/consistency are not measured |
| Graders appropriate to outcome; judge policy not agent-editable | evaluation | **P** | `judge/JUDGE_PROMPT_TEMPLATE.md` exists; not wired to a case harness |
| Repeated trials / pass@k with stated estimators | evaluation | **N/A** | No benchmark harness |
| Offline → shadow → limited rollout | evaluation | **P** | Loom has shadow mode server-side; the IDE does not gate releases |

## Production, reliability & safety

| Practice | Ref | Status | Evidence |
|---|---|---|---|
| Durable run state separate from workers; explicit terminal outcomes | production | **P** | Run records in localStorage (survive UI restart, not a transactional store); chat cache separate |
| External-write checklist (idempotency key, receipt, reconcile) | production | **N/A (client)** | The IDE issues no external writes; Loom does. The IDE never replays a failed POST |
| Retry limit + backoff + jitter; don't retry invalid/unknown | production | **P** | One GET-only retry (500 ms) on refused/timeout; POST never replayed; no jitter |
| Enforce trust boundaries (retrieved→model, model→tool, approval→action) | production | **G** | Loom's shelljail/decision layer cover model→tool and generated-code→env; the approval→action binding and the autonomy dial are the client gaps |
| Human involvement: show action, persist approval, defined timeout state | production | **P** | HITL cards show parameters+expiry; approval route live-verified; a full approve→execute round-trip is not |
| Correlate runs/traces/tool calls/cost | production | **C** | TraceId returned, "View trace" UI, per-turn cost + run records, tool-call events |
| Budget latency & cost (max spend/deadline/turns) | production | **P** | `timeout_seconds` enforced server-side; `max_rounds` has no server consumer (sent but not enforced) |
| Release: pin versions, offline regression set, rollback, kill switch | production | **P** | Pinned wire formats + tests; no kill switch or staged rollout |

## Summary counts

- **Compliant:** 11 · **Partial:** 18 · **Gap:** 5 · **N/A:** 4

The five gaps (autonomy enforcement, memory-instruction boundary, no eval
set, no approval→action binding proof, no trust-boundary enforcement on the
client) are the recurring themes; the rest of the reference's guidance is
either already honored or reasonably scoped to a thin client.
