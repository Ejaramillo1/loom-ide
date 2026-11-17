# Quiet Complexity × Loom — Master Audit

Full-system audit of the Quiet Complexity IDE
(`/home/ed/loom-ide-tauri`, `tauri-prototype`) against Loom v1.4.0
(`/home/ed/work/loom`). History: the 2026-11-15 merged audit ran against
`b1f16bd`/`7f65bfc` (IDE) and `ab46f76f` (Loom) with a live server on
`127.0.0.1:5006`; its post-fix refresh and critique are preserved. On
2026-11-16 the audit was **refreshed to the current state**: IDE
@ `f75ad9f`, Loom @ `8082078` — see
[14-report-evaluation.md](14-report-evaluation.md) for the claim-by-claim
evaluation of the refresh report, and the updated
[00-final-assessment.md](00-final-assessment.md) for the current verdict.
Evidence levels below state exactly what each claim rests on.

> **Merged audit.** Two independent audit passes ran in parallel into
> this directory. Their outputs are consolidated here: the numbered
> documents are the merged canonical set; the parallel pass's own
> self-contained output (documents + issue catalogue) is preserved in
> `contract-audit/`, and its issue files are also mirrored at
> `10-implementation-issues/`. The post-fix evaluation
> (`evidence/post-fix-evaluation.md`) and its critique
> (`contract-audit/11-post-fix-assessment-critique.md`) are both
> preserved; the critique's corrections are folded into the canonical
> documents.

## Answer

**Is Quiet Complexity fully integrated with Loom? → NO.**

A genuinely connected interface to Loom's real intelligence — and since
the 2026-11-16 implementation rounds, the primary chat path is
**trustworthy and test-pinned**: streamed identity (QC-03), completion
truth (QC-04), chunked/NDJSON transport (issues 017/003), the
registration race (016), session adoption honesty (007), costs and
durable run records (QC-14), the HITL approval route (QC-07), the
task/skills HTTP registration (001/002), server-side context consumption
(QC-09) and TraceId population (004) are all fixed with tests and, where
possible, live verification. The verdict is still NO because human
control: Manual is now enforced at the IDE boundary from stored records
(QC-01/issue 005 — every execution path resolves the governing
work/Intent and rejects Manual before sending; cancellation is
requested/confirmed/unavailable as applicable; per-tool approval for
Assisted/Collaborative is a separate Loom project), the traversed-UI proof on the current binary is not yet
executed, the documentation tail (issue 015, NG-1/NG-2) is unfixed, and
one gateway residual remains (QC-02/issue 011): the server is now
**loopback-bound with restricted origins** (contained 2026-11-17,
`16-gateway-containment.md`), but the prepared reject-before-dispatch
middleware patch for unlisted browser origins is not yet applied
(Loom-side scope). See
`00-final-assessment.md` (verdict, 10 questions, completion criteria)
and `14-report-evaluation.md` (truth table of every prior claim).

## Documents (canonical)

| # | Document |
|---|---|
| 00 | [Final assessment](00-final-assessment.md) — verdict, 10 questions, definition of completion |
| 01 | [Executive audit](01-executive-audit.md) — merged findings table (30 unique) |
| 02 | [Loom capability map](02-loom-capability-map.md) — services, contracts, wire formats |
| 03 | [Complete integration matrix](03-integration-matrix.md) — every feature end to end |
| 04 | [Technical architecture audit](04-technical-architecture.md) |
| 05 | [Human-centered UX audit](05-human-centered-ux.md) |
| 06 | [Unity and spatial audit](06-unity-spatial.md) |
| 07 | [Security, reliability, performance](07-security-reliability-performance.md) |
| 08 | [Test and verification report](08-test-verification-report.md) |
| 09 | [Remediation roadmap](09-remediation-roadmap.md) — merged, phased |
| 10 | Issue catalogues: [10-issues/](10-issues/) (this pass) · [10-implementation-issues/](10-implementation-issues/) (parallel pass) |
| 11 | [Lessons from Awesome Agentic System Design](11-lessons-awesome-agentic-design.md) |
| 12 | [Current-state recheck (2026-11-15 evening)](12-current-state-recheck.md) |
| 13 | [Live contract verification (2026-11-16)](13-live-contract-verification.md) |
| 14 | [Evaluation of the refresh report + new gaps (2026-11-16)](14-report-evaluation.md) |

## Issue catalogues and overlap map

