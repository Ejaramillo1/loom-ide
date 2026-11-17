# QC-09 — The advertised context pack never reaches agent chat

Severity: **P1**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

The IDE sends work, intent and up to 4000 characters of the open file in WeaveRequest.context. In both inspected multi-agent execution paths the server calls Chat/ChatWithProgress with req.Query only and never consumes req.Context.

## Evidence

- [src/main.ts:4867](/home/ed/loom-ide-tauri/src/main.ts:4867) (`function buildChatContext(`)
- [src-tauri/src/lib.rs:1732](/home/ed/loom-ide-tauri/src-tauri/src/lib.rs:1732) (`async fn ask_loom(`)
- [loom/pkg/server/multi_agent.go:1163](/home/ed/work/loom/pkg/server/multi_agent.go:1163) (`resp, err := ag.Chat(ctx, sessionID, req.Query)`)
- [loom/pkg/server/multi_agent.go:1399](/home/ed/work/loom/pkg/server/multi_agent.go:1399) (`resp, err := ag.ChatWithProgress(ctx, sessionID, req.Query, progressCallback)`)

## Root cause

A schema field and serialized payload were mistaken for runtime context delivery. The single-agent server paths also were searched; no Weave context consumption was found.

## Expected behavior

The agent receives the explicitly scoped work/intent/file context and the human can inspect what was supplied.

## Proposed correction

Use an existing supported context-input path that reaches the model, or explicitly include bounded context in the actual query until a server context mapping is implemented. Make selection and truncation visible; do not equate context text with authorization.

## Affected components

Chat context builder, unary/stream adapters, Loom server-to-agent calls.

## Relevant Loom contracts

WeaveRequest.context is documented as prompt interpolation data; actual runtime use must be implemented or proven. No local vault retrieval is attached automatically.

## Acceptance criteria

- A contained echo/context test proves exact intent/work/file values reach the model in both paths.
- An unrelated file is never included.
- Truncation and unsaved editor content handling are explicit.

## Verification strategy

Instrument an isolated provider to capture its actual input; assert selected context and absent unrelated content, then a real model/UI workflow.

## Dependencies

QC-03 for streaming identity.

## Regression risks

Avoid sending sensitive editor text without clear scope; context must never widen tool authority.
