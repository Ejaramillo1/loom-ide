# QC-21 — Model switching omits the provider and does not target the session owner

Severity: **P1**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

The session model selector calls switchModel(detail.id, undefined, modelSel.value). Loom requires provider+model on this path and returns HTTP 400. The Rust command also has no agent ID; the multi-agent implementation selects the default agent when agent_id is absent rather than deriving it from session_id.

## Evidence

- [src/main.ts:4420](/home/ed/loom-ide-tauri/src/main.ts:4420) (`await switchModel(detail.id, undefined, modelSel.value)`)
- [src-tauri/src/lib.rs:1601](/home/ed/loom-ide-tauri/src-tauri/src/lib.rs:1601) (`async fn switch_model(`)
- [/home/ed/work/loom/pkg/server/multi_agent.go:3658](/home/ed/work/loom/pkg/server/multi_agent.go:3658) (`// Legacy switch: require session_id, provider, and model.`)

## Root cause

The UI treats a model ID and session URL as a complete per-session switch contract; the actual server requires provider and agent ownership and changes an agent provider, which can affect multiple sessions.

## Expected behavior

Selecting a model changes the intended agent/provider under explicitly stated scope, returns the effective model and preserves session context as promised.

## Proposed correction

Carry the selected ModelInfo provider and authoritative session owner agent ID to the existing command, validate the full request and read SwitchModelResponse.success/newModel. Clarify that this backend changes agent-level provider state; do not promise isolation per session without backend support.

## Affected components

Session model selector, API/Rust switch command, Loom SwitchModel routing.

## Relevant Loom contracts

SwitchModelRequest.provider/model/agent_id/preserve_context; SwitchModelResponse.success/new_model. Safe live missing-provider request returns 400 before any agent lookup/mutation; see management-validation-probes.json.

## Acceptance criteria

- A normal UI selection sends provider/model and the correct owner ID.
- Two agents are present: switching one never changes the default/other agent.
- Any sharing across sessions is explicit and effective model is read back.

## Verification strategy

Generated request contract tests; contained two-agent model switch/readback with a retained conversation. No live model switch was performed in this audit.

## Dependencies

QC-01 for runtime authority and QC-02 for live deployment containment.

## Regression risks

Do not silently reset context, change other agents, or imply agent-wide settings are private to one session.
