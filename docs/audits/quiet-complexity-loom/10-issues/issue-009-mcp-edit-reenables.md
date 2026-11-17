# Issue 009 — Editing an MCP server silently re-enables it

- **Title:** Editing an MCP server silently re-enables it
- **Severity:** P2 — control-surface drift (user intent not preserved)

## Problem statement

The MCP edit dialog has no enabled/disabled toggle, yet `submitMcpServer`
passes `enabled: true` on every save — both the edit path
(`updateMcpServer(..., true)`) and the add path
(`addMcpServer(..., true)`, acceptable for add). Editing a deliberately
disabled server therefore re-enables it without the user being told or
asked. Enabling a server changes what tools Loom's agents can reach — a
consequential change the philosophy says must never be quiet.

## Evidence and file references

- `src/main.ts:4143-4150`:
  `updateMcpServer(editingMcpName, form.transport, form.command, form.args, form.url, true)`
  and the same `true` for add.
- `src/main.ts:4007-4020` (edit dialog prefill — no enabled field read),
  `src/api.ts:1198-1201` (`updateMcpServer` signature supports `enabled`).

## Root cause

**Confirmed.** The update command always applies the literal `true`; the
dialog never surfaces the field.

## Expected behavior

Editing preserves the server's enabled state unless the user explicitly
changes it; the dialog shows the current state.

## Current behavior

Any edit re-enables the server silently.

## Proposed correction

- Add an enabled checkbox to the MCP dialog, prefilled from
  `getMcpServer` in edit mode, and pass its value through
  `updateMcpServer`; in add mode default to true (as today).

## Affected components

- `src/main.ts` (openMcpEditDialog, readMcpForm/submitMcpServer),
  `index.html` (dialog markup if needed).

## Relevant Loom contracts

- `PUT /v1/mcp/servers/{name}` — `enabled` field (loom.proto MCP server
  message).

## Acceptance criteria

1. Editing a disabled server and saving leaves it disabled.
2. The dialog displays and allows changing the enabled state.
3. No other MCP flow regresses.

## Verification strategy

- Unit test on the form-read path; live edit of a test server (once one
  exists) asserting the enabled bit is preserved.

## Dependencies

- None (IDE-only).

## Regression risks

- Low — isolated dialog logic.

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`b6c612f`). MCP edit preserves the row's enabled state.
