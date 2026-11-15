# 03 — Complete integration matrix

Baseline: IDE `c46aa644`, Loom `ab46f76f`; 15 November 2026. This inventories the active views, their meaningful workflows and the retained alternative surfaces. [139 command mappings](evidence/tauri-command-inventory.md) and [162 RPCs](evidence/loom-rpc-inventory.md) provide the exhaustive lower-level inventory. Source locations are resolved now, not copied from historical audits.

**No row is FULLY INTEGRATED.** That classification requires an executed real UI/backend workflow, both directions, failures and restart evidence. PARTIALLY INTEGRATED means real source wiring/read or unit evidence with explicit remaining gaps. UI ONLY means local semantics do not govern Loom, even if that local feature works. UNSUPPORTED can mean unsupported by the current IDE transport; it does not deny Loom implementation. BROKEN requires a concrete incompatible contract or observed defect. NOT VERIFIED is used when source wiring alone cannot establish behavior.

Common transport: frontend wrappers invoke Tauri; unary Rust performs status-checked HTTP then serde/protojson decoding; streaming uses the separate raw reader; the frontend renders through its own state. All remote operations require the configured service and deployment boundary. All source claims below are static unless the evidence field says executed. Safe validation probes execute rejection paths, never the feature's successful model/tool mutation.

