# 10 — Implementation issues

22 independently scoped issues: 2 P0, 14 P1, 6 P2. No fixes implemented. Each file is self-contained. The full requested system scope includes every confirmed actionable issue, including management contracts found during the final cross-check.

| ID | Severity | Issue | Confidence |
|---|---|---|---|
| QC-01 | P0 | [Autonomy changes do not constrain Loom execution](qc-01-autonomy-changes-do-not-constrain-loom-execution.md) | Confirmed |
| QC-02 | P0 | [The live Loom gateway exceeds the stated localhost trust boundary](qc-02-the-live-loom-gateway-exceeds-the-stated-localhost-trust-boundary.md) | Confirmed |
| QC-03 | P1 | [Streaming chat loses the selected session and agent](qc-03-streaming-chat-loses-the-selected-session-and-agent.md) | Confirmed |
| QC-04 | P1 | [Failed or truncated chat streams are reported as completed](qc-04-failed-or-truncated-chat-streams-are-reported-as-completed.md) | Confirmed |
| QC-05 | P1 | [Non-chat subscriptions use the wrong streaming protocol](qc-05-non-chat-subscriptions-use-the-wrong-streaming-protocol.md) | Confirmed |
| QC-06 | P1 | [Clarification acknowledgements always fail decoding](qc-06-clarification-acknowledgements-always-fail-decoding.md) | Confirmed |
| QC-07 | P1 | [Approval cards answer the wrong Loom request store](qc-07-approval-cards-answer-the-wrong-loom-request-store.md) | Strongly supported: separate stores and wrong route confirmed; live pending approvals were not modified. |
| QC-08 | P1 | [Agent creation posts a bare config instead of CreateAgentRequest](qc-08-agent-creation-posts-a-bare-config-instead-of-createagentrequest.md) | Confirmed |
| QC-09 | P1 | [The advertised context pack never reaches agent chat](qc-09-the-advertised-context-pack-never-reaches-agent-chat.md) | Confirmed |
| QC-10 | P1 | [Task and skill annotations are not registered HTTP services](qc-10-task-and-skill-annotations-are-not-registered-http-services.md) | Confirmed |
| QC-11 | P1 | [Task updates and ready/blocked lists use incompatible shapes](qc-11-task-updates-and-ready-blocked-lists-use-incompatible-shapes.md) | Confirmed |
| QC-12 | P1 | [MCP add, test and health decode different contracts as server rows](qc-12-mcp-add-test-and-health-decode-different-contracts-as-server-rows.md) | Confirmed |
| QC-13 | P1 | [Workflow completion can attach output to the wrong work](qc-13-workflow-completion-can-attach-output-to-the-wrong-work.md) | Confirmed |
| QC-14 | P1 | [Work evidence and execution provenance vanish on restart](qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md) | Confirmed |
| QC-15 | P2 | [Artifact search can display results for an older query](qc-15-artifact-search-can-display-results-for-an-older-query.md) | Confirmed |
| QC-16 | P2 | [The shared vault path is compiled to the checkout](qc-16-the-shared-vault-path-is-compiled-to-the-checkout.md) | Confirmed |
| QC-17 | P2 | [Changing sessions leaks live subscriptions](qc-17-changing-sessions-leaks-live-subscriptions.md) | Confirmed |
| QC-18 | P2 | [The vault change signature misses relation-only edits](qc-18-the-vault-change-signature-misses-relation-only-edits.md) | Confirmed |
| QC-19 | P2 | [Canvas layout persistence can silently lose saved positions](qc-19-canvas-layout-persistence-can-silently-lose-saved-positions.md) | Confirmed |
| QC-20 | P2 | [Current feature documentation contradicts the shipped architecture](qc-20-current-feature-documentation-contradicts-the-shipped-architecture.md) | Confirmed |
| QC-21 | P1 | [Model switching omits the provider and does not target the session owner](qc-21-model-switching-omits-the-provider-and-does-not-target-the-session-owner.md) | Confirmed |
| QC-22 | P1 | [App creation sends HTML to a declarative-spec API](qc-22-app-creation-sends-html-to-a-declarative-spec-api.md) | Confirmed |
