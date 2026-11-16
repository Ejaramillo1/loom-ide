# 13 — Live contract verification (2026-11-16)

> End-to-end, evidence-backed verification of the Loom contract against the
> **real** server, closing the gaps the prior report left open: Loom
> compatibility, the native handler behavior, and runtime correctness. All
> probes ran against the live `looms serve` process (pid 297398, HTTP
> `127.0.0.1:5006`, gRPC `127.0.0.1:60051`), binary `/home/ed/.local/bin/looms`
> built 2026-11-15 19:13 from `/home/ed/work/loom` @ `8082078` (v1.4.0).
> The server source advanced past the prior audit's `ab46f76f`: commit
> `8082078` ("Gateway: register Task/Skills services, answer stored HITL
> requests, consume WeaveRequest.context, return TraceId") and the IDE is at
> `e837bc8` (approval cards now route through the stored-request store).

**Health at verification start:**

```json
{"status":"healthy","components":{"openai/deepseek-v4-pro":{"status":"healthy","lastCheck":"1794851722","latencyMs":"1736"}},"version":"1.4.0"}
```

## Phase 1 — Live chat streaming trace (one full transaction)

Traced from frontend arguments to the real Loom server and back to the UI,
with a real request/response. Probe:
`evidence/live-chat-stream-probe.mjs` (byte-faithful reproduction of the
request `run_stream` emits), captured output
`evidence/live-chat-stream-probe.txt`.

### 1a. Frontend arguments (`sendChat` / `buildChatContext`)

`src/main.ts` `sendChat` (line 5873) captures `workId`, `sessionId`,
`agentId`, `intentId` **at send time**, builds the context pack via
`buildChatContext` (line 5147 — active work title/status/autonomy, active
intent statement, open-file label + first 4000 chars, active experiment,
selected session/agent ids), registers the reply state **before** invoking
(line 5902, issue 016 fix), then calls
`askLoomStream(requestId, clean, sessionId, agentId, context)` (line 5938).

### 1b. Rust dispatch (`ask_loom_stream`)

`src-tauri/src/loom_stream.rs` `ask_loom_stream` (line 86) validates inputs,
builds the **snake_case** body via `weave_stream_body` (line 117), and
`start_loom_stream` spawns `run_stream` (line 997), which connects to
`loom_addr()` (`127.0.0.1:5006`), writes the request with
`X-Loom-Slot-Origin: interactive`, reads/decode the chunked response, and
re-emits each event as a `loom-stream` Tauri event.

### 1c. Loom contract — real POST `/v1/weave:stream`

| Field | Observed |
|---|---|
| Request | `POST /v1/weave:stream` with `{query, enable_trace}` (snake_case) + `X-Loom-Slot-Origin: interactive` |
| Status | `HTTP/1.1 200 OK` |
| Content-Type | `text/event-stream` |
| Framing | `Transfer-Encoding: chunked` (decoded by the IDE reader) |
| Server version | `1.4.0` |
| First event | `stage: 3` ("Generating response"), latency **5099 ms** (first byte); server-reported TTFT **2033 ms** |
| Event count | 4 (stage 3 → stage 3 token stream → stage 3 complete → stage 7) |
| Final event | `stage: 7` (`EXECUTION_STAGE_COMPLETED`), `partial_content: "pong"`, `cost.total_cost_usd: 0.0127975`, `context_state.context_tokens_used: 5924` |

The model answered `"pong"` exactly as prompted. The completion event is the
snake_case wire shape the frontend already reads
(`cost.total_cost_usd`, `partial_content`).

### 1d. Events back to the UI

`src/main.ts` `listen<LoomStreamEvent>("loom-stream", …)` (line 8108) →
`handleStreamEvent` (line 5325): every `progress` event sets `loomVerified`,
renders `partial_content` into the bubble, captures cost, and renders tool
lines / HITL cards; the terminal event routes to `finishStream` (line 5601)
which settles state exactly once (`settleStreamState`, line 5593). The
reader accepts `stage: 7` as completion (`weave_completed`, line 316) and
rejects `stage: 8` / a non-empty `error` / EOF-before-completion.

**Stop** (code + test traced, live trigger non-deterministic): Stop →
`cancelLoomStream` → `cancel_loom_stream` sets the per-request `AtomicBool` →
`run_stream` re-checks on every read wake and returns `Err("Cancelled.")` →
terminal `kind: cancelled`. Covered by `loom_stream::tests::cancel_during_silence_stops_the_reader`
and `cancel_after_completion_data_still_reports_cancelled`.

**HITL** (code traced, live trigger non-deterministic): `handleStreamEvent`
renders `hitl_request` cards via `renderHitlCard` (line 5402), splitting
approval / resource / question cards; covered by `hitl-card.test.ts` and
`chat-lifecycle.test.ts`.

### 1e. Session identity live (QC-03 re-verified against the new server)

`evidence/live-session-reuse-probe.mjs` / `.txt`: turn 1 (no `session_id`)
created `sess_b05e656f` (agent `guide`, `conversationCount: 2`); turn 2 sent
`session_id: "sess_b05e656f"` (snake_case) and the **same** session's
`conversationCount` advanced **2 → 4** — no new session. The snake_case
identity contract (QC-03 fix) holds on the live server.

## Phase 2 — Persistence verification

Verified with real tests (disposable temp vaults under `target/fold-tests/`)
plus a live read-only shape probe. The live sync-to-real-vault command was
**not** executed (see §5).

- **Atomic write** — `knowledge.rs` `atomic` (line 253): temp file +
  `write_all` + `sync_all` + `rename` + parent-dir `sync_all`, with symlink
  rejection before and after. Canvas layout save (`knowledge_canvas_layout_save`,
  line 1059) uses the same temp+rename (QC-19 fix). Verified by
  `knowledge::tests::recovery_is_idempotent_and_conflicts_preflight_all_files`,
  `stale_ledger_and_external_edits_never_overwritten`,
  `create_save_search_history_and_provenance`, `symlink_root_parent_note_history_and_ledger_rejected`.
- **Recovery after interruption** — a pending journal (`PENDING`) is replayed
  on `Vault::open` (`knowledge.rs` line 400-408); `replay` (line 381)
  preflights every write and refuses conflicts, then marks completion.
  Verified by `recovery_is_idempotent_and_conflicts_preflight_all_files`
  (idempotent replay + conflict preflight) and
  `symlink_root_parent_note_history_and_ledger_rejected`.
- **Local/server reconciliation (the current manual mirror)** —
  `knowledge_sync_from_loom` (line 1087) GETs `/v1/sessions`, `/v1/agents`,
  `/v1/artifacts` and mirrors each into the vault via `mirror` (line 871):
  idempotent by the `Loom ID: {id}` marker, whitelists metadata fields, and
  never copies inline artifact content. Verified by
  `sync_markers_are_exact_idempotent_and_artifact_content_excluded` and
  `sync_does_not_duplicate_a_hidden_marker`. Live read-only probe confirms the
  three endpoints return the exact shapes `mirror` expects:
  `{"agents":[{id,name,status,activeSessions,…}],"totalCount":3}`,
  `{"sessions":[{id,state,updatedAt,conversationCount,agentId,…}],"totalCount":N}`,
  `{"artifacts":[{id,name,source,purpose,sessionId,createdAt,…}]}`.

## Phase 3 — Approval and tools (live)

The question: does the server treat clarification answers as tool approvals,
and is the dedicated `RequestToolPermission` RPC the correct approval path?

**Answer: no on both counts. The correct approval-answer path is
`POST /v1/human-requests/{id}:respond`, which the IDE already uses
(`respond_human_request`).** Three distinct server-side stores were
confirmed (source `pkg/server/`), and each route was probed live:

| Path | Server store | Live result | Conclusion |
|---|---|---|---|
| `answer_clarification` → `POST /v1/clarifications/{session}/answer` | legacy `pendingQuestions` map (`multi_agent.go:3919`) | HTTP 200 `{"error":"question not found or already answered"}` for a fake question | **Not** a tool approval; answers a legacy clarification question only |
| `tool_permission_request` → `POST /v1/tools:request-permission` | in-memory `pendingPermissions` (blocks on a channel) | `{}` → HTTP 400 `session_id is required`; with a fake session → **blocked 15 s+** (no bytes); `/v1/tools:grant-permission` → 404 | **Not** the correct path: `RequestToolPermission` blocks waiting for `GrantToolPermission`, which is a Go method with **no HTTP route** — an HTTP client can never answer it |
| `respond_human_request` → `POST /v1/human-requests/{id}:respond` | `HumanRequestStore` (SQLite, shared with `contact_human` / `looms hitl`) | bogus id + `status:"bogus"` → HTTP 400 `invalid status` (validates before lookup); bogus id + `approved` → HTTP 404 `request not found` (store wired); GET → 405 | **Correct** approval-answer path (status vocabulary `approved`/`rejected`/`responded`) |

The IDE already routes approval cards through `respond_human_request`
(`main.ts:5491-5504`) and question cards through `answer_clarification`
(`main.ts:5471`), matching this live-verified split. `renderHitlCard`
(line 5419) classifies `kind: "approval"` / `request_type: "approval"` as
approval (the server's `HITLRequestInfo.kind` classifier, `loom.proto:985`).
No code change was required; the path is correct and now live-verified.

**Not executed:** a full live approve/deny of a real held tool (requires the
agent to actually park a tool call — non-deterministic, and the server has no
hook-held tools configured). The parked-turn 409 refusal
(`handleHumanRequestRespond`, `http.go:383`) is source-confirmed, not
live-tested.

## 4. Verification suite — real numbers

| Check | Command | Result |
|---|---|---|
| Frontend tests | `npm test -- --run` | **93 passed / 12 files** (0 failed) |
| Frontend build | `npm run build` | ✓ built in 6.63 s (tsc + vite) |
| Tauri lib tests | `cargo test --offline --locked -p … --lib` | **125 passed / 0 failed / 2 ignored** |
| Native-app tests | `cargo test --offline --locked --manifest-path native-app/Cargo.toml` | **22 passed / 0 failed** |
| rustfmt | `cargo fmt --check --manifest-path src-tauri/Cargo.toml` | ✓ exit 0 |
| Focused stream reader | `cargo test --lib loom_stream::` | **24 passed** |
| Focused persistence | `cargo test --lib knowledge::` | **13 passed / 1 ignored** |
| Preview smoke | `vite preview` + `curl /` | HTTP 200, title `Loom — Human-Centered Development Environment` |
| Unity recompile | `unity recompile --project-path unity-memory-palace --format json` | **BLOCKED** — `EDITOR_NOT_RUNNING` (exit 12): no Unity Editor running in this environment |
| CheckWorkbench (Play Mode) | `unity command script eval --file Tools/CheckWorkbench.cs` | **BLOCKED** — requires a running Editor with the Pipeline package |

## 5. What was NOT executed, and why

- **Unity recompile + CheckWorkbench Play Mode** — no Unity Editor is
  running in this environment (`unity status` → 0 instances), so both are
  environment-blocked, not code failures. Prior green runs are recorded in
  `docs/DESIGN_PROGRESS.md`.
- **Live `knowledge_sync_from_loom` against the real vault** — the command
  writes into `default_root()` (the checkout's `native-app/Research Vault`,
  QC-16), so running it would mutate real user data. Reconciliation was
  instead verified by the mirror unit tests plus a live read-only shape probe.
- **A live held-tool approve/deny round-trip** — no hook-held tool is
  configured and triggering one is non-deterministic; the route contract is
  verified live and source-confirmed.
- **Provider-abort latency on Stop** — cooperative cancellation is
  code-traced and unit-tested; the provider's actual abort latency is
  provider-dependent and not measured.

## 6. Decisions taken

- No source changes were needed: the three phases verified correct as-is
  (the approval route fix already landed in `de3b4fc`). Reason: the task is a
  verification trace, and the live probes confirm the code is correct.
- Committed only this report and the new evidence files, not the pre-existing
  untracked audit corpus. Reason: prior audit explicitly preserved that corpus
  outside its commits (§10 of `12-current-state-recheck.md`).
- Marked Unity recompile / CheckWorkbench as blocked rather than forcing a
  batch Editor. Reason: no running Editor is available and starting one is
  out of scope for an unattended contract trace.

## 7. Evidence files

- `evidence/live-chat-stream-probe.mjs` / `.txt` — full streaming weave
  transaction (request, head, 4 SSE events with latency, completion + cost).
- `evidence/live-session-reuse-probe.mjs` / `.txt` — two-turn session reuse
  (snake_case `session_id`, conversationCount 2 → 4).
