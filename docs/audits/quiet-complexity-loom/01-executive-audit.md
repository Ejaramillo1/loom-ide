# 01 — Executive Audit: Quiet Complexity × Loom

**Date:** 2026-11-15 · **Merged audit** (live end-to-end verification +
parallel read-only contract audit + post-fix re-verification). The
parallel set is preserved in full in `contract-audit/`; its issue
catalogue is mirrored at `10-implementation-issues/`. This refresh
re-verified source at `b1f16bd` and re-ran every suite; it performed **no
new live model or UI verification** — the evidence standard below says
exactly what each claim rests on.

**Repositories audited:**

- IDE: `/home/ed/loom-ide-tauri` — `tauri-prototype` @ `b1f16bd` (+ audit
  docs committed at `7f65bfc`). Tauri 2, Rust, vanilla TypeScript,
  Monaco, Unity WebGL.
- Loom: `/home/ed/work/loom` — `main` @ `ab46f76f`, VERSION 1.4.0.
- Live server (audit-time evidence, 2026-11-15 morning): `looms serve`
  v1.4.0 on `0.0.0.0:5006`/`:60051`, provider `openai`
  (deepseek-v4-pro), 3 agents. **Not re-probed during this refresh**;
  per the audit decision, no further turns were run against personal
  sessions.

## The one question

> **Is Quiet Complexity fully integrated with Loom?**

# **NO.**

It is a **genuinely connected interface to Loom's real intelligence** —
the chat path executes real turns (live-verified at audit time, including
a UI-driven test that flipped the status pill to "Connected to Loom") —
but it is **not fully integrated**. Since the original pass, commit
`b1f16bd` repaired the two most severe chat-path breaks in code, and the
post-fix critique (`contract-audit/11-…`) corrected the verification
claims: the fixes are correct but only **partially verified**, and two
primary-path defects the earlier assessment underweighted are now
confirmed. The decisive state:

1. **Streamed identity — fixed in code, partially verified.** The stream
   request now sends snake_case `session_id`/`agent_id`/`enable_trace`,
   matching the SSE handler's decoder. Verified at the HTTP level (happy
   path + owner-mismatch rejection). **No automated or retained test
   traverses the patched Rust → Tauri → UI path** (critique §1). (QC-03)
2. **Failure truth — partially fixed, partially verified.** Error-bearing
   events and EOF-without-completion now end the turn as errors; helper
   tests pass. Untested terminal shapes remain (critique §5). (QC-04)
3. **Registration race (confirmed, new P1):** reply state is registered
   after an await over a command that already spawned the emitting
   thread; early events are discarded and a dropped terminal event leaves
   the chat busy forever. Realistic trigger: sending while Loom is
   stopped. (issue 016)
4. **Chunk framing (confirmed, new P1):** the stream reader never decodes
   `Transfer-Encoding: chunked`; events larger than the server's ~2 KB
   write buffer split mid-payload and corrupt — a split completion event
   turns success into a false "disconnected" failure. Works today only by
   accident of the server's write pattern. (issue 017)
5. **Two shipped surfaces 404 on every action**: Loom task boards and
   Skills — TaskService/SkillsImportService are annotated in the proto
   but **not registered** in the HTTP gateway (live 404s). (issues
   001/002, QC-10)
6. **Four streams silently discard every payload** (NDJSON vs SSE
   framing; live-captured). (issue 003, QC-05)
7. **Human control is advisory**: autonomy dial local-only (issue 005,
   QC-01); approvals answered to the wrong store (QC-07); several
   management calls post the wrong request shape (QC-08/21/22, QC-11/12);
   the context pack never reaches the agent (QC-09); traces never return
   ids (issue 004). Clarification decoding is **fixed and correct**
   (QC-06 — both acceptance fields required by contract).

## What the audit is NOT saying

- **Not a mock.** No fabricated replies, no seeded live data; failures
  surface as errors; the status model distinguishes verified vs merely
  reachable (live-observed).
