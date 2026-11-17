# 08 — Observability & Evaluation Assessment

## Observability (real Loom data, not duplicate telemetry)

| Signal | Source | Surfaces in UI |
|---|---|---|
| Trace correlation | `WeaveResponse.TraceId` (Loom `8082078`) | "View trace ›" button → `get_trace` |
| Execution ids | `session_id` (server), `runId` (client run record) | session bar, run records |
| Tool-call visibility | `WeaveProgress` tool lifecycle events | tool lines in the chat stream |
| Token / cost | `CostInfo.total_cost_usd` (completion event + unary) | per-turn cost + scoped running total |
| Latency | stream latency (first byte) | not surfaced, but captured in probes |
| State transitions | `loomVerified` / sphere state / status pill | ambient sphere + pill |
| Errors | stream error envelopes, HTTP status + body | typed captions (rejection vs disconnection) |
| Retries | GET-only single retry | not surfaced (acceptable) |

Observability comes from **real Loom execution** — the IDE adds no parallel
telemetry stack, correctly. The only IDE-local signal is the run record,
which is client durability rather than telemetry.

## Test & evaluation quality

Current suites (fresh at `c58777f`):

| Suite | Result | What it proves |
|---|---|---|
| Vitest (frontend) | **97/97** (12 files) | Extracted real handlers over a fake DOM + mocked bridges: send/stream/settle lifecycle, HITL cards, stream consumers, run records, spatial, knowledge |
| `cargo test --lib` (Tauri) | **132 passed / 2 ignored** | Wire-contract pinning (snake_case vs camelCase), 28 stream fixtures (chunked/NDJSON/SSE/truncation/cancel, incl. a real loopback TCP socket), store/workspace/knowledge persistence |
| `cargo test` (native-app) | **22 passed** | Vault/session/workspace persistence and the eframe workbench |
| `cargo fmt --check` (src-tauri) | exit 0 | formatting gate (src-tauri only; native-app debt is documented) |
| Unity recompile / CheckWorkbench | deferred (no Editor available) | C# build + Play-mode self-check |

**Where the suite could mislead (reference: evaluation.md):**

1. **No held-out evaluation set.** `judge/` tooling and
   `JUDGE_PROMPT_TEMPLATE.md` exist, but there is no case file with
   expected-final-state / prohibited-changes / a grader rubric, so "the
   agent did the right thing" is never *measured* — only "the wire worked".
2. **Completion ≠ correctness.** `weave_completed` verifies the *stream
   ended at stage 7*, not that the *content* satisfied the intent. A fluent
   wrong answer is indistinguishable from a correct one by the current
   checks.
3. **No failure injection at the app level.** The stream reader has
   deterministic transport fixtures, but there is no harness that injects a
   wrong-but-well-formed Loom response into the full UI to observe recovery.
4. **No repeated-trial / pass@k discipline.** Single live probes
   demonstrate the happy path, not consistency under perturbation.
5. **The "no live turn through the rebuilt UI at head" gap** — the
   Rust→Tauri→UI path is pinned at both ends and the wire is byte-faithfully
   verified, but criterion 1 (a traversed UI→Loom→UI journey on the current
   binary) is not yet recorded.

These are **confidence gaps, not code defects**. The suite is unusually
strong for the transport/contract layer; it under-tests the *semantic* layer
(did the agent accomplish the human's goal) and the *operational* layer
(recovery under injected faults).

## Recommended evaluation additions (small, incremental)

1. Extend `judge/` to a case-file format (case id, input, initial state,
   permitted actions, expected final state, **prohibited changes**, grader
   rubric) — the reference's evaluation checklist, verbatim shape.
2. Add a grounding check to every verdict: does the claim cite evidence.
3. Add one app-level failure-injection test (stub `askLoomStream` to emit a
   plausible-but-wrong completion, assert the UI's honest-failure path).
4. Keep judge inputs separate from agent text (the "judge policy is not
   agent-editable" rule) — already the case, but make it explicit in the
   template header.
