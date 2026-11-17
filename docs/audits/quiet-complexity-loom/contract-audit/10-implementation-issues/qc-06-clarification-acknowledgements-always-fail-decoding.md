# QC-06 — Clarification acknowledgements always fail decoding

Severity: **P1**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

A successfully delivered answer has success and accepted booleans. The IDE instead requires a status string, reports failure after delivery, and enables retry even though the question may already be consumed.

## Evidence

- [src-tauri/src/loom_stream.rs:278](/home/ed/loom-ide-tauri/src-tauri/src/loom_stream.rs:278) (`pub fn answer_clarification(`)
- [loom/proto/loom/v1/loom.proto:1370](/home/ed/work/loom/proto/loom/v1/loom.proto:1370) (`message AnswerClarificationResponse`)
- [src/main.ts:5127](/home/ed/loom-ide-tauri/src/main.ts:5127) (`await answerClarification(sid, hitl.request_id, answer)`)

## Root cause

The response decoder implements a field absent from the actual proto. HTTP 200 can also contain an application rejection.

## Expected behavior

Accepted answers close their card once; rejected/expired answers display the server reason.

## Proposed correction

Decode success, accepted and error explicitly, require both positive booleans, and return the actual rejection. Keep acceptance separate from subsequent agent progress.

## Affected components

Rust clarification command and chat HITL cards.

## Relevant Loom contracts

AnswerClarificationResponse; Go contract probe asserts an accepted response has no status. Live nonexistent-question response is HTTP 200 with an error.

## Acceptance criteria

- Accepted answer is shown as delivered.
- Unknown, expired or duplicate question remains a visible rejection.
- Retry cannot claim acceptance after the original answer was already consumed.

## Verification strategy

Contract fixtures generated from actual protobuf responses; contained pending-question test through the UI.

## Dependencies

QC-07 for stored approval requests; legacy clarification is a separate route.

## Regression risks

An accepted answer must not be resent just because local rendering or refresh fails.