- **Not "fully verified".** No claim in this audit outruns its evidence:
  the identity fix is wire-verified, not UI-path-verified; the outcome
  fix is helper-tested, not transport-tested; the live evidence is
  audit-time evidence, not a fresh pass.
- **Not a polish-first product.** The philosophy is genuinely encoded:
  Intent → Work → Artifact → Evidence → Control with provenance labels,
  autonomy ceilings, and honest empty states — but the control layer's
  truthfulness (QC-01/QC-02) is a top-priority open risk, not a tail
  item.
- **Not a visual façade.** The sphere and Unity bench derive from real
  app state; the bridge is bidirectional and origin-checked.

## Merged findings at a glance (32 unique, deduplicated)

Both issue catalogues are kept in full: `10-issues/` (17 issues from this
audit) and `10-implementation-issues/` (22 issues from the parallel
audit). Overlaps are mapped in the README. Severity is per the original
files; the merged view:

| # | Sev | Finding | Issue refs |
|---|---|---|---|
| 1 | P0 | Live Loom gateway exceeds the localhost trust boundary (0.0.0.0, unauth, wildcard CORS) | QC-02, issue 011 |
| 2 | P0 | Autonomy changes do not constrain Loom execution | QC-01, issue 005 |
| 3 | P0 | Task boards/kanban disconnected (service not HTTP-registered) | issue 001, QC-10 |
| 4 | P0 | Skills disconnected (same root cause) | issue 002, QC-10 |
| 5 | P1 | Chat stream registration race: early events discarded; chat can stay busy forever | issue 016 (new) |
| 6 | P1 | Stream reader does not decode HTTP chunk framing; large events corrupted/dropped | issue 017 (new) |
| 7 | P1¹ | Streamed chat identity: **FIXED at b1f16bd** (wire-verified; UI path unverified) | QC-03 |
| 8 | P1¹ | Failure misreporting: **PARTIALLY FIXED at b1f16bd** (untested terminal shapes remain) | QC-04 |
| 9 | P1 | Non-chat subscriptions use the wrong streaming protocol (NDJSON discarded) | QC-05, issue 003 |
| 10 | P1¹ | Clarification acknowledgements: **FIXED at b1f16bd** (success && accepted) | QC-06 |
| 11 | P1 | Approval cards answer the wrong Loom request store | QC-07 |
| 12 | P1 | Agent creation posts a bare config instead of `{"config":…}` | QC-08 |
| 13 | P1 | The advertised context pack never reaches agent chat (`req.Context` unused) | QC-09 |
| 14 | P1 | Task updates and ready/blocked lists use incompatible shapes | QC-11 |
| 15 | P1 | MCP add/test/health decode different contracts as server rows | QC-12 |
| 16 | P1 | Workflow completion can attach output to the wrong work | QC-13, issue 006 |
| 17 | P1 | Work evidence and execution provenance vanish on restart | QC-14, issue 006 |
| 18 | P1 | Model switching omits the provider and session-owner targeting | QC-21 |
| 19 | P1 | App creation sends HTML to a declarative-spec API | QC-22 |
| 20 | P1 | Trace ids never returned; observability unreachable | issue 004 |
| 21 | P2 | Artifact search can display results for an older query | QC-15 |
| 22 | P2 | Shared vault path is compiled into the checkout | QC-16 |
| 23 | P2 | Changing sessions leaks live subscriptions | QC-17 |
| 24 | P2 | Vault change signature misses relation-only edits | QC-18 |
| 25 | P2 | Canvas layout persistence can silently lose positions | QC-19 |
| 26 | P2 | Feature documentation contradicts the shipped architecture (incl. the 16 MB/chunked stream claims) | QC-20, issue 015, critique §10 |
| 27 | P2 | Newest-session adoption heuristic (second layer; QC-03 root cause fixed) | issue 007 |
| 28 | P2 | Chat replies carry no evidence-kind label | issue 008 |
| 29 | P2 | MCP edit silently re-enables the server | issue 009 |
| 30 | P2 | No CSP for the webview | issue 010 |
| 31 | P2 | 18 bridges with no UI call site | issue 012 |
| 32 | P3 | Slot origin, error-caption conflation, stale citations, `LOOM_ADDR` parse panic | issues 013/014/015, issue 017 note |