| # | Feature | Classification | Remediation |
|---|---|---|---|
| 01 | [Chat — unary fallback](#feature-01) | **PARTIALLY INTEGRATED** | [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-09](10-implementation-issues/qc-09-the-advertised-context-pack-never-reaches-agent-chat.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md) |
| 02 | [Chat — normal streaming path](#feature-02) | **BROKEN** | [QC-03](10-implementation-issues/qc-03-streaming-chat-loses-the-selected-session-and-agent.md), [QC-04](10-implementation-issues/qc-04-failed-or-truncated-chat-streams-are-reported-as-completed.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md) |
| 03 | [Stop / interruption](#feature-03) | **PARTIALLY INTEGRATED** | [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-04](10-implementation-issues/qc-04-failed-or-truncated-chat-streams-are-reported-as-completed.md) |
| 04 | [Legacy clarification cards](#feature-04) | **BROKEN** | [QC-06](10-implementation-issues/qc-06-clarification-acknowledgements-always-fail-decoding.md), [QC-07](10-implementation-issues/qc-07-approval-cards-answer-the-wrong-loom-request-store.md) |
| 05 | [Stored approvals / parked human requests](#feature-05) | **BROKEN** | [QC-07](10-implementation-issues/qc-07-approval-cards-answer-the-wrong-loom-request-store.md) |
| 06 | [Work items and manual planning](#feature-06) | **PARTIALLY INTEGRATED** | [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-13](10-implementation-issues/qc-13-workflow-completion-can-attach-output-to-the-wrong-work.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md) |
| 07 | [Intent and acceptance criteria](#feature-07) | **UI ONLY** | [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-09](10-implementation-issues/qc-09-the-advertised-context-pack-never-reaches-agent-chat.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md) |
| 08 | [Autonomy and work pause](#feature-08) | **UI ONLY** | [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md) |
| 09 | [Agents — list and detail](#feature-09) | **PARTIALLY INTEGRATED** | [QC-03](10-implementation-issues/qc-03-streaming-chat-loses-the-selected-session-and-agent.md) |
| 10 | [Agents — create from reviewed JSON / description](#feature-10) | **BROKEN** | [QC-08](10-implementation-issues/qc-08-agent-creation-posts-a-bare-config-instead-of-createagentrequest.md) |
| 11 | [Agents — start/stop/reload/delete](#feature-11) | **NOT VERIFIED** | No confirmed defect; acceptance not executed. |
| 12 | [Sessions — select/create/history/resume/delete/resolve-gap](#feature-12) | **PARTIALLY INTEGRATED** | [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-03](10-implementation-issues/qc-03-streaming-chat-loses-the-selected-session-and-agent.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md) |
| 13 | [Session live subscription](#feature-13) | **BROKEN** | [QC-05](10-implementation-issues/qc-05-non-chat-subscriptions-use-the-wrong-streaming-protocol.md), [QC-17](10-implementation-issues/qc-17-changing-sessions-leaks-live-subscriptions.md) |
| 14 | [Models/providers — availability](#feature-14) | **PARTIALLY INTEGRATED** | No confirmed defect; acceptance not executed. |
| 15 | [Models — switch from session detail](#feature-15) | **BROKEN** | [QC-21](10-implementation-issues/qc-21-model-switching-omits-the-provider-and-does-not-target-the-session-owner.md) |
| 16 | [Tools — definitions and registration](#feature-16) | **PARTIALLY INTEGRATED** | [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-07](10-implementation-issues/qc-07-approval-cards-answer-the-wrong-loom-request-store.md) |
| 17 | [MCP servers and tools](#feature-17) | **BROKEN** | [QC-12](10-implementation-issues/qc-12-mcp-add-test-and-health-decode-different-contracts-as-server-rows.md) |
| 18 | [Memory — local notes / versions / archive](#feature-18) | **PARTIALLY INTEGRATED** | [QC-09](10-implementation-issues/qc-09-the-advertised-context-pack-never-reaches-agent-chat.md), [QC-16](10-implementation-issues/qc-16-the-shared-vault-path-is-compiled-to-the-checkout.md), [QC-18](10-implementation-issues/qc-18-the-vault-change-signature-misses-relation-only-edits.md) |
| 19 | [Memory — Graph and Canvas](#feature-19) | **PARTIALLY INTEGRATED** | [QC-18](10-implementation-issues/qc-18-the-vault-change-signature-misses-relation-only-edits.md), [QC-19](10-implementation-issues/qc-19-canvas-layout-persistence-can-silently-lose-saved-positions.md) |
| 20 | [Memory garden / review and Activity](#feature-20) | **PARTIALLY INTEGRATED** | [QC-07](10-implementation-issues/qc-07-approval-cards-answer-the-wrong-loom-request-store.md), [QC-18](10-implementation-issues/qc-18-the-vault-change-signature-misses-relation-only-edits.md) |
| 21 | [Memory — manual Sync from Loom](#feature-21) | **PARTIALLY INTEGRATED** | [QC-09](10-implementation-issues/qc-09-the-advertised-context-pack-never-reaches-agent-chat.md), [QC-16](10-implementation-issues/qc-16-the-shared-vault-path-is-compiled-to-the-checkout.md) |
| 22 | [Remote GraphMemory and MemoryLayer](#feature-22) | **UNSUPPORTED** | No confirmed defect; acceptance not executed. |
| 23 | [Code — files, editor and manual save](#feature-23) | **PARTIALLY INTEGRATED** | [QC-09](10-implementation-issues/qc-09-the-advertised-context-pack-never-reaches-agent-chat.md) |
| 24 | [Experiments — arms and recorded decisions](#feature-24) | **PARTIALLY INTEGRATED** | [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-09](10-implementation-issues/qc-09-the-advertised-context-pack-never-reaches-agent-chat.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md) |
| 25 | [Provider A/B comparison](#feature-25) | **BROKEN** | [QC-05](10-implementation-issues/qc-05-non-chat-subscriptions-use-the-wrong-streaming-protocol.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md) |
| 26 | [Workflow catalogue, execute and execution results](#feature-26) | **BROKEN** | [QC-04](10-implementation-issues/qc-04-failed-or-truncated-chat-streams-are-reported-as-completed.md), [QC-05](10-implementation-issues/qc-05-non-chat-subscriptions-use-the-wrong-streaming-protocol.md), [QC-13](10-implementation-issues/qc-13-workflow-completion-can-attach-output-to-the-wrong-work.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md) |
| 27 | [Workflow schedules and scheduled cancellation](#feature-27) | **NOT VERIFIED** | [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md) |
| 28 | [Artifacts — list, View content, search and attachments](#feature-28) | **PARTIALLY INTEGRATED** | [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md), [QC-15](10-implementation-issues/qc-15-artifact-search-can-display-results-for-an-older-query.md) |
| 29 | [Evidence feed / provenance labels](#feature-29) | **PARTIALLY INTEGRATED** | [QC-04](10-implementation-issues/qc-04-failed-or-truncated-chat-streams-are-reported-as-completed.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md) |
| 30 | [Observability — trace detail](#feature-30) | **PARTIALLY INTEGRATED** | [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md) |
| 31 | [Unity / spatial navigation and synchronization](#feature-31) | **PARTIALLY INTEGRATED** | [QC-18](10-implementation-issues/qc-18-the-vault-change-signature-misses-relation-only-edits.md) |
| 32 | [Sphere and connection/state pill](#feature-32) | **PARTIALLY INTEGRATED** | [QC-04](10-implementation-issues/qc-04-failed-or-truncated-chat-streams-are-reported-as-completed.md) |
| 33 | [Attention — decisions/proposal bell](#feature-33) | **PARTIALLY INTEGRATED** | [QC-07](10-implementation-issues/qc-07-approval-cards-answer-the-wrong-loom-request-store.md), [QC-18](10-implementation-issues/qc-18-the-vault-change-signature-misses-relation-only-edits.md) |
| 34 | [Settings — appearance, motion, quality and connection](#feature-34) | **PARTIALLY INTEGRATED** | [QC-02](10-implementation-issues/qc-02-the-live-loom-gateway-exceeds-the-stated-localhost-trust-boundary.md) |
| 35 | [Patterns shelf/detail/create/load](#feature-35) | **PARTIALLY INTEGRATED** | [QC-05](10-implementation-issues/qc-05-non-chat-subscriptions-use-the-wrong-streaming-protocol.md) |
| 36 | [Skills add/classify/bulk import](#feature-36) | **BROKEN** | [QC-05](10-implementation-issues/qc-05-non-chat-subscriptions-use-the-wrong-streaming-protocol.md), [QC-10](10-implementation-issues/qc-10-task-and-skill-annotations-are-not-registered-http-services.md) |
| 37 | [Tasks/boards/dependencies/decomposition/context](#feature-37) | **BROKEN** | [QC-05](10-implementation-issues/qc-05-non-chat-subscriptions-use-the-wrong-streaming-protocol.md), [QC-10](10-implementation-issues/qc-10-task-and-skill-annotations-are-not-registered-http-services.md), [QC-11](10-implementation-issues/qc-11-task-updates-and-ready-blocked-lists-use-incompatible-shapes.md) |
| 38 | [Apps list/open/delete and creation](#feature-38) | **BROKEN** | [QC-22](10-implementation-issues/qc-22-app-creation-sends-html-to-a-declarative-spec-api.md) |
| 39 | [Server configuration, TLS and storage administration](#feature-39) | **PARTIALLY INTEGRATED** | [QC-02](10-implementation-issues/qc-02-the-live-loom-gateway-exceeds-the-stated-localhost-trust-boundary.md) |
| 40 | [Menus, search, drawers and keyboard paths](#feature-40) | **NOT VERIFIED** | [QC-15](10-implementation-issues/qc-15-artifact-search-can-display-results-for-an-older-query.md), [QC-20](10-implementation-issues/qc-20-current-feature-documentation-contradicts-the-shipped-architecture.md) |
| 41 | [Plain browser preview and retired native window](#feature-41) | **PARTIALLY INTEGRATED** | [QC-20](10-implementation-issues/qc-20-current-feature-documentation-contradicts-the-shipped-architecture.md) |

<a id="feature-01"></a>

## 01 — Chat — unary fallback

**PARTIALLY INTEGRATED**. UI/source: [src/main.ts:5274](/home/ed/loom-ide-tauri/src/main.ts:5274) `async function sendChatUnary(`.

- **Frontend → Tauri/Rust → API:** api.askLoom → lib.rs::ask_loom → POST /v1/weave
- **Underlying Loom implementation:** LoomService.Weave → multi_agent.go::Weave → agent.Chat → provider/tool loop
- **Request / response contract:** WeaveRequest query/sessionId/agentId/context; WeaveResponse text/sessionId/traceId.
- **State synchronization / persistence:** Caches text by originating work, links returned session ID; sessions persisted by Loom; trace metadata is not retained in local cache.
- **Error handling:** HTTP/parse failures visible; unsent text restored. Link save is best-effort and errors swallowed.
- **Executed evidence / limitation:** Request/response source traced; Rust live read smoke does not call Weave. No real turn executed.
- **Missing behavior / smallest correction:** Context unused by backend; autonomy advisory; no current end-to-end success proof.
- **Acceptance to promote integration:** Real bounded two-turn model/tool run from work, trace lookup, reload and exact owner/session readback.
- **Severity / issue:** [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-09](10-implementation-issues/qc-09-the-advertised-context-pack-never-reaches-agent-chat.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md)

<a id="feature-02"></a>

## 02 — Chat — normal streaming path

**BROKEN**. UI/source: [src/main.ts:5346](/home/ed/loom-ide-tauri/src/main.ts:5346) `async function sendChat(text:`.

- **Frontend → Tauri/Rust → API:** api.askLoomStream → loom_stream.rs::ask_loom_stream/run_stream → custom POST /v1/weave:stream → loom-stream events
- **Underlying Loom implementation:** HTTPServer.handleStreamWeaveSSE → MultiAgentServer.StreamWeave → agent.ChatWithProgress.
- **Request / response contract:** Custom encoding/json expects session_id/agent_id; UI receives snake_case WeaveProgress. Rust sends camelCase identity.
- **State synchronization / persistence:** Request state/partial tool lines in Map; completion guesses session if missing; cache contains only text.
- **Error handling:** Failed-stage payload is treated as progress; EOF creates done; asynchronous rejection bypasses unary fallback.
- **Executed evidence / limitation:** Go decoder probe, safe live empty-query failure, extracted current UI handler reproduction.
- **Missing behavior / smallest correction:** Chosen agent/session discarded; failure can show completed; origin/trace untrustworthy.
- **Acceptance to promote integration:** Choose non-default agent/session, send twice, inject execution failure/disconnect and prove actual UI/result IDs.
- **Severity / issue:** [QC-03](10-implementation-issues/qc-03-streaming-chat-loses-the-selected-session-and-agent.md), [QC-04](10-implementation-issues/qc-04-failed-or-truncated-chat-streams-are-reported-as-completed.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md)

<a id="feature-03"></a>

## 03 — Stop / interruption

**PARTIALLY INTEGRATED**. UI/source: [src/main.ts:5029](/home/ed/loom-ide-tauri/src/main.ts:5029) `function renderChatControls(`.

- **Frontend → Tauri/Rust → API:** api.cancelLoomStream → loom_stream.rs::cancel_loom_stream → atomic flag/read wake/socket close.
- **Underlying Loom implementation:** Loom request context cancellation; no universal arbitrary-tool pause endpoint.
- **Request / response contract:** Frontend requestId is a local stream handle, not a durable server execution ID.
- **State synchronization / persistence:** Active stream state cleared locally; no server acknowledgement/history reconciliation is persisted.
- **Error handling:** Unknown handle errors; read timeout approximately 20 s; cancelled label distinct from partial reply.
- **Executed evidence / limitation:** Rust cancellation validation test passes. Actual running model/tool interruption was not executed.
- **Missing behavior / smallest correction:** Cannot establish stopped side effects from a set flag or closed socket.
- **Acceptance to promote integration:** Stop a harmless long-running counted tool, inspect backend cancellation and any subsequent side effects.
- **Severity / issue:** [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-04](10-implementation-issues/qc-04-failed-or-truncated-chat-streams-are-reported-as-completed.md)

<a id="feature-04"></a>

## 04 — Legacy clarification cards

**BROKEN**. UI/source: [src/main.ts:5104](/home/ed/loom-ide-tauri/src/main.ts:5104) `function renderHitlCard(`.

- **Frontend → Tauri/Rust → API:** answerClarification → loom_stream.rs::answer_clarification → /v1/clarifications/{session}/answer.
- **Underlying Loom implementation:** multi_agent.go::AnswerClarificationQuestion → pendingQuestions answer channel.
- **Request / response contract:** Request questionId/answer; response success/accepted/error, no status.
- **State synchronization / persistence:** Transient card; guesses newest session if unknown; accepted server question may already be consumed.
- **Error handling:** Always rejects a missing status, including a genuine accepted response.
- **Executed evidence / limitation:** Go response fixture and safe nonexistent-question HTTP-200 application rejection.
- **Missing behavior / smallest correction:** Delivery acknowledgement invalid; legacy question_id versus stored request_id not separated.
- **Acceptance to promote integration:** Ask/answer a real contained pending legacy question, duplicate/expire it and show exact server acknowledgement.
- **Severity / issue:** [QC-06](10-implementation-issues/qc-06-clarification-acknowledgements-always-fail-decoding.md), [QC-07](10-implementation-issues/qc-07-approval-cards-answer-the-wrong-loom-request-store.md)

<a id="feature-05"></a>

## 05 — Stored approvals / parked human requests

**BROKEN**. UI/source: [src/main.ts:5110](/home/ed/loom-ide-tauri/src/main.ts:5110) `const isApproval = hitl.kind === "approval"`.

- **Frontend → Tauri/Rust → API:** Approve/Deny strings reuse clarification command.
- **Underlying Loom implementation:** HumanRequestStore.RespondToRequest / held-call admission; HTTP answer adapter not found.
- **Request / response contract:** HITLRequestInfo request_id/kind/summary/context_json; store uses approved/rejected/responded states.
- **State synchronization / persistence:** Actual hold is backend-owned; UI card is transient and does not reconcile stored decisions.
- **Error handling:** Legacy map returns unknown question for a store-owned ID; approval context incomplete.
- **Executed evidence / limitation:** Independent store and RPC implementations inspected; real pending approvals untouched.
- **Missing behavior / smallest correction:** Missing answer exposure is distinct from unsupported runtime holds.
- **Acceptance to promote integration:** Harmless held tool: inspect reasons/args; approve once, deny once, expire and restart with authoritative state.
- **Severity / issue:** [QC-07](10-implementation-issues/qc-07-approval-cards-answer-the-wrong-loom-request-store.md)

<a id="feature-06"></a>

## 06 — Work items and manual planning

**PARTIALLY INTEGRATED**. UI/source: [src/main.ts:1424](/home/ed/loom-ide-tauri/src/main.ts:1424) `function renderWorkDetail(`.

- **Frontend → Tauri/Rust → API:** get/add/set_work_* in lib.rs → WorkStore; session/artifact APIs for references.
- **Underlying Loom implementation:** No Loom WorkItem RPC; optional Loom sessions/artifacts and separate task boards.
- **Request / response contract:** Local WorkItem active/paused, intent_id, session_id, artifact_ids and criteria.
- **State synchronization / persistence:** work.json atomic persistence; execution/experiment relations remain frontend Maps.
- **Error handling:** Local persistence errors shown on mutation; some remote lists retain stale rows.
- **Executed evidence / limitation:** Passing Rust store/inheritance/restart tests, not a live UI run.
- **Missing behavior / smallest correction:** Pause is local; no runtime policy/run provenance.
- **Acceptance to promote integration:** Create local work offline, attach real session/run/artifact online, restart and recover all links.
- **Severity / issue:** [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-13](10-implementation-issues/qc-13-workflow-completion-can-attach-output-to-the-wrong-work.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md)

<a id="feature-07"></a>

## 07 — Intent and acceptance criteria

**UI ONLY**. UI/source: [src/main.ts:1014](/home/ed/loom-ide-tauri/src/main.ts:1014) `function buildIntentEditor(`.

- **Frontend → Tauri/Rust → API:** create/update_intent, set_intent_acceptance/active → IntentStore.
- **Underlying Loom implementation:** No matching persistent IDE Intent API; Loom task decomposition/Weaver can consume goals separately.
- **Request / response contract:** Local statement/why/acceptance/version/history/autonomy; context pack forwards only selected strings.
- **State synchronization / persistence:** intents.json persists versions/history; no authoritative intent ID attached to runtime executions.
- **Error handling:** Validation and justification errors visible; context delivery not enforced.
- **Executed evidence / limitation:** Local intent tests pass; no goal-to-runtime round trip.
- **Missing behavior / smallest correction:** UI ONLY refers to Loom authority, not a fake local object; consequential chat need not start from intent.
- **Acceptance to promote integration:** Persist intent, run against it, prove runtime context and durable evidence of that objective after restart.
- **Severity / issue:** [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-09](10-implementation-issues/qc-09-the-advertised-context-pack-never-reaches-agent-chat.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md)

<a id="feature-08"></a>

## 08 — Autonomy and work pause

**UI ONLY**. UI/source: [src/main.ts:839](/home/ed/loom-ide-tauri/src/main.ts:839) `function buildAutonomyDial(`.

- **Frontend → Tauri/Rust → API:** set_work_autonomy/update_intent and set_work_status → local stores.
- **Underlying Loom implementation:** Runtime hooks/held requests exist; no four-level Weave policy binding or universal pause.
- **Request / response contract:** Four shipped levels with rank/justification/inheritance; not five implemented privilege bands.
- **State synchronization / persistence:** Local state/history persistent; in-flight runtime authority unchanged.
- **Error handling:** Invalid rank/raise rejected locally; no denied-execution acknowledgement.
- **Executed evidence / limitation:** Local policy-record tests pass; executing commands do not consult policy.
- **Missing behavior / smallest correction:** P0 control gap; record semantics honestly and enforce at runtime.
- **Acceptance to promote integration:** Manual/paused and tightened in-flight work cannot execute forbidden operations through any entry point.
- **Severity / issue:** [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md)

<a id="feature-09"></a>

## 09 — Agents — list and detail

**PARTIALLY INTEGRATED**. UI/source: [src/main.ts:3676](/home/ed/loom-ide-tauri/src/main.ts:3676) `function renderAgents(`.

- **Frontend → Tauri/Rust → API:** listAgents/getAgent → lib.rs::list_agents/get_agent → /v1/agents[/{id}].
- **Underlying Loom implementation:** ListAgents/GetAgent → runtime registry and AgentInfo.
- **Request / response contract:** AgentInfo immutable id, name, status, counters; serde aliases/int64 conversion.
- **State synchronization / persistence:** Refetched into frontend; registry persistence controlled by Loom configuration.
- **Error handling:** Listing clears on error; detail shows failure; source chooses name for chat selector although GUID is canonical.
- **Executed evidence / limitation:** Safe live /v1/agents returns 200; actual UI identity selection not exercised.
- **Missing behavior / smallest correction:** Read path real, source routing must be verified with non-default/renamed agents.
- **Acceptance to promote integration:** Rename/select a contained non-default agent; verify exact GUID and real status across restart.
- **Severity / issue:** [QC-03](10-implementation-issues/qc-03-streaming-chat-loses-the-selected-session-and-agent.md)

<a id="feature-10"></a>

## 10 — Agents — create from reviewed JSON / description

**BROKEN**. UI/source: [src/main.ts:4214](/home/ed/loom-ide-tauri/src/main.ts:4214) `async function submitAgentCreate(`.

- **Frontend → Tauri/Rust → API:** createAgent → loom_http.rs::agent_create → POST /v1/agents; describeAgent → unary askLoom.
- **Underlying Loom implementation:** CreateAgentFromConfig; default-agent prompt is not independent evidence of Weaver routing.
- **Request / response contract:** CreateAgentRequest requires config/configPath; Rust sends bare editor object.
- **State synchronization / persistence:** Dialog holds proposal; registry should persist created config according to server.
- **Error handling:** Server validation surfaced; normal bare request rejected.
- **Executed evidence / limitation:** Go protojson fixture demonstrates invalid envelope; real agent not created.
- **Missing behavior / smallest correction:** Creation and generated config schema do not match reviewed AgentConfig contract.
- **Acceptance to promote integration:** Review valid nested config, create one actual agent, list/read/start/stop/restart it.
- **Severity / issue:** [QC-08](10-implementation-issues/qc-08-agent-creation-posts-a-bare-config-instead-of-createagentrequest.md)

<a id="feature-11"></a>

## 11 — Agents — start/stop/reload/delete

**NOT VERIFIED**. UI/source: [src/main.ts:3974](/home/ed/loom-ide-tauri/src/main.ts:3974) `async function openAgentDetail(`.

- **Frontend → Tauri/Rust → API:** agentStart/Stop/Reload/Delete → loom_http lifecycle wrappers.
- **Underlying Loom implementation:** LoomService lifecycle → pkg/server/agent_lifecycle.go.
- **Request / response contract:** Encoded immutable agent ID in path; returned AgentInfo or lifecycle response.
- **State synchronization / persistence:** Refreshes agents after actions; persistence/runtime effects depend on registry.
- **Error handling:** Action failures show notices; no live mutation/recovery test.
- **Executed evidence / limitation:** Call chain and server implementation inspected; no real agents changed.
- **Missing behavior / smallest correction:** Source wiring exists; verified lifecycle semantics cannot be inferred from list success.
- **Acceptance to promote integration:** Contained create/start/stop/reload/delete and failure cases, with observed process/runtime state.
- **Severity / issue:** No confirmed defect; acceptance not executed.

<a id="feature-12"></a>

## 12 — Sessions — select/create/history/resume/delete/resolve-gap

**PARTIALLY INTEGRATED**. UI/source: [src/main.ts:4328](/home/ed/loom-ide-tauri/src/main.ts:4328) `function renderSessionDetail(`.

- **Frontend → Tauri/Rust → API:** lib.rs session/history commands; loom_http.rs resume/delete/resolve-gap.
- **Underlying Loom implementation:** Session RPCs and pkg/server/session_resume.go; resume can execute tools/models.
- **Request / response contract:** Session/history JSON; ResumeSessionResponse and ResolveExecutionGapResponse require exact readback.
- **State synchronization / persistence:** Selected ID/local cache; backend session store persists history; work session link is local JSON.
- **Error handling:** Errors shown; resume/resolve can report requested/resolved without proving effective resulting state.
- **Executed evidence / limitation:** Real session detail parser passes; lifecycle and interrupted recovery not run.
- **Missing behavior / smallest correction:** Authority/identity and restart/cancellation evidence incomplete.
- **Acceptance to promote integration:** Create contained session, two turns, interrupt/resume, resolve real gap only when valid, reopen history after restart.
- **Severity / issue:** [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-03](10-implementation-issues/qc-03-streaming-chat-loses-the-selected-session-and-agent.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md)

<a id="feature-13"></a>

## 13 — Session live subscription

**BROKEN**. UI/source: [src/main.ts:1984](/home/ed/loom-ide-tauri/src/main.ts:1984) `async function ensureSessionSubscription(`.

- **Frontend → Tauri/Rust → API:** sessionSubscribe → loom_stream.rs::session_subscribe → GET /v1/sessions/{id}:subscribe.
- **Underlying Loom implementation:** SubscribeToSession gateway stream.
- **Request / response contract:** Gateway newline JSON result with SessionUpdate, not SSE data lines.
- **State synchronization / persistence:** On progress refreshes selected detail; old subscriptions not cancelled on selection change.
- **Error handling:** Start/error can be silent; old events are ignored but resources remain.
- **Executed evidence / limitation:** Source transport/ownership traced; no live subscription UI test.
- **Missing behavior / smallest correction:** Wrong transport plus lifecycle cleanup.
- **Acceptance to promote integration:** External contained session change reaches selected UI; A→B→none leaves no subscriptions.
- **Severity / issue:** [QC-05](10-implementation-issues/qc-05-non-chat-subscriptions-use-the-wrong-streaming-protocol.md), [QC-17](10-implementation-issues/qc-17-changing-sessions-leaks-live-subscriptions.md)

<a id="feature-14"></a>

## 14 — Models/providers — availability

**PARTIALLY INTEGRATED**. UI/source: [src/main.ts:2964](/home/ed/loom-ide-tauri/src/main.ts:2964) `function renderInspectorModels(`.

- **Frontend → Tauri/Rust → API:** listModels/listProviders → typed lib.rs response parsers.
- **Underlying Loom implementation:** ListAvailableModels/ListProviders → model/provider configuration.
- **Request / response contract:** ModelInfo and ProviderEntry.config; activeProvider drives active marker.
- **State synchronization / persistence:** Refetched in memory; backend config authoritative.
- **Error handling:** Errors clear unavailable detail; discovery not an effective-model execution test.
- **Executed evidence / limitation:** Live Rust parser smoke passes model/provider responses.
- **Missing behavior / smallest correction:** No provider-switch execution proof; preserve accurate unavailable/empty distinction.
- **Acceptance to promote integration:** Display actual configured providers/models and verify their effective runtime selection with a contained turn.
- **Severity / issue:** No confirmed defect; acceptance not executed.

<a id="feature-15"></a>

## 15 — Models — switch from session detail

**BROKEN**. UI/source: [src/main.ts:4420](/home/ed/loom-ide-tauri/src/main.ts:4420) `await switchModel(detail.id, undefined, modelSel.value)`.

- **Frontend → Tauri/Rust → API:** switchModel → lib.rs::switch_model → /v1/sessions/{id}:switch-model.
- **Underlying Loom implementation:** MultiAgentServer.SwitchModel → provider factory / agent role provider.
- **Request / response contract:** Legacy request requires session_id/provider/model; agent_id defaults to default agent in implementation.
- **State synchronization / persistence:** UI requests model only; underlying setting is agent-scoped, not independent per-session state.
- **Error handling:** Normal request returns missing-provider error before mutation.
- **Executed evidence / limitation:** Live validation probe returns 400; source confirms absent provider and owner.
- **Missing behavior / smallest correction:** Wrong request/target/scope; use effective model response and explicit owner.
- **Acceptance to promote integration:** Switch a contained non-default session owner; read effective provider/model and prove other agents unchanged.
- **Severity / issue:** [QC-21](10-implementation-issues/qc-21-model-switching-omits-the-provider-and-does-not-target-the-session-owner.md)

<a id="feature-16"></a>

## 16 — Tools — definitions and registration

**PARTIALLY INTEGRATED**. UI/source: [src/main.ts:3927](/home/ed/loom-ide-tauri/src/main.ts:3927) `async function submitRegisterTool(`.

- **Frontend → Tauri/Rust → API:** listTools plus loom_http.rs::tools_register; MCP per-server tool drawer.
- **Underlying Loom implementation:** LoomService ListTools/RegisterTool subset; separate ToolRegistryService not fully exposed.
- **Request / response contract:** RegisterToolRequest.tool; ToolDefinition schema strings; RegisterToolResponse success/message.
- **State synchronization / persistence:** Definitions from server; register should refresh authoritative registry; not a tool implementation editor.
- **Error handling:** JSON/HTTP errors visible; application-success booleans require explicit validation.
- **Executed evidence / limitation:** Live tools parser passes; no tool was registered or run.
- **Missing behavior / smallest correction:** Cannot claim execution/permission integration from schemas or HTTP acceptance.
- **Acceptance to promote integration:** Register a harmless actual tool in isolation; inspect schema/result and denied/failed execution, not just metadata.
- **Severity / issue:** [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-07](10-implementation-issues/qc-07-approval-cards-answer-the-wrong-loom-request-store.md)

<a id="feature-17"></a>

## 17 — MCP servers and tools

**BROKEN**. UI/source: [src/main.ts:4124](/home/ed/loom-ide-tauri/src/main.ts:4124) `async function testMcpConfig(`.

- **Frontend → Tauri/Rust → API:** loom_http.rs MCP add/update/get/list/test/restart/delete/health/tools.
- **Underlying Loom implementation:** MCP management RPCs → pkg/server/mcp_management.go → manager/transport.
- **Request / response contract:** Add.server envelope; Test.success/error; Health.servers map; tool schemas from Tools response.
- **State synchronization / persistence:** Backend config/manager authoritative; UI health action can replace rows with empty list.
- **Error handling:** Exact Test request rejects name; latent 200 failure is parsed as server and shown passed.
- **Executed evidence / limitation:** Safe test validation, live empty health shape and source contracts inspected.
- **Missing behavior / smallest correction:** Fix each distinct envelope; do not share a server parser for test/health.
- **Acceptance to promote integration:** Contained harmless MCP config test/add/list/tools/restart/delete; preserve errors and identities.
- **Severity / issue:** [QC-12](10-implementation-issues/qc-12-mcp-add-test-and-health-decode-different-contracts-as-server-rows.md)

<a id="feature-18"></a>

## 18 — Memory — local notes / versions / archive

**PARTIALLY INTEGRATED**. UI/source: [src/knowledge.ts:37](/home/ed/loom-ide-tauri/src/knowledge.ts:37) `export function installKnowledge(`.

- **Frontend → Tauri/Rust → API:** vaultInvoke → knowledge.rs CRUD/history/archive/restore; shared draft-safe editor.
- **Underlying Loom implementation:** No Loom runtime memory API; one-way mirror exists separately.
- **Request / response contract:** Markdown JSON frontmatter, Note/Meta, revision and original-body guards.
- **State synchronization / persistence:** Repository-path vault; atomic journal/history preserves previous content; archive preserves files.
- **Error handling:** Invalid/symlink/oversize/stale writes rejected; vault errors visible.
- **Executed evidence / limitation:** Extensive passing knowledge/store tests; no real-vault smoke performed.
- **Missing behavior / smallest correction:** Local by design; does not imply model retrieval. Portable path and watcher incomplete.
- **Acceptance to promote integration:** Contained local create/edit/history/archive/restore; prove only explicitly selected context reaches a real model.
- **Severity / issue:** [QC-09](10-implementation-issues/qc-09-the-advertised-context-pack-never-reaches-agent-chat.md), [QC-16](10-implementation-issues/qc-16-the-shared-vault-path-is-compiled-to-the-checkout.md), [QC-18](10-implementation-issues/qc-18-the-vault-change-signature-misses-relation-only-edits.md)

<a id="feature-19"></a>

## 19 — Memory — Graph and Canvas

**PARTIALLY INTEGRATED**. UI/source: [src/knowledge.ts:346](/home/ed/loom-ide-tauri/src/knowledge.ts:346) `function renderGraph(`.

- **Frontend → Tauri/Rust → API:** KnowledgeListing/edges; canvas layout load/save/export → knowledge.rs.
- **Underlying Loom implementation:** No GraphMemory RPC; graph is local typed relations.
- **Request / response contract:** Nine relation types; note IDs and local positions; Obsidian JSON Canvas export.
- **State synchronization / persistence:** Notes/edges durable; layout JSON direct write with silent catch; shared bench renderers.
- **Error handling:** Vault failures honest; layout failure hidden; external ledger changes missed.
- **Executed evidence / limitation:** Graph/layout/interaction tests pass; no actual canvas screen interaction observed.
- **Missing behavior / smallest correction:** Local graph useful but not runtime memory; durable layout/external signal gaps.
- **Acceptance to promote integration:** Relate/drag/export/reopen actual contained notes; external edge changes refresh both surfaces.
- **Severity / issue:** [QC-18](10-implementation-issues/qc-18-the-vault-change-signature-misses-relation-only-edits.md), [QC-19](10-implementation-issues/qc-19-canvas-layout-persistence-can-silently-lose-saved-positions.md)

<a id="feature-20"></a>

## 20 — Memory garden / review and Activity

**PARTIALLY INTEGRATED**. UI/source: [src/knowledge.ts:125](/home/ed/loom-ide-tauri/src/knowledge.ts:125) `function auditRows(`.

- **Frontend → Tauri/Rust → API:** knowledge_review / listing ledger and pending count.
- **Underlying Loom implementation:** No Loom approval inbox; local author/proposed/evidence-link policy.
- **Request / response contract:** Human review requires evidence edge/reason/current revision; local audit entries.
- **State synchronization / persistence:** Vault journal and versions persist; bell derived from local listing.
- **Error handling:** Invalid agent overwrite/review rejected; errors visible; remote HITL not synchronized here.
- **Executed evidence / limitation:** Passing proposal/evidence/stale-write/recovery tests.
- **Missing behavior / smallest correction:** Maintain local review distinction; do not claim remote held execution approval.
- **Acceptance to promote integration:** Propose/review/reject with actual linked evidence, restart, and prove it does not answer unrelated runtime holds.
- **Severity / issue:** [QC-07](10-implementation-issues/qc-07-approval-cards-answer-the-wrong-loom-request-store.md), [QC-18](10-implementation-issues/qc-18-the-vault-change-signature-misses-relation-only-edits.md)

<a id="feature-21"></a>

## 21 — Memory — manual Sync from Loom

**PARTIALLY INTEGRATED**. UI/source: [src-tauri/src/knowledge.rs:1064](/home/ed/loom-ide-tauri/src-tauri/src/knowledge.rs:1064) `pub async fn knowledge_sync_from_loom(`.

- **Frontend → Tauri/Rust → API:** GET sessions?limit=500, agents, artifacts?limit=200 → Vault.mirror.
- **Underlying Loom implementation:** Loom metadata list RPCs; no model-memory write/export RPC used.
- **Request / response contract:** Exact import markers; metadata only; existing imported IDs skipped.
- **State synchronization / persistence:** New snapshots persisted as local notes; not updates/deletes/two-way sync; partial count reported on failure.
- **Error handling:** Stops with count on failure; no all-or-nothing transaction across three remote lists.
- **Executed evidence / limitation:** Idempotent marker/content-exclusion tests pass; actual user vault not synced.
- **Missing behavior / smallest correction:** Snapshots are not current runtime memory; pagination and changed/deleted remote objects not reconciled.
- **Acceptance to promote integration:** Contained import twice, inspect original metadata and limitation labels, fail midway without duplicate notes.
- **Severity / issue:** [QC-09](10-implementation-issues/qc-09-the-advertised-context-pack-never-reaches-agent-chat.md), [QC-16](10-implementation-issues/qc-16-the-shared-vault-path-is-compiled-to-the-checkout.md)

<a id="feature-22"></a>

## 22 — Remote GraphMemory and MemoryLayer

**UNSUPPORTED**. UI/source: [src/knowledge.ts:346](/home/ed/loom-ide-tauri/src/knowledge.ts:346) `function renderGraph(`.

- **Frontend → Tauri/Rust → API:** No corresponding Tauri transport call; local graph is a different store.
- **Underlying Loom implementation:** GraphMemoryService/MemoryLayerService gRPC contracts; configured bootstrap in Loom.
- **Request / response contract:** Remote entity/edge/recall/remember/context/stats versus local Note/Edge.
- **State synchronization / persistence:** Remote persistence belongs to configured Loom memory stores; no IDE synchronization.
- **Error handling:** No remote operation exists to return an error through this UI.
- **Executed evidence / limitation:** Schemas/store/runtime sources inspected; remote calls not executed.
- **Missing behavior / smallest correction:** UNSUPPORTED by current IDE transport, not absent from Loom. Follow existing transport decision.
- **Acceptance to promote integration:** After scope/transport choice: real remember/recall/relate/context and restart with visible returned evidence.
- **Severity / issue:** No confirmed defect; acceptance not executed.

<a id="feature-23"></a>

## 23 — Code — files, editor and manual save

**PARTIALLY INTEGRATED**. UI/source: [src/main.ts:5999](/home/ed/loom-ide-tauri/src/main.ts:5999) `async function openFile(`.

- **Frontend → Tauri/Rust → API:** workspace commands → workspace.rs containment/read_text/write_text; Monaco editor.
- **Underlying Loom implementation:** Local filesystem, not an agent filesystem tool API; Ask Loom sends query/context.
- **Request / response contract:** Selected canonical root; path/content/original; UTF-8≤1 MB; explicit-save compare.
- **State synchronization / persistence:** Files and workspace selection persist; manual dirty draft guards; no automatic agent apply/execute.
- **Error handling:** Outside-root/binary/read-only/external-change errors preserve draft.
- **Executed evidence / limitation:** Passing workspace tests and frontend build; actual desktop editing not clicked.
- **Missing behavior / smallest correction:** Context claims fail QC-09; no terminal/test runner promised from this local editor.
- **Acceptance to promote integration:** Open/edit/save/reload contained file, detect external edit, then prove selected contextual assistance without automatic writes.
- **Severity / issue:** [QC-09](10-implementation-issues/qc-09-the-advertised-context-pack-never-reaches-agent-chat.md)

<a id="feature-24"></a>

## 24 — Experiments — arms and recorded decisions

**PARTIALLY INTEGRATED**. UI/source: [src/main.ts:6520](/home/ed/loom-ide-tauri/src/main.ts:6520) `async function runExperimentArm(`.

- **Frontend → Tauri/Rust → API:** ExperimentStore status/result plus unary askLoom; selection/decision persistence.
- **Underlying Loom implementation:** Weave agent query, not a dedicated controlled-experiment/evaluator contract.
- **Request / response contract:** Arm config becomes prompt prose; response text saved as result; chosen arm is a human record.
- **State synchronization / persistence:** experiments.json durable; running arms reset on client load; work relationship in Map.
- **Error handling:** Failure reported, local status reset handling exists; no actual tool cancellation/control enforcement.
- **Executed evidence / limitation:** Store tests pass; no contained actual arm/evaluation run executed.
- **Missing behavior / smallest correction:** Do not imply config was enforced or text independently measured; context/evidence gaps.
- **Acceptance to promote integration:** Run two genuinely different supported configs, inspect tool/evaluation evidence and retain origin/decision after restart.
- **Severity / issue:** [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-09](10-implementation-issues/qc-09-the-advertised-context-pack-never-reaches-agent-chat.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md)

<a id="feature-25"></a>

## 25 — Provider A/B comparison

**BROKEN**. UI/source: [src/main.ts:2009](/home/ed/loom-ide-tauri/src/main.ts:2009) `function handleAbtestEvent(`.

- **Frontend → Tauri/Rust → API:** providerAbtest → loom_stream.rs::provider_abtest → /v1/providers:abtest.
- **Underlying Loom implementation:** LoomService.ABTest / provider evaluation implementation.
- **Request / response contract:** ABTestRequest mode/providerNames; gateway result with camelCase ABTestEvent fields and int64 latency.
- **State synchronization / persistence:** In-memory comparison table/winner; no durable work/evaluation relationship.
- **Error handling:** Wrong stream format discards results; empty validation error observed safely.
- **Executed evidence / limitation:** HTTP 400 JSON envelope and source stream contracts inspected; no paid provider calls.
- **Missing behavior / smallest correction:** Actual fields are flat, not oneofs; decode envelope/casing and distinguish scores from evidence.
- **Acceptance to promote integration:** Compare two real contained providers, verify actual output/latency/cost/score/winner and retain evidence.
- **Severity / issue:** [QC-05](10-implementation-issues/qc-05-non-chat-subscriptions-use-the-wrong-streaming-protocol.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md)

<a id="feature-26"></a>

## 26 — Workflow catalogue, execute and execution results

**BROKEN**. UI/source: [src/main.ts:1834](/home/ed/loom-ide-tauri/src/main.ts:1834) `async function runWorkflow(name:`.

- **Frontend → Tauri/Rust → API:** list/execute/get/list-executions in lib.rs; normal workflow stream in loom_stream.rs.
- **Underlying Loom implementation:** Workflow orchestration via MultiAgentServer → workflow engine/agents/checkpoints.
- **Request / response contract:** ExecuteWorkflowRequest workflowRef; WorkflowProgress executionId; WorkflowExecution result/status.
- **State synchronization / persistence:** Runtime execution authoritative; frontend polling/maps; source-work changes during run misattribute output.
- **Error handling:** Wrong protocol; EOF can show completed without ID; unary fallback only on command start rejection.
- **Executed evidence / limitation:** Safe empty-request rejection; extracted origin test; no real workflow executed.
- **Missing behavior / smallest correction:** Run lifecycle/error/origin/evidence not complete.
- **Acceptance to promote integration:** Contained workflow success/failure/checkpoint, navigate during run, inspect real artifacts/status and restart recovery.
- **Severity / issue:** [QC-04](10-implementation-issues/qc-04-failed-or-truncated-chat-streams-are-reported-as-completed.md), [QC-05](10-implementation-issues/qc-05-non-chat-subscriptions-use-the-wrong-streaming-protocol.md), [QC-13](10-implementation-issues/qc-13-workflow-completion-can-attach-output-to-the-wrong-work.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md)

<a id="feature-27"></a>

## 27 — Workflow schedules and scheduled cancellation

**NOT VERIFIED**. UI/source: [src/main.ts:2278](/home/ed/loom-ide-tauri/src/main.ts:2278) `async function submitSchedule(`.

- **Frontend → Tauri/Rust → API:** loom_http schedule create/update/list/get/pause/resume/trigger/delete/history/cancel.
- **Underlying Loom implementation:** MultiAgentServer schedule methods → workflow scheduler.
- **Request / response contract:** ScheduleWorkflowRequest workflowName+schedule cron/timezone/enabled; cancellation is a signal, not rollback.
- **State synchronization / persistence:** Configured backend owns schedule/history; frontend refreshes arrays.
- **Error handling:** HTTP errors visible; cooperative cancelled boolean/message needs effective-state readback.
- **Executed evidence / limitation:** Live empty schedule list returns 200; no schedules created/triggered/altered.
- **Missing behavior / smallest correction:** Read result does not verify cron timezone, persistence, pause/resume or interrupted execution.
- **Acceptance to promote integration:** Contained schedule with explicit timezone; create/read/pause/resume/trigger/history/cancel and restart; no real-user schedule touched.
- **Severity / issue:** [QC-01](10-implementation-issues/qc-01-autonomy-changes-do-not-constrain-loom-execution.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md)

<a id="feature-28"></a>

## 28 — Artifacts — list, View content, search and attachments

**PARTIALLY INTEGRATED**. UI/source: [src/main.ts:4630](/home/ed/loom-ide-tauri/src/main.ts:4630) `function renderArtifacts(`.

- **Frontend → Tauri/Rust → API:** list/search/get_content → lib.rs typed metadata/content decoder; work artifact IDs saved locally.
- **Underlying Loom implementation:** Loom artifact store APIs, actual content bytes/encoding.
- **Request / response contract:** Artifact metadata; GetArtifactContent bytes/base64/encoding; query search; size cap.
- **State synchronization / persistence:** Server owns artifact content; client local work attachments durable; preview/search rows transient.
- **Error handling:** View failures visible; list can retain stale rows; search response ordering unsafe.
- **Executed evidence / limitation:** Decoder vectors/schema tests pass; current View/search UI existence confirmed; no private artifact contents read.
- **Missing behavior / smallest correction:** Real content UI exists; need live content/provenance verification and stale-search fix.
- **Acceptance to promote integration:** Produce actual contained artifact, search/open exact bytes, attach, fail content read, restart/reopen with producer evidence.
- **Severity / issue:** [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md), [QC-15](10-implementation-issues/qc-15-artifact-search-can-display-results-for-an-older-query.md)

<a id="feature-29"></a>

## 29 — Evidence feed / provenance labels

**PARTIALLY INTEGRATED**. UI/source: [src/main.ts:2826](/home/ed/loom-ide-tauri/src/main.ts:2826) `function buildEvidenceSection(`.

- **Frontend → Tauri/Rust → API:** Local experiments + Loom executions; work-filter Maps; Knowledge evidence shelf reuses it.
- **Underlying Loom implementation:** Workflow outputs and experiment records; no independent judge invocation.
- **Request / response contract:** Observed/recorded/inferred/unknown type exists; replies do not consistently attach source/trace metadata.
- **State synchronization / persistence:** Underlying records persist, work filter links and cached trace handles do not.
- **Error handling:** Unavailable lists may retain stale data; success labels depend on transport truth.
- **Executed evidence / limitation:** Source flow traced; local result tests pass; no complete claim→evidence click chain executed.
- **Missing behavior / smallest correction:** Generated narration must not be promoted to observed proof.
- **Acceptance to promote integration:** Click every claim to its actual tool/test/trace/artifact, including after restart and disconnected/recovered backend.
- **Severity / issue:** [QC-04](10-implementation-issues/qc-04-failed-or-truncated-chat-streams-are-reported-as-completed.md), [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md)

<a id="feature-30"></a>

## 30 — Observability — trace detail

**PARTIALLY INTEGRATED**. UI/source: [src/main.ts:4241](/home/ed/loom-ide-tauri/src/main.ts:4241) `async function openTraceDialog(`.

- **Frontend → Tauri/Rust → API:** getTrace → lib.rs::get_trace → /v1/traces/{id}.
- **Underlying Loom implementation:** observability_rpc.go::GetTrace and runtime trace recording; process-local lookup/optional exporter.
- **Request / response contract:** Trace/rootSpan/spans; camelCase/int64 aliases.
- **State synchronization / persistence:** Unary reply can expose traceId; cache drops it; streaming progress does not supply authoritative trace handle.
- **Error handling:** Lookup errors shown in dialog; absence is not an empty verified trace.
- **Executed evidence / limitation:** Trace parser unit tests pass; no actual execution trace inspected.
- **Missing behavior / smallest correction:** Handle discovery/retention and backend retention limits need completion.
- **Acceptance to promote integration:** Execute contained run, open its true span/tool context from reply/work, restart and describe available retention honestly.
- **Severity / issue:** [QC-14](10-implementation-issues/qc-14-work-evidence-and-execution-provenance-vanish-on-restart.md)

<a id="feature-31"></a>

## 31 — Unity / spatial navigation and synchronization

**PARTIALLY INTEGRATED**. UI/source: [src/spatial.ts:3](/home/ed/loom-ide-tauri/src/spatial.ts:3) `export function installSpatialWorkbench(`.

- **Frontend → Tauri/Rust → API:** iframe player ↔ LoomVault.jslib / MemoryPalaceController → host callback.
- **Underlying Loom implementation:** No direct Loom service; host supplies real record counts/state and routes domains.
- **Request / response contract:** Same-origin/source-checked ready/error/select; theme/state/count/size messages.
- **State synchronization / persistence:** Queues pre-ready state/theme/count; no backend object ID selection; selected portal is local scene state.
- **Error handling:** Loader/Unity errors visible with Retry; Q2 fallback deferred.
- **Executed evidence / limitation:** Bridge tests and Unity recompile pass; 4/4 asset copies match; actual WebGL/Tauri click NOT VERIFIED.
- **Missing behavior / smallest correction:** Meaningful host bridge exists; no proof of current packaged navigation/render or remote memory.
- **Acceptance to promote integration:** Actual Tauri six-portal selection plus real data changes, theme/motion/resize/error/retry; preserve keyboard HTML navigation.
- **Severity / issue:** [QC-18](10-implementation-issues/qc-18-the-vault-change-signature-misses-relation-only-edits.md)

<a id="feature-32"></a>

## 32 — Sphere and connection/state pill

**PARTIALLY INTEGRATED**. UI/source: [src/loom-state.ts:4](/home/ed/loom-ide-tauri/src/loom-state.ts:4) `export function loomState(`.

- **Frontend → Tauri/Rust → API:** Frontend reachability/attention/activity → notifySpatialState → ApplyLoomState.
- **Underlying Loom implementation:** lib.rs health probe uses /v1/health; no all-server-jobs telemetry.
- **Request / response contract:** Error/attention overrides local processing/busy/input/completed; fixed palette.
- **State synchronization / persistence:** Transient local state; not durable execution status or remote multi-client activity.
- **Error handling:** False stream completion can turn it completed; error explanation belongs in text.
- **Executed evidence / limitation:** State-priority tests pass; live semantic/UI/model comparison not executed.
- **Missing behavior / smallest correction:** Keep defined meaning; distinguish observed connection from unverified whole-runtime state.
- **Acceptance to promote integration:** Compare actual contained success/failure/hold/Stop/offline events against text and sphere; no fabricated activity.
- **Severity / issue:** [QC-04](10-implementation-issues/qc-04-failed-or-truncated-chat-streams-are-reported-as-completed.md)

<a id="feature-33"></a>

## 33 — Attention — decisions/proposal bell

**PARTIALLY INTEGRATED**. UI/source: [src/main.ts:3122](/home/ed/loom-ide-tauri/src/main.ts:3122) `function renderAttention(`.

- **Frontend → Tauri/Rust → API:** get_attention derives experiment decisions; knowledge listing supplies proposed-note count.
- **Underlying Loom implementation:** Not a complete Loom pending-request feed; runtime cards arrive only on an active stream.
- **Request / response contract:** AttentionItem decision; finding type reserved. Local proposal count.
- **State synchronization / persistence:** Decision records/notes persist; remote outstanding requests not enumerated/reconciled here.
- **Error handling:** Errors must remain distinct from zero pending; stale-signal gaps apply.
- **Executed evidence / limitation:** Local decision/proposal tests; no remote attention inbox acceptance.
- **Missing behavior / smallest correction:** Name local decisions and remote holds distinctly; preserve only actionable events.
- **Acceptance to promote integration:** Real local undecided experiment and proposal plus runtime approval/error each require the right contextual action.
- **Severity / issue:** [QC-07](10-implementation-issues/qc-07-approval-cards-answer-the-wrong-loom-request-store.md), [QC-18](10-implementation-issues/qc-18-the-vault-change-signature-misses-relation-only-edits.md)

<a id="feature-34"></a>

## 34 — Settings — appearance, motion, quality and connection

**PARTIALLY INTEGRATED**. UI/source: [src/theme.ts:35](/home/ed/loom-ide-tauri/src/theme.ts:35) `export function setAppearance(`.

- **Frontend → Tauri/Rust → API:** Theme localStorage/CSS/Monaco/player; OS motion; Unity quality; LOOM_ADDR env.
- **Underlying Loom implementation:** No remote appearance API; server config/TLS/storage are separate settings.
- **Request / response contract:** dark/white; High/Balanced/Low; source/origin messages; numeric socket address.
- **State synchronization / persistence:** Appearance stored locally; quality startup queuing incomplete; connection URL display still hardcoded default.
- **Error handling:** Local appearance persistence failure tolerated; invalid LOOM_ADDR parse unchecked; no TLS/auth remote profile.
- **Executed evidence / limitation:** Theme/player tests pass; actual live theme/quality pixels and remote config not verified.
- **Missing behavior / smallest correction:** Keep local settings; contain connection boundary; test during-load quality and effective state.
- **Acceptance to promote integration:** Toggle before/during/after player readiness; restart; invalid address surfaces an error; nonlocal profiles remain explicitly unsupported.
- **Severity / issue:** [QC-02](10-implementation-issues/qc-02-the-live-loom-gateway-exceeds-the-stated-localhost-trust-boundary.md)

<a id="feature-35"></a>

## 35 — Patterns shelf/detail/create/load

**PARTIALLY INTEGRATED**. UI/source: [src/knowledge.ts:191](/home/ed/loom-ide-tauri/src/knowledge.ts:191) `async function renderPatterns(`.

- **Frontend → Tauri/Rust → API:** loom_http pattern list/get/create/load; loom_stream pattern_updates_stream.
- **Underlying Loom implementation:** LoomService pattern RPCs → pattern library/hot reload.
- **Request / response contract:** Patterns/detail JSON and load/create responses; gateway stream update event.
- **State synchronization / persistence:** Backend files/library authoritative; shelf refreshes in memory.
- **Error handling:** List/detail errors shown; realtime update format wrong.
- **Executed evidence / limitation:** Safe live patterns list 200; mutations not run.
- **Missing behavior / smallest correction:** Shelf real; automatic updates and contextual use/evidence need live verification.
- **Acceptance to promote integration:** Contained actual pattern create/load/read and external update reflected in shelf; prove a run uses chosen pattern where supported.
- **Severity / issue:** [QC-05](10-implementation-issues/qc-05-non-chat-subscriptions-use-the-wrong-streaming-protocol.md)

<a id="feature-36"></a>

## 36 — Skills add/classify/bulk import

**BROKEN**. UI/source: [src/knowledge.ts:275](/home/ed/loom-ide-tauri/src/knowledge.ts:275) `function renderSkills(`.

- **Frontend → Tauri/Rust → API:** loom_http skills_add/classify/bulk_import → skills paths.
- **Underlying Loom implementation:** SkillsImportService → skills importer/router rebuild, separate service registration.
- **Request / response contract:** InlineSkill SKILL.md/references; BulkImportSkillsRequest srcDir/outDir; progress/routerReloaded.
- **State synchronization / persistence:** Backend generated skill tree durable; no list RPC promised; progress UI local.
- **Error handling:** Unavailable service can reject routes; gateway stream wrong; per-skill failure must not become finished-success.
- **Executed evidence / limitation:** Schemas/handler inspected; no private skills imported or dependencies added.
- **Missing behavior / smallest correction:** HTTP annotation is not exposure; actual model-loaded skill must be proven.
- **Acceptance to promote integration:** Contained genuine skill import/classify, router reload/read/use in run, partial-failure and restart behavior.
- **Severity / issue:** [QC-05](10-implementation-issues/qc-05-non-chat-subscriptions-use-the-wrong-streaming-protocol.md), [QC-10](10-implementation-issues/qc-10-task-and-skill-annotations-are-not-registered-http-services.md)

<a id="feature-37"></a>

## 37 — Tasks/boards/dependencies/decomposition/context

**BROKEN**. UI/source: [src/main.ts:2375](/home/ed/loom-ide-tauri/src/main.ts:2375) `function buildLoomBoardsSection(`.

- **Frontend → Tauri/Rust → API:** loom_tasks.rs 19-style command surface; task_updates_stream; JSON dialogs/actions.
- **Underlying Loom implementation:** TaskService → task.Manager/taskctx/bus; HTTP service not registered.
- **Request / response contract:** Nested task/update/dependency envelopes; readyTasks/blockedTasks; status enums and limits.
- **State synchronization / persistence:** Remote task store distinct from local WorkStore; no migration implied.
- **Error handling:** Current live routes 404; latent update/list-shape defects; generic Value can fabricate response-object row.
- **Executed evidence / limitation:** Live board/task 404; inspected task methods/proto; no real board mutated.
- **Missing behavior / smallest correction:** Existing backend capability not exposed through this gateway, then caller contracts need correction.
- **Acceptance to promote integration:** Contained board/task create/update/claim/release/transition/dependency/decompose; conflict tests and exact readback after restart.
- **Severity / issue:** [QC-05](10-implementation-issues/qc-05-non-chat-subscriptions-use-the-wrong-streaming-protocol.md), [QC-10](10-implementation-issues/qc-10-task-and-skill-annotations-are-not-registered-http-services.md), [QC-11](10-implementation-issues/qc-11-task-updates-and-ready-blocked-lists-use-incompatible-shapes.md)

<a id="feature-38"></a>

## 38 — Apps list/open/delete and creation

**BROKEN**. UI/source: [src/main.ts:3957](/home/ed/loom-ide-tauri/src/main.ts:3957) `async function submitAppCreate(`.

- **Frontend → Tauri/Rust → API:** apps list/get/create/update/delete/components → loom_http.rs; open backend app route.
- **Underlying Loom implementation:** LoomService apps → pkg/server/apps_rpc.go / optional compiler/HTML provider.
- **Request / response contract:** CreateUIAppRequest.spec, metadata/content response; UI instead posts name/html.
- **State synchronization / persistence:** Server app provider controls persistence; list refreshed after mutations.
- **Error handling:** Normal create rejected unknown html; rendered app path/runtime compiler not exercised.
- **Executed evidence / limitation:** Safe live create validation rejects before any write; actual apps not created/opened/deleted.
- **Missing behavior / smallest correction:** Read/list path exists; create model fundamentally mismatched.
- **Acceptance to promote integration:** Review real UIAppSpec, create/list/get/open/update in containment; verify actual content and invalid-component/duplicate errors.
- **Severity / issue:** [QC-22](10-implementation-issues/qc-22-app-creation-sends-html-to-a-declarative-spec-api.md)

<a id="feature-39"></a>

## 39 — Server configuration, TLS and storage administration

**PARTIALLY INTEGRATED**. UI/source: [src/main.ts:3047](/home/ed/loom-ide-tauri/src/main.ts:3047) `function renderInspectorServerConfig(`.

- **Frontend → Tauri/Rust → API:** lib.rs get_server_config/storage; loom_http tls status/renew/run_migration.
- **Underlying Loom implementation:** LoomService server/storage methods → backend/TLS manager.
- **Request / response contract:** Nested ServerConfig/StorageStatus; lifecycle responses have their own result/error semantics.
- **State synchronization / persistence:** Backend configuration authoritative; IDE only shows/refetches it.
- **Error handling:** Read errors visible; destructive/consequential administration not exercised.
- **Executed evidence / limitation:** Real Rust config/storage parser smoke passes; sanitized network evidence retained.
- **Missing behavior / smallest correction:** No claim of successful migration/certificate issuance; protect broad administration behind actual boundary.
- **Acceptance to promote integration:** Read actual configuration; in an isolated deployment verify denied/failed/successful administration and readback, never test on user stores.
- **Severity / issue:** [QC-02](10-implementation-issues/qc-02-the-live-loom-gateway-exceeds-the-stated-localhost-trust-boundary.md)

<a id="feature-40"></a>

## 40 — Menus, search, drawers and keyboard paths

**NOT VERIFIED**. UI/source: [src/main.ts:4780](/home/ed/loom-ide-tauri/src/main.ts:4780) `function openGlobalSearch(`.

- **Frontend → Tauri/Rust → API:** installAppMenu, existing workspace/knowledge actions and scoped searches.
- **Underlying Loom implementation:** Local shell/navigation; remote search limited to artifact API.
- **Request / response contract:** Focus/ARIA/menu action IDs; filters use actual work/note rows.
- **State synchronization / persistence:** Local selections/drawers and theme preferences; no account system behind avatar.
- **Error handling:** Source focus/draft guards; actual accessibility stack and dynamic focus not observed.
- **Executed evidence / limitation:** 63 frontend tests include shell/knowledge/player cases; CUA visual timed out.
- **Missing behavior / smallest correction:** Automated structure is not real-window keyboard/screen-reader evidence; no redesign required.
- **Acceptance to promote integration:** Actual keyboard-only menu/search/drawer/dialog/manual editing path, screen reader/zoom and both themes.
- **Severity / issue:** [QC-15](10-implementation-issues/qc-15-artifact-search-can-display-results-for-an-older-query.md), [QC-20](10-implementation-issues/qc-20-current-feature-documentation-contradicts-the-shipped-architecture.md)

<a id="feature-41"></a>

## 41 — Plain browser preview and retired native window

**PARTIALLY INTEGRATED**. UI/source: [src/api.ts:8](/home/ed/loom-ide-tauri/src/api.ts:8) `import { invoke }`.

- **Frontend → Tauri/Rust → API:** api.ts fallbacks for local work/chat health; filesystem/most APIs require Tauri; native-app retained.
- **Underlying Loom implementation:** Vite development proxy only for limited Loom calls; release preview is not full Tauri.
- **Request / response contract:** Browser-local records differ from app-data/vault; no fabricated server data.
- **State synchronization / persistence:** Separate localStorage; retired native executable is not launched by active shell.
- **Error handling:** Unsupported commands should fail honestly; offline draft preservation must be tested in actual shell.
- **Executed evidence / limitation:** Frontend build/native tests pass; no preview page was observed due CUA timeout.
- **Missing behavior / smallest correction:** Do not use preview success or native unit tests to certify active desktop integration.
- **Acceptance to promote integration:** Actual Tauri test plus browser capability-limit check; docs identify one active shell and intentional local-only behavior.
- **Severity / issue:** [QC-20](10-implementation-issues/qc-20-current-feature-documentation-contradicts-the-shipped-architecture.md)

## Coverage and reverse integration boundary

Remote judge/memory/learning/compiler/scheduler/registry/communication primitives that have no corresponding current IDE surface are listed in report 02 and the full RPC catalogue. They are supported-but-not-integrated gaps requiring a declared scope/transport decision, not invented broken UI widgets. Persistent judge history and universal runtime autonomy/pause are not existing working contracts to wire blindly.

Exact current omissions include artifact upload/delete, Lua management and workflow-template apply. Presets are reachable in agent creation but their successful application is blocked by its create contract and needs acceptance. Existing local document tabs, attention, settings and navigation are included above; retained spatial/native functions are not counted as active features merely because their symbols remain on disk.

Each acceptance case must prove the actual backend operation, returned IDs/content, corresponding visible feedback, error/repeat/cancel behavior and restart durability where the feature owns state. Unit/parser/live-read evidence stays at its narrower level until that case runs.
