# AP-01 — Autonomy dial is not enforced by the execution path

- **Severity:** P0 (critical human-control defect)
- **Classification:** Confirmed architectural weakness
- **Reference:** production-and-safety.md — *"A visual autonomy control
  without corresponding enforcement is a critical architectural defect."*

## Problem

The four autonomy levels (`manual` → `assisted` → `collaborative` →
`delegated`) are stored, displayed, history-tracked, and guarded for
*raising* (justification required), but **no code on the execution path
consults the level**. Setting "Manual" and then sending a consequential
request places no constraint on what Loom does.

## Evidence

- `src-tauri/src/store.rs`: `autonomy_rank` + `AutonomyChange` history; the
  levels are validated and persisted, and raising requires justification.
- `src/main.ts:950`: dial copy states "Loom's runtime does not read this
  level yet — it does not constrain execution on the server."
- `src-tauri/src/lib.rs`: `ask_loom` / `loom_stream.rs` `ask_loom_stream`
  forward the query without any autonomy check.
- Loom `/home/ed/work/loom/pkg/server/multi_agent.go` (`8082078`, read-only):
  the `Weave`/`StreamWeave` paths consume `context` and `timeout_seconds`
  but have **no** autonomy/permission field.

## Expected behavior

A human-set level constrains what actually executes: e.g. "Manual" forwards
no workflow/experiment/tool-heavy request without an explicit approval;
"Delegated" permits the widest set. The level must be observable in Loom's
approval behavior, or the UI must state exactly what it governs (currently
only the latter is true).

## Proposed solution

1. **Client boundary (no Loom change):** in the Rust command layer, resolve
   the active intent's level and enforce an action allowlist before any
   request is forwarded (e.g. reject workflow execution / tool-permission
   requests above the level; require approval otherwise).
2. **Runtime contract (upstream, out of scope):** document a Loom
   permission/autonomy mapping so the runtime enforces the level too. Mark
   as upstream; do not implement.

## Acceptance criteria

- For each of the four levels, a defined set of permitted vs gated actions.
- A gated action is refused (or routed to approval) at the IDE boundary.
- The UI reports enforcement accurately (not "governs nothing").

## Verification

- Unit tests: for each level, assert the boundary rejects/permits each
  action class.
- Manual: set "Manual", attempt a workflow run → refused/approval-gated.

## Dependencies

None (client half). Runtime enforcement depends on a future Loom contract.

## Risks

Low for the client half (no Loom change); the allowlist must not silently
break existing chat, which stays permitted at every level.
