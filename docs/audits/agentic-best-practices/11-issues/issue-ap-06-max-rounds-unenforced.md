# AP-06 — `max_rounds` is sent but has no server consumer

- **Severity:** P1 (budget not enforced end-to-end)
- **Classification:** Confirmed defect (partial enforcement)
- **Reference:** production-and-safety.md — set a maximum spend, deadline, and turn count.

## Problem

The IDE now sends `max_rounds`/`timeout_seconds` on both weave paths, but
Loom enforces only `timeout_seconds` (via `context.WithTimeout`); `max_rounds`
has no consumer in the weave path. The turn budget shown to the user governs
time, not turns.

## Evidence

- `src-tauri/src/lib.rs` (`weave_unary_body`) and `loom_stream.rs`
  (`weave_stream_body`) send `maxRounds`/`max_rounds` and
  `timeoutSeconds`/`timeout_seconds`.
- Loom `pkg/server/multi_agent.go:4209/4351` (read-only): `timeout_seconds`
  → `context.WithTimeout`; no `MaxRounds` reference in the weave path.
  Per-turn rounds are governed by agent config `max_turns`, not `max_rounds`.

## Expected behavior

The turn budget the human sets is actually enforced — or the UI states the
truth ("timeout is enforced; round count is not").

## Proposed solution

1. IDE: state the enforcement split honestly in the budget field tooltips.
2. Upstream (out of scope): map `WeaveRequest.max_rounds` to the agent's
   `max_turns` in Loom, or document it as unused. Do not modify Loom here.

## Acceptance criteria

- The budget UI states which of the two fields the server enforces.
- No false claim that round count is bounded.

## Verification

Source re-verification of the Loom weave path (read-only) + a UI copy check.

## Dependencies

Server-side enforcement needs a Loom change (upstream).

## Risks

None (documentation + honesty).
