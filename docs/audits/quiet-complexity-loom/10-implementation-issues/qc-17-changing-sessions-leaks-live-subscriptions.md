# QC-17 — Changing sessions leaks live subscriptions

Severity: **P2**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

ensureSessionSubscription overwrites sessionSubId when selection changes and returns immediately for no selection. It never cancels the previous stream. Its ignored events still consume server work and a Rust thread until closure or the 30-minute timeout.

## Evidence

- [src/main.ts:1984](/home/ed/loom-ide-tauri/src/main.ts:1984) (`async function ensureSessionSubscription(`)
- [src/main.ts:2340](/home/ed/loom-ide-tauri/src/main.ts:2340) (`async function refreshLoomBoardTasks(`)
- [src-tauri/src/loom_stream.rs:33](/home/ed/loom-ide-tauri/src-tauri/src/loom_stream.rs:33) (`pub fn start_loom_stream(`)

## Root cause

The selected-session lifecycle lacks the cleanup already implemented for task-board subscriptions.

## Expected behavior

At most one selected-session subscription survives; clearing selection or closing its owner stops it.

## Proposed correction

Cancel the previous session stream before replacing/clearing its ID, following the existing task-board pattern. Ensure completion of an old stream cannot clear the new subscription.

## Affected components

Session selection/subscription frontend; Rust stream registry.

## Relevant Loom contracts

SubscribeToSession and cancel_loom_stream; source confirms cleanup omission. Resource impact was not benchmarked.

## Acceptance criteria

- Switch A → B → none leaves zero subscriptions.
- Old terminal events cannot invalidate the new subscription.

## Verification strategy

Count stream starts/cancels with delayed terminal events, then observe contained server subscription counts.

## Dependencies

QC-05 for functional subscriptions.

## Regression risks

Do not cancel a conversation turn when only its read-only session subscription changes.


---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`7f93a2f` + tests). Subscription cancel on change/clear; stale terminals cannot clear the new handle; same-session re-ensure idempotent.
