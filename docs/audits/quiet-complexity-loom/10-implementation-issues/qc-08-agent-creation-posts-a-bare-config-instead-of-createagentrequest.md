# QC-08 — Agent creation posts a bare config instead of CreateAgentRequest

Severity: **P1**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

The JSON editor produces an agent configuration; Rust posts that object directly to /v1/agents. Loom requires a config envelope or configPath, so a normal named configuration is rejected.

## Evidence

- [src/main.ts:4214](/home/ed/loom-ide-tauri/src/main.ts:4214) (`async function submitAgentCreate(`)
- [src-tauri/src/loom_http.rs:278](/home/ed/loom-ide-tauri/src-tauri/src/loom_http.rs:278) (`pub async fn agent_create(`)
- [loom/proto/loom/v1/loom.proto:2054](/home/ed/work/loom/proto/loom/v1/loom.proto:2054) (`message CreateAgentRequest`)
- [loom/pkg/server/agent_lifecycle.go:170](/home/ed/work/loom/pkg/server/agent_lifecycle.go:170) (`if req.Config == nil && req.ConfigPath == ""`)

## Root cause

Tauri invoke arguments and Loom request JSON were treated as the same object. The describe-to-create prompt also asks the default agent to act as Weaver rather than selecting a proven Weaver capability.

## Expected behavior

Reviewed valid AgentConfig reaches the runtime once and returns the created immutable ID; invalid config remains a visible validation error.

## Proposed correction

Wrap the reviewed object as {config: ...} at the Rust HTTP boundary. Generate/review actual AgentConfig fields, including its nested LLM/tools schema. Do not call a default-agent prompt a verified Weaver integration.

## Affected components

Agent creation dialog and HTTP command.

## Relevant Loom contracts

CreateAgentRequest.config; AgentConfig; CreateAgentFromConfig validation. Go protojson probe confirms rejection of a bare name and acceptance of its envelope.

## Acceptance criteria

- A minimally valid reviewed config creates one agent and refreshes its row.
- Malformed or unknown config fields produce a visible error.
- Description proposals identify which real agent produced them.

## Verification strategy

Generated contract fixture and isolated create/list/start/stop/restart round trip.

## Dependencies

None.

## Regression risks

Creating an agent may configure executable tools; retain review and server validation.


---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`b6c612f`). Agent create wraps `CreateAgentRequest.config`.
