# 01 — Executive audit

**What this repo does:** Quiet Complexity combines a local file/editor, persistent human work and intent records, a markdown knowledge vault, an embedded Unity bench, and a client for Loom sessions, agents and execution. Loom owns model/tool execution and its own persisted sessions/artifacts. The expected load is one local human, potentially several concurrent backend turns and a growing personal vault, not a multi-tenant hosted IDE.

**Is Quiet Complexity fully integrated with Loom? NO.** It has genuine HTTP integrations and useful local capabilities, but the normal streaming path can lose execution identity and display failure as completion. Human control remains partly advisory. Passing unit tests and polished spatial rendering do not close these gaps.

## Evidence and maturity

IDE: `/home/ed/loom-ide-tauri`, branch `tauri-prototype`, `c46aa644e4801dfd1156e61cbbea79111fd8ac3e`, origin `Ejaramillo1/loom-ide`. Loom: `/home/ed/work/loom`, branch `main`, `ab46f76f1bd962a82c31ede81233d538cb2ed773`, origin `teradata-labs/loom`. Both worktrees were clean at entry. A running gateway reports looms 1.4.0; its binary commit was not established. Local source and live response evidence are kept separate.

All six required checks pass: 63 frontend tests; 94 Tauri tests with 2 ignored; 22 native tests; frontend build; Rust formatting; Unity recompile reports up-to-date with 0 errors/0 warnings. An additional existing read-only Rust gateway smoke test passes, and three Go contract assertions plus three extracted frontend-handler probes reproduce specific contract/sequence defects. These do not demonstrate a complete human → Tauri → model/tools → visible response workflow.

## Must fix first

1. **P0 — Control is advisory.** [QC-01: Autonomy changes do not constrain Loom execution](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md). Local rank/history rules are real, but execution commands do not enforce them. Manual or paused work can still run agents; tightening a dial does not change an active runtime's tool authority.
2. **P0 — The actual server exceeds the documented local trust boundary.** [QC-02: The live Loom gateway exceeds the stated localhost trust boundary](10-implementation-issues/qc-02-the-live-loom-gateway-exceeds-the-stated-localhost-trust-boundary.md). The live process listens on all interfaces; unauthenticated reads and wildcard CORS are observed. Reachability through the host firewall and browser exploitation were not tested.
3. **P1 — Identity and success reporting are unreliable.** [QC-03: Streaming chat loses the selected session and agent](10-implementation-issues/qc-03-streaming-chat-loses-the-selected-session-and-agent.md) and [QC-04: Failed or truncated chat streams are reported as completed](10-implementation-issues/qc-04-failed-or-truncated-chat-streams-are-reported-as-completed.md). The exact SSE decoder drops the chosen session/agent; a real HTTP-200 error payload enters the UI's verified/done route.
4. **P1 — Other streams and human answers do not follow their contracts.** [QC-05: Non-chat subscriptions use the wrong streaming protocol](10-implementation-issues/qc-05-non-chat-subscriptions-use-the-wrong-streaming-protocol.md), [QC-06: Clarification acknowledgements always fail decoding](10-implementation-issues/qc-06-clarification-acknowledgements-always-fail-decoding.md), [QC-07: Approval cards answer the wrong Loom request store](10-implementation-issues/qc-07-approval-cards-answer-the-wrong-loom-request-store.md). Gateway newline JSON is consumed as SSE; clarification responses have no status string; stored approvals are answered through a different legacy map.
5. **P1 — Some management surfaces cannot perform their normal requests.** [QC-08: Agent creation posts a bare config instead of CreateAgentRequest](10-implementation-issues/qc-08-agent-creation-posts-a-bare-config-instead-of-createagentrequest.md), [QC-10: Task and skill annotations are not registered HTTP services](10-implementation-issues/qc-10-task-and-skill-annotations-are-not-registered-http-services.md), [QC-11: Task updates and ready/blocked lists use incompatible shapes](10-implementation-issues/qc-11-task-updates-and-ready-blocked-lists-use-incompatible-shapes.md), [QC-12: MCP add, test and health decode different contracts as server rows](10-implementation-issues/qc-12-mcp-add-test-and-health-decode-different-contracts-as-server-rows.md). A schema annotation is not a registered running API.

There are **22 actionable findings: 2 P0, 14 P1, 6 P2**. [Each issue](10-implementation-issues/README.md) contains current source evidence, confidence, the smallest correction, acceptance tests, dependencies and regression risks. Lower-confidence performance observations are kept as verification work, not invented additional findings.

