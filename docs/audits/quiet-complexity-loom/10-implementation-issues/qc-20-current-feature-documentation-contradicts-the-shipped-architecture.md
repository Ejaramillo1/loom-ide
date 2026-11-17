# QC-20 — Current feature documentation contradicts the shipped architecture

Severity: **P2**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

The root README still advertises the retired second window and spatial note-writing bridge, while newer progress notes call streaming/HITL/tasks integrated without end-to-end evidence. IDE_CRITIQUE still calls Monaco absent even though it is installed and wired.

## Evidence

- [README.md:8](/home/ed/loom-ide-tauri/README.md:8) (`All three surfaces are active`)
- [docs/IDE_CRITIQUE.md:33](/home/ed/loom-ide-tauri/docs/IDE_CRITIQUE.md:33) (`not Monaco`)
- [docs/DESIGN_PROGRESS.md:62](/home/ed/loom-ide-tauri/docs/DESIGN_PROGRESS.md:62) (`clarification answers and tool approvals both deliver`)
- [src/monaco.ts:34](/home/ed/loom-ide-tauri/src/monaco.ts:34) (`monaco.editor`)

## Root cause

Historical implementation statements have accumulated as current capability claims without a verified contract/release ledger.

## Expected behavior

Setup instructions and feature claims reflect current reachable behavior and distinguish source implementation, tests and live verification.

## Proposed correction

After functional remediation, update the current README and relevant report status blocks; keep historical snapshots explicitly historical. Link this audit and a per-capability acceptance ledger rather than rewriting history.

## Affected components

README; design/progress/connection documentation.

## Relevant Loom contracts

No API change; compare reports 02, 03 and 08 with the pinned source.

## Acceptance criteria

- Current setup describes one active Tauri shell and Monaco.
- No claim of full streaming/approval/task integration without its workflow evidence.
- Historical reports remain intact and clearly dated.

## Verification strategy

Check every current capability claim against the integration matrix and an executed acceptance workflow.

## Dependencies

Functional issue completion determines which claims can be promoted.

## Regression risks

Do not remove important capabilities or deferred design decisions to make the documentation look complete.


---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`b36a7c6`/`1c6efb8`/`bdb92bb`). DESIGN_PROGRESS/DECISIONS tasks-skills premise corrected; LOOM_CONNECTION_MODEL framing claims corrected with the code fix. (The philosophy-citation half lives in issue 015, still open.)
