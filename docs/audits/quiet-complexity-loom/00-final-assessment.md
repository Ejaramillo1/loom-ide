# 00 — Final Assessment

> Merged audit, refreshed to the **current state** on 2026-11-16.
> Audited: IDE `/home/ed/loom-ide-tauri` @ `f75ad9f` (branch
> `tauri-prototype`, local only) and Loom `/home/ed/work/loom` @ `8082078`
> (v1.4.0). The original audit and its post-fix refresh (`b1f16bd`,
> `7f65bfc`) remain historical evidence; the implementation rounds that
> landed between them and now (`7f93a2f…f75ad9f` IDE, `8082078` Loom) are
> accounted for by `14-report-evaluation.md`, which verifies every claim of
> the refresh report claim-by-claim. Evidence hierarchy unchanged: nothing
> is marked "fully verified" without a traversed chain, and each status
> names its proof (source / unit fixture / loopback / live probe / live
> UI).

## Is Quiet Complexity fully integrated with Loom?

# **NO.**

Quiet Complexity **executes real Loom intelligence** — live-verified: a
message typed in the real UI produced a streamed answer from the real
runtime, and since then the primary chat path has been rebuilt and pinned
by tests at both ends. It is **not a mock**, and it is no longer a partial
integration *because the primary path is broken*. The honest reason it is
still NO:

1. **Criterion 1 is not yet literally demonstrated on the current
   binary.** The chain is pinned at both ends — Rust wire-contract tests,
   and 15 lifecycle tests over the **extracted real `main.ts` handlers
   with a minimal fake DOM and mocked Tauri bridges** (not the real Tauri
   event pipeline or a rendered window) — and the wire contract is
   live-verified (byte-faithful stream probe, session-reuse probe), but
   no live model turn has been executed through the rebuilt UI at head
   (NG-4).
2. **Human control is still advisory (QC-01/issue 005).** The autonomy
   dial is honestly labeled now — it states exactly what it governs —
   but Loom's weave path enforces nothing; the permission mapping is a
   Loom-side contract that does not exist yet.
3. **The trust boundary is now enforced at the network, with one
   prepared residual (QC-02/issue 011).** As of 2026-11-17 the live
   gateway binds **`127.0.0.1:5006/60051` only** (loopback, observed
   sockets) and serves the exact-origin allowlist
   `{http://localhost:5006, http://127.0.0.1:5006}` — no wildcard CORS.
   Native (no-Origin) IDE traffic, the dev proxy, hosted apps and
   Swagger all verified working. **Residual:** the current middleware
   omits the CORS grant for unlisted origins but still dispatches them —
   proven live: a browser "simple" POST with an unlisted Origin created
   a session. A reject-before-dispatch middleware patch (and optional
   Host check) is prepared with tests in
   `16-gateway-containment.md` / `evidence/`; applying it is a Loom-side
   change, pending separately authorized execution scope.
4. **Functional and documentation tails remain, kept separate:**
   (a) **NG-2, functional:** `max_rounds`/`timeout_seconds` are still
   never sent by the IDE — every turn runs server defaults, and Loom
   `8082078` enforces only `timeout_seconds` (no `max_rounds` consumer
   exists server-side). (b) **Issue 015/NG-3, documentation copy:** stale
   philosophy citations and one unreachable attention-dialog sentence.
   (c) **NG-1, tooling scope:** fmt discipline is src-tauri-only
   (`native-app` has never been rustfmt-clean).

Everything the previous assessments listed as primary-path breaks is now
**fixed, and verified to the level each item below states** — no item is
described as more verified than its evidence. The remaining work is
control-boundary contracts, verification depth, and truth-in-
documentation — not a rebuild.

## The ten questions

**1. Which Loom capabilities are completely functional?**
Sessions (list/create/history/detail), agents, artifacts (list/detail/
content/stats/search/attach), patterns, models, tools, server info,
health — all live-verified. **Chat execution is now trustworthy end to
end**: identity (QC-03, live session-reuse proof), completion truth
(QC-04 — tested terminal cases: error text, stage-8/FAILED-without-
error-text, EOF-before-completion, truncation-mid-chunk,
error-after-completion, cancel-after-completion, cancel-during-silence),
transport framing (issue 017, live chunked probe), registration/fallback
lifecycle (issue 016), per-turn cost and durable run records (QC-14).
Task boards and Skills are now registered HTTP services (Loom `8082078`)
with live 200s.

**2. Which are only partially integrated?**
Workflow live streams (attribution fixed + tested; live runs not
executed — nothing configured), schedules (history bridged; cancel
wired), experiments (chat-backed arms), evidence (labels real, live
replies default to Observed), autonomy (**honestly labeled, still not
enforced**), the gRPC-only families (judge, graph memory, memory layer,
learning, LLM scheduler, teleprompter — unwired by decision).

**3. Which UI elements are disconnected from Loom?**
None that ship a control: kanban and Skills now have live data sources;
provider A/B, workflow/session/pattern streams now decode their
payloads. The gRPC-only families state their unavailable-here truth
instead of pretending. (Traces: `WeaveResponse.TraceId` is populated
server-side and the UI renders "View trace ›" when present.)

