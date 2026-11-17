# AP-07 — No live UI→Loom→UI turn through the rebuilt binary at head

- **Severity:** P2 (verification depth)
- **Classification:** Insufficient evidence (not a code defect)
- **Reference:** evaluation.md — distinguish claimed success from verified completion.

## Problem

The Rust→Tauri→UI chain is pinned by tests at both ends, and the wire
contract is live-verified byte-for-byte, but no model turn has been executed
through the *rebuilt* UI at the current commit in a disposable profile. The
single true UI→Loom→UI turn remains an earlier commit's audit run.

## Evidence

- Prior corpus `13-live-contract-verification.md`: live probes reproduce the
  request bytes and a session-reuse turn, but through a probe script, not
  the rendered UI.
- `chat-lifecycle.test.ts` drives extracted handlers with mocked bridges —
  not the real Tauri event pipeline.

## Expected behavior

One harmless turn, in a disposable profile, through the actual chat box,
with the selected session/agent confirmed and the run recorded on the right
work item.

## Proposed solution

Run the app with `XDG_DATA_HOME` + `LOOM_VAULT_DIR` pointed at disposable
dirs against a loopback Loom server with synthetic sessions (no personal
data), and record the journey.

## Acceptance criteria

Evidence shows: select work/session/agent → send → streamed reply → same
session on message 2 → "View trace" opens the turn's trace → run record on
the correct work item.

## Verification

The documented run itself is the verification.

## Dependencies

A loopback Loom server with disposable data (owner start or authorization).

## Risks

None to personal data if the disposable profile is used.
