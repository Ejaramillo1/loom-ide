# QC-12 — MCP add, test and health decode different contracts as server rows

Severity: **P1**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

Add returns an envelope containing server; Test returns success/error rather than a server; Health returns a map. parse_mcp/list_field flatten or drop these shapes. The exact test request also sends an unsupported name field and is rejected by the live gateway.

## Evidence

- [src-tauri/src/loom_http.rs:125](/home/ed/loom-ide-tauri/src-tauri/src/loom_http.rs:125) (`pub async fn mcp_server_add(`)
- [src-tauri/src/loom_http.rs:239](/home/ed/loom-ide-tauri/src-tauri/src/loom_http.rs:239) (`pub async fn mcp_server_test(`)
- [src-tauri/src/loom_http.rs:230](/home/ed/loom-ide-tauri/src-tauri/src/loom_http.rs:230) (`pub async fn mcp_servers_health_check(`)
- [src/main.ts:4124](/home/ed/loom-ide-tauri/src/main.ts:4124) (`async function testMcpConfig(`)
- [loom/proto/loom/v1/loom.proto:2888](/home/ed/work/loom/proto/loom/v1/loom.proto:2888) (`message TestMCPServerConnectionResponse`)

## Root cause

One server-row parser is reused for unrelated RPC responses. The UI declares a test passed whenever invoke resolves, without checking the application success flag.

## Expected behavior

Add uses the actual returned server; Test reports its real result; Health updates status by name without replacing configured server rows with an empty list.

## Proposed correction

Remove unsupported name from Test, decode its success/error fields, unwrap Add.server, and merge the health map into the existing list. Preserve server errors and configuration fields.

## Affected components

MCP Rust wrappers, test/add dialog and health list.

## Relevant Loom contracts

AddMCPServerResponse.server; TestMCPServerConnectionResponse.success/error; HealthCheckMCPServersResponse.servers map. Live probe: with name HTTP 400; without name a missing executable returns HTTP 200 with error.

## Acceptance criteria

- Missing command never displays passed.
- Successful add reports the real server name.
- Health check retains existing rows and updates their actual health.

## Verification strategy

Run captured validation fixtures; test a harmless isolated MCP server only after explicit configuration review.

## Dependencies

None.

## Regression risks

Do not launch arbitrary executables during tests; preserve env/arguments and existing server identities.
