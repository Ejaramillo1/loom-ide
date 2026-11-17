# Issue 011 — Loom is exposed on 0.0.0.0 without authentication

- **Title:** Loom is exposed on 0.0.0.0 without authentication
- **Severity:** P1 — environmental security risk (not an IDE code defect)
- **Status (2026-11-17):** **CONTAINED (config), residual prepared.**
  `/home/ed/.loom/looms.yaml` now sets `server.host: 127.0.0.1` (both
  listeners loopback-only — observed via `ss`, survives restart) and a
  restricted CORS allowlist (exact origins only, no wildcard). Native
  IDE traffic, the dev proxy, hosted apps, Swagger, a streamed chat turn
  and trace access all verified working after the change. **Residual:**
  an unlisted browser Origin is still *dispatched* (its response is
  unreadable) — proven live by a session-creating "simple" POST. The
  reject-before-dispatch middleware patch + tests are prepared in
  `16-gateway-containment.md` and `evidence/` (Loom-side scope, not yet
  applied). Full record: `docs/audits/quiet-complexity-loom/
  16-gateway-containment.md`.

## Problem statement

The running Loom server binds `0.0.0.0:5006` (HTTP gateway) and
`0.0.0.0:60051` (gRPC) with no authentication. Anyone who can reach the
host over the network can send weaves (spending the configured LLM),
drive the agents' tools (web/file/http tools; `shell_execute` is jailed
server-side), read artifacts and session history, delete sessions, and
mutate MCP/apps/schedules. The IDE itself is correctly localhost-scoped
and unauthenticated by design (registered decision), but the *server's*
binding turns that local trust model into a network-wide one.

## Evidence and file references

- `ss -tlnp` (2026-11-15): `*:5006` bound by `looms` (pid 220399).
- `/home/ed/.loom/looms.yaml` — `server: host: 0.0.0.0, port: 60051`;
  no auth section.
- Live probes from loopback succeeded with no credentials; the HTTP
  gateway requires none (`pkg/server/http.go` — no auth middleware in the
  path; Loom's auth interceptor exists for gRPC but is not configured
  here).
- IDE side: `docs/LOOM_CONNECTION_MODEL.md` — "Auth: none. Loom's auth is
  server-side; the IDE talks to localhost unauthenticated — fine locally,
  not portable."

## Root cause

**Confirmed (deployment configuration).** The workstation profile serves
Loom on all interfaces without auth.

## Expected behavior

For a single-user workstation: the server binds `127.0.0.1` only, or the
exposure is an explicit, owner-approved decision.

## Current behavior

Network-reachable unauthenticated agent runtime.

## Proposed correction

- Change the Loom config to bind loopback (`server.host: 127.0.0.1`,
  http `0.0.0.0` → `127.0.0.1` where configurable) and restart; or enable
  Loom's auth for the deployment. Record the decision (IDE docs or the
  workstation's ops notes).

## Affected components

- `/home/ed/.loom/looms.yaml` (runtime configuration — requires owner
  action); no IDE source change.

## Relevant Loom contracts

- `ENV_VARS.md` / server config (`server.host`, http bind options);
  auth interceptor (`pkg/server/auth_interceptor.go`).

## Acceptance criteria

1. `ss -tlnp` shows Loom bound to loopback only (or auth is enforced).
2. The IDE still connects unchanged.
3. The exposure decision is recorded with the owner's sign-off.

## Verification strategy

- Re-run the binding check and the full live probe set after the change.

## Dependencies

- Owner authorization to change runtime configuration (audit rules: no
  config changes without approval — this issue *proposes* the change).

## Regression risks

- Binding to loopback can break legitimate LAN clients (none known here);
  verify before applying.

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** STILL OPEN (server decision). `looms` still binds `0.0.0.0:5006/60051` unauthenticated and CORS allows wildcard origins (http.go:265) — unchanged at Loom `8082078`. P0 for Eduardo — maps to QC-02.