**4. Which capabilities exist in Loom but are not exposed in the IDE?**
The gRPC-only families above; task decompose/dependencies (gRPC); the
two-way harness MCP (blocked on an allowlist contract); avatars (no
identity concept). Each is decision-gated, not lost.

**5. Which capabilities are advertised but unsupported by Loom?**
A per-intent autonomy level **enforced** by execution permissions —
the IDE now says so in the dial's own copy (main.ts:950). The earlier
false "tasks/skills are 100% HTTP" premise is corrected (they now are,
after `8082078`); the context-pack and trace-id gaps no longer exist.

**6. Which integrations silently fail or misrepresent backend state?**
None of the previously confirmed silent failures survive: the
registration race (016), chunk-framing corruption (017), NDJSON discards
(003/QC-05), context loss (QC-09), wrong-work attribution (006/QC-13),
MCP re-enable (009), wrong-store approvals (QC-07) are all fixed with
tests. Remaining honesty gaps, by class: **functional** — the missing
budget fields (NG-2, execution limits never sent); **documentation
copy** — the unreachable attention sentence and stale citations
(issue 015/NG-3).

**7. Which defects prevent reliable agent execution?**
None on the shipped HTTP surface. The remaining execution risks are
Loom-side posture: the gateway is now **loopback-contained** (see point
3; the unlisted-origin action path is the prepared-patch residual), and
the absence of an autonomy enforcement contract (QC-01).

**8. Which gaps compromise human control or understanding?**
Autonomy is labeled but advisory (005); the gateway is loopback-bound
with restricted origins (011, contained 2026-11-17 — the unlisted-origin
action path is the prepared-patch residual); the stale citations erode
auditability of the philosophy's Loom hooks (015).

**9. Smallest set of changes for full integration with Loom's supported
capabilities?**
1. Loom (decision-gated): autonomy enforcement contract (QC-01) and
   the prepared middleware reject patch for unlisted origins (QC-02
   residual, `16-gateway-containment.md`).
2. IDE: send `max_rounds`/`timeout_seconds` from the Intent (NG-2);
   format or scope-exclude `native-app` (NG-1); fix the two stale-copy
   items (issue 015).
3. Verification: one live model turn through the real rebuilt UI
   (disposable profile — closes criterion 1), Unity recompile when an
   Editor is available, real-window CSP/pixel check (D14).

**10. How without compromising Quiet Complexity?**
All of it is contract-level and invisible to the visual design. The calm
surface stays exactly as designed; the autonomy dial already demonstrates
the pattern — honesty instead of pretense, truth instead of removal.

## Definition of completion

1. A streamed chat turn addressed to a work item's session and agent
   actually executes in that session on that agent, **proven through the
   Rust → Tauri → UI path**, or the error is visible. — *Near: wire
   contract test-pinned + live-verified; the traversed-UI proof on the
   current binary is not yet executed (NG-4).*
2. No failed or truncated turn is ever shown as completed, under all
   terminal shapes. — **DONE for the tested shapes.** Fixture-pinned:
   error text, stage 8/FAILED-without-error-text, EOF-before-completion,
   truncation-mid-chunk, error-after-completion, cancel-after-completion,
   cancel-during-silence. **Not yet distinct fixtures:** malformed JSON
   `data:` frames, completion-then-truncation, cancellation exactly at
   EOF (W-7).
3. Every stream the IDE opens decodes its payloads: HTTP chunk framing
   first, then SSE and NDJSON both parsed. — **DONE.** 13 transport
   fixtures incl. a real loopback TCP stream; live chunked weave verified.
4. Every shipped Loom-facing control either round-trips or states why it
   cannot — zero controls that always 404. — **DONE for shipped
   controls** (tasks/boards/skills live; management shapes fixed);
   gRPC-only families state their truth. Migrations remain a
   user-triggered preview.
5. HITL answers decode correctly and approvals route to the correct
   store or state the truth. — **Routing DONE; round-trip unverified.**
   QC-06 unchanged; QC-07 fixed via Loom's
   `/v1/human-requests/{id}:respond` (shared HumanRequestStore), the IDE
   routes there, and live route probes passed (doc 13 §3) — but a
   **successful held-request round-trip (approve → the held tool
   actually runs) has not been executed** (needs a live held tool, W-5).
6. A completed turn yields a reachable trace; claims carry evidence
   kinds. — **DONE.** TraceId populated server-side; "View trace ›"
   renders when present; live replies default to the Observed label.
7. Autonomy is observable in Loom's approval behavior, or its copy states
   exactly what it governs; the deployment respects the trust boundary.
   — *Half: the copy is honest (done); enforcement is absent (QC-01);
   the deployment is loopback-contained with restricted origins
   (QC-02 contained 2026-11-17; the unlisted-origin reject patch is
   prepared, Loom-side).*

## Final principle

Quiet Complexity does not merely look intelligent: its execution is real,
and now its primary path is trustworthy — the session you select is the
session that answers, a failed turn is never shown as success, a large
answer is never corrupted by its transport, and every terminal settles
exactly once, with cost and provenance recorded. What remains is the work
a human-centered interface to an agentic runtime must still finish:
**make control real rather than labeled** (a Loom contract, not a UI
one), **respect the trust boundary**, and **prove the patched path end to
end on the current binary**. Completion is measured in the seven criteria
above, not in features, and no claim here outruns its evidence.
