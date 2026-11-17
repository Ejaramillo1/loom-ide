# 09 — Remediation Roadmap

Merged, prioritized, dependency-aware plan for reaching **full
integration with Loom's supported capabilities**. References both issue
catalogues: `10-issues/` (this audit) and `10-implementation-issues/`
(parallel audit, QC refs). Updated 2026-11-15 to reflect `b1f16bd`
(fixed: QC-03, QC-04 error-bearing path, QC-06) and the critique's
corrections: the transport defects (issues 016/017) come first, and
**control-boundary risks (QC-01 autonomy, QC-02 exposure) are sequenced
ahead of cosmetic/admin expansion**, not after it. No step proposes a
framework change, a rebuild, or removing Quiet Complexity.

## Definition of completion

See `00-final-assessment.md` — seven measurable criteria. Criterion
state: (1) wire contract fixed, UI-path proof missing; (2) error-bearing
events handled, other terminal shapes untested; (3) open; (4) open;
(5) half done (QC-06 fixed, QC-07 open); (6) open; (7) open.

## Phase 0 — Truth pass (0.5 day, no code)

1. Correct the tasks/skills premise in `docs/DECISIONS.md` and
   `docs/DESIGN_PROGRESS.md` against the verified gateway registration
   (issues 001/002, QC-10/20).
2. Correct `docs/LOOM_CONNECTION_MODEL.md`: the "16 MB per response /
   chunked read to EOF" claims describe the **unary** reader only; the
   stream reader has no size bound and no chunk decoding (issue 017,
   critique §10); the five gateway streams are NDJSON, not SSE (QC-05).
   Preserve the historical wording as evidence; do not rewrite the audit
   into a success story.
3. Fix stale doc citations (issue 015).

## Phase 1 — Make the primary chat path trustworthy (1–2 days, IDE-only)

**Ordered by dependency: registration race, then transport framing, then
the missing proof for the b1f16bd fixes.**

1. **Registration race (issue 016).** Build the reply state and insert it
   into `activeStreams` **before** invoking `askLoomStream`; settle
   `chatInFlight` exactly once on every terminal and on invoke rejection;
   fall back to unary only when no POST can have been accepted. Tests:
   vitest with an invoke stub that emits before resolving; a Rust
   loopback fixture emitting an immediate terminal.
2. **HTTP body framing (issue 017).** Decode `Transfer-Encoding:
   chunked` (and honor Content-Length) in the stream reader before line
   parsing, with a per-stream size bound and `LOOM_ADDR` error handling —
   reusing the pattern already in `loom_http_raw` (`lib.rs:1217-1328`).
   Fixtures: content-length body, chunk-split event > 2048 bytes,
   trailers, truncated mid-chunk, empty chunk. **This is the foundation
   for item 3.**
3. **NDJSON dispatch (QC-05/issue 003).** On the same decoded-body seam,
   parse both SSE `data:` lines and gateway `{"result":…}` NDJSON lines
   per endpoint. Unblocks workflow live progress, session live updates,
   A/B results, pattern updates.
4. **Close the proof gap on b1f16bd (critique §1, §2, §5).** Add a
   body-encoding test asserting the streamed request keys
   (`session_id`/`agent_id`/`enable_trace`); transport fixtures for EOF,
   truncation-after-completion, FAILED-without-error-text, malformed
   frames, cancellation near EOF; partial-output draft rules (never
   overwrite a newer human draft; cache partial replies as partial).
5. **HITL approvals (QC-07).** Route approve/deny to the correct
   request-store endpoint once its contract is confirmed
   (`RespondToRequest`, proto comment `loom.proto:868`); until then show
   an explicit unavailable-here state with inspectable context. Keep
   QC-06 exactly as fixed (both acceptance fields required).

Phase 1 unblocks: chat that never strands or lies, session continuity,
agent routing proof, workflow live progress, session live updates, A/B
results, pattern updates.

## Phase 2 — Control boundaries and Loom-side registrations (decision-gated)

**Sequenced together and ahead of admin polish, because unenforced
autonomy and an exposed gateway are the highest-order risks (critique
§8).**

1. **Autonomy → permissions mapping (QC-01, issue 005).** Truth-first:
   inspect every consequential entry point (chat, experiment arms,
   workflows, resume, task decomposition, provider comparison,
   schedules). Implement only restrictions the runtime can already
   express; do **not** invent a Manual/Assisted/Collaborative/Delegated
   privilege mapping or claim `backend_config`/context text enforces
   permissions. Where the transport or semantics are unresolved, make
   advisory scope explicit in the UI and record the exact runtime/
   approval contract Loom needs (including tightening active runs).
2. **Deployment posture (QC-02, issue 011).** Bind Loom to loopback or
   enable auth; record the decision in `docs/`. The IDE must not assume
   a trust boundary the server does not hold.
3. **Tasks + skills transport decision (issues 001/002, QC-10).**
   Smallest Loom change: register `TaskServiceHandlerFromEndpoint` +
   `SkillsImportServiceHandlerFromEndpoint` in `pkg/server/http.go`.
   Until then, gate the IDE surfaces behind a live probe with the honest
   "gRPC-only" state. When registered, fix the task payload shapes
   (QC-11) and the MCP contract decodes (QC-12).
