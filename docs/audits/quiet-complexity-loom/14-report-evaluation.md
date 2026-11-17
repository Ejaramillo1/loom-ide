# 14 — Evaluation of the "Master audit refresh" report (2026-11-16)

> This document answers the question **"how much of the refresh report is
> true?"** and records every gap it left. Method: every claim was re-checked
> against the repositories as they exist now — IDE
> `/home/ed/loom-ide-tauri` @ `f75ad9f` (branch `tauri-prototype`, local
> only, ahead of origin), Loom `/home/ed/work/loom` @ `8082078` — plus the
> evidence the report itself cites (`evidence/ma-rerun-*.log`) and the
> intervening implementation ledger (`docs/unattended-build/PROGRESS.md`,
> docs 12 and 13). Fresh suites were re-run this pass (logs:
> `evidence/eval-20261116-*.log`). No production source was modified and
> nothing was pushed.

## 1. The short answer

The report is **true for the state it audited** (`b1f16bd` + `7f65bfc`,
2026-11-15 morning). Every number it cites matches the preserved logs, and
every defect it names was real at that commit. It is **not true as a
description of the current state**: after it was written, an authorized
implementation pass landed **23 IDE commits** (`f7217bc..f75ad9f`;
source tree 18 files, +3,889/−400; audit docs 6 files, +997; total
40 files, +5,502/−415) and a Loom commit (`8082078`, 4 files, +203/−3)
that **close most of the defects the report lists as open**. (Earlier
drafts of this evaluation cited "~15 commits, +5,416/−783, 46 files" —
those numbers are superseded by the canonical range above, measured with
`git rev-list --count` and `git diff --shortstat`.) The report's verdict
(NO) was correct then and, on the stricter criteria, remains defensible
now — but its body of evidence is stale, its line references have
shifted, and its "no fixes implemented" framing no longer holds for the
repository as a whole.

## 2. Claim-by-claim truth table

