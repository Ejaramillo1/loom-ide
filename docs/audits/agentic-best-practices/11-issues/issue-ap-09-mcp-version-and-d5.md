# AP-09 — MCP spec version unpinned; Loom-as-MCP (D5) not implemented

- **Severity:** P2 (interoperability hygiene)
- **Classification:** Confirmed architectural weakness / improvement opportunity
- **Reference:** tools-and-protocols.md — follow a versioned specification; "a link labeled `latest` can change."

## Problem

The IDE manages MCP servers (full CRUD + test + health + tools) but (a) does
not pin or display the MCP spec version its response decoding assumes, and
(b) the decided Loom-as-MCP-server ↔ harness connection (DECISIONS D5) is
not implemented, so the IDE's MCP surface is a registry, not a live
integration.

## Evidence

- `loom_tasks.rs` MCP commands decode several response shapes by hand.
- `docs/DECISIONS.md` D5: "Loom-as-MCP-server ↔ harness: connect, in both
  directions, with an explicit list of which PC tools are exposed" — not
  implemented.

## Expected behavior

The MCP protocol version is pinned in docs and surfaced; D5 connects the
harness with an explicit tool allowlist.

## Proposed solution

Pin/display the MCP spec revision; implement D5 with an allowlist, keeping
the MCP decode logic version-aware.

## Acceptance criteria

- The negotiated MCP version is visible in the server row.
- D5 wiring exists with an explicit allowlist, or is recorded blocked.

## Verification

Contract tests against a pinned MCP revision; an allowlist test.

## Dependencies

D5 depends on the harness allowlist contract (PC tools).

## Risks

Low; do not adopt a new protocol version without compatibility testing.
