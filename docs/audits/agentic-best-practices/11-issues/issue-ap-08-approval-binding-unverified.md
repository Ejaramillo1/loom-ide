# AP-08 — HITL approval→tool-execution binding is source-confirmed, not live-verified

- **Severity:** P2 (verification depth)
- **Classification:** Insufficient evidence (route verified, enforcement not)
- **Reference:** production-and-safety.md — bind approval to the exact action; a timeout must not imply approval.

## Problem

The approval *route* is live-verified (`POST /v1/human-requests/{id}:respond`
→ shared HumanRequestStore), and cards show parameters + expiry, but a full
approve → tool-actually-executes-once (and deny → never) round-trip has not
been executed against a held tool. The parked-turn 409 refusal is
source-confirmed only.

## Evidence

- Prior corpus `13-live-contract-verification.md` Phase 3: route probes pass;
  a real held-tool approve/deny was not executed (no hook-held tool
  configured; non-deterministic trigger).

## Expected behavior

UI state, stored-request state, and tool execution agree: no approve → 0,
approve → 1, repeat-approve → 1, deny → 0, expiry shown, restart → stored
decision represented.

## Proposed solution

Use a harmless counted tool in an isolated backend; exercise the supported
request-creation path (not manual DB inserts) for each case.

## Acceptance criteria

Each of the six cases (before/approve/repeat/deny/expiry/restart) has
matching UI + store + execution evidence.

## Verification

The documented round-trip is the verification.

## Dependencies

A loopback Loom server with a harmless hold-able tool.

## Risks

None if isolated; do not use personal approvals.
