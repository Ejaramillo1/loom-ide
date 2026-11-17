# 07 — Security, Reliability, and Performance

## 1. Security

### 1.1 Boundaries (IDE)

| Boundary | Mechanism | Verdict |
|---|---|---|
| Tauri capabilities | `capabilities/default.json`: `core:default` only — no shell/fs/http plugins | ✅ minimal |
| Workspace file access | `workspace.rs`: canonicalize + prefix containment, 1 MB cap, UTF-8-only, binary NUL rejection, atomic temp+rename, original-content optimistic concurrency | ✅ exemplary |
| Command argument hygiene | ids percent-encoded; names validated; file names reject separators/control chars | ✅ |
| XSS | chat/knowledge/patterns render via `textContent`; `escapeHtml` where innerHTML carries data; only static SVG markup in `addChatMessage` | ✅ no live XSS path found |
| Unity bridge | origin + source validation on both sides; retired channels ignored; payloads type-checked | ✅ |
| Secrets | no credentials/keys/tokens in the IDE source (scan clean); Loom contacted unauthenticated on loopback by design (registered decision) | ✅ for the local model |
| CSP | **`"csp": null`** in `tauri.conf.json` — no CSP for a webview embedding a Unity iframe and Monaco workers | ❌ issue 010 |
| Dev proxy exposure | vite preview binds localhost:1420 only | ✅ |

### 1.2 Boundaries (Loom server, environmental)

- The live server binds **`0.0.0.0:5006` / `0.0.0.0:60051`** with no
  authentication, and the parallel audit additionally observed **wildcard
  CORS** on the HTTP gateway (QC-02). Any network host can weave chats,
  read artifacts, drive tools, and mutate sessions. The IDE's localhost
  trust model is documented, but the *server* exceeds it. **Issue 011 /
  QC-02 (P0 environmental).**
- `X-Loom-Slot-Origin` is client-asserted; the IDE never sends
  `interactive`, so its turns ride the batch band under door admission.
  **Issue 013.**

## 2. Reliability

### 2.1 What is right

- Honest failures on the unary path: no fabricated replies; non-2xx
  surfaces the server message; empty responses error; failed sends
  restore the draft; partial-stream markers on Stop.
- Idempotency posture: GET-only retry, POSTs never replayed.
- Concurrency: optimistic file saves with original comparison; lock-order
  discipline; request-sequence tokens; in-flight dedupe sets; render-only
  selects.
- Resource limits: 16 MB response cap (**unary reader only** — the
  stream reader has no size bound, issue 017), 30-min stream cap, 1 MB
  file cap, 5 × 1.5 s poll cap, 4 MB chat-cache budget.
- Connection model implemented as documented and live-observed
  (verified/unverified pill states, re-probes).

### 2.2 Defects (merged; full files in `10-issues/` and `10-implementation-issues/`)

