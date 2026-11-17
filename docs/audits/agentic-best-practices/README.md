# Quiet Complexity — Agentic Best Practices Audit

Independent audit of **Quiet Complexity** (`/home/ed/loom-ide-tauri` @
`c58777f`, branch `tauri-prototype`) against Loom v1.4.0
(`/home/ed/work/loom` @ `8082078`, **read-only — untouched**) and the
[Awesome Agentic System Design](https://github.com/gtzheng/Awesome-Agentic-System-Design)
reference. **Audit only** — no source modified, no Loom change, nothing
pushed, no destructive test. Line-level and live-probe evidence is in the
sibling corpus `../quiet-complexity-loom/`.

## Documents

| # | Document |
|---|---|
| 01 | [Executive assessment](01-executive-assessment.md) |
| 02 | [Best-practices compliance matrix](02-best-practices-compliance-matrix.md) |
| 03 | [Loom integration assessment](03-loom-integration-assessment.md) |
| 04 | [Architecture & orchestration](04-architecture-orchestration.md) |
| 05 | [Context & memory](05-context-memory.md) |
| 06 | [Tools & protocols](06-tools-protocols.md) |
| 07 | [Reliability & security](07-reliability-security.md) |
| 08 | [Observability & evaluation](08-observability-evaluation.md) |
| 09 | [Software engineering](09-software-engineering.md) |
| 10 | [Remediation roadmap](10-remediation-roadmap.md) |
| 11 | [Actionable issues](11-actionable-issues.md) → [`11-issues/`](11-issues/) |

## The fourteen questions

1. **Sound agentic design?** Mostly — a fixed UI workflow delegating to
   Loom's single-agent loop, with a real run contract. One critical gap
   (autonomy unenforced).
2. **Unnecessarily complicated?** No — a thin client, no competing
   orchestration, no service wrappers.
3. **Duplicating Loom?** Partially in *storage* (work/intent/vault vs
   tasks/artifacts/memory), not in *capability* (no agent loop/tools/memory
   of its own). Migration is already decided (D6).
4. **Workflows structured correctly?** Yes — Loom owns workflows; the IDE
   attributes results correctly and does not reimplement them.
5. **Context/memory appropriate?** Context is bounded and treated as
   untrusted. Memory is a local one-way mirror; Loom graph memory is
   unwired (gRPC) — a gap, not a conflict.
6. **Tool contracts robust?** Loom's tools are server-side and correctly
   delegated; the MCP registry is complete. Autonomy is the missing
   permission layer.
7. **Reliable under failure?** Yes as a client (atomic writes, GET-only
   retry, no POST replay, cooperative cancel, bounded readers).
8. **Human control genuinely enforced?** **No** — the autonomy dial governs
   metadata, not execution (the critical defect).
9. **Execution observable/verifiable?** Observably yes (trace, cost, tool
   events); verifiably only at the transport layer — no held-out eval set.
10. **Fully integrated with Loom?** **No** — a genuine, test-pinned partial
    integration; gaps are control-boundary (autonomy, exposure) and
    capability (gRPC families), not primary-path breakage.
11. **Most serious weaknesses?** Unenforced autonomy (P0), exposed
    unauthenticated gateway (P0), local/Loom storage duplication (P1),
    unreachable gRPC capabilities (P1).
12. **Greatest value, least disruption?** Enforce autonomy at the IDE
    boundary; loopback-bind the gateway; complete the D6 task migration;
    add the judge case harness.
13. **What to keep unchanged?** The vanilla TS/Tauri/Rust/Unity stack, the
    thin-client delegation, the honesty mechanics, the tested stream
    reader, the central sphere + deferred Q2.
14. **What blocks production-readiness?** The two P0s (autonomy, exposure),
    the missing traversed-path proof (AP-07), and the absence of a measured
    evaluation set (AP-05).

## Prioritized findings

| Priority | Finding | Evidence | Impact | Action |
|---|---|---|---|---|
| P0 | Autonomy dial unenforced (AP-01) | `store.rs` levels + `multi_agent.go` no enforcement | Human control is illusory | Enforce at IDE boundary; specify Loom contract |
| P0 | Gateway exposure (AP-02) | `cmd_serve.go` `0.0.0.0`, wildcard CORS | Any host process/browser origin drives Loom | Loopback-bind + CORS allowlist |
| P1 | gRPC families unwired (AP-03) | `http.go` registration; no tonic | Judge/graph-memory unreachable | Rust gRPC client (D3) |
| P1 | Storage duplication (AP-04) | `work.json`/`intents.json` vs Loom tasks | Two sources of truth | Complete D6 migration |
| P1 | No eval set (AP-05) | `weave_completed` = transport truth | "correct" unmeasured | Judge case harness |
| P1 | `max_rounds` unenforced (AP-06) | `multi_agent.go` no consumer | Turn budget governs time only | Honest copy; upstream map |
| P2 | Traversed path unproven (AP-07) | probes, not UI, at head | Criterion-1 gap | Disposable-profile live turn |
| P2 | Approval binding unverified (AP-08) | route only, no execute | Enforcement not shown | Held-tool round-trip |
| P2 | MCP version + D5 (AP-09) | unpinned; D5 undone | Interop drift | Pin version; D5 + allowlist |
| P3 | Hygiene (AP-10) | native-app fmt, dial drift, dead branch | Minor | Format once; align docs |