| # | Report claim | Verdict | Evidence (now) |
|---|---|---|---|
| 1 | Scope: "current state (`b1f16bd` + critique `7f65bfc`)" | **TRUE for its date; NOT the current state** | `git log`: both commits exist; HEAD has since advanced through the Round 1–3 implementation commits to `f75ad9f`; Loom advanced `ab46f76f → 8082078` |
| 2 | `npm test -- --run` → 63/63 | **TRUE then; stale now** | `ma-rerun-frontend-tests.log`: 63/63, 8 files. Now: **93/93, 12 files** (`eval-20261116-frontend-tests.log`) |
| 3 | `npm run build` exit 0, 4.16 MB bundle, chunk-size warning only | **TRUE then; same now** | `ma-rerun-frontend-build.log`: 4,156.48 kB. Now: exit 0, **4,167.87 kB**, same warning (`eval-20261116-frontend-build.log`) |
| 4 | `cargo test --lib` → 96 passed / 2 ignored | **TRUE then; stale now** | `ma-rerun-tauri-tests.log`: 96/2. Now: **125 passed / 2 ignored** |
| 5 | Focused `loom_stream::` → 4 passed / 94 filtered | **TRUE then; stale now** | `ma-rerun-stream-focused.log`: 4/94. Now: **24 `loom_stream::` tests** (doc 13 §4), including 13 transport fixtures |
| 6 | `cargo test` (native-app) → 22 passed | **TRUE then and now** | `ma-rerun-native-tests.log` and `eval-20261116-native-tests.log`: 22/22 |
| 7 | `cargo fmt --check` exit 0 | **TRUE only for src-tauri; the report omits the scope** | src-tauri: exit 0 (re-run this pass). **native-app fails `cargo fmt --check`** (exit 1, pre-existing since `41170a6`) — new gap NG-1 |
| 8 | QC-03 fix present and correct on the wire (`loom_stream.rs:85-125`); **no automated test traverses the patched UI path** | **First half TRUE (line range now ~111-125); second half needs a precise restatement** | `weave_stream_body` still snake_case. Both **ends** are now pinned: Rust wire-contract tests assert camelCase keys are absent; `chat-lifecycle.test.ts` (**15 tests**, runner-verified) drives the **extracted real `main.ts` handlers with a minimal fake DOM and mocked Tauri bridges** — not the real Tauri event pipeline; live session-reuse probe (doc 13 §1e: same session 2→4). The middle of the chain and a rendered window remain untraversed — **verification through the rebuilt UI stays open (NG-4)** |
| 9 | QC-04 partial — error-bearing events handled; FAILED-without-error, malformed frames, truncation-after-completion **untested** | **TRUE then; FALSE now** | `weave_completed` (loom_stream.rs:316) rejects error text, stage 8/`EXECUTION_STAGE_FAILED`, EOF-before-completion; fixtures `failed_stage_without_error_text_is_an_error`, `truncated_mid_chunk_is_an_explicit_error`, `error_after_completion_is_an_error_not_a_success` (:1371), `cancel_after_completion_data_still_reports_cancelled` (:1388), chunked/trailer/real-TCP fixtures |
| 10 | QC-06 correct as-is — `success && accepted` both required, not relaxed | **TRUE, unchanged** | `clarification_ack` (loom_stream.rs:341) still requires both; test `clarification_requires_explicit_acceptance` |
| 11 | Issue 016 registration race: `activeStreams.set` (main.ts:5404) after `await askLoomStream` (:5371) | **TRUE then (line refs 5404/5371); FIXED now** | Registration now precedes the invoke (main.ts:5931 vs 5938) with an explicit "(issue 016)" comment; `settleStreamState` is exactly-once; tests `chat-lifecycle.test.ts:176/199/221/284/301` |
| 12 | Issue 017: `run_stream` parses raw socket lines, no chunk decoding; unary reader seam at lib.rs:1217-1328 | **TRUE then; FIXED now** | `BodyDecoder` + `read_response_events` (loom_stream.rs:430-642, 851) decode chunked/Content-Length/EOF framing before SSE/NDJSON parsing; 13 fixtures incl. split-across-chunk-boundaries, trailers/zero-chunk, truncated-mid-chunk, real loopback TCP; live chunked weave verified (doc 13 §1c) |
| 13 | Draft restoration conditional (error branch restores only when `st.text` is empty) | **TRUE in essence; the condition is the composer's emptiness, not `st.text`** | finishStream (main.ts:5683-5688) restores only when the composer is empty — "never overwrite text the human typed while the request ran"; test `chat-lifecycle.test.ts:341` |
| 14 | Error wording conflates rejection with disconnection | **TRUE then; FIXED now (issue 014)** | `isLoomConnectionError` split (main.ts:5655-5668): "Loom rejected the turn/message" vs "Loom stopped answering / Could not reach Loom"; test `chat-lifecycle.test.ts:356` |
| 15 | QC-01/QC-09 re-confirmed in Loom source: no autonomy enforcement; `WeaveRequest.context` never consumed | **QC-01 still TRUE at `8082078`; QC-09 FALSE now** | No permission enforcement added to the weave path (multi_agent.go diff adds none). Context **is** consumed: `requestContextSection` (multi_agent.go:999-1041) rides the prompt in `Weave` (:1208) and `StreamWeave` (:1445), bounded 1200/600 chars, labeled untrusted; covered by `request_context_test.go` |
| 16 | `docs/LOOM_CONNECTION_MODEL.md` overstates (16 MB/chunked describe the unary reader only) — "flagged, not edited" | **TRUE then; RESOLVED now** | The doc now states both readers decode body framing and cites the stream reader's gain at `bdb92bb`; the overstatement is gone because the code was fixed, and the doc followed |
| 17 | Deliverables updated: 00/01/08/09 rewritten, 02/03/04/05/07 corrected, issues 016/017 written, qc-03/04/06 status blocks, README/overlap map, `ma-rerun-*` logs | **TRUE** | All files exist with matching timestamps and content (verified in `docs/audits/quiet-complexity-loom/`) |
| 18 | Verdict NO — genuine partial integration; "primary path still carries the registration race and chunk-framing defect" | **TRUE for the audited state; the two named defects are now FIXED** | See claims 11-12. Updated verdict: still NO on the stricter criteria, but for different reasons — see §4 and the rewritten `00-final-assessment.md` |
| 19 | "No fixes implemented, no pushes, no live tests against personal sessions — audit only" | **TRUE for the report's own pass; FALSE as a description of the repository since** | The subsequent authorized rounds implemented fixes (local commits only, no pushes); live probes (doc 13) used synthetic sessions (`sess_b05e656f`), never personal ones |
| 20 | Implicit premise: this refresh describes the *current* state | **FALSE at delivery time** | 15+ implementation commits and Loom `8082078` landed after the refresh, closing issues 003/006/007/008/009/010/012/013/014/016/017 and QC-04/05/07/08/09/10/11/12/13/14/15/16/17/18/19/20/21/22, plus issues 001/002/004 server-side |

## 3. New gaps this evaluation found (beyond the report)

- **NG-1 — fmt discipline is only src-tauri-wide.** `native-app` has never
  been rustfmt-clean (fails `cargo fmt --check`, pre-existing since
  `41170a6`; unchanged by the implementation rounds). Every "fmt ✓" in the
  refresh report and the build ledger is src-tauri-scoped without saying
  so. Fix: either format `native-app` once or state the scope in every
  future claim. (`evidence/eval-20261116-fmt.log`)
