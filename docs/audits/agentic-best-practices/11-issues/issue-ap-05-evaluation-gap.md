# AP-05 — No held-out evaluation set; "completed" is not "correct"

- **Severity:** P1 (verification confidence)
- **Classification:** Confirmed architectural weakness
- **Reference:** evaluation.md — build an eval set; measure more than completion.

## Problem

`weave_completed` verifies the stream ended at stage 7, not that the content
satisfied the intent. There is no case file with expected final state,
prohibited changes, and a grader rubric, so a fluent-but-wrong answer is
indistinguishable from a correct one. `judge/` tooling exists but is not
wired to a case harness.

## Evidence

- `src-tauri/src/loom_stream.rs:316` `weave_completed` returns true on
  stage 7 only — transport truth, not semantic truth.
- `judge/JUDGE_PROMPT_TEMPLATE.md` exists; no case files reference it.

## Expected behavior

A held-out set of representative tasks (initial state, permitted actions,
expected final state, prohibited changes, grader) is scored, and "verified"
is measured rather than asserted.

## Proposed solution

Extend `judge/` to the reference's case-file format; add a grounding check
to every verdict; keep judge policy separate from agent text. Add one
app-level failure-injection test (stub a plausible-but-wrong completion,
assert the honest-failure path).

## Acceptance criteria

- At least a small held-out case set runs and reports outcome + prohibited-
  change violations.
- Judge inputs are not agent-editable.

## Verification

Run the harness; confirm a wrong completion fails the grader.

## Dependencies

None.

## Risks

Low; do not over-build evaluation infrastructure before the primary path is
fully live-verified (AP-07).
