# 08 — Test and verification report

All results below were executed during this audit, 15 November 2026. Raw output is retained under evidence/. Host log clock strings may use another timezone; the report date uses America/Tijuana. Historical design-report counts were not reused as test results.

## Required checks

| Command | Result | Evidence |
|---|---|---|
| `npm test -- --run` | Exit 0; **63 passed**, 8 files | [log](evidence/frontend-tests.log) |
| `npm run build` | Exit 0; TypeScript + Vite successful; bundle/plugin timing warnings retained | [log](evidence/frontend-build.log) |
| `cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib` | Exit 0; **94 passed, 0 failed, 2 ignored** | [log](evidence/tauri-tests.log) |
| `cargo test --offline --locked --manifest-path native-app/Cargo.toml` | Exit 0; **22 passed, 0 failed** | [log](evidence/native-tests.log) |
| `cargo fmt --check --manifest-path src-tauri/Cargo.toml` | Exit 0 | [log](evidence/rustfmt.log) |
| `unity recompile --project-path "$PWD/unity-memory-palace" --format json` | Exit 0; **up_to_date, 0 errors, 0 warnings** | [log](evidence/unity-recompile.log) |

The two ignored Rust tests are the live-gateway parser smoke and real-vault read-only smoke. The former was deliberately run separately below; the latter remained ignored to avoid depending on or reopening private vault data/recovery journals. Initial checks ran in parallel across independent suites; no application code changed to make any result pass.

## Additional checks and contract reproduction

| Command / probe | Observed result | What it proves / does not prove |
|---|---|---|
| `cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib gateway_tests::live_gateway_responses_parse -- --ignored --exact` | **1 passed**, 95 filtered, exit 0; [log](evidence/live-gateway-test.log) | Actual Rust HTTP/parsers accept live config/storage/models/tools/providers and available session detail; no UI, execution or tool result proof |
| `GOTOOLCHAIN=local GOPROXY=off go -C /home/ed/work/loom run /home/ed/loom-ide-tauri/docs/audits/quiet-complexity-loom/contract-audit/evidence/contract_probe.go` | **3 assertions passed**; [source](evidence/contract_probe.go), [log](evidence/go-contract-probe.log) | Exact generated Go types/decoders reproduce camelCase loss, bare agent-config rejection and absent clarification status; no model is invoked |
| `node docs/audits/quiet-complexity-loom/contract-audit/evidence/frontend_contract_probe.mjs` | **3 reproductions passed**, exit 0; [source](evidence/frontend_contract_probe.mjs), [log](evidence/frontend-contract-probe.log) | Executes extracted current production handlers: failure progress goes to done; workflow completion uses current work; older artifact response overwrites newer. Deliberately reproduces defects, not a healthy product pass |
| Focused Go server test command below | Exit 1 at setup: cached `testify v1.12.1` missing, GOPROXY=off; [log](evidence/loom-focused-tests.log) | **NOT RUN**, no test assertions executed; dependencies were not installed and source was not changed |
| SHA-256 public/dist player comparison | **4/4 asset pairs identical**; [result](evidence/player-assets.json) | Build copied player bytes. Does not establish source/player parity or rendering |

Blocked command:

```sh
GOTOOLCHAIN=local GOPROXY=off go -C /home/ed/work/loom test ./pkg/server \
  -run '^(TestSSEStreamWrapperSendPreservesLegacyJSON|TestSSEStreamWrapperWriteHeartbeat|TestSSEStreamWrapperWritesConcurrent|TestAnswerClarificationQuestion_Success|TestStreamWorkflow_Validation|TestMultiAgentServer_WeaveRoutesToSessionOwnerAgent)$' \
  -count=1
```

Missing cached dependencies are a prerequisite blocker. The audit-only/no-install rule precludes installing them or editing code to pass. No three cosmetic retries were made against the same unavailable dependency.

## Safe live gateway probes

[Environment](evidence/environment.json), [contract probes](evidence/live-contract-probes.json), [MCP validation](evidence/mcp-validation-probe.json) and [network boundary](evidence/network-boundary.json) contain sanitized observations. No chat histories, credentials, model/tool content or private configuration were saved.

- `/health`, agent/session reads: HTTP 200. The static health route is not a provider or agent execution check.
- `/v1/boards` and `/v1/tasks`: **404**. HTTP annotations alone do not expose peer services.
- Patterns, schedule list and MCP health: **200**; returned top-level shapes were inspected without recording private rows.
- `POST /v1/weave:stream` with empty query: **HTTP 200**, SSE failed-stage error. Query validation runs before session generation/model/tool execution in the inspected source.
- Empty workflow stream and provider A/B requests: **400**, JSON error envelopes. No workflow/model was executed.
- Unknown audit-only clarification ID: **200**, application error “question not found or already answered”; no real pending request was answered.
- MCP connection Test with unsupported name: **400 unknown field**. Repeated without name against a deliberately nonexistent executable: **200 application error**. No executable was started or server config saved.
- The server reports HTTP `0.0.0.0:5006`, gRPC `0.0.0.0:60051`, TLS disabled. `ss` independently observed `*:5006` owned by looms. Read probes with `Origin: https://audit.invalid` returned wildcard CORS.

The gateway executable reports 1.4.0. Matching that version does not prove it is built from local `ab46f76f`; source-derived findings and live observations have separate confidence.

## Visual and end-to-end limits

A fresh local preview started on 127.0.0.1:4175. CUA inventory exposed no native app surfaces. Opening the built interface in its browser timed out after 30 seconds and reset the kernel, so no page/screenshot or portal click was observed. **Visual verification did not pass.** Generated old screenshots and Editor reports are not substitutes.

No isolated configured real-provider/no-side-effect agent environment was established. The running gateway contains user sessions/configuration; this audit did not create sessions, submit paid model turns, run arbitrary registered tools, trigger schedules, alter agents, upload/delete artifacts or resolve real approvals. Consequently a successful human → UI → Tauri → Loom model/tools → UI loop, cancellation of an actual tool, and client/server restart recovery remain **NOT VERIFIED**. Unblock with a contained backend/provider profile and an accessible actual Tauri window; use the workflows in report 09.

No release Tauri package rebuild, WebGL rebuild/Editor Play Mode self-check, full Go suite, all-provider test matrix, screen-reader/hardware profiling, destructive disk recovery or external network penetration test was performed. These limits do not weaken the confirmed decoder/control defects; they prevent claims of full working integration.

## Concurrent audit boundary

Other audit files and live UI/model evidence appeared in the parent directory during this run. They were preserved and are not claimed as executions of this contract-focused pass. This complete report set is isolated here to avoid competing writes. Its own source, probes and raw logs are in evidence/. Statements that UI/model execution was not performed refer to this pass; they do not assert that no other auditor executed it. Review parent-directory evidence separately before reconciling the two assessments.

## Additional management validation

[Safe management probes](evidence/management-validation-probes.json): the exact model-only switch request returned HTTP 400, provider required; the app name/html request returned HTTP 400, unknown field html. Both were rejected before any requested mutation. These establish QC-21/22.
