# AP-02 — Local gateway exceeds the documented localhost trust boundary

- **Severity:** P0 (security)
- **Classification:** Confirmed defect (deployment posture)
- **Reference:** production-and-safety.md — trust boundaries; tools-and-protocols.md — least privilege.

## Problem

`looms` defaults to binding `0.0.0.0` for HTTP (`:5006`) and gRPC (`:60051`),
serves unauthenticated, and allows wildcard CORS origins. Any process on the
host — and any browser origin that can reach the host — can drive the Loom
runtime. The project's documented decision is "localhost only, no client
auth."

## Evidence

- Loom `cmd/looms/cmd_serve.go` (read-only): HTTP address =
  `config.Server.Host:HTTPPort`; gRPC `--host` default `0.0.0.0`.
- Loom `pkg/server/http.go` (read-only): CORS `allowedOrigin` handling
  includes a wildcard branch; `NewHTTPServerWithCORS` with configured origins.
- The prior corpus recorded the default `0.0.0.0` bind and wildcard CORS
  (QC-02 / issue 011); a later restart was observed loopback-bound, i.e. the
  *default* is exposed but the operator can override. The wildcard-CORS
  default and the missing auth remain.

## Expected behavior

The local deployment binds loopback, permits only the Tauri origin(s), and
rejects unrelated browser origins. Remote deployment (if ever) uses a
separate authenticated transport.

## Proposed solution

Operator/config change, not an IDE code change: bind `127.0.0.1`, set an
explicit CORS allowlist (the Tauri origin only), and keep auth server-side.
Record the exact values in `docs/LOOM_CONNECTION_MODEL.md` so the doc and
the deployment agree.

## Acceptance criteria

- `ss -tln` shows loopback-only listeners.
- A foreign `Origin` header receives no `Access-Control-Allow-Origin`.
- The Tauri origin still works; unary and stream routes apply the same policy.

## Verification

Live origin probes against a loopback-bound server (route + stream), plus a
`ss` address check.

## Dependencies

None (operator config). No Loom source change.

## Risks

None to the IDE; must not break the Tauri webview's own origin.
