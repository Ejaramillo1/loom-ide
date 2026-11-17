# AP-03 — gRPC-only Loom capabilities are unreachable from the IDE

- **Severity:** P1 (capability gap)
- **Classification:** Confirmed architectural weakness
- **Reference:** architecture.md — use Loom's established capabilities rather than building competing infrastructure.

## Problem

Several Loom capabilities exist only behind gRPC and have no HTTP gateway
handler, so the IDE cannot reach them: judge, graph memory, memory layer,
learning, LLM scheduler, teleprompter, and task decompose/dependencies. The
IDE shows honest empty states for some and omits others.

## Evidence

- Loom `pkg/server/http.go` (read-only): the gateway registers the main
  services plus Task/Skills (added `8082078`), not the gRPC-only families.
- `docs/DECISIONS.md` D3: "Phase-5 transport: a Rust gRPC client in the IDE
  backend, Judge first" — decided, not implemented.
- `src-tauri/Cargo.toml`: no `tonic`/`prost`/`h2` dependency.

## Expected behavior

The IDE reaches judge and graph memory through a Rust gRPC client, using
Loom's supported interfaces, without re-implementing them.

## Proposed solution

Add the Rust gRPC client (D3, dependency-gated on tonic/prost approval) and
expose judge + graph memory first, then the remaining families as needed.
This is the correct use of a supported Loom interface, not a bypass.

## Acceptance criteria

- Judge and graph memory are callable from the IDE and results render.
- No HTTP shim is added to Loom (upstream untouched).

## Verification

Unit tests for the gRPC client against a stubbed endpoint; a live call
against a disposable server.

## Dependencies

Dependency approval (tonic/prost) — otherwise blocked.

## Risks

New dependency; scope it narrowly (Judge first per D3).