## Answers to the ten integration questions

| Question | Answer at this baseline |
|---|---|
| Completely functional capabilities? | No feature is promoted to FULLY INTEGRATED without a live UI execution/restart test. Gateway configuration/storage/model/tool/provider/session reads are verified through the real Rust HTTP/parser smoke test. Local file/vault/store behavior has substantial passing unit evidence. |
| Partially integrated? | Unary chat and experiment arms; session/agent/model browsing; model lists; patterns; workflow catalogue/schedules; artifacts including content and search; traces; local-work session/artifact links; Unity host navigation/state. Mutations and rendered backend feedback generally lack live UI evidence. |
| Disconnected UI elements? | Autonomy and paused work are local planning semantics; the avatar is decorative; local review is not a Loom approval inbox. The local knowledge graph is not remote graph memory. These boundaries must remain explicit. |
| Supported Loom capabilities not exposed? | Remote GraphMemory/MemoryLayer; judge evaluation; learning; teleprompter; LLM scheduling; ToolRegistry operations beyond the HTTP subset; bus/shared-memory/async messaging; artifact upload/delete; workflow template application and some registry operations. See the reverse inventory in report 02. |
| Advertised but unsupported? | Universal server-enforced four-level IDE autonomy has no existing Weave policy contract; arbitrary local work pause has no universal runtime pause RPC. Judge history is explicitly empty in this Loom implementation. A stored approval answer is implemented in a store but not exposed through the inspected HTTP API. These need contracts/adapters, not pretend frontend wiring. |
| Silent failure/misrepresentation? | SSE failed-stage/EOF → completion; ignored context map; wrong gateway stream decoder; MCP health map → empty list; accepted clarification → client error; task response-object → bogus task; stale artifact search; missing durable execution ownership. |
| Reliable execution blockers? | Lost agent/session identity, incompatible stream protocols, agent-create envelope, unregistered task/skill services, broken human-answer paths, and invalid model/app management requests. |
| Human control/understanding gaps? | Advisory autonomy, ambiguous Stop versus server cancellation, approval decisions routed to the wrong store, evidence lost on restart, generated experiment prose lacking enforced configurations/evaluation. |
| Smallest completion set? | Contain trust; fix identity/terminal/answer contracts; use the actual gateway protocols; register existing services; correct mutation envelopes; persist provenance; verify bounded end-to-end/restart/failure cases. Expand gRPC-only capabilities only through the recorded transport decision. |
| Preserve Quiet Complexity? | Keep the vanilla TypeScript/Tauri/Unity shell. Put execution, artifacts, evidence and controls under work/intent objects, use existing detail/dialog surfaces, and reveal lower-level capabilities contextually. No new dashboard or framework is required. |

## Decisions taken

- Audit-only: the user's explicit discover/verify/document instruction overrides standing instructions to fix failing checks.
- Preserve the current four shipped autonomy levels and all recorded defaults; assess enforcement rather than inventing policy.
- Treat local work/vault capabilities as intentionally local; only mark a Loom claim integrated when its actual path supports it.
- Read and safely probe the existing gateway without creating sessions, running tools/models, editing production configuration or resolving real human requests.
- Keep Q2 deferred and keep the central sphere; neither is remediation for a backend defect.
- Use existing dependencies and single-agent work; no delegation was requested.

**Verdict:** real connectivity, incomplete product integration. Fix execution identity, truthful failure reporting and enforced human control before expanding features. Not checked: complete live UI/model execution, real-window visuals, destructive recovery and full Loom/provider suites; report 08 gives exact blockers.

## Concurrent audit boundary

Other audit files and live UI/model evidence appeared in the parent directory during this run. They were preserved and are not claimed as executions of this contract-focused pass. This complete report set is isolated here to avoid competing writes. Its own source, probes and raw logs are in evidence/. Statements that UI/model execution was not performed refer to this pass; they do not assert that no other auditor executed it. Review parent-directory evidence separately before reconciling the two assessments.

## Additional confirmed management contracts

QC-21: selecting a model omits the provider and cannot reliably target the session-owning agent. QC-22: Add app sends raw html to a declarative UIAppSpec API. The exact request shapes both received safe HTTP 400 validation rejections before mutation. These are included in the 22 issues and the 41-feature matrix.
