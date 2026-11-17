# 08 — Test and Verification Report

Commands executed during this audit (2026-11-15), results observed, and
limitations. Logs are preserved under `evidence/`. This refresh re-ran
every suite **fresh** against `b1f16bd` and re-resolved every cited
source location; it performed **no new live model or UI verification**
(per the audit decision: existing personal sessions are off-limits for
unattended testing, and no disposable isolated profile was available).

## 1. Automated suites (fresh runs, 2026-11-15 ~09:32)

| Command | Result | Evidence |
|---|---|---|
| `npm test -- --run` (vitest) | **PASS — 63/63 tests, 8 files, exit 0** | this run |
| `npm run build` (tsc + vite) | **PASS, exit 0** — 4.16 MB bundle (1.07 MB gzip); rolldown chunk-size warning only | this run |
| `cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib` | **PASS — 96 passed, 2 ignored, 0 failed** | this run |
| `cargo test --offline --locked --manifest-path native-app/Cargo.toml` | **PASS — 22 passed** | this run |
| `cargo fmt --check --manifest-path src-tauri/Cargo.toml` | **PASS, exit 0** | this run |
| Focused stream tests `cargo test --lib loom_stream::` | **PASS — 4 passed, 0 failed, 94 filtered** | this run |

The four focused tests are:
`stream_inputs_are_validated_before_any_network_work`,
`cancel_of_an_unknown_request_is_an_error`,
`weave_requires_completion_and_surfaces_application_errors`,
`clarification_requires_explicit_acceptance`. All four exercise
**helpers** — they do not traverse the request builder, the socket
reader, chunk decoding, cancellation mid-stream, or event delivery.
"All suites green" therefore proves the patch did not regress the helper
surface, and nothing more (critique §2).

Earlier runs preserved under `evidence/`: the original audit's suites
(`frontend-tests.log`, `tauri-tests.log`, `native-tests.log`,
`frontend-build.log`, `unity-recompile.log`) and the post-fix
evaluation's runs (`post-fix-*.log`). Unity recompile was **not**
re-run in this refresh: no C#/Unity changes since the prior 0-error /
0-warning pass; note that the earlier post-fix evaluation's "every check
re-run" headline required this qualification too (critique §12).

## 2. Live evidence (audit-time; NOT repeated in this refresh)

Full transcript: `evidence/live-verification.md`. Summary of what was
demonstrated against the running looms v1.4.0 server during the morning
pass:

| # | Test | Result |
|---|---|---|
| 1 | `GET /v1/health` | healthy, component map + version |
| 2 | Streaming weave (SSE), "Reply with exactly: pong" | PASS — 4 s; token events; completion with cost + context_state |
| 3 | Unary weave, "Reply with exactly: echo" | PASS — 4.8 s; `text`, `sessionId`, `agentId`, `cost`; **no `traceId`** (issue 004) |
| 4 | Agent routing by name (`agentId: "guide"`), unary | PASS |
| 5 | Session create/history/detail | PASS |
| 6 | Agents/models/tools lists | PASS (3 agents; catalog; 18 tools) |
| 7 | Artifacts list/detail/content/stats | PASS |
| 8 | Patterns/presets/templates/apps/component types | PASS |
| 9 | Server config / storage / TLS | PASS |
| 10 | Route existence (mutation endpoints) via validation/404 probes | PASS |
| 11 | **UI-level chat (headless Chromium + CDP)** — real UI → streamed reply → pill "Connected to Loom" | PASS — `evidence/ui-chat-live.png` |
| 12 | Tasks/boards/skills endpoints | FAIL — 404 (issues 001/002) |
| 13 | Session subscribe framing | FAIL — live NDJSON `{"result":…}` captured; IDE parser discards it (issue 003) |
| 14 | Bus topics | FAIL server-side — 501 not implemented |
| 15 | Shared memory / Lua routes | registered; Lua disabled in config |

**Post-fix (b1f16bd) HTTP-level evidence** (morning pass, preserved in
`evidence/post-fix-evaluation.md`): stream addressed to
`sess_d7f154c9` + `internet-researcher` completed with `stage:7` and grew
that session 2→4 conversations (no new session); the same request with
`agent_id:guide` was rejected with FailedPrecondition "session belongs to
a different agent" — identity is enforced, not dropped, at the wire. A
permanent turn was added to an existing session during that verification:
**it is disclosed, and no further live tests may be run against that
session** (critique §9).

