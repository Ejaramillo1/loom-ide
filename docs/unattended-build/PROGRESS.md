# Unattended build — progress ledger

Owner away. Implementation of `docs/OPENCODE_UNATTENDED_BUILD_PROMPT.md`
ordered queue, working repo `/home/ed/loom-ide-tauri`, branch
`tauri-prototype`. Local commits only; Loom read-only; no new
dependencies; preserve pre-existing uncommitted work (the audit corpus
under `docs/audits/` and any owner edits — never staged).

## Starting state

- Starting commit: `f7217bc` (docs: specify unattended IDE-only
  implementation workflow).
- Tree: branch ahead of origin by 13; untracked pre-existing files:
  `docs/audits/quiet-complexity-loom/**` (merged audit corpus, including
  `12-current-state-recheck.md` from the same session's audit pass).
  Preserved untouched; excluded from all commits.
- Baseline checks (fresh, 2026-11-15 ~16:05 UTC): vitest 63/63 (8
  files) · `npm run build` ✓ · cargo lib 96 passed / 2 ignored ·
  native-app 22 passed · `cargo fmt --check` ✓ · focused `loom_stream::`
  4 passed / 94 filtered.
- Live facts (read-only probes): `/v1/health` 200 (v1.4.0);
  `/v1/tasks`, `/v1/boards`, `POST /v1/skills:bulkImport` all 404;
  `looms` on `*:5006`/`*:60051`.
- Source-recheck summary (from `docs/audits/quiet-complexity-loom/12-current-state-recheck.md`):
  3 FIXED (QC-03, QC-06, QC-04-partial) · 29 STILL PRESENT · 0
  REGRESSED · patched Rust→Tauri→UI path NOT VERIFIED.

## Ordered queue (concise)

1. Chat request lifecycle (issue 016; settle-once; unary fallback
   safety; partial-reply preservation; body-encoding test).
2. Transport framing: chunked decode + size bound + `LOOM_ADDR` Result +
   FAILED-without-error-text; NDJSON gateway envelopes (issues 017/003,
   QC-04 residue).
3. Streaming consumers: workflow attribution (QC-13), subscription
   cancellation (QC-17), A/B + workflow + session + pattern payloads
   (QC-05), slot-origin header on chat turns (issue 013).
4. Management contracts (QC-08/11/12/21/22, issue 009; 200-with-false
   handling).
5. HITL cards (QC-07: legacy vs request-store ids; unavailable-here
   state; safe parameter rendering).
6. Costs + durable run records (QC-14, issue 008).
7. Context record truthfulness (QC-09: bounded labeled query section).
8. Control semantics (QC-01 copy truth; local boundary tests).
9. Local reliability (QC-15/18/19; vault-root setting only; judge
   templates; app-opener isolation).
10. Decision-gated directions (gRPC blocker; migration preview only;
   harness allowlist blocker; Q2 untouched).

## Ledger

### Slice 1 — Chat request lifecycle

**Status:** FIXED — committed `58cce7b` (2026-11-15 ~16:45 UTC).

- Issue 016 registration race: reply state registered before the invoke;
  per-request exactly-once settle (`settleStreamState`); overlapping
  sends no longer strand the counter; unary fallback only on pre-spawn
  rejection and skipped when a terminal raced the rejection.
- Issue 007 second layer: done branch no longer adopts newest/selected
  session; honest identity note when the wire reports no session id.
- Partial replies preserved (cached, marked partial); failed-draft
  restore never overwrites a newer human draft.
- Rust: `weave_stream_body` builder extracted + 3 wire-contract tests
  (snake_case keys, blank omission, context passthrough) — QC-03 pinned
  by the real builder, not source grepping.
- Checks at commit: vitest 74/74 (9 files, +11) · build ✓ · cargo lib
  99/2 · native 22 ✓ · fmt ✓. Unity untouched (no C# change).
- Next: Slice 2.

### Slice 2 — Transport framing + NDJSON dispatch

**Status:** FIXED — committed `bdb92bb` (2026-11-15 ~17:30 UTC).

- Issue 017: chunked transfer decoding (sizes/data/CRLF/trailers/zero
  chunk) + Content-Length + EOF fallback on the production reader;
  split >2 KB payloads reassemble; truncated/malformed framing is an
  explicit error; non-2xx error bodies decoded through the same framing.
- Issue 003/QC-05 unblocked: NDJSON result/error envelopes dispatch on
  the decoded-body seam.
- QC-04 residue: FAILED stage 8 fails without error text.
- Bounds: header lines/bytes, chunk-size lines, 1 MB lines, 16 MB body.
- `LOOM_ADDR` parse panic removed (Result error).
- 13 transport fixtures (in-memory + real loopback TCP + Stop-during-
  silence) drive the production `read_response_events`.
- Checks at commit: cargo lib 111/2 · native 22 ✓ · vitest 74/74 ·
  build ✓ · fmt ✓. Unity untouched.
- Next: Slice 3.

### Slice 3 — Streaming consumers + slot origin

**Status:** FIXED — committed `7f93a2f`.

- Issue 013: `X-Loom-Slot-Origin: interactive` on both chat weave paths
  (unary via `loom_request_with_headers`, stream in `run_stream`);
  background streams stay batch.
- QC-13: workflow completion/error attribute to `workflowStreamOrigin`
  (captured at start), never the selection at completion; error text
  keeps the real workflow name captured before state clearing.
- A/B: flat camelCase ABTestEvent decoded; int64 latencyMs string
  coerced; provider ids/score/cost/winner preserved.
- QC-17: session subscription cancel on change/clear; stale terminals
  cannot clear the new handle; same-session re-ensure is idempotent.
- Workflow stream reads protojson camelCase (executionId/message/progress).
- 5 regression tests (stream-consumers.test.ts).
- Checks at commit: vitest 79/79 (10 files) · build ✓ · cargo lib 111/2
  · native 22 ✓ · fmt ✓. Unity untouched.
- Next: Slice 4.

### Slice 4 — Management contracts

**Status:** FIXED — committed `b6c612f` (2026-11-15 ~18:10 UTC).

- QC-08: agent create wraps `CreateAgentRequest.config`.
- QC-21: model switch supplies owner agent + provider; success=false is
  a rejection; effective new_model shown with the agent-level scope.
- QC-22: app create submits a declarative UIAppSpec; dialog asks for a
  description; component-type listing reads protojson `type`.
- QC-12: MCP add unwraps `server` + success check; test drops `name`
  and decodes success/message/error/tool_count (failures never show as
  passed); health merges the name-keyed map into existing rows.
- issue 009: MCP edit preserves the row's enabled state.
- QC-11: `board_id` query param; nested `{task}` update envelope;
  create/update reject missing `task` fields; readyTasks/blockedTasks.
- Checks at commit: vitest 79/79 · build ✓ · cargo lib 112/2 · native
  22 ✓ · fmt ✓. Unity untouched.
- Next: Slice 5.

### Slice 5 — HITL cards (QC-07)

**Status:** FIXED — committed `ff272af` (2026-11-15 ~18:35 UTC).

- Question cards answer via the legacy clarification map using the
  card's `question_id`; options become one-click answers.
- Approval/resource cards are display-only with the honest reason:
  Loom's stored-request store has no network answer route (verified
  read-only: only `looms hitl` resolves it); Approve/Deny removed.
- Cards show held-call parameters as inert text (with the server-
  truncation notice) and the server-supplied hold timeout; a card
  without question_id is display-only.
- 5 regression tests over the real renderHitlCard.
- Checks at commit: vitest 84/84 · build ✓ · cargo lib 112/2 · native
  22 ✓ · fmt ✓. Unity untouched.
- Next: Slice 6.

### Slice 6 — Costs + durable run records (QC-14, issue 008)

**Status:** FIXED — committed `a714b20` (2026-11-15 ~19:00 UTC).

- Unary decodes `cost.total_cost_usd` (both casings); stream captures the
  completion event's CostInfo. Missing cost stays unknown, never zero.
- Run-record store (localStorage, same store as chat cache): id,
  captured work/intent/session/agent, event-derived status, partial
  flag, timestamps, error, cost + source, trace id. Exactly one record
  per settle; a crash mid-run leaves no record instead of an invented
  outcome; corrupt bytes retained under a backup key; cap 200.
- Unary fallback addresses the captured selection and never overwrites a
  newer human draft.
- Pill title carries the scoped running total (IDE-recorded only).
- Live loom replies default to the 'Observed' evidence label.
- Tests: 4 run-store + 2 lifecycle record assertions.
- Checks at commit: vitest 90/90 (12 files) · build ✓ · cargo lib 112/2
  · native 22 ✓ · fmt ✓. Unity untouched.
- Next: Slice 7.

### Slice 7 — Continuation record (QC-09)

**Status:** FIXED — committed `1959b2b` (2026-11-15 ~19:25 UTC).

- The context map is inert server-side (re-verified), so the composed
  continuation record rides the query — the only input that
  demonstrably reaches the model — on both request paths.
- Bounded (1200 chars), labeled informational (untrusted data, not
  instructions), built from captured selection state + this work's run
  receipts only; open-file content capped at 600; unrelated work and
  note bodies never leak; truncation stated; attachment visible to the
  human under the sent message.
- Tests: 4 context-section + lifecycle assertion of the composed query.
- Checks at commit: vitest 94/94 · build ✓ · cargo lib 112/2 · native
  22 ✓ · fmt ✓. Unity untouched.
- Next: Slice 8.

### Slice 8 — Control semantics (QC-01)

**Status:** FIXED (honesty) — committed `a02ad52` (2026-11-15 ~19:40 UTC).

- autonomy_admission extracted + 4 boundary tests (ceiling not prose-
  overridable, justification rule, tightening instant, unknown levels).
- Autonomy dial states its local-only scope; Stop button labels
  cooperative cancellation. QC-01 stays open by design: no privilege
  mapping invented; server enforcement needs a Loom-side contract.
- Checks at commit: vitest 94/94 · build ✓ · cargo lib 116/2 · native
  22 ✓ · fmt ✓. Unity untouched.
- Next: Slice 9.

### Slice 9 — Local reliability (QC-15/16/18/19)

**Status:** FIXED — committed `52c652a` (2026-11-15 ~20:05 UTC).

- QC-18: watcher signature includes `.loom/ledger.json` mtimes
  (relation-only edits move it; filesystem test proves it).
- QC-19: atomic layout saves (tmp+rename) with surfaced failures;
  corrupt layouts never overwritten by a fallback.
- QC-15: artifact search request-generation guard (stale responses can
  never replace newer results/errors).
- QC-16: `LOOM_VAULT_DIR` explicit setting; default path and data
  preserved (no relocation).
- Apps open detached (noopener,noreferrer); judge template extended.
- Checks at commit: vitest 94/94 · build ✓ · cargo lib 117/2 · native
  22 ✓ · fmt ✓. Unity untouched.
- Next: Slice 10.

### Slice 10 — Decision-gated directions

**Status:** PARTIAL (preview) + 3 recorded blockers — committed
`18d42a2` (2026-11-15 ~20:25 UTC).

- Migration preview: read-only `work_migration_preview` command + UI
  dialog (name collisions, open intent-mapping decision, autonomy-stays-
  local notes); the migration stays an explicit user-triggered action.
  3 Rust fixtures.
- BLOCKED: Rust gRPC client — tonic/prost/h2 absent; no new deps
  unattended (direction approved, implementation dependency-gated).
- BLOCKED: two-way harness MCP — tool allowlist + permission boundary
  not established.
- BLOCKED: avatar — no account/profile identity concept.
- Q2: unchanged (deferred).
- Checks at commit: vitest 94/94 · build ✓ · cargo lib 120/2 · native
  22 ✓ · fmt ✓. Unity untouched.

## Assessment (end of this build pass)

Completed all ten queue slices that are authorized and unblocked. Ten
local commits: `58cce7b`, `bdb92bb`, `7f93a2f`, `b6c612f`, `ff272af`,
`a714b20`, `1959b2b`, `a02ad52`, `52c652a`, `18d42a2` (plus the ledger
commit). No pushes, no branch changes, no deletions, no new
dependencies, no Loom writes, no personal-session use, no Unity changes
(the required Unity recompile was skipped each slice because no C#
changed; the baseline pass remains 0 errors/0 warnings).

State after the pass (vs the audit baseline at `b1f16bd`):
- FIXED by this pass: issue 016 (registration race), issue 017 (chunk
  framing), QC-05/issue 003 transport (NDJSON dispatch ready at the
  reader; consumer decoding wired for workflow/A-B), QC-13 (workflow
  ownership), QC-17 (subscription lifecycle), QC-08/21/22/12/11
  (management shapes), issue 009 (MCP edit enabled state), QC-07 (HITL
  honesty: approvals display-only), QC-14 (durable run records), issue
  008 (evidence label), QC-09 (query-riding continuation record), QC-01
  (honest scope copy + boundary tests; NOT marked fixed — server
  enforcement needs a Loom contract), QC-15/18/19, issue 013 (slot
  origin header), QC-16 (explicit setting only).
- Verification gaps that remain honest: the patched Rust→Tauri→UI path
  has no end-to-end automated test (no disposable profile authorized);
  live behavior verified by read-only probes + loopback fixtures only;
  the tasks/skills HTTP 404s and the Loom-side blockers (gateway
  registration, TraceId, context consumption, autonomy enforcement,
  gateway exposure) remain, decision-gated.
- Exact blockers: (1) Loom HTTP registration of Task/Skills services or
  the dependency-gated Rust gRPC client; (2) a Loom-side contract for
  autonomy/permission enforcement and for stored-approval answering;
  (3) gateway bind/auth posture; (4) TraceId population; (5) authorized
  disposable profile for live end-to-end verification.
- Material risks: none of the new code was exercised against a live
  model turn (per the no-personal-session rule); the stream reader
  rewrite is covered by 13 loopback/in-memory fixtures against the
  production reader, not by a real Loom stream.


Plan:
- `src/main.ts`: register reply state before `askLoomStream` invoke;
  per-request exactly-once settle (replaces the
  `activeStreams.size === 0` decrement); unary fallback only on
  pre-spawn rejection; skip fallback if a terminal raced the rejection;
  capture work/session/agent/context before any await; drop
  newest-session adoption in the done branch (report missing identity
  instead); preserve partial replies (cache + partial note); never
  overwrite a newer human draft.
- `src-tauri/src/loom_stream.rs`: extract `weave_stream_body` builder
  (snake_case contract) + body-encoding unit tests.
- New `src/chat-lifecycle.test.ts`: vitest coverage of the acceptance
  cases (early terminal, overlapping sends, work switch, start failure,
  validation rejection, partial-then-disconnect, cancel, repeated
  terminal, race terminal-vs-rejection).

## Decisions taken (this build pass)

(none yet)

## Blockers

(none yet)


## Round 2 — "fix everything" (owner authorization, 15 Nov evening)

Loom-side (repo `/home/ed/work/loom`, commit `8082078`, local only, no
push): TaskService + SkillsImportService registered on the HTTP gateway
(kanban and Skills shelf now have real data sources — verified live:
`/v1/tasks` 200, `/v1/boards` 200, `/v1/skills:bulkImport` 400
validation instead of 404); `POST /v1/human-requests/{id}:respond`
answers stored approvals over HTTP with `looms hitl respond` semantics;
`WeaveResponse.TraceId` populated from the active span (unary +
dedupe-final); `WeaveRequest.context` consumed into the prompt as a
bounded labeled section (1200 chars, file content 600, truncation
stated; untrusted-data label). Server rebuilt and restarted
(`/home/ed/.local/bin/looms`, pid changed, same `looms serve` config);
health 200. Pre-existing FTS5-sqlite test failure noted (environment,
not these changes).

IDE-side (commits `1c6efb8`, `+harness`, `+docs`):
- Context delivery moved server-side; client query composition removed
  (no double injection); context-section.test.ts retired (coverage in
  Loom request_context_test.go).
- Issue 014 captions split rejection vs disconnection on both paths.
- Issue 010 webview CSP set; inline file:// guard moved into main.ts.
- Issues 001/002 boards error names the missing registration on 404.
- Issue 012: schedule-history 'Cancel run' + tools 'Request permission…'
  dialogs wired to the bridged commands; history reads protojson
  executionId.
- QC-04 residue fixtures: error-after-completion, cancel-near-EOF.

Verification: vitest 90/90 · build ✓ · cargo lib 122/2 · native 22 ✓ ·
fmt ✓ · live probes above. Remaining: release-binary rebuild (running),
real-window CSP/UI check (D14 environment limit), a real model turn
still not executed (no disposable profile).
