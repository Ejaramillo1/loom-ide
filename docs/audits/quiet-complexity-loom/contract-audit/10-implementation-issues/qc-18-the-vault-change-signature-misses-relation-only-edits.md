# QC-18 — The vault change signature misses relation-only edits

Severity: **P2**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

The watcher compares note/pending counts and the maximum visible-file mtime. The ledger under .loom is excluded. External edge/activity changes that do not alter notes or pending counts leave Graph/Canvas stale indefinitely.

## Evidence

- [src-tauri/src/knowledge.rs:1015](/home/ed/loom-ide-tauri/src-tauri/src/knowledge.rs:1015) (`pub fn knowledge_signature()`)
- [src-tauri/src/knowledge.rs:463](/home/ed/loom-ide-tauri/src-tauri/src/knowledge.rs:463) (`pub fn changed_at_ms(`)
- [src/knowledge.ts:105](/home/ed/loom-ide-tauri/src/knowledge.ts:105) (`sig.changed_at_ms !== lastSignature.changed_at_ms`)

## Root cause

A maximum visible-note timestamp is not a vault revision. It also misses an edited file whose mtime remains below another future-dated file.

## Expected behavior

Relevant external note, relation, review and activity changes refresh all knowledge surfaces without overwriting drafts.

## Proposed correction

Include the existing ledger revision and a reliable bounded per-file change signature. Preserve the 3-second poll and draft guards; avoid rereading all note bodies just to detect changes.

## Affected components

Knowledge signature command, poller, graph/canvas/activity and bench refresh.

## Relevant Loom contracts

Local vault ledger is authoritative for edges/activity; no Loom event supplies these local changes.

## Acceptance criteria

- Editing only ledger edges refreshes Graph/Canvas.
- A future-dated unrelated note cannot hide another edit.
- An open dirty editor is preserved and refresh happens after safe completion.

## Verification strategy

Use a contained vault and external ledger/note writes; assert signature and UI changes. Measure scan cost at a documented note count.

## Dependencies

None.

## Regression risks

Vault open currently reparses notes and recovery journal; retain symlink, validation and recovery safeguards.
