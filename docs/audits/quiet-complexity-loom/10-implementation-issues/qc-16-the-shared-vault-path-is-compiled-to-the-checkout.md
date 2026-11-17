# QC-16 — The shared vault path is compiled to the checkout

Severity: **P2**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

knowledge::default_root uses CARGO_MANIFEST_DIR and native-app/Research Vault. A packaged binary on another machine therefore targets its build-time checkout rather than a selected or packaged writable vault.

## Evidence

- [src-tauri/src/knowledge.rs:71](/home/ed/loom-ide-tauri/src-tauri/src/knowledge.rs:71) (`pub fn default_root()`)
- [src-tauri/src/knowledge.rs:947](/home/ed/loom-ide-tauri/src-tauri/src/knowledge.rs:947) (`pub fn knowledge_list(`)

## Root cause

A development repository location is embedded as a runtime data location; no user-selected portable vault setting is passed to with_vault.

## Expected behavior

The packaged IDE opens a documented writable persistent vault independent of the build machine, while this checkout's existing vault stays preserved.

## Proposed correction

Persist an explicit vault location using the existing settings pattern. Preserve the current checkout path as a legacy choice without copying/moving files automatically.

## Affected components

Knowledge adapter/bootstrap; packaging documentation; spatial knowledge surface.

## Relevant Loom contracts

Local vault capability, not a Loom memory RPC. Source path behavior is confirmed; fresh-machine packaging was not executed.

## Acceptance criteria

- Binary runs with the build checkout absent and opens its selected vault.
- Existing notes, ledger/history and canvas remain unchanged.
- Unavailable vault is visible and recoverable without silent seeding.

## Verification strategy

Run a packaged binary in an isolated data directory with no checkout path; open a contained vault, restart and inspect it.

## Dependencies

Product choice of default location; no user-data migration during the audit.

## Regression risks

Never relocate private vault content or replace the existing folder automatically.


---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`52c652a`). `LOOM_VAULT_DIR` explicit setting; default path and data preserved (no relocation).