4. **Trace ids (issue 004).** One-line Loom fix: set
   `WeaveResponse.TraceId = span.TraceID`; optionally add the field to
   the stream completion event (proto change).
5. **Context pack (QC-09).** Either wire `req.Context` into the weave
   context compilation server-side, or stop advertising it in the IDE
   until it does something. A bounded, labeled IDE-side query-context
   repair using existing supported input is acceptable meanwhile; never
   attach unrelated vault content.

Phase 2 needs Eduardo's Loom-side decisions; the live evidence in
`evidence/live-verification.md` and the contract files in
`contract-audit/` are the decision package.

## Phase 3 — Management contracts and evidence chains (1–2 days, mostly IDE)

- Agent creation wraps `{"config": …}` (QC-08); model switch supplies
  provider + authoritative owner agent and inspects the returned
  effective model (QC-21); app creation submits a declarative
  `UIAppSpec` or downgrades to a spec editor (QC-22).
- Evidence chains (issues 004/008, QC-14): persist execution↔work
  attribution with backward-compatible fields and atomic writes;
  evidence-kind defaults; trace links once Phase 2 lands.
- Capture originating work for workflow stream completion; never use the
  selected work at completion (QC-13, issue 006).
- Guard artifact search/list against out-of-order completion (QC-15).

## Phase 4 — Close the reliability tail (1–2 days, IDE-only)

- Cancel stale session subscriptions (QC-17); newest-session adoption
  guards (issue 007); MCP enabled toggle (issue 009); expose
  schedule-execution cancel and tool-permission request (issue 012).
- Vault root from app-data instead of `CARGO_MANIFEST_DIR` (QC-16) —
  requires the packaged-vault decision (docs/DECISIONS.md).
- Signature coverage for relation-only edits (QC-18); canvas layout flush
  on close (QC-19).

## Phase 5 — Hardening (1 day)

1. CSP for the webview (issue 010).
2. Slot origin header (issue 013); caption wording — distinguish
   transport verification from turn outcome, and stop labeling validation
   rejections as "Could not reach Loom" (issue 014, critique §7).

## Sequencing rationale

- Phase 1 is IDE-only and makes the default chat path trustworthy: the
  race and framing defects sit on the path every user touches, and the
  NDJSON fix rides the same seam. This is the largest trust gain per
  hour.
- Phase 2 deliberately leads with the two control-boundary P0s (QC-01,
  QC-02) alongside the Loom-side registrations: an honest interface to an
  exposed, unenforced runtime is not a completed state no matter how many
  surfaces round-trip.
- Phases 3–5 close the management and reliability tail cheaply.

## Non-goals

- No React, no rebuild, no second app.
- No judge/graph-memory/teleprompter HTTP work until the gRPC transport
  decision is made.
- No new persistence infrastructure beyond the existing stores.
- No visual simplification to hide broken surfaces — connect them instead.
- No unattended live tests against existing personal sessions, and no
  fabrication of end-to-end evidence from HTTP probes alone.

---

## Implementation status at `f75ad9f` / Loom `8082078` (2026-11-16)

The plan below is preserved as written. An authorized unattended
implementation pass (`docs/unattended-build/PROGRESS.md`, rounds 1–3) and
a Loom-side commit (`8082078`) have since executed most of it. Per-phase:

- **Phase 0 (truth pass): DONE.** `DESIGN_PROGRESS.md`/`DECISIONS.md`
  tasks/skills premise corrected (`b36a7c6`); `LOOM_CONNECTION_MODEL.md`
  framing claims corrected with the code fix at `bdb92bb`.
- **Phase 1 (primary chat path): DONE.** Issues 016/017/003/007/014,
  QC-04 residue, QC-06 confirmed, QC-03 test-pinned + live-verified.
  Criterion 1's traversed-UI proof still not executed on the rebuilt
  binary (NG-4).
- **Phase 2 (control boundaries + Loom registrations): PARTIAL.**
  Loom `8082078` landed the registrations (Task/Skills gateway, HITL
  respond route, context consumption, TraceId) and the IDE wired them.
  QC-01 enforcement and QC-02 gateway posture remain decision-gated.
- **Phase 3 (management contracts + evidence chains): DONE.**
  QC-08/11/12/21/22, issue 009, QC-13/14, issue 008.
- **Phase 4 (reliability tail): DONE.** QC-15/16/17/18/19, issue 012,
  issue 010 (CSP), issue 013.
- **Phase 5 (hardening): PARTIAL.** Remaining: issue 015 (stale
  citations + attention copy), NG-1 (native-app fmt), NG-2
  (`max_rounds`/`timeout_seconds` from Intent), NG-5 (Unity recompile /
  CheckWorkbench, real-window checks — environment-gated).

See `14-report-evaluation.md` for the per-claim evidence and
`00-final-assessment.md` for the updated completion criteria.
