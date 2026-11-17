# 16 — Gateway containment: loopback-only Loom + browser-origin policy

> Owner-directed work order (2026-11-17): make Loom reachable only from
> this computer, then restrict browser access without breaking the IDE.
> Follows the recorded decision: **localhost only, no client
> authentication**; remote authenticated deployment stays a separate work
> item. Loom **source** changes remain outside the write boundary —
> everything below is config on this machine, or a *prepared* patch
> (unapplied) with its tests.

## 1. Baseline (recorded 2026-11-17 ~18:35 UTC)

| Item | Value |
|---|---|
| IDE revision | `/home/ed/loom-ide-tauri` @ `65f82bb` (`tauri-prototype`) |
| Loom source revision | `/home/ed/work/loom` @ `8082078` (`main`, ahead 1) |
| Running binary | `/home/ed/.local/bin/looms`, 110,834,576 bytes, built 2026-11-15 19:13 from `8082078` (v1.4.0) |
| Running process | `looms serve` — **no flags**, pid 68457, started 2026-11-17 10:20 in a terminal (pts/2); cwd `/home/ed/musebridge-linux` |
| Env (names only) | `LOOM_DATA_DIR=/home/ed/.loom`, `LOOM_BIN_DIR=/home/ed/.local/bin`, `LOOM_LLM_OPENAI_ENDPOINT` (endpoint URL; no API key in env) |
| Config file | `/home/ed/.loom/looms.yaml` (596 B) — `server.host: 0.0.0.0`, `server.port: 60051`; **no `server.cors` section**; provider `openai` / `deepseek-v4-pro` |
| Listeners observed | `*:5006` (HTTP) and `*:60051` (gRPC) — **wildcard binds, live exposure** |
| Active work at baseline | IDE (Tauri) app not running; latest session update 18:20:30Z (16 min before); no in-flight turns indicated |
| Startup mechanism | Interactive `looms serve` in the owner's terminal; no systemd unit, no wrapper script |

## 2. Effective configuration (precedence)

`cmd/looms/config.go` viper defaults →
`/home/ed/.loom/looms.yaml` →
environment → CLI flags (none used).

- `config.go:1370` `server.host` default **`0.0.0.0`** (persistent
  setting responsible for the wildcard listeners; the yaml repeats it).
- `config.go:1391` `server.cors.allowed_origins` default **`["*"]`**
  (source comment: "INSECURE for production!") — active because the yaml
  has no cors section. Live-confirmed: `GET /v1/health` with
  `Origin: http://evil.example` returns `Access-Control-Allow-Origin: *`
  (read-only probe, this run).
- Both HTTP and gRPC addresses are built from `server.host`
  (`cmd_serve.go:3821`), so one setting contains both ports.

## 3. Local deployment policy (acceptance rules, agreed before testing)

| Connection | Intended behavior |
|---|---|
| IDE Rust client → `127.0.0.1:5006` | Works (HTTP, SSE included) |
| Local gRPC client → `127.0.0.1:60051` | Works |
| Another computer → either port | No listener on any non-loopback address |
| Allowed browser origin (exact list below) | Allowed, with exact-origin echo |
| Unlisted browser origin | **Rejected before dispatch** (no read, no action) |
| Request without an `Origin` header (native clients) | Continues working |

Explicit `127.0.0.1` first. IPv6 loopback: not added (no real caller
requires it); verify separately if one appears.

## 4. Browser callers of the HTTP gateway (traced, not assumed)