**What this evidence does and does not prove:** it proves the backend
request/response contracts and, in test 11, the pre-patch UI round trip.
It does **not** prove the patched Rust → Tauri → UI path end to end —
direct HTTP probes never invoke `run_stream`, its framing, Tauri event
delivery, frontend registration, or rendering (critique §1). That proof
remains an open verification item, to be closed with loopback fixtures
plus (if authorized) a disposable isolated profile.

## 3. Source-level verifications performed in this refresh

Each re-resolved against current files:

- `loom_stream.rs:85-125` — snake_case `session_id`/`agent_id`/
  `enable_trace` on the stream request (QC-03 fix present).
- `loom_stream.rs:302-327` — `weave_completed` / `clarification_ack`
  (QC-04/QC-06 fixes present; both acceptance fields required — correct).
- `src/main.ts:5346-5409` vs `5043-5045`, `5176-5186` — registration
  race confirmed (issue 016): `activeStreams.set` at 5404 follows the
  `await askLoomStream` at 5371; unknown-id events silently dropped;
  `chatInFlight` decremented only in `finishStream`.
- `loom_stream.rs:341-460` vs `lib.rs:1217-1328` — chunked decoding
  exists in the unary reader only; the stream reader parses raw socket
  lines (issue 017).
- `pkg/server/http.go:430-451, 467-490, 456-465` — SSE events written as
  one `Fprintf`+`Flush` per event through Go `net/http` (chunked body;
  ~2 KB server write buffer splits larger events across chunks).
- `multi_agent.go` Weave/StreamWeave — no consumption of
  `WeaveRequest.context` (QC-09 re-confirmed).
- `proto/loom/v1/loom.proto:747-812, 845+` — `WeaveRequest` fields;
  `WeaveProgress` carries no session/trace identity (issues 004/007 wire
  facts re-confirmed).
- Loom package grep — no autonomy/permission surface for per-intent
  levels in the weave path (QC-01 re-confirmed); autonomy exists only in
  the IDE's local work metadata.

## 4. Failure testing performed

- Bogus workflow ref on `/v1/workflows:execute` and `:stream` → 404 with
  server message (IDE surfaces it). (audit-time, live)
- Bogus trace id → 404 "trace not found" (route + message correct).
- Bogus agent id → 404 with the available-agent list.
- Invalid payloads on register/permission routes → 400 validation errors
  (proves route registration without executing anything).
- Stream cancel semantics: unit-tested
  (`cancel_of_an_unknown_request_is_an_error`).
- **Not yet tested (open verification items, critique §5):** FAILED stage
  without an error string; malformed JSON frames; errors after
  completion; valid completion followed by truncation; cancellation near
  EOF; real EOF handling; chunk-split payloads (issue 017 fixtures);
  early-event delivery (issue 016 fixtures).

## 5. Contract verification

- WeaveRequest/WeaveResponse/WeaveProgress/HITLRequestInfo/
  AnswerClarificationRequest field-by-field against `proto/loom/v1/loom.proto`
  and the live wire — matches the IDE's structs (both paths), with the
  two wire formats (protojson gateway vs snake_case SSE) now documented
  in `02-loom-capability-map.md`.
- grpc-gateway v2.33.0 `ForwardResponseStream` source inspected in the Go
  module cache to establish the NDJSON `{"result":…}\n` framing fact (003).
- `pkg/server/http.go` registration list inspected to establish the
  LoomService-only gateway fact (001/002); corroborated by Loom's own
  `docs/reference/http-server.md`.
- `AnswerClarificationResponse` (`loom.proto:1370`): proto3 `bool
  success`/`accepted` — omitting `accepted` means false, so requiring
  both is the correct contract, not a defect (critique §11).

## 6. What was NOT verified (honest limitations)

- **No new live model/UI verification in this refresh** — deliberate.
  The patched Rust → Tauri → UI chain, real-window pixels, and live
  chunk-split behavior remain unverified; loopback fixtures can close
  most of this without touching the server.
- Workflow execution — the server has zero workflows configured; route
  error paths verified only.
- Schedules, MCP CRUD, agent lifecycle mutations, app create/update,
  session delete/resume/resolve-gap, TLS renew, storage migrate — none
  executed (destructive, mutating, or nothing to act on).