¹ QC-03/QC-04/QC-06 changed state at `b1f16bd`; see the status blocks at
the top of each file in `10-implementation-issues/`.

## Major risks

1. **Control-boundary risks first.** An unauthenticated Loom on all
   interfaces with wildcard CORS (QC-02), and an autonomy dial that
   changes no server-side permission (QC-01), are the highest-order risks
   in this audit. They outrank cosmetic and admin expansion and are
   sequenced accordingly in `09-remediation-roadmap.md`.
2. **A primary path that can strand or misreport.** The registration race
   (016) can leave the chat busy forever with an empty bubble; undecoded
   chunk framing (017) can corrupt large events or falsely report
   disconnection on success. Both are confirmed in source and both sit on
   the default chat path.
3. **Verification inflation.** The post-fix evaluation called the
   identity/outcome repairs "fully verified" on evidence that proves the
   HTTP contract, not the patched UI chain. This audit's standard:
   **HTTP probes prove backend contracts; only a traversed Rust → Tauri →
   UI test (or retained equivalent capture) proves the IDE path.**
4. **Dead surface area.** The kanban and Skills shelf are working-looking
   controls that always 404 — repeated failure trains users to distrust
   the working integrations.
5. **False completion residue.** Beyond the fixed error-bearing path,
   untested terminal shapes (FAILED without error text, truncation after
   completion, malformed frames) can still misreport.

## Overall assessment

A real interface to Loom's actual intelligence with precisely localized
breaks. The `b1f16bd` patch was the right first repair and is correctly
scoped; what remains is to make the transport trustworthy (issues 016,
017, 003), to make control real or honestly labeled (QC-01/02/07), and to
prove the patched path with tests that actually traverse it. Completing
the existing integrations delivers more value than any new feature, and
none of it requires abandoning the Tauri / TypeScript / Unity stack or
the Quiet Complexity philosophy. The merged remediation roadmap is
`09-remediation-roadmap.md`; the measurable definition of completion is
in `00-final-assessment.md`.

---

## Current-state addendum (2026-11-16)

The body above describes `b1f16bd` + Loom `ab46f76f` and is preserved as
historical evidence. Current audited state: IDE @ `f75ad9f`, Loom
@ `8082078`. Reclassification (proof per item in `14-report-evaluation.md`
and the per-file status blocks in both issue catalogues):

- **FIXED since the body was written:** issues 001/002 (gateway
  registration, live 200s), 003 (NDJSON), 004 (TraceId), 006
  (attribution), 007 (session adoption honesty), 008 (Observed label),
  009 (MCP enabled state), 010 (CSP), 012 (bridges), 013 (slot origin),
  014 (captions), 016 (registration race), 017 (chunk framing); QC-04
  (tested terminal cases: error text, stage-8/FAILED-without-error-text,
  EOF-before-completion, truncation-mid-chunk, error-after-completion,
  cancel-after-completion, cancel-during-silence), QC-05/07/08/09/10/11/
  12/13/14/15/16/17/18/19/20/21/22. QC-03 is now test-pinned and
  live-verified; QC-06 was and remains correct.
- **STILL OPEN:** issue 005/QC-01 (autonomy not enforced server-side —
  now honestly labeled), issue 011/QC-02 (gateway bind/auth/CORS
  posture), issue 015/NG-3 (stale citations + attention copy —
  documentation).
- **New gaps:** NG-1 (native-app never rustfmt-clean — prior fmt claims
  were src-tauri-scoped; tooling), NG-2 (`max_rounds`/`timeout_seconds`
  never sent — **functional**, and Loom `8082078` enforces only
  `timeout_seconds`), NG-4 (no live turn through the rebuilt UI at
  head), NG-5 (Unity/gRPC tails env/decision-gated).

Verdict remains **NO**, with the reasons updated — see
`00-final-assessment.md`.