| This audit (`10-issues/`) | Parallel audit (`10-implementation-issues/`) | Status at `f75ad9f` / Loom `8082078` (2026-11-16) |
|---|---|---|
| issue 001 task boards disconnected | QC-10 | **FIXED** (server-side, Loom `8082078`) — live `/v1/tasks` 200, `/v1/boards` 200 |
| issue 002 skills disconnected | QC-10 | **FIXED** (server-side) — live `/v1/skills:bulkImport` 400-validation instead of 404 |
| issue 003 stream framing mismatch | QC-05 | **FIXED** (`bdb92bb`) — NDJSON `{"result":…}` unwrapped; fixtures |
| issue 004 trace ids unreachable | — (unique to this pass) | **FIXED** (Loom `8082078` + IDE) — TraceId populated; "View trace ›" renders |
| issue 005 autonomy not enforced | QC-01 | **IDE admission enforced (2026-11-18)** — policy resolved from stored records on every path; Manual rejected before sending; cancellation requested/confirmed/unavailable stated; per-tool approval = separate Loom project (`17-autonomy-enforcement.md`) |
| issue 006 workflow attribution/name | QC-13, QC-14 | **FIXED** — `workflowStreamOrigin` + persisted ownership maps + tests |
| issue 007 newest-session race | QC-03 (root cause) | **FIXED** (`58cce7b`) — no newest/current-session adoption; honest identity note; tests |
| issue 008 chat evidence kind | — | **FIXED** (`a714b20`) — live replies default to Observed |
| issue 009 MCP edit re-enables | — | **FIXED** (`b6c612f`) — edit preserves enabled state |
| issue 010 missing CSP | — | **FIXED** (`1c6efb8`) — webview CSP in `tauri.conf.json`; inline file:// guard in main.ts |
| issue 011 Loom LAN exposure | QC-02 (adds wildcard CORS) | **CONTAINED 2026-11-17** — loopback binds + restricted origins (observed sockets; survives restart); unlisted-origin action path = prepared Loom-side patch (`16-gateway-containment.md`) |
| issue 012 unused bridges | — | **FIXED** (`1c6efb8`) — schedule cancel + tool permission dialogs wired; apps open detached |
| issue 013 slot origin | — | **FIXED** (`7f93a2f`) — `X-Loom-Slot-Origin: interactive` on chat paths |
| issue 014 error caption | — | **FIXED** (`1c6efb8`) — rejection vs disconnection split + test |
| issue 015 stale citations/dead copy | QC-20 | **STILL OPEN** — re-verified: `documentation/…` citations and attention copy unchanged |
| **issue 016 stream registration race** | — (new, critique §3) | **FIXED** (`58cce7b`) — register before invoke, settle-once; covered by `chat-lifecycle.test.ts` (15 tests, extracted handlers + mocked bridges) |
| **issue 017 stream chunk framing** | — (new, critique §4) | **FIXED** (`bdb92bb`) — chunked/CL/EOF framing decoder; 13 fixtures; live chunked probe |
| — (folded into 03/07/09) | QC-03 stream identity | **FIXED + TEST-PINNED + LIVE-VERIFIED** — snake_case wire tests; live session-reuse 2→4 |
| — (folded) | QC-04 failed/truncated streams shown as completed | **FIXED + TESTED** — tested terminal cases: error text, stage-8/FAILED-without-error-text, EOF-before-completion, truncation-mid-chunk, error-after-completion, cancel-after-completion, cancel-during-silence (distinct fixtures for malformed JSON frames, completion-then-truncation, cancel-at-EOF still open — W-7) |
| — (folded) | QC-06 clarification decoding | **CONFIRMED CORRECT AS-IS** — `success && accepted` both required |
| — (folded) | QC-07 approval cards answer the wrong request store | **FIXED (routing) + LIVE-VERIFIED (route only)** — `/v1/human-requests/{id}:respond` (Loom `8082078`), IDE routes there (doc 13 §3); **a successful held-request round-trip (approve → tool runs) is not yet executed** (W-5) |
| — (folded) | QC-08 agent create posts bare config | **FIXED** (`b6c612f`) — wraps `CreateAgentRequest.config` |
| — (folded) | QC-09 context pack never reaches agent chat | **FIXED** (Loom `8082078` + `1c6efb8`) — bounded labeled section consumed; no double injection |
| — (folded) | QC-11 task update/ready/blocked shapes | **FIXED** (`b6c612f`) |
| — (folded) | QC-12 MCP contract decodes | **FIXED** (`b6c612f`) |
| — (folded) | QC-15 artifact search race | **FIXED** (`52c652a`) — request-generation guard |
| — (folded) | QC-16 vault path compiled to checkout | **FIXED** (`52c652a`) — `LOOM_VAULT_DIR` explicit setting |
| — (folded) | QC-17 subscription leak | **FIXED** (`7f93a2f`) + tests |
| — (folded) | QC-18/19 signature/layout persistence | **FIXED** (`52c652a`) — watcher signature + atomic layout saves |
| — (folded) | QC-21 model switch omits provider | **FIXED** (`b6c612f`) |
| — (folded) | QC-22 app create sends HTML to spec API | **FIXED** (`b6c612f`) — declarative UIAppSpec |

New gaps found by the 2026-11-16 evaluation (see `14-report-evaluation.md`
§3): NG-1 `native-app` never rustfmt-clean; NG-2 `max_rounds`/
`timeout_seconds` never sent; NG-3 issue 015 still open; NG-4 no live
model turn through the rebuilt UI at head; NG-5 Unity/gRPC tails
decision/env-gated.

## Evidence

- [Live verification log](evidence/live-verification.md) — every live
  probe, its result, and the captured bytes (incl. the QC-03 proof).
- [Automated checks](evidence/checks.json) — all six suites fresh-passed
  (2026-11-15); live gateway contract test passed.
- `evidence/ui-chat-live.png` — UI-level end-to-end chat test (typed
  message → live Loom → rendered reply → "Connected to Loom").
- Raw captures (in `/tmp/opencode/`): `weave-stream-live.log`,
  `weave-unary-live.json`, `subscribe-raw.log`, `ui-chat-live.json`,
  plus the parallel pass's probes in `evidence/` and `contract-audit/`.

## Rules honored

Read-only: no production source modified, no pushes, no destructive
tests, no configuration changes. The only writes are these audit
documents and a handful of disposable test sessions on the local dev
server. Mutating/destructive endpoints were verified by route-existence
probes only.
