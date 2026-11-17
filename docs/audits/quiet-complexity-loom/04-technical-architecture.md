# 04 — Technical Architecture Audit

## 1. Component map (verified)

```text
┌────────────────────────────  Tauri desktop app (com.loom.ide)  ────────────────────────────┐
│                                                                                             │
│  index.html (modes: spatial/experiment/work/code/agents/artifacts/knowledge)                │
│  src/main.ts        UI shell, all feature handlers (7477 lines, vanilla TS, no framework)   │
│  src/api.ts         invoke() bridge + browser fallback + typed contracts                     │
│  src/knowledge.ts   Knowledge rail: vault, graph, canvas, patterns, skills                  │
│  src/spatial.ts     Unity iframe bridge (origin-checked postMessage)                        │
│  src/sphere.ts, loom-state.ts, theme.ts, monaco.ts, app-menu.ts                             │
│  public/spatial-player.html/js   Unity WebGL host page (same origin)                        │
│                                                                                             │
│  ── Tauri command layer (Rust, src-tauri/src/) ──                                           │
│  lib.rs             state stores + sessions/agents/workflows/artifacts/tools/models/        │
│                     providers/traces/server-info/workspace + loom_request (raw HTTP)        │
│  loom_stream.rs     SSE consumer → Tauri events; per-request cancel flags                   │
│  loom_http.rs       MCP/agents/presets/patterns/apps/schedules/skills/tools/admin/sessions  │
│  loom_tasks.rs      boards + tasks (all dead at runtime — issue 001)                        │
│  store.rs           Work/Intent/Experiment JSON stores (app-data/loom-ide/*.json)           │
│  knowledge.rs       markdown vault + one-way Loom sync                                      │
│  workspace.rs       confined workspace file I/O (atomic, optimistic concurrency)            │
│  shared/navigation.rs  single-instance claim (loopback socket)                              │
│                                                                                             │
└───────────────────────────────┬─────────────────────────────────────────────────────────────┘
                                │ raw TCP HTTP/1.1 (Connection: close), localhost:5006
                                │ + streaming: Accept: text/event-stream
┌───────────────────────────────▼─────────────────────────────────────────────────────────────┐
│  Loom server (looms serve, v1.4.0)                                                          │
│  pkg/server/http.go     gateway mux: LoomService only + custom /v1/weave:stream SSE        │
│  grpc-gateway v2.33     JSONPb (camelCase, string int64s, base64 bytes)                    │
│  pkg/server/multi_agent.go   Weave / StreamWeave / agent loop / orchestrator               │
│  pkg/agent/*            agents, sessions, park-and-resume holds, permission checker        │
│  pkg/shuttle/*          tools, registry, admission chain                                    │
│  pkg/orchestration/*    workflow builders, HITL gates                                       │
│  pkg/task/*             TaskService (gRPC-only at runtime)                                  │
│  pkg/observability/*    tracers, spans (embedded SQLite)                                    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Separation of concerns — good

- Three data sources are kept strictly separate and documented as such in
  `lib.rs` module docs: (1) local structured work (`work.json`,
  `intents.json`, `experiments.json`), (2) Loom server state (sessions,
  agents, artifacts, chat), (3) the markdown vault. Nothing cross-migrates
  silently.
- The frontend has exactly one bridge file (`api.ts`); every backend
  command has one wrapper; the browser preview has an explicit, honest
  fallback (localStorage + dev proxy) and refuses Tauri-only commands.
- Rust ↔ TS contracts are typed on both sides; the Rust structs carry the
  gateway-compat burden (aliases, `de_i64`, base64 decoding) so the
  frontend stays clean.

## 3. The raw-HTTP client (loom_http_raw / loom_request)

Strengths (all code-verified, several live-verified):

- 2 s connect / 5 s write / 4 s GET / 180 s POST read timeouts; total
  deadline rather than per-read; 16 MB response cap; chunked bodies
  decoded; content-length early exit.
- GET-only single retry after 500 ms; POSTs never replayed (idempotency
  honesty).
- Status checked before JSON parse; non-2xx error bodies surface the
  server's `message`; `LOOM_ADDR` env override.
- Path/query percent-encoding for interpolated ids.

Weaknesses:

- No keep-alive: every request opens a new TCP connection (`Connection:
  close`). Fine for a desktop tool; costs a handshake per call.
- The client never sends `X-Loom-Slot-Origin: interactive`, so IDE turns
  ride the server's **batch** scheduling band when door admission is
  enabled (issue 013).
- Two error envelopes exist on the live gateway (unary routes:
  `{"code":5,"message":...}`; streamed routes: `{"error":{"code":5,...}}`);
  the stream path's message extraction misses the nested form and falls
  back to a raw snippet (cosmetic).

## 4. Streaming subsystem (loom_stream.rs)

- One generic SSE consumer for 7 endpoints; per-request cancel flags;
  terminal event always emitted (done/error/cancelled); non-JSON chunks
  counted and reported; non-2xx bodies surfaced; 30-min global cap;
  heartbeat-friendly 20 s wake.
- **Fixed at `b1f16bd`:** the weave stream sends snake_case
  `session_id`/`agent_id`/`enable_trace`; `weave_completed` requires an
  explicit successful terminal (stage 7 / `EXECUTION_STAGE_COMPLETED`)
  and surfaces a non-empty top-level `error`; EOF-without-completion is
  an error on the weave stream. The unary path keeps camelCase — the two
  wire formats are now correctly separated. Verification is HTTP-level
  plus helper tests; the Rust → Tauri → UI path is untested end to end
  (critique §1–2).
- **Defect (confirmed, issue 017):** the parser reads the **raw socket**
  through `BufReader::lines()` — HTTP body framing is never decoded.
  The Loom SSE handler writes one `Fprintf`+`Flush` per event through Go
  `net/http`, i.e. chunked transfer encoding; events larger than the
  server's ~2 KB response buffer are split mid-payload across chunks and
  the JSON line is corrupted. A split completion event turns a
  successful turn into a false "disconnected before confirming
  completion". The chunked decoder and 16 MB cap exist **only** in the
  unary reader (`lib.rs:1217-1328`) — the in-tree seam to reuse. Also:
  `addr.parse().unwrap()` panics the reader thread on an invalid
  `LOOM_ADDR` (`loom_stream.rs:342`).
- **Defect (confirmed, issue 016):** `start_loom_stream` spawns the
  reader thread and returns immediately; the frontend registers the
  reply state only **after** awaiting the invoke
  (`main.ts:5371 → 5404`). Events emitted before registration (including
  a fast terminal error when Loom is down) are silently discarded by
  `handleStreamEvent` (`main.ts:5043-5045`); a dropped terminal event
  leaves `chatInFlight` stuck and the chat busy forever.
- **Defect:** the parser is SSE-only (`data:` lines). Five of the seven
  endpoints are gateway-streamed RPCs that emit NDJSON
  `{"result": {...}}` lines. Every payload from those streams is silently
  discarded (issue 003). Verified empirically against the live subscribe
  stream. Fixes land on the same decoded-body seam as issue 017.
- Thread-per-stream model: acceptable for a desktop client, but there is
  no cap on concurrent streams (a user can spawn unbounded threads +
  TCP connections). Low severity.

## 5. Local state stores (store.rs, experiment.rs, workspace.rs)

- Work/Intent/Experiment JSON in the app-data dir with atomic writes,
  versioned intents (history snapshots), autonomy history, acceptance
  criteria.
- Lock-order discipline documented and enforced (intents before work) to
  avoid deadlocks; auto-created intent rollback on failed work creation.
- Autonomy rules: ceiling from intent, justification required to raise,
  instant lowering, auto-tighten cascade on intent change — implemented
  and tested.
- Workspace file I/O: canonicalize + prefix check, 1 MB cap, UTF-8-only,
  binary rejection, optimistic-concurrency save (original-content
  comparison), atomic temp+rename. This is exemplary desktop-app file
  hygiene.
- In-memory attribution maps (`executionWorkIds`, `experimentWorkIds`)
  are volatile — evidence-to-work links die on restart (issue 006).

## 6. Frontend state management

- Module-level state with render functions (no framework) — consistent
  with the project constraints. Render-only selects (never mutate
  selection on render), request-sequence tokens against stale async
  responses, in-flight dedupe sets for toggles, debounced saves and
  searches.
- Race defects found: streamed workflow attribution uses the *current*
  selection at completion; streamed chat adopts the *newest* session
  (issues 006, 007).
- Chat cache: per-work localStorage with 4 MB budget pruning — pragmatic;
  the server history remains the source of truth when uncached.

## 7. Contract layer

- Verified against `proto/loom/v1/loom.proto` and live responses:
  camelCase aliases, `de_i64` string-int64 tolerance, two-layer base64,
  empty-object list handling, the `{"artifact":{...}}` / `{"app":{...}}`
  wrappers, snake_case SSE fields.
- Regression tests in `gateway_tests.rs` + `lib.rs` tests encode the
  gateway shapes; the live gateway test passed against the running server
  during this audit.
- Gaps: no schema-level code generation (structs are hand-maintained) —
  acceptable for this surface, but the 7x7x7 tasks/skills premise shows
  what happens when contracts are read from protos alone without checking
  server registration (issues 001/002).

## 8. Duplication and dead surface

- 18 API wrappers with no UI call site (issue 012): some are redundant
  (pause/resume schedules — the UI uses PATCH), most correspond to
  features with no UI (task decompose/dependencies/ready/blocked/context,
  tool permission request, app update, schedule execution cancel, single
  schedule/board/task/app get).
- `native-app/` (egui "Living Workbench") is a preserved legacy prototype
  with its own Loom adapter and blocking I/O. It is not part of the Tauri
  product path; its known gaps (no session identity, discarded context
  pack, UI-thread blocking) remain as documented in
  `docs/LOOM_CONNECTION_AUDIT.md`. Recommendation: keep as reference, do
  not extend; if it stays in-tree, label it `legacy` in its README.
- Two "experiment" concepts (local JSON vs vault notes) intentionally
  share a name — documented in DECISIONS.md, mildly confusing.

## 9. Maintainability

- Strong: focused modules, honest comments that explain *why* (e.g. the
  SSE-vs-protojson comment in loom_stream.rs, the de_i64 doc, lock-order
  notes), tests colocated, docs/ as a living decision registry.
- Weak: `main.ts` at ~7.5k lines is the whole UI; the audit found two
  defects that a smaller surface would have made obvious (nulled-before-
  use name, wrong work id). No framework is a constraint, not an excuse:
  feature modules per view would keep the current stack.
- Doc drift: DESIGN_PROGRESS/7x7x7 claim tasks/skills "100% HTTP" (false);
  philosophy citations point at `documentation/...` paths that moved to
  `docs/...`; `LOOM_CONNECTION_AUDIT.md` banner cites DESIGN_PROGRESS and
  LOOM_CONNECTION_MODEL that exist now but were missing at audit time.

## 10. Structural weaknesses ranked

1. **Trust-the-proto fallacy** — capabilities were implemented from proto
   annotations without checking the running gateway (P0, issues 001/002).
2. **Unenforced control and an exposed runtime** — the autonomy dial maps
   to no server-side permission (P0, QC-01/issue 005) and the live
   gateway exceeds the localhost trust boundary (P0, QC-02/issue 011).
3. **Untrustworthy stream transport** — raw-socket line parsing with no
   chunk decoding (P1, issue 017) and request state registered after the
   emitting thread starts (P1, issue 016); both on the default chat path.
4. **One-size-fits-all streaming** — SSE parser used for endpoints that do
   not speak SSE (P1, issue 003).
5. **Local control semantics presented as execution control** (P1, issue
   005).
6. **Volatile attribution** (P2, issues 006/007).
7. **Dead surface area** (P2, issue 012).