- **NG-2 — `WeaveRequest.max_rounds` / `timeout_seconds` are still never
  sent** from the IDE (lessons doc item 1, first backend-enforced
  autonomy step). Grep of `main.ts` + `loom_stream.rs` + `lib.rs` shows no
  sender; every turn runs server defaults (3 rounds / 300 s). **Loom
  `8082078` enforcement reality (verified in source):** `timeout_seconds`
  IS consumed (`context.WithTimeout`, `multi_agent.go:4209-4211,
  4351-4353`); `max_rounds` has **no consumer** in the weave path —
  per-turn rounds come from agent config `max_turns` (`agent.go:2718`).
  Wiring `max_rounds` therefore needs Loom-side work before any
  end-to-end enforcement claim is possible. This is a **functional**
  gap, tracked separately from the documentation items (NG-3).
- **NG-3 — issue 015 is still open.** The philosophy still cites
  `documentation/architecture/*` (files live under `docs/`, verified
  `docs/01-design-philosophy.md:28-58`), and the attention dialog's
  non-experiment branch still says "This item comes from the Loom
  server." (main.ts:3431) although `get_attention` only ever produces
  local `decision` items.
- **NG-4 — no live model turn through the real rebuilt UI at head.**
  Doc 13's live evidence is a byte-faithful wire reproduction
  (`live-chat-stream-probe.mjs`) plus live session-reuse and route probes;
  the only true UI→Loom→UI turn remains the `b1f16bd`-era audit run. The
  Rust→Tauri→UI chain is now pinned by tests at both ends, but criterion 1
  (traversed path) is still not literally demonstrated on the current
  binary. (A peer process was running `tauri dev` at 19:45 PST on
  2026-11-16 — this may be closing; not evidenced in the corpus yet.)
- **NG-5 — Unity and gRPC tails remain decision/env-gated:** Unity
  recompile + CheckWorkbench blocked (`EDITOR_NOT_RUNNING`); the
  gRPC-only families (judge, graph memory, memory layer, learning, LLM
  scheduler, teleprompter) remain unwired by decision; real-window
  pixel/CSP check (D14) still environment-limited.

## 4. Where the verdict stands now

The refresh's verdict (NO) **survives**, but its reasoning must be
rewritten. The primary chat path — the thing the report correctly called
the product's heartbeat — is now:

- identity: fixed, **test-pinned, live-verified** (QC-03);
- completion truth: fixed — **tested terminal cases**: error text,
  stage-8/FAILED-without-error-text, EOF-before-completion,
  truncation-mid-chunk, error-after-completion, cancel-after-completion,
  cancel-during-silence. Distinct fixtures for malformed JSON frames,
  completion-then-truncation, and cancel-at-EOF remain open (QC-04, W-7);
- transport: chunked/CL/EOF framing decoded, **fixture + live verified**
  (issue 017);
- NDJSON gateway streams: decoded (QC-05/issue 003);
- registration race: fixed + tested (issue 016);
- session adoption honesty: fixed + tested (issue 007);
- costs: surfaced per turn + durable run records (QC-14/issue 008);
- HITL approvals: **routed** to the real stored-request store, **live
  route-verified** (QC-07) — a successful held-request round-trip
  (approve → the held tool runs) is **not yet executed**;
- tasks/boards/skills: HTTP-registered server-side, **live 200s**
  (issues 001/002/QC-10);
- context pack: consumed server-side, bounded and labeled untrusted
  (QC-09);
- trace ids: populated and reachable in the UI (issue 004).

What still fails the definition of completion: **autonomy is not enforced
by Loom** (QC-01/issue 005 — now honestly labeled, still advisory), **the
gateway remains exposed** (`0.0.0.0:5006/60051`, unauthenticated, wildcard
CORS — QC-02/issue 011), **criterion 1's traversed-UI proof is still not
executed on the current binary** (NG-4), and the remaining tails, by
class: **functional** — `max_rounds`/`timeout_seconds` are never sent
(NG-2; Loom `8082078` enforces only `timeout_seconds`, no `max_rounds`
consumer exists); **documentation copy** — stale citations and the
attention sentence (issue 015/NG-3); **tooling scope** — native-app fmt
discipline (NG-1). Verdict: **NO — a materially deeper partial
integration than the refresh described; the honest reason is now
control-boundary work and verification depth, not primary-path defects.**

The rewritten `00-final-assessment.md`, updated README/01/08/09, and
per-file status blocks in `10-issues/` and `10-implementation-issues/`
carry this reclassification; the report itself is preserved as historical
evidence (its claims were correct for its own scope and its logs remain
under `evidence/ma-rerun-*`).

## 5. Residuals to watch

- Eduardo's decisions still open: gateway bind/auth/CORS posture
  (QC-02), an autonomy enforcement contract (QC-01), gRPC-client vs
  server-side expansion for the gRPC-only families.
- The peer implementation process was active during this evaluation
  (`tauri dev` running; commits landing). Head may move again; the status
  blocks below are pinned to `f75ad9f` / Loom `8082078`.
- The uncommitted audit corpus (`docs/audits/**`) remains intentionally
  outside the peer's commits and inside this evaluation's writes.
