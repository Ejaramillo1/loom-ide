# QC-02 — The live Loom gateway exceeds the stated localhost trust boundary

Severity: **P0**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Status (2026-11-17)

**CONTAINED by configuration; middleware residual prepared.** The
gateway now binds `127.0.0.1` only (both ports, observed sockets,
restart-surviving) and serves an exact-origin CORS allowlist (no
wildcard). Verified after the change: native IDE requests, dev proxy,
hosted apps, Swagger, a disposable streamed chat turn (incremental SSE),
session listing, and trace access (200). **Not yet closed:** unlisted
browser origins are still dispatched (action path proven live — an
unlisted-origin "simple" POST created a session); a
reject-before-dispatch middleware patch and its regression tests are
prepared in `16-gateway-containment.md` + `evidence/` and require
Loom-side execution scope. No credentials were added (local
unauthenticated model preserved).

## Problem and current behavior

The running gateway listens on all interfaces without TLS, accepts unauthenticated API reads, and returns Access-Control-Allow-Origin: * to an unrelated Origin. Localhost-only client documentation does not restrict the server.

## Evidence

- [loom/pkg/server/http.go:105](/home/ed/work/loom/pkg/server/http.go:105) (`func (h *HTTPServer) Start(`)
- [loom/pkg/server/http.go:316](/home/ed/work/loom/pkg/server/http.go:316) (`func (h *HTTPServer) handleStreamWeaveSSE(`)
- [src-tauri/src/lib.rs:1209](/home/ed/loom-ide-tauri/src-tauri/src/lib.rs:1209) (`pub(crate) fn loom_addr()`)

## Root cause

The running server configuration binds 0.0.0.0; the HTTP stack defaults to permissive CORS. The custom SSE route calls grpcServer directly rather than going through the gateway gRPC call. No IDE connection authentication is supplied.

## Expected behavior

A local deployment must enforce loopback binding and explicit trusted origins. A nonlocal deployment needs authenticated, authorized transport on every route, including custom SSE.

## Proposed correction

Use the existing Loom bind/CORS configuration to contain the local service; verify auth on SSE and gateway routes before supporting remote LOOM_ADDR. Do not weaken TLS/auth to make the client connect. This audit changes no running configuration.

## Affected components

Loom serve configuration and HTTP middleware; IDE connection model.

## Relevant Loom contracts

evidence/network-boundary.json and live-contract-probes.json; ss observed *:5006; /v1/agents accepted without credentials. External network reachability/firewall and browser exploitation were not tested.

## Acceptance criteria

- Local profile listens only on loopback.
- An untrusted Origin receives no usable cross-origin API response.
- Authenticated deployments enforce the same identity on unary and custom SSE routes.

## Verification strategy

In an isolated deployment test allowed/disallowed origins and absent/invalid credentials; inspect bound addresses. Never test unauthorized tool execution on user data.

## Dependencies

Operational configuration review; no frontend redesign required.

## Regression risks

Do not break legitimate Tauri origins. LAN exploitability depends on firewall and browser policy; the observed exposure is confirmed, exploitation is not.


---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** STILL OPEN. Server posture unchanged at Loom `8082078`: `0.0.0.0:5006/60051` unauthenticated, wildcard CORS allowed. P0 decision for Eduardo. Maps to issue 011.
