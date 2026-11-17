# 10 — Remediation Roadmap

Smallest practical sequence, prioritizing **completing existing functionality
over introducing new layers**. No step requires modifying Loom as a default;
the single upstream item (autonomy runtime contract) is marked out-of-scope.

## P0 — Human control and security (first, no new architecture)

1. **Enforce the autonomy dial at the IDE boundary.** In the Rust layer,
   resolve the active intent's level and gate: which workflows may run, which
   approval/tool-heavy requests the IDE will forward, and which local actions
   are offered. Four levels map to a concrete action allowlist. *This is
   entirely client-side; Loom is untouched.*
2. **Loopback-bind + restrict CORS for the local gateway** (operator change,
   not code). Default `0.0.0.0` + wildcard CORS must become `127.0.0.1` + an
   explicit origin allowlist, or the "localhost only" decision is false.
3. **Specify the autonomy runtime contract** (upstream, out of scope): a
   Loom permission/autonomy mapping so the runtime enforces the level too.
   Document, do not implement.

## P1 — Collapse duplication and reach the missing capabilities

4. **Complete the task migration (DECISIONS D6).** Move local work/intent to
   Loom tasks via the existing read-only `work_migration_preview` → explicit
   user-triggered migration. Removes the only real storage overlap.
5. **Wire the Rust gRPC client (DECISIONS D3).** Unblocks judge, graph
   memory, memory layer, task decompose/dependencies — the capabilities the
   IDE currently cannot reach. Dependency-gated (tonic/prost), approved.
6. **Implement Loom-as-MCP ↔ harness (DECISIONS D5)** with an explicit
   allowlist; pin and display the MCP spec version.

## P2 — Close the verification gaps

7. **Add the judge case-file harness** (`08`): case id, input, initial
   state, permitted actions, expected final state, prohibited changes,
   grader rubric; a grounding check per verdict; judge policy kept separate
   from agent text.
8. **Add one app-level failure-injection test** (stub a plausible-but-wrong
   completion, assert the honest-failure path).
9. **Execute one live UI→Loom→UI turn through the rebuilt binary** in a
   disposable profile (closes criterion 1 / NG-4); plus a held-tool
   approve/deny round-trip (closes the HITL enforcement question).

## P3 — Hygiene

10. **Format `native-app` once** (or keep it explicitly excluded) so "fmt ✓"
    is unambiguous.
11. **Fix the reserved-but-unproduced attention `finding` copy** and the
    five-step-vs-four-level philosophy drift.
12. **Surface per-turn latency** alongside cost, and show the server's
    enforcement of `timeout_seconds` (so a budget is visibly real).

## Sequencing rationale

P0 items are control-boundary defects that are cheap (client-side) and high
impact; they precede all capability work. P1 removes duplication and reaches
already-decided capabilities; P2 turns "verified" from a claim into a
measurement. Nothing proposes a rewrite, a second orchestrator, or a Loom
change as the default.