- HITL card delivery — no hold was raised by any verified turn; code path
  + route registration + unit tests only.
- Provider A/B results — cannot arrive at all under the framing defect
  (003/017); the endpoint itself not exercised.
- Model switch — session mutation not executed.
- Vault sync from Loom — not executed (writes into the user's vault).
- Unity — prior pass 0 errors / 0 warnings; not re-run (no Unity changes
  since).

## 7. Verification gaps in the project's own tooling

- No contract-test suite between the IDE and a real Loom server exists in
  CI form (the `#[ignore]` live test is opt-in; it passed at audit time).
- No loopback transport fixtures for the stream reader — the gap that
  leaves issues 016/017 unguarded; the recommended fixtures are specified
  in those issue files.
- The 7x7x7 pass recorded features as implemented without a live contract
  check for tasks/skills — the process gap that produced issues 001/002.
  Recommendation: any new surface must be gated on one live request
  against a running server before being marked implemented, and any
  end-to-end claim must name the exact chain it traversed.

---

## 4. Current-state re-run (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`)

Fresh runs this pass, against the working tree at `f75ad9f` content.
Logs: `evidence/eval-20261116-*.log`.

| Command | Result |
|---|---|
| `npm test -- --run` (vitest) | **93/93 passed, 12 files, exit 0** (committed state; doc 13) — fresh re-run 2026-11-16 ~20:14: **95/95** because the peer task's uncommitted `spatial.test.ts` edits add 2 tests; see `evidence/exec-20261116-frontend-tests.log` |
| `npm run build` (tsc + vite) | **exit 0** — 4,167.87 kB bundle (1,073.21 kB gzip); chunk-size warning only |
| `cargo test --lib` (src-tauri) | **125 passed, 2 ignored, 0 failed** |
| `cargo test` (native-app) | **22 passed, 0 failed** |
| `cargo fmt --check` (src-tauri) | **exit 0** |
| `cargo fmt --check` (native-app) | **FAILS (exit 1)** — pre-existing; `native-app/src` has never been rustfmt-clean (last touched `41170a6`, before the audit). Every "fmt ✓" claim in the refresh report and build ledger is src-tauri-scoped and did not say so — see `14-report-evaluation.md` NG-1 |
| Focused `loom_stream::` | **24 passed** (13 transport fixtures over the production reader incl. real loopback TCP) |

Fresh evidence standard applied 2026-11-16: the six required commands were
re-run at `f75ad9f` with per-manifest capture and immediate exit codes —
`evidence/exec-20261116-frontend-tests.log`,
`exec-20261116-frontend-build.log`, `exec-20261116-tauri-tests.log`,
`exec-20261116-native-tests.log`, `exec-20261116-fmt-src-tauri.log`
(EXIT=0), `exec-20261116-fmt-native-app.log` (EXIT=1, 1,886-line diff).
These supersede `eval-20261116-fmt.log`, whose header mixes a
missing-manifest error with `FMT_EXIT=0` and is retained only as a record
of the earlier mis-capture. Unity recompile/CheckWorkbench remain
environment-blocked (no Editor session was free; the peer task
20261116-195041 owns the running Editor).

Test growth since the refresh report: frontend 63→93 (8→12 files; new
`chat-lifecycle.test.ts` **15 tests** (runner-verified) over the
**extracted real `main.ts` handlers with a minimal fake DOM and mocked
Tauri bridges** — not the real Tauri event pipeline,
`hitl-card.test.ts`, `stream-consumers.test.ts`,
`run-records.test.ts`); Tauri lib 96→125 (stream framing/NDJSON
fixtures, wire-contract pins, knowledge persistence); native unchanged
at 22.

The refresh report's claim "the patched Rust → Tauri → UI path has no
automated test" needs a precise restatement: both **ends** are now
pinned — the Rust end by
`weave_stream_body_uses_the_sse_snake_case_contract` (asserts camelCase
keys absent) and the UI end by `chat-lifecycle.test.ts` driving the
extracted real `sendChat`/`handleStreamEvent`/`finishStream` code with
mocked bridges, including the issue-016 early-terminal and issue-014
caption cases. **The middle of the chain — the real Tauri event bridge
and a rendered window — is still not traversed by any automated test,
and a live model turn through the rebuilt binary remains unexecuted
(NG-4)**; doc 13's live probes verify the wire contract byte-for-byte.
