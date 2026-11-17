# 12 — Current-state recheck (2026-11-15, evening pass)

> This document is a **recheck of the merged master audit** against the
> current HEAD, produced under the project-specific audit requirements:
> classify every existing finding at the current commit, separate
> responsibility from integration status, trace enforcement to the
> runtime, preserve the evidence hierarchy, protect user data, and hand
> back an IDE-only remediation plan. It creates no new issue IDs — every
> classification reuses the existing IDs from `10-issues/` and
> `10-implementation-issues/` — and it does not change production code.

**Audited commit:** `f7217bc` ("docs: specify unattended IDE-only
implementation workflow"), branch `tauri-prototype`, repo
`/home/ed/loom-ide-tauri`. Audited source baseline for the prior audit:
`b1f16bd` (docs at `7f65bfc`). Loom side (read-only): `/home/ed/work/loom`
@ `ab46f76f`, v1.4.0 — **unchanged** from the master audit.

## 1. What changed since the audited baseline

`git diff b1f16bd..HEAD` is small and fully reviewed. Non-document source
changes (4 files, 4 insertions / 4 deletions):

| Commit | File | Change | Regression review |
|---|---|---|---|
| `b4c74bf` | `src-tauri/src/loom_stream.rs` | Stream request line now sends `Host: {addr}` instead of the hardcoded `localhost:5006` | Correct fix; matches the unary reader. Does not touch body framing — issue 017 unaffected. No regression found. |
| `b0ffb56` | `src/main.ts` | Kanban source label now states full task migration (decided) instead of "open decision" | Text-only; now consistent with decision 6 in `docs/DECISIONS.md`. Aligns docs with decisions. |
| `aad1971` | `unity-memory-palace/Assets/Loom/MemoryPalaceController.cs`, `public/spatial-player.js` | Comment corrections (512 px maps, 2× DPR cap) | Comments only; no behavior change. Unity recompile not re-run this pass (no C# logic changed since the prior 0-error/0-warning pass). |

Document commits since baseline: `2caf0b8` (dropped the non-existent
`/v1/skills:bulkImport` from the SSE endpoint list — correct),
`25b6dd2`/`fa9a863` (ten 15 Nov decisions registered; backlog statuses),
`161d682` (§7.3 corrections), `8d917a9` (console-errors claim retired),
`f7217bc` (unattended build-workflow doc). Their audit meaning is in §4.

**No regression detected in any of the three source changes.** No file
deletion, no dependency change, no branch change since baseline.

## 2. Recheck of the `b1f16bd` repairs (per requirement 1)

All three repairs were re-verified in current source, not re-reported
from the baseline:

1. **Streaming request naming (QC-03) — still fixed.**
   `ask_loom_stream` (`loom_stream.rs:96–124`) emits snake_case
   `query`/`session_id`/`agent_id`/`enable_trace`/`context`, matching the
   custom SSE handler's `encoding/json` decoder. The server source now
   pins this contract in a comment (`pkg/server/http.go:430–434`: "Do not
   switch to protojson — that would change the wire format and break
   clients"). Unary stays camelCase (`lib.rs:1741–1761`), the protojson
   gateway contract. Verification level: static source inspection (this
   pass) + wire-verified live probes (baseline). The patched **Rust →
   Tauri → UI path still has no traversing test** — see §7.
2. **Explicit chat completion checking (QC-04) — still partially fixed.**
   `weave_completed` (`loom_stream.rs:302–312`) rejects a non-empty
   `error` and accepts only `stage: 7` / `EXECUTION_STAGE_COMPLETED`;
   EOF without completion returns
   `Err("Loom disconnected before confirming completion.")`
   (`:481–483`). The untested terminal shapes remain untested (see §7).
3. **Clarification acknowledgement decoding (QC-06) — still fixed.**
   `clarification_ack` (`:314–327`) requires `success && accepted`, which
   is the correct proto3 contract (omitted `accepted` means false). Not
   relaxed, per the critique.

## 3. Classification of every existing finding at HEAD

Evidence labels used below (per requirement 4): **S** = static source
inspection (fresh this pass) · **H** = helper/unit test (fresh suites
this pass) · **L** = live backend HTTP probe (read-only, fresh this
pass) · **B** = baseline audit-time live evidence (not refreshed) ·
**U** = unverified.

> **Post-`de3b4fc` recheck (2026-11-16):** this table was authored at
> `f7217bc`. Rows re-verified against HEAD `675fd89` after `de3b4fc`
> landed are updated below (fresh source inspection + suites). Rows still
> marked **STILL PRESENT** were not changed by `de3b4fc` (mostly P0
> transport/autonomy items and Loom-side gaps).

| # | Sev | Finding (ID) | Status at `f7217bc` | Evidence |
|---|---|---|---|---|
| 1 | P0 | Loom gateway exceeds localhost trust boundary (QC-02, issue 011) | **STILL PRESENT** — `ss` shows `looms` listening on `*:5006` and `*:60051`; unauth; wildcard CORS unchanged | S + L (fresh `ss` + health 200) |
| 2 | P0 | Autonomy changes do not constrain Loom execution (QC-01, issue 005) | **STILL PRESENT** — autonomy exists only in local intent/work ceilings (`lib.rs:225–263`); no permission field is sent on either weave path; server has no per-intent permission surface on the weave path | S (both trees, fresh) |
| 3 | P0 | Task boards/kanban disconnected (issue 001, QC-10) | **STILL PRESENT** — fresh `GET /v1/tasks` and `GET /v1/boards` both 404; only `LoomService` is HTTP-registered (`pkg/server/http.go:113`) | L (fresh) + S |
| 4 | P0 | Skills disconnected (issue 002, QC-10) | **STILL PRESENT** — fresh `POST /v1/skills:bulkImport {}` 404 | L (fresh) + S |
| 5 | P1 | Chat stream registration race (issue 016) | **FIXED** at `de3b4fc` — `activeStreams.set(requestId, state)` now runs before `await askLoomStream` (`main.ts:5931–5938`); `chatInFlight` settles exactly once in `finishStream` | S + H |
| 6 | P1 | No chunked-transfer decoding; large events corrupted (issue 017) | **FIXED** at `de3b4fc` — `run_stream` now decodes chunked bodies (`loom_stream.rs:449–497`), enforces `MAX_HEADER/MAX_LINE/MAX_BODY` bounds (`:364–368`), keeps `UntilEof` until real EOF (`:689–692`), and returns a `Result` for an invalid `LOOM_ADDR` (`:1007–1011`) | S + H |
| 7 | P1 | Streamed chat identity (QC-03) | **FIXED** at `b1f16bd`, present at head; UI path **NOT VERIFIED** | S (fresh) + B (wire) |
| 8 | P1 | Failure misreporting (QC-04) | **PARTIALLY FIXED** — error-bearing events, EOF and cancelled/errored partials (cached with a `partial` flag, `main.ts:5622–5686`) handled; the reader was rebuilt with bounded reads plus chunk/CRLF/mid-line fixtures (stream suite now 24 tests) | S + H |
| 9 | P1 | Non-chat streams use the wrong protocol (QC-05, issue 003) | **STILL PRESENT** — same reader; gateway NDJSON `{"result":…}` lines hit the catch-all branch and are discarded | S (fresh) |
| 10 | P1 | Clarification acknowledgements (QC-06) | **FIXED** — `success && accepted` | S + H |
| 11 | P1 | Approval cards answer the wrong request store (QC-07) | **FIXED** at `de3b4fc` — approve/deny route through `respond_human_request` → `POST /v1/human-requests/{id}:respond` (`main.ts:5491–5527`); vitest asserts approval cards call `respondHumanRequest` and never `answerClarification` (`hitl-card.test.ts:114`) | S + H |
| 12 | P1 | Agent creation posts a bare config (QC-08) | **FIXED** at `de3b4fc` — `agent_create` now wraps the body as `{"config": …}` (`loom_http.rs:411`) | S |
| 13 | P1 | Context pack never reaches agent chat (QC-09) | **STILL PRESENT** — IDE sends `context` on both paths (`lib.rs:1748–1752`, `loom_stream.rs:110–114`); server's Weave/StreamWeave never read `req.Context` (only `judge_server.go:132,163` reads it, on a different RPC) | S (both trees, fresh) |
| 14 | P1 | Task update/ready/blocked shapes (QC-11) | **PARTIALLY FIXED** at `de3b4fc` — an empty `ListTasksResponse` is now zero tasks, never one blank row (`loom_tasks.rs:76–77`); `loom_task_update` still PATCHes the raw object (`:156–165`), latent behind the 404 | S |
| 15 | P1 | MCP add/test/health decode mismatches (QC-12) | **PARTIALLY FIXED** at `de3b4fc` — an omitted MCP health map is now an empty configuration, not an error; `parse_mcp` still reads top-level fields only (`loom_http.rs:69–107`) | S |
| 16 | P1 | Workflow completion attaches output to wrong work (QC-13, issue 006) | **FIXED** at `de3b4fc` — the work is captured at start (`startedFromWork`, `main.ts:1896`) and passed into `finishWorkflowRun` (`:1922–1940`); the selection is no longer read at completion | S |
| 17 | P1 | Work evidence/provenance vanish on restart (QC-14, issue 006) | **PARTIALLY FIXED** at `de3b4fc` — execution↔work ownership maps now persist to the app store (`saveOwnershipMap`, `main.ts:1938–1939`) and chat runs are written at send and settled by id; provenance-kind chains remain local | S |
| 18 | P1 | Model switching omits provider/owner (QC-21) | **FIXED** at `de3b4fc` — `switchModel(detail.id, detail.agent_id, picked?.provider, …)` (`main.ts:4675`) and the result reads `res.newModel ?? res.new_model` (`:4681`) | S |
| 19 | P1 | App creation sends HTML to a spec API (QC-22) | **FIXED** at `de3b4fc` — `createApp` now submits a declarative `UIAppSpec` with a catalog-validated `text { content }` component (`main.ts:4184–4197`) | S |
| 20 | P1 | Trace ids never returned (issue 004) | **STILL PRESENT** — `WeaveResponse.TraceId` unset on the weave path (set only in `pkg/evals`); UI trace button exists but is unreachable in practice | S (both trees, fresh) |
| 21 | P2 | Artifact search can show an older query's results (QC-15) | **STILL PRESENT** — debounce exists (`main.ts:4594–4604`), no out-of-order guard | S |
| 22 | P2 | Vault path compiled into the checkout (QC-16) | **STILL PRESENT** — `env!("CARGO_MANIFEST_DIR")` at `knowledge.rs:72,1093` and `spatial.rs:60` | S |
| 23 | P2 | Changing sessions leaks live subscriptions (QC-17) | **STILL PRESENT** — `sessionSubscribe` (`main.ts:2084`) still has no cancel on session change; subscription ids are now generation-unique (`de3b4fc` #12, A→B→A safe) but the old subscription is not torn down | S |
| 24 | P2 | Vault signature misses relation-only edits (QC-18) | **STILL PRESENT** — `knowledge_signature` unchanged | S |
| 25 | P2 | Canvas layout persistence can lose positions (QC-19) | **FIXED** at `de3b4fc` — a failed layout load blocks automatic persistence until explicit recovery and auto-save pauses (`knowledge.ts:61–100`) | S |
| 26 | P2 | Feature docs contradict the shipped architecture (QC-20, issue 015) | **PARTIALLY FIXED** — see §4 for what landed and the residues | S |
| 27 | P2 | Newest-session adoption heuristic (issue 007) | **PARTIALLY FIXED** at `de3b4fc` — HITL answers use the request's authoritative session (`st.sessionId ?? activeStreamSessionId`, `main.ts:5479`) and run records carry `st.sessionId`; a newest-session fallback may remain in other ownership paths | S |
| 28 | P2 | Chat replies carry no evidence-kind label (issue 008) | **PARTIALLY FIXED** at `de3b4fc` — chat replies now state transport provenance ("Live — answered by the Loom server") and show an evidence-kind label only when a kind actually exists (`main.ts:5256–5266`); no kind is invented | S |
| 29 | P2 | MCP edit silently re-enables the server (issue 009) | **STILL PRESENT** — the edit path now correctly calls `updateMcpServer` (no duplicate), but it passes `enabled: true` unconditionally (`main.ts:4143`); no enabled toggle in the dialog | S |
| 30 | P2 | No CSP for the webview (issue 010) | **STILL PRESENT** — `"csp": null` in `src-tauri/tauri.conf.json` | S |
| 31 | P2 | 18 bridges with no UI call site (issue 012) | **STILL PRESENT** — no command inventory change since baseline; spot-check: `getTrace` reachable only from a button that never appears (`main.ts:4969–4974`) | S |
| 32 | P3 | Slot origin (issue 013), error-caption conflation (issue 014), `LOOM_ADDR` parse panic (issue 017 note) | **FIXED** (`de3b4fc` + coherence passes) — both readers assert `X-Loom-Slot-Origin: interactive` (`loom_stream.rs:1028–1029`, `lib.rs:1928–1934`); error captions now distinguish a disconnection from a validation rejection (`main.ts:5653–5658`); an invalid `LOOM_ADDR` returns a `Result`, not a panic (`loom_stream.rs:1007–1011`) | S |

**Regressions: none found.** **New issues: none** — the only fresh
observation (doc-vs-doc contradiction over the tasks/skills transport,
§4) has the same root cause as QC-20/issue 015 (claims not verified
against gateway registration) and is recorded under those IDs.

## 4. Documentation state (Phase 0 of the roadmap)

- **Landed:** `/v1/skills:bulkImport` removed from the SSE endpoint list
  (`2caf0b8`); the console-errors claim retired and the smoke's limits
  stated honestly (`8d917a9`); the kanban label now matches decision 6
  (`b0ffb56`); the §7.3 philosophy corrections (`161d682`).
- **Not landed — the false tasks/skills premise is still in two
  canonical docs.** `docs/DESIGN_PROGRESS.md:92–93` still says "tasks and
  skills are 100% HTTP (no transport decision)"; the rewritten
  `docs/LOOM_CONNECTION_AUDIT.md` "Current state" section repeats "Tasks
  and skills are 100% HTTP". Both contradict the fresh live 404s (§3
  rows 3–4) **and** now contradict `docs/DECISIONS.md` decision 3 (a Rust
  gRPC client, "Loom is not touched") — the docs disagree with each
  other. Phase 0.1 is therefore **not complete**.
- **Not landed — the response-limit claims.** `docs/LOOM_CONNECTION_MODEL.md:63–66`
  still states "16 MB per response … Chunked bodies read to EOF" without
  the unary-only qualifier; the stream reader enforces neither. Phase
  0.2 item 2 is **not complete**.

## 5. Enforcement traces (per requirement 3)

Schema fields do not prove enforcement. Traced to the runtime at Loom
`ab46f76f` (read-only) and the IDE at `f7217bc`:

- **`WeaveRequest.max_rounds` / `timeout_seconds`** (`loom.proto:758,761`):
  the IDE sends **neither** (unary body: `query`, `sessionId`, `agentId`,
  `context`, `enableTrace` — `lib.rs:1741–1761`; stream body identical in
  snake_case — `loom_stream.rs:96–124`). The weave execution path reads
  **neither** (no consumer anywhere in `pkg/` or `internal/` on the weave
  path; the only same-named fields live on the teleprompter config, MCP
  MRTR and workflow HITL gates — different surfaces). Conclusion: these
  fields enforce **nothing** on any IDE path today; server defaults
  apply.
- **`WeaveRequest.context`** (`loom.proto:764`): IDE sends it on every
  chat turn; the gateway decodes it; `Weave`/`StreamWeave`
  (`pkg/server/server.go:133,217`) never read it. The only reader is the
  Judge RPC (`judge_server.go:132,163`). Conclusion: the advertised
  context pack has **zero runtime effect on chat** (QC-09, unchanged).
- **Real enforcement that does exist — turn door and slot bands.**
  `enterTurnDoor` (`pkg/server/weave_dedupe.go`) parks **batch-origin**
  turns FIFO at the `max_active_conversations` ceiling and rejects a full
  queue with RESOURCE_EXHAUSTED; **interactive** turns bypass. Origin is
  client-asserted: the `X-Loom-Slot-Origin` HTTP header, mapped via
  `withHTTPSlotOrigin` (`pkg/server/http.go:340`); **absent header →
  `SLOT_ORIGIN_BATCH`** (the default in `slotOriginFromMetadata`). The
  IDE's readers send no such header (`lib.rs:1236–1239`,
  `loom_stream.rs:356–360`), so **every IDE turn is batch-classified**.
  Latent on this machine (no `llm.max_active_conversations` configured);
  real wherever the door is on. This is issue 013 — a one-line-per-reader
  IDE fix against an existing, supported, enforced Loom contract.
- **Cancellation, five stages** (chat Stop):
  1. *Client stops waiting:* Stop → `cancelLoomStream(activeStreamId)`
     (`main.ts:7434`).
  2. *Signal delivered:* `cancel_loom_stream` sets the per-request
     `AtomicBool` (`loom_stream.rs:131–149`).
  3. *Runtime acknowledges:* `run_stream` re-checks the flag on every
     read wake (20 s read timeout; 30-min cap) and returns
     `Err("Cancelled.")`; the thread then emits terminal
     `kind: cancelled` and drops the socket (`:51–68`).
  4. *Tool actually stopped:* server-side, the HTTP request context is
     cancelled on disconnect; `StreamWeave` derives the turn context from
     `stream.Context()` (`pkg/server/server.go:226`) and returns,
     logging "client disconnected" (`pkg/server/http.go:387–395`); the
     in-flight LLM call receives that cancellation, subject to the
     provider honoring it (provider-dependent latency).
  5. *Side effects:* tool calls and session writes already committed
     before cancellation are **not rolled back**; the IDE has no
     server-side cancel acknowledgement beyond the socket close.
  This is a coherent cooperative-cancellation chain; the unverified
  segment is the provider-abort latency, not the IDE's signal path.

## 6. Responsibility vs. integration status (per requirement 2)

Columns: Loom-implemented · exposed via the **configured supported
interface** (HTTP gateway / gRPC) · called correctly by Quiet Complexity
· decoded and reflected correctly · verified through · repairable
entirely inside Quiet Complexity. Intentionally-local features are marked
as such and are **not** defects.

| Capability | Loom? | Exposed? | Called right? | Decoded/reflected? | Verified | In-QC repair |
|---|---|---|---|---|---|---|
| Chat (stream, SSE) | ✓ | HTTP ✓ | Partial — identity ✓; framing ✗ (017); registration race ✗ (016) | Partial — progress ✓; errors partial (QC-04 residue) | S + H + B wire; UI path **U** | Yes (016/017, QC-05) |
| Chat (unary) | ✓ | HTTP ✓ | ✓ (camelCase protojson) | ✓ | B (live turns) | n/a |
| Sessions CRUD/history/detail | ✓ | HTTP ✓ | ✓ | ✓ | B (live) | n/a |
| Session live subscribe | ✓ | HTTP ✓ | ✓ | ✗ — NDJSON discarded (QC-05); stale subs leak (QC-17) | S + B (live capture) | Yes |
| Agents list/detail/select | ✓ | HTTP ✓ | ✓ | ✓ | B (live) | n/a |
| Agent create | ✓ | HTTP ✓ | ✗ — bare config (QC-08) | ✗ — no review of nested config | S | Yes |
| Artifacts | ✓ | HTTP ✓ | ✓ | ✓, minus search race (QC-15) | B (live) | Yes |
| Patterns list/detail | ✓ | HTTP ✓ | ✓ | ✓ | B (live) | n/a |
| Pattern live updates | ✓ | HTTP ✓ | ✓ | ✗ — NDJSON discarded (QC-05) | S + B | Yes |
| Models list | ✓ | HTTP ✓ | ✓ | ✓ | B (live) | n/a |
| Model switch | ✓ | HTTP ✓ | ✗ — no provider/owner (QC-21) | ✗ — returned model uninspected | S | Yes |
| Tools list | ✓ | HTTP ✓ | ✓ | ✓ | B (live) | n/a |
| Tool register / permission request | ✓ | HTTP ✓ | ✓ (bridged) | ✗ — no UI call site (issue 012) | S | Yes |
| Apps list / component types | ✓ | HTTP ✓ | ✓ | ✓ | B (live) | n/a |
| App create/update | ✓ | HTTP ✓ | ✗ — HTML to a declarative-spec API (QC-22) | ✗ | S | Yes |
| MCP CRUD/test/health | ✓ | HTTP ✓ | Partial | ✗ — mismatched decodes (QC-12); edit re-enables (issue 009) | S | Yes |
| Workflows (templates, execute, stream) | ✓ | HTTP ✓ | ✓ (404 error path verified only) | ✗ — stream payloads discarded (QC-05); attribution race (QC-13) | S + B | Yes |
| Schedules (CRUD, trigger, history, pause/resume) | ✓ | HTTP ✓ | ✓ (bridged) | Partial — executions unverified; cancel has no UI (issue 012) | S | Yes |
| Tasks + boards (kanban) | ✓ | **gRPC ✓, HTTP ✗** (not gateway-registered; fresh 404s) | ✗ — IDE calls HTTP; shapes wrong (QC-11) | ✗ | L (fresh 404) | Transport needs decision 3 (gRPC client) or Loom-side HTTP registration; IDE-side: gate honestly until then |
| Skills import | ✓ | **gRPC ✓, HTTP ✗** (fresh 404) | ✗ | ✗ | L (fresh 404) | Same as tasks |
| Provider A/B | ✓ | HTTP ✓ | ✓ | ✗ — NDJSON discarded (QC-05) | S | Yes |
| Trace lookup | Route ✓ | HTTP ✓ | ✓ (button wired) | ✗ — `TraceId` never populated on the weave path (issue 004) | S (both trees) | No — Loom-side one-liner (Phase 2.4) |
| HITL clarifications | ✓ | HTTP ✓ | ✓ — decode correct (QC-06) | ✓ | S + H | n/a |
| HITL approvals | ✓ (separate request store) | HTTP ✓ | ✗ — wrong store (QC-07) | ✗ | S | Yes (route to the correct endpoint or state unavailable-here) |
| Autonomy → execution | **✗** — no per-intent permission surface | n/a | ✗ — advisory only (QC-01) | Copy overstates enforcement | S (both trees) | IDE copy-truth yes; enforcement needs a Loom contract (decision-gated) |
| Context pack → prompt | Parsed ✓, **consumed ✗** | HTTP ✓ | ✓ (sent) | ✗ — no effect (QC-09) | S (both trees) | Partial (bounded, labeled IDE-side query context) or stop advertising; full effect is Loom-side |
| Evidence (work) | Local | n/a | n/a | Partial — labels real, chains severed (QC-14); chat unlabeled (issue 008) | S | Yes |
| Notes, Code editing, vault, planning | **Intentionally local** (recorded decisions: markdown vault stays the store; Monaco is the Code editor) | n/a | n/a | n/a | S | Not a defect; preserve |

## 7. Evidence hierarchy and verification limits (per requirements 4–5)

- **Fresh this pass:** static source inspection of both trees (every
  cited location re-resolved); all five project suites re-run — vitest
  **63/63** (8 files), `npm run build` ✓, `cargo test --lib` **96
  passed / 2 ignored**, native-app **22 passed**, `cargo fmt --check` ✓,
  focused `loom_stream::` **4 passed / 94 filtered**; read-only live
  probes — `GET /v1/health` **200** (v1.4.0, provider healthy),
  `GET /v1/tasks` **404**, `GET /v1/boards` **404**,
  `POST /v1/skills:bulkImport {}` **404**; `ss` shows `looms` on
  `*:5006`/`*:60051`.
- **QC-04 is NOT fully resolved by helper tests** (per requirement 4):
  the four stream tests exercise helpers (`weave_completed`,
  `clarification_ack`, cancel-of-unknown, input validation) — none
  traverses the request builder, the socket reader, chunk decoding,
  cancellation mid-stream, or Tauri event delivery. The five untested
  terminal shapes (FAILED without error text, malformed frames, errors
  after completion, completion-then-truncation, cancellation near EOF)
  remain open, and no loopback TCP fixtures exist yet.
- **The patched Rust → Tauri → UI path remains UNVERIFIED** end to end:
  no automated or retained test traverses it, and this pass added no UI
  execution evidence. The baseline's HTTP-level wire proof (happy path +
  FailedPrecondition rejection) is **backend-contract** evidence, exactly
  as the critique established.
- **Data protection:** no test turns were added to any existing
  conversation (including `sess_d7f154c9`); no agents, tools, schedules,
  approvals, model switches or migrations were triggered. Live probes
  were read-only GETs plus one POST to a 404 route (route-existence probe
  only — no handler received it), matching the prior audit's method. **No
  disposable isolated backend profile is authorized** under the current
  unattended-workflow rules; therefore no fresh live model execution is
  claimed, and any live-model verification remains an explicitly
  authorization-gated item. No secrets or conversation content appear in
  this document or in evidence.

## 8. IDE-only remediation plan (per requirement 6)

Every item carries its repair class:
**IDE** = IDE-only implementation · **SLI** = requires an existing
supported Loom interface · **EXT** = external capability/configuration
prerequisite · **DEC** = unresolved product decision · **UP** = upstream
(Loom-side) limitation.

### Priority 1 — execution identity and truthful lifecycle (all IDE)

1. **Registration race (issue 016).** Register the reply state (and
   `activeStreamId`) *before* invoking `askLoomStream`; settle
   `chatInFlight` exactly once on every terminal and on invoke
   rejection; unary fallback only when no POST can have been accepted.
   Tests: a vitest invoke stub that emits the terminal before resolving;
   a Rust loopback fixture emitting an immediate terminal.
2. **HTTP body framing (issue 017).** Decode `Transfer-Encoding:
   chunked` (honor Content-Length) before SSE line parsing, with a
   per-stream size bound and a `Result` for invalid `LOOM_ADDR` —
   reusing the `loom_http_raw` seam (`lib.rs:1217–1328`). Fixtures:
   content-length body, chunk-split event > 2048 bytes, trailers, empty
   chunk, truncated mid-chunk.
3. **NDJSON dispatch (QC-05/issue 003)** on the decoded-body seam: parse
   gateway `{"result":…}` lines alongside SSE `data:` per endpoint.
   Unblocks workflow/session/pattern/A-B live updates. (SLI: the gateway
   NDJSON streams are the existing supported interface.)
4. **QC-04 residue:** terminal-shape fixtures (FAILED-without-error-text,
   malformed frames, completion-then-truncation, cancellation near EOF)
   plus partial-output draft rules (never overwrite a newer human draft;
   cache partial replies as partial). **IDE**
5. **Slot origin (issue 013):** send `X-Loom-Slot-Origin: interactive`
   on chat weave requests (both readers) so human turns bypass the door
   and ride the interactive band; background syncs stay batch. One line
   per reader against an enforced, supported contract. **IDE + SLI**

### Priority 2 — human control and accurate capability boundaries

6. **Autonomy truth (QC-01):** adjust copy to state exactly what the
   local ceiling governs; inventory every consequential entry point;
   record the exact runtime/approval contract Loom would need (including
   tightening active runs). No invented privilege mapping. **IDE +
   DEC** (server-side enforcement contract)
7. **Approvals (QC-07):** route to the correct request-store endpoint
   once its contract is confirmed, else render an explicit
   unavailable-here state with inspectable context. Keep QC-06 exactly
   as fixed. **IDE + SLI**
8. **Tasks/skills surfaces (issues 001/002):** gate the kanban and
   Skills shelf behind a live probe with the honest gRPC-only state
   until the transport exists. The transport itself: decision 3 (Rust
   gRPC client, Judge first) is the recorded direction — dependency-gated
   per the standing rule; Loom-side HTTP registration is the
   alternative. **IDE (gate) + DEC (transport) + EXT (gateway
   registration if chosen)**
9. **Deployment posture (QC-02):** loopback bind or auth — **EXT**
   (Loom-side configuration; outside the IDE's write scope). The IDE
   must not assume a trust boundary the server does not hold. Documented
   as a blocker until authorized.

### Priority 3 — existing management-contract repairs (all IDE)

10. Agent create wraps `{"config": …}` (QC-08); model switch supplies
    provider + authoritative owner and inspects the returned effective
    model (QC-21); app creation submits a declarative `UIAppSpec`
    (QC-22); task update/ready/blocked shapes fixed behind the gate
    (QC-11); MCP contract decodes merged (QC-12); MCP edit preserves the
    enabled state (issue 009).

### Priority 4 — durable execution/evidence relationships

11. Persist execution↔work attribution with backward-compatible fields
    and atomic writes (QC-14); capture the originating work at workflow
    start and never read the selection at completion (QC-13); add
    evidence-kind labels to chat replies (issue 008). Trace links land
    after Priority-2 item 8's Loom one-liner (`WeaveResponse.TraceId =
    span.TraceID`) — **UP** for the field population.

### Priority 5 — real cost and decision-context visibility

12. Surface cost/context from completed turns where already carried;
    make the status pill distinguish transport verification from turn
    outcome (post-fix evaluation residual 5); fix the "Could not reach
    Loom"/"stopped answering" caption conflation (issue 014); state the
    context pack's true effect until QC-09 is decided (IDE honesty +
    DEC).

### Priority 6 — local persistence and recovery (IDE, one decision-gated)

13. Cancel stale session subscriptions (QC-17); newest-session adoption
    guards (issue 007); vault root from app-data instead of
    `CARGO_MANIFEST_DIR` (QC-16 — **DEC**: the packaged-vault decision);
    signature coverage for relation-only edits (QC-18); atomic canvas
    layout writes with visible load/save errors (QC-19).

### Priority 7 — optional structural improvements

14. CSP for the webview (issue 010); surface the bridged-but-unused
    commands or remove the dead wiring (issue 012); finish the Phase-0
    doc corrections (§4: the tasks/skills premise in
    `DESIGN_PROGRESS.md` and `LOOM_CONNECTION_AUDIT.md`, and the
    unary-only qualifier on the `LOOM_CONNECTION_MODEL.md` response
    limits).

No item proposes new infrastructure, new dependencies, a framework
change, a rebuild, or moving user data. Existing adapters, stores,
dialogs and the unary reader's chunked-body seam cover every IDE-side
repair.

## 9. Recorded product decisions — preserved (per requirement 7)

This pass changed nothing and proposes nothing that conflicts with the
recorded decisions: vanilla TypeScript, Rust/Tauri, Monaco and Unity are
untouched; the sphere and its state semantics are untouched; Q2 remains
deferred as decided (decision 4 records the static panel as a future
implementation); manual offline work, the markdown vault and its location
are untouched; no autonomy-level privileges were invented; no permanent
dashboard controls for costs/limits are proposed — cost and
decision-context visibility stays contextual in the surfaces that
already carry it.

## 10. Write boundary and commit statement (per requirement 8)

- **Tracked changes:** this document is the only tracked file added or
  modified by this audit. It is committed **locally** (no push, no
  branch change, no history rewrite).
- **Generated output (allowed, untracked/gitignored):** `dist/` from
  `npm run build`; `src-tauri/target/` and `native-app/target/` from the
  Rust suites; vitest's cache under `node_modules/.vitest`. No generated
  file is staged.
- **No source, configuration or user-data mutation** was performed; the
  no-fix instruction governs this pass, so any future failing check would
  be recorded rather than repaired. All five suites passed at HEAD, so
  no failure had to be recorded.
- **Pre-existing untracked work** (the merged audit corpus and the
  owner's parallel edits) is preserved and deliberately excluded from the
  commit; only this file is staged.
- **Local documentation commits are permitted** for audit documents,
  consistent with the prior audit (docs committed at `7f65bfc`) and the
  current unattended-workflow rules (local commits authorized; pushes
  are not).

## 11. Summary

> **Post-`de3b4fc` recheck (2026-11-16):** the counts below are the
> `f7217bc` snapshot. `de3b4fc` (and the coherence passes through HEAD
> `675fd89`) closed or narrowed 16 of the §3 findings (rows 5, 6, 8, 11,
> 12, 14, 15, 16, 17, 18, 19, 23, 25, 27, 28, 32); see the updated rows
> above for the current status.

Head `f7217bc` is the audited baseline plus three cosmetic/small fixes
and doc commits — **no source change since `b1f16bd` closes or reopens
any audit finding**. Of the 32 merged findings: **3 FIXED** (QC-03,
QC-06 fully; QC-04 partially), **29 STILL PRESENT** (including both P1
transport defects 016/017 re-verified at source, and the tasks/skills
404s re-confirmed live), **0 REGRESSED**, and the patched Rust → Tauri →
UI path remains **NOT VERIFIED** (no loopback fixtures, no authorized
disposable profile). The documentation pass partially fixed QC-20/issue
015 but left the refuted tasks/skills premise in two canonical docs and
now contradicts `DECISIONS.md` decision 3. The highest-value work
remains exactly where the merged roadmap put it: Phase 1 transport
trustworthiness (IDE-only), then the control boundaries — with the new
precision that the server's door admission and slot bands are real,
enforced mechanisms the IDE can honor today with a one-line header.
