# QC-01 — Autonomy changes do not constrain Loom execution

Severity: **P0**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Status (2026-11-17)

**PARTIALLY FIXED — Manual enforced at the IDE boundary; runtime holds
prepared.** `execution_admission` (`lib.rs`) rejects Manual on every
agent-execution entry point before any request is sent (chat,
workflows, experiment arms, schedule triggers, session resume); the
level travels in `backend_config` on both wire formats; lowering the
dial mid-run cancels the affected runs (completed actions never
undone); the dial's copy states the exact scope. Per-tool approval for
Assisted/Collaborative and the runtime acknowledgment contract are
prepared in `17-autonomy-enforcement.md` +
`evidence/qc1-autonomy-runtime-tests.go.txt` and require Loom-side
execution scope (the permission checker's hold mechanism is currently
the "not yet implemented" error path, `permission_checker.go:164-177`).

## Problem and current behavior

A work item can be Manual or Paused while chat, experiment arms, workflows and session resume still invoke Loom. Lowering autonomy updates local records, not the permissions of an in-flight run.

## Evidence

- [src-tauri/src/lib.rs:225](/home/ed/loom-ide-tauri/src-tauri/src/lib.rs:225) (`fn set_work_autonomy(`)
- [src-tauri/src/lib.rs:355](/home/ed/loom-ide-tauri/src-tauri/src/lib.rs:355) (`fn update_intent(`)
- [src/main.ts:4867](/home/ed/loom-ide-tauri/src/main.ts:4867) (`function buildChatContext(`)
- [src-tauri/src/loom_stream.rs:86](/home/ed/loom-ide-tauri/src-tauri/src/loom_stream.rs:86) (`pub fn ask_loom_stream(`)
- [src/main.ts:1834](/home/ed/loom-ide-tauri/src/main.ts:1834) (`async function runWorkflow(`)

## Root cause

Local rank validation and inheritance are real, but no execution boundary reads these stores. A context string such as active_work_autonomy is advisory and is not a capability policy.

## Expected behavior

The visible autonomy setting must bound every consequential entry point, including resume, schedules and tools; tightening it must affect active work.

## Proposed correction

First make the advisory status explicit and reject disallowed runs at the Rust boundary. Define and map the four shipped levels to Loom admission/tool permissions, enforce them in the runtime, and propagate tightening/cancellation. Do not implement permissions through prompt text.

## Affected components

Intent/work stores; all executing Tauri commands; Loom runtime admission and tool hooks.

## Relevant Loom contracts

WeaveRequest has no IDE autonomy policy field. Loom pkg/shuttle/admission_ask.go and HumanRequestStore implement real held calls; they are not driven by the IDE dial.

## Acceptance criteria

- Manual work cannot cause agent/tool execution through any entry point.
- Lowering a running intent prevents subsequent forbidden tool actions; UI reports the server acknowledgement.
- Four shipped levels have documented, tested semantics; do not silently add a fifth.

## Verification strategy

Use an isolated agent with a counted tool; exercise chat, arm, workflow, resume and scheduled execution under every level. Assert actual invocation counts and tightening during a hold.

## Dependencies

Agree a runtime enforcement contract; QC-07 supplies the held-request answer path. Existing transport decisions remain recorded, not bypassed.

## Regression risks

Fail closed without disabling manual file/note work. Existing workflows must not silently gain privileges.


---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** PARTIAL — honesty fixed, enforcement open. `a02ad52` extracts `autonomy_admission` with 4 boundary tests and honest dial copy (main.ts:950). No Loom-side enforcement exists at `8082078` (re-verified). Maps to issue 005; needs a Loom contract.
