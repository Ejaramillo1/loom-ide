# 01 — Executive Assessment

> Independent audit of **Quiet Complexity** (IDE at `/home/ed/loom-ide-tauri`,
> branch `tauri-prototype` @ `c58777f`) against Loom v1.4.0
> (`/home/ed/work/loom` @ `8082078`, read-only) and the
> [Awesome Agentic System Design](https://github.com/gtzheng/Awesome-Agentic-System-Design)
> reference (MIT; fetched 2026-11-16, original docs only).
>
> **Audit only.** No source was modified, no Loom file was changed, nothing
> was pushed, and no test wrote to either checkout. Deep, line-level and
> live-probe evidence lives in the earlier corpus
> `../quiet-complexity-loom/` (docs `00`–`15`, `evidence/`); this document
> set re-states conclusions and adds the best-practices framing, without
> duplicating every raw probe.

## Verdict

Quiet Complexity is a **genuine, correctly-shaped thin client over Loom's
real intelligence** — not a mock, and not a case of "rebuilding the agent
platform inside the IDE." Its primary chat path is now trustworthy and
test-pinned end to end (identity, completion truth, transport framing,
settle-once lifecycle, cost capture, HITL routing, server-side context
consumption, TraceId). It is **not fully integrated**, and it is **not yet
production-ready**, for three evidence-backed reasons that are control-boundary
and verification issues rather than architecture problems:

1. **The autonomy dial is not enforced** — the four levels govern local
   metadata and are honestly labeled, but Loom's weave path enforces nothing
   (QC-01 / issue 005). A visual autonomy control without backend
   enforcement is, per the reference, a critical architectural defect.
2. **The local gateway posture exceeds the documented localhost trust
   boundary** — `looms` serves `0.0.0.0:5006`/`:60051` unauthenticated with
   wildcard CORS (QC-02 / issue 011). (The audit-time server in the earlier
   corpus was observed loopback-bound after a restart; the default and the
   CORS wildcard remain a decision for the operator.)
3. **No live model turn has been executed through the rebuilt UI at the
   current commit** — the Rust→Tauri→UI chain is pinned by tests at both
   ends and the wire contract is live-verified byte-for-byte, but the
   traversed-path proof (criterion 1) is still not demonstrated on the
   current binary.

Everything else the reference asks about is either present, present-with-
gaps, or an intentional local choice — detailed in `02`–`09` below.

## Overall maturity

| Dimension | Assessment | Basis |
|---|---|---|
| Architecture shape | **Strong** — fixed UI workflow + delegation to Loom's single-agent loop; no competing orchestration | `04` |
| Context/memory | **Adequate, one-way** — bounded context pack, local vault mirror; Loom graph memory unwired | `05` |
| Tool/protocol | **Adequate** — MCP CRUD managed, Loom tools server-side; no Loom-as-MCP yet | `06` |
| Reliability | **Good for a client** — durable run records, atomic writes, GET-only retry, cooperative cancel | `07` |
| Security | **Weak at the boundary** — no auth, wildcard CORS, unenforced autonomy | `07` |
| Observability | **Good, real** — TraceId, per-turn cost, tool-call events; evaluation set absent | `08` |
| Engineering | **Strong** — thin vanilla TS, 141 commands, 97/132/22 green suites, pinned wire formats | `09` |

## Critical risks (P0)

1. **Unenforced autonomy** — the flagship control concept governs nothing
   server-side. Any consequential action Loom performs is not constrained by
   the level the human set.
2. **Unauthenticated gateway exposure** — `0.0.0.0` + wildcard CORS + no
   auth means any process on the host (and any browser origin) can drive the
   Loom runtime. The IDE itself does not store credentials (they stay in
   Loom's config, outside the UI), but the gateway is the runtime's front
   door.

## Most valuable, least-disruptive next steps (expanded in `10`)

1. Enforce the four autonomy levels at the IDE boundary (which entry points
   may run / which actions the IDE forwards) and specify the Loom runtime
   contract — no new architecture, no Loom change required for the client
   half.
2. Loopback-bind + restrict CORS for the local deployment; keep remote as a
   separately authenticated transport.
3. Complete the already-decided task migration (DECISIONS `D6`) to collapse
   local work/intent storage into Loom tasks, removing the one real source
   of duplication.
4. Add a held-out evaluation set + failure injection to the existing
   `judge/` tooling, so "verified" is measured rather than asserted.
5. Wire the Rust gRPC client (DECISIONS `D3`) for the gRPC-only families
   (judge, graph memory, task decompose) currently unreachable.

## What must not change

The vanilla TypeScript/Tauri/Rust/Unity stack (no React), the thin-client
delegation model, the honesty mechanics (empty states, evidence-kind labels,
cost display, partial-reply preservation, rejection-vs-disconnection
captions), the now well-tested stream reader, and the central sphere +
deferred Q2 Unity fallback.