| # | Defect | Location | Impact |
|---|---|---|---|
| 016 | **Registration race:** reply state registered after `await askLoomStream` whose Rust side already spawned the emitting thread; early events discarded; a dropped terminal event leaves the chat busy forever | `main.ts:5346-5409` (await at 5371, set at 5404), `:5043-5045`; `loom_stream.rs:33-70` | Primary chat path can strand with an empty bubble and no Stop (P1, confirmed) |
| 017 | **No chunked-transfer decoding:** stream reader parses raw socket lines; events > ~2 KB split mid-payload across chunks (Go SSE handler writes chunked) → corrupted/dropped events, false "disconnected before confirming completion"; no stream size bound; `LOOM_ADDR` parse panic | `loom_stream.rs:341-460`; decoder exists only in `lib.rs:1217-1328`; `pkg/server/http.go:430-465` | Primary chat path and all six other streams (P1, confirmed) |
| QC-03 | ~~Streamed chat drops session/agent~~ **FIXED at `b1f16bd`**: snake_case `session_id`/`agent_id`/`enable_trace`; HTTP probes show identity honored + owner-mismatch rejected. UI path not end-to-end tested | `loom_stream.rs:85-125`; `pkg/server/http.go:324` | Resolved in code (wire-verified, partial UI verification) |
| QC-04 | ~~Failed/truncated streams reported as completed~~ **PARTIALLY FIXED at `b1f16bd`**: `weave_completed` requires explicit completion and surfaces `error`; EOF-without-completion errors. FAILED-without-error, malformed frames, truncation-after-completion untested | `loom_stream.rs:302-312,481-483`; `pkg/server/http.go:467` | Remaining terminal shapes can still misreport (P1, partial) |
| QC-06 | ~~Clarification answers always fail decoding~~ **FIXED at `b1f16bd`**: requires `success && accepted` (correct under proto3 bool defaults; do not relax) | `loom_stream.rs:314-327`; `loom.proto:1370` | Resolved (unit-tested) |
| QC-07 | Approval cards answer the wrong Loom request store (clarifications vs the approval store's `RespondToRequest` handle) | `main.ts:5127`; `loom.proto:868` | Approvals may never reach the hold (strongly supported) |
| QC-08 | Agent creation posts a bare config; `CreateAgentRequest` expects `{"config": …}` | `loom_http.rs:278-291`; `loom.proto:2054` | Agent creation cannot work (P1) |
| QC-22 | App creation sends `{name, html}`; `CreateUIAppRequest` is a declarative spec | `main.ts:3962`; `apps.proto:113` | App creation cannot work (P1) |
| QC-21 | Model switch sends only `model`, omitting `provider`/`agent_id` | `main.ts:4420`; `loom.proto:2439` | Switch may misroute with multiple providers (P1) |
| QC-09 | The context pack never reaches agent chat (`req.Context` unused in the weave handler) | `main.ts:4867`; `multi_agent.go` (grep) | The advertised context feature is inert (P1) |
| QC-11 | Task update / ready / blocked payloads use incompatible message shapes | `loom_tasks.rs`; `task.proto` | Surface fails even after registration (P1) |
| QC-12 | MCP add/test/health decode different response contracts as one server row | `loom_http.rs:69-107` | MCP panel shows wrong/blank data (P1) |
| QC-13 | Workflow completion attaches output to the work selected *at completion*, not at start | `main.ts:1914` | Evidence on the wrong work item (P1) |
| QC-14 | `executionWorkIds`/`experimentWorkIds` are in-memory | `main.ts:291-292` | Attribution lost on restart (P1) |
| QC-17 | Changing sessions leaks live subscriptions (old stream never cancelled) | `main.ts:1984-2005` | One dead stream per session change (P2) |
| QC-15 | Artifact search has no request token; older responses can overwrite newer ones | `main.ts:4595-4617` | Stale results (P2) |
| QC-16 | Vault root compiled to the checkout via `env!("CARGO_MANIFEST_DIR")` | `knowledge.rs:72-75` | Packaged app reads the repo's vault (P2) |
| QC-18 | Vault change signature misses relation-only edits | `knowledge.rs` signature | External edge edits not refreshed (P2) |
| QC-19 | Canvas layout save is debounced and can lose positions on close | `knowledge.ts:67-73` | Silent layout loss (P2) |
| 006a | Workflow error message nulls `runningWorkflow` before use → `Workflow "" failed` | `main.ts:1890-1893` | Error loses the name (P3) |
| 007 | Newest-session adoption race (compounded by QC-03) | `main.ts:5036-5039` | Wrong session binding (P2) |
| 009 | MCP edit hardcodes `enabled: true` | `main.ts:4144,4148` | Disabled servers silently re-enabled (P2) |
| 013 | Batch slot origin for human turns | `lib.rs:1235` | Queueing under door admission (P3) |
| — | No cap on concurrent streams/threads | `loom_stream.rs` | Low (user-triggered) |

## 3. Performance

- Startup: ~5.3 MB gzip frontend (Monaco 1.07 MB gzip) + 25.5 MB wasm.
  Unity startup dominates; loading UI measured and shown.
- Runtime: only the 3 s vault-signature poll and 10 s offline re-probe;
  streams push rather than poll; all Loom I/O is `spawn_blocking`
  (UI thread never blocked) in the Tauri app. (The legacy native-app
  still blocks its UI thread — documented legacy.)
- Unity: DPR cap 2×, quality tiers (renderScale/MSAA budgets, SSAO/bloom
  off on Low), reduced-motion pauses particles/orbit, IL2CPP OptimizeSize,
  data caching on.
- Memory: 16 MB per-response cap; per-event stream payloads; 4 MB chat
  cache; on-demand artifact content cache.
- Network: one TCP connection per request (`Connection: close`) — fine at
  desktop rates; notable only under batch sync.

## 4. Prioritized risk list

1. **P0** — Unenforced autonomy: the control dial maps to no server-side
   permission (QC-01, issue 005) — the flagship human-control concept is
   advisory.
2. **P0** — LAN-exposed unauthenticated Loom with wildcard CORS (QC-02,
   issue 011).
3. **P1** — Untrustworthy stream transport on the primary path: the
   registration race (issue 016) and undecoded chunk framing (issue 017).
4. **P1** — Remaining failure-truth gaps (QC-04 untested terminal shapes)
   and NDJSON discards (QC-05/issue 003).
5. **P1** — HITL approval routing (QC-07) and wrong request shapes on
   management surfaces (QC-08/21/22, QC-11/12) and the inert context pack
   (QC-09).
6. **P2** — Attribution/race/leak/persistence defects (QC-13/14/15/17/18/19,
   issues 006/007/009/012).
7. **P2** — CSP absent (issue 010); vault path compiled in (QC-16).
8. **P3** — Wording/copy issues (006a, 013, 014, 015), `LOOM_ADDR`
   parse panic (with issue 017).
