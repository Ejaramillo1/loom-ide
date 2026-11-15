# QC-14 — Work evidence and execution provenance vanish on restart

Severity: **P1**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

Evidence filtering relies on executionWorkIds and experimentWorkIds Maps populated only during the current process. Reloading preserves the underlying experiments and Loom executions but removes their work relationships. Chat caching also stores only who/text, dropping trace handles.

## Evidence

- [src/main.ts:291](/home/ed/loom-ide-tauri/src/main.ts:291) (`const executionWorkIds = new Map`)
- [src/main.ts:292](/home/ed/loom-ide-tauri/src/main.ts:292) (`const experimentWorkIds = new Map`)
- [src/main.ts:5688](/home/ed/loom-ide-tauri/src/main.ts:5688) (`function cacheChatMessage(`)
- [src/main.ts:2798](/home/ed/loom-ide-tauri/src/main.ts:2798) (`experimentWorkIds.get(e.id) !== workId`)

## Root cause

Persistent work/session/artifact stores do not persist execution/experiment ownership or per-reply evidence identifiers. Streamed replies do not adopt a returned trace/session handle and fall back to newest sessions.

## Expected behavior

Intent → work → execution → artifact/trace relationships remain inspectable after navigation, process restart and backend reconnect.

## Proposed correction

Persist these identifiers with the existing work/experiment records or a minimal relation record; retain trace/session metadata in reply caching. Obtain authoritative stream identity from the backend, never newestSessionId inference.

## Affected components

Work/experiment models, evidence feed, chat cache and Loom completion response.

## Relevant Loom contracts

WeaveResponse.session_id/trace_id exist on unary. WeaveProgress lacks those completion fields at this snapshot; a transport contract change or authoritative precreated session is needed.

## Acceptance criteria

- Restart retains work-scoped execution/experiment evidence.
- Trace links survive reopening the conversation.
- Concurrent sessions cannot be associated by newest timestamp.

## Verification strategy

Create a contained work/run/artifact chain, restart both client and server, inspect exact IDs and traces, and repeat with two concurrent sessions.

## Dependencies

QC-03, QC-04 and QC-13; server stream identity exposure if needed.

## Regression risks

Use backward-compatible optional fields; do not migrate or overwrite existing user records silently.
