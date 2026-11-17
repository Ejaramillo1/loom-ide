# QC-19 — Canvas layout persistence can silently lose saved positions

Severity: **P2**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

Canvas layouts use fs::write directly. A crash or disk failure during overwrite can truncate the file; frontend load/save catches discard the error, so the arrangement disappears without explanation.

## Evidence

- [src-tauri/src/knowledge.rs:1044](/home/ed/loom-ide-tauri/src-tauri/src/knowledge.rs:1044) (`pub fn knowledge_canvas_layout_save(`)
- [src/knowledge.ts:72](/home/ed/loom-ide-tauri/src/knowledge.ts:72) (`void saveCanvasLayout(rows).catch`)
- [src/knowledge.ts:87](/home/ed/loom-ide-tauri/src/knowledge.ts:87) (`a missing or unreadable layout file is not an error state`)

## Root cause

This persistence path bypasses the atomic-write pattern used elsewhere and treats unreadable content like absence.

## Expected behavior

The last good layout survives failed saves; corruption/save failure is visible without discarding notes or drafts.

## Proposed correction

Use the existing atomic-write approach and report layout load/save errors in the existing Knowledge status area. Preserve invalid bytes for recovery.

## Affected components

Canvas layout command and debounced frontend save/load.

## Relevant Loom contracts

Local CanvasPosition[] JSON; no Loom API. Crash/disk-failure scenario is source-confirmed, not destructively tested.

## Acceptance criteria

- Injected write failure preserves the previous valid JSON.
- Unreadable layout reports an error while notes remain usable.
- Normal restart retains positions.

## Verification strategy

Contained filesystem failure injection and round-trip test; no real-vault corruption.

## Dependencies

None.

## Regression risks

Never delete the last layout or overwrite it with an empty fallback after a failed load.


---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`52c652a`). Atomic layout saves (tmp+rename) with surfaced failures; corrupt layouts never overwritten by a fallback.
