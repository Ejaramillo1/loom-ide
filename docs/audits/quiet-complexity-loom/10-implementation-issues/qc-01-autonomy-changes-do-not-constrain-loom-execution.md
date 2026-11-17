# QC-01 — Autonomy changes do not constrain Loom execution

Severity: **P0**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Status (2026-11-18)

**IDE admission enforced from stored records; cancellation honest;
runtime policy separate (Loom project).** `resolve_execution_policy`
(`lib.rs`) resolves the governing level from stored work/Intent
identifiers on every execution command — Manual is rejected before any
network request, missing/invalid records are rejected, and a fallback
re-reads current policy at dispatch (no caller-supplied level strings
remain). Lowering the dial requests cancellation for affected streams
and states requested/confirmed/unavailable-failed distinctly; one-shot
paths are reported as not cancellable. Per-tool approval behavior
(Assisted/Collaborative) is explicitly **outside** the IDE claim — see
`17-autonomy-enforcement.md` §1 for the Loom contract.

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