| Caller | Evidence | Needs cross-origin grant? |
|---|---|---|
| Tauri webview | CSP `connect-src 'self' ipc: http://ipc.localhost` (`tauri.conf.json:5`) — direct fetches to `:5006` are blocked by the webview itself; all Loom traffic goes through the Rust backend | **No** |
| Vite dev/preview browser fallback | `vite.config.ts` proxies `/api/loom` → `http://localhost:5006` with **`changeOrigin: true`** (Origin rewritten to the gateway's own origin) | **No** (its requests arrive with `Origin: http://localhost:5006`) |
| Hosted Loom apps ("Open" button) | `main.ts:4093` `window.open(http://localhost:5006/apps/{name}, "_blank", "noopener,noreferrer")` — pages live **on** the gateway origin; same-origin fetches | **No** (same-origin POSTs may send `Origin: http://localhost:5006` — include it) |
| Swagger UI | Served by the gateway itself at `/swagger-ui` — same origin | **No** |
| Local curl/scripts | No Origin header | n/a (native path) |

**Conclusion:** no browser caller requires a *third-party* origin grant.
Policy: `allowed_origins` = exactly `["http://localhost:5006",
"http://127.0.0.1:5006"]` (named consumers: the dev proxy's rewritten
origin and hosted apps' same-origin POSTs). Nothing else. No wildcard,
no `null`.

## 5. CORS behavior test (isolated instance, current middleware)

Executed 2026-11-17 against a temporary loopback instance (ports
5007/60052, isolated SQLite, keyless ollama provider, restricted
allowlist = the repair policy) with the **current** (unpatched)
middleware. Full capture: `evidence/exec-20261117-cors-matrix.log`.

| # | Probe | Result |
|---|---|---|
| 1 | no-Origin GET `/v1/health` | 200 — native path works, no CORS headers |
| 2 | allowed Origin GET | 200 + `Access-Control-Allow-Origin: http://localhost:5007` (exact echo) |
| 3 | unlisted Origin GET | 200, **no ACAO** — browser cannot read, but the handler ran |
| 4 | unlisted Origin OPTIONS preflight | **204** — preflight is never refused |
| 5 | **unlisted Origin "simple" POST `/v1/sessions`** (text/plain, JSON body, no preflight) | **200 — session `sess_1d8c82d4` was created. The action executed.** (deleted afterward; sessions `{}` confirmed) |
| 6 | unlisted Origin POST `/v1/weave:stream` | 200 `text/event-stream` — the streaming handler dispatched |
| 7 | unlisted Origin POST `/v1/human-requests/{id}:respond` | 404 handler-level — the approval route dispatched |
| 8 | allowed Origin POST `/v1/sessions` | 200 — normal flow works |

**Conclusion:** restricting the CORS allowlist alone prevents *reading*
but leaves a browser-triggered **action path** (case 5 — and by the same
mechanism, weave turns and approval answers). The middleware must
**reject unlisted browser origins before dispatch**; configuration alone
is not enough. Until the Loom-side patch is applied, the contained
server's residual risk is exactly this action path, and the docs below
say so.

## 6. Smallest complete repair (prepared)1. **Config (authorized, this machine):** `/home/ed/.loom/looms.yaml` →
   `server.host: 127.0.0.1`, explicit `server.http_port: 5006`, and:
   ```yaml
   server:
       host: 127.0.0.1
       port: 60051
       http_port: 5006
       cors:
           enabled: true
           allowed_origins:
               - http://localhost:5006
               - http://127.0.0.1:5006
   ```
   No credential changes (local unauthenticated model preserved).
2. **Prepared middleware patch (unapplied — Loom repo is outside the
   write boundary):** in `corsMiddleware`, when `Origin` is present and
   not in the allowlist → **403 before dispatch** (both preflight and
   actual requests); no-Origin requests pass unchanged; allowed origins
   keep exact-origin echo. Optional second hunk: reject Hosts whose
   hostname is neither `localhost` nor `127.0.0.1` (DNS-rebinding
   defense for non-browser clients), preserving the legitimate Host
   values of the IDE (`LOOM_ADDR`) and the dev proxy. Patch + tests are
   prepared in `evidence/` for owner review; **not applied**.

## 7. Prepared artifacts (in `evidence/`)

- `qc2-cors-reject.patch` (26 lines) — reject unlisted browser origins
  with 403 before dispatch; exact context; syntax-checked.
- `qc2-host-check.patch` (40 lines) — optional Host validation
  (`localhost`/`127.0.0.1` only), depends on the reject patch;
  syntax-checked.
- `qc2-cors-middleware-tests.go.txt` — prepared regression tests
  (stdlib-only) covering allowed-origin echo, unlisted-origin rejection
  before dispatch, native no-Origin pass-through, preflight behavior,
  and the Host check. To be appended to `pkg/server/http_test.go` by
  the Loom-side pass.
- `exec-20261117-cors-matrix.log` — the isolated matrix capture (§5).

## 8. Applied configuration (2026-11-17)

- Backup: `/home/ed/.loom/looms.yaml.bak-20261117` (596 bytes,
  permissions preserved).
- `/home/ed/.loom/looms.yaml` `server` section now:
  `host: 127.0.0.1`, `port: 60051`, `http_port: 5006`, and
  `cors: {enabled: true, allowed_origins: [http://localhost:5006,
  http://127.0.0.1:5006]}`. No credential changes; no other keys moved.
- No conflicting overrides existed (server ran with no flags; env has
  no host/cors variables).

## 9. Controlled restart and observation

- Active-work check before restart: IDE app not running; last session
  update ~16 min prior; no in-flight turns indicated.
- Graceful stop: SIGTERM to pid 68457 → exited, ports released.
- Restart: `looms serve` detached (same environment: `LOOM_DATA_DIR`,
  `LOOM_BIN_DIR`, `LOOM_LLM_OPENAI_ENDPOINT`), log
  `/tmp/opencode/loom-serve.log`.
- Observed (`ss`): only `127.0.0.1:5006` and `127.0.0.1:60051` — no
  `0.0.0.0`, no `[::]`, no LAN address. Server log: "CORS enabled with
  restricted origins ["http://localhost:5006","http://127.0.0.1:5006"]".
- Origin probes on the real server: allowed origin → 200 + exact-origin
  echo; unlisted origin → 200 with **0** `Access-Control-Allow-Origin`
  headers (unreadable); no-Origin native → 200.
- A non-loopback connection test from another machine was **not**
  performed (no second machine); wildcard absence is proven by the
  observed sockets.
- Provider healthy after restart (`openai/deepseek-v4-pro`,
  `/v1/health` 200).

## 10. IDE check after containment

- IDE live contract test:
  `cargo test --offline --locked --manifest-path
  src-tauri/Cargo.toml --lib live_gateway_responses_parse -- --ignored`
  → **1 passed** (`evidence/exec-20261117-live-gateway-test.log`).
- Disposable streamed chat turn (byte-faithful `run_stream` probe, no
  session, "Reply with exactly: pong") → 4 SSE events, incremental
  tokens, stage-7 completion with cost $0.0066, chunked framing decoded
  (`evidence/exec-20261117-live-stream-probe.txt`). Streaming remains
  incremental through the contained gateway.
- Trace access: unary turn returned `traceId:
  1894d567-8ddf-4936-8949-dade8dbcd43b`; `GET /v1/traces/{id}` → **200**.
- Synthetic sessions created by these probes (`sess_6545da63`,
  `sess_9c635ca6`) are disposable fixtures; no personal session was
  touched.
- Approval endpoint: exercised at the isolated instance (route
  dispatched, §5 case 7); full held-tool round-trip remains its own
  acceptance task (W-5).

## 11. Persistence check and documentation

- Second restart through the same mechanism → identical observation
  (`127.0.0.1` sockets only, restricted origins logged, health 200).
  The repair survives restart.
- Documents updated: `LOOM_CONNECTION_MODEL.md` (deployment
  containment), `10-issues/issue-011-*`, `10-implementation-issues/
  qc-02-*`, `00-final-assessment.md`, `README.md`,
  `15-execution-plan.md`. All describe the residual honestly: the
  unlisted-origin **action path** remains open until the prepared
  Loom-side patch is applied.

**Completion rule status:** both listeners loopback-only ✓ (observed +
restart-proof); unwanted browser access cannot **read** ✓ (no wildcard,
no ACAO to unlisted origins) and cannot trigger tested actions ✗ until
the prepared patch is applied; legitimate IDE traffic works ✓ (native,
streamed turn, traces); configuration survives restart ✓.
