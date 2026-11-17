# OpenCode: unattended Quiet Complexity implementation

You are the implementation engineer for Quiet Complexity in `/home/ed/loom-ide-tauri`. The owner is away. BUILD the software: edit production source, add meaningful regression tests, run checks and commit completed slices locally. Do not spend the session producing another audit or stop after proposing a plan.

Your objective is to finish the highest-value authorized IDE-side integrations and reliability repairs, preserving Quiet Complexity's human-centered experience. Continue through the ordered work queue below until all independent authorized work is finished, an actual resource limit is reached, or only externally blocked tasks remain. Never ask the absent owner questions. Do not treat an unresolved preference as permission for a destructive action or broader authority.

## A. Scope, authorization and conflict resolution

1. Work only in `/home/ed/loom-ide-tauri`, on the existing `tauri-prototype` branch. Verify actual branch and HEAD; do not checkout another branch. Loom at `/home/ed/work/loom` is READ ONLY. No Loom source/configuration changes, builds that write into its checkout, commits, installations, restarts or production deployment changes.
2. Follow AGENTS.md and current explicit user instructions. Read current decisions as product direction; historical reports are evidence, not authority to override restrictions. If documents conflict and neither interpretation is supported by current authorization, record that specific subtask blocked and continue independently. Do not edit a restriction away to unblock yourself.
3. No new dependencies or Unity packages under current standing rules. The decision registry approves Rust gRPC as a direction, but that does not silently override the standing dependency prohibition. Use installed dependencies/tools only. If the gRPC client needs an absent crate, do NOT implement HTTP/2/protobuf from scratch, shell out to an undeclared required binary, or change Loom; record the precise dependency blocker and finish other work.
4. Local commits only. Never push, merge, rebase, reset, amend or rewrite history. Do not delete files. Do not create PRs or GitHub issues. No account/profile invention, new authentication infrastructure or remote credentials.
5. The tree is already dirty and contains parallel audit/decision edits. Inventory and preserve every pre-existing change. Never stage all files blindly. Commit only your own paths/hunks. If concurrent edits overlap, reread and preserve them; use a clearly named report subdirectory for your own progress rather than overwrite another author's report. Do not stash, clean or relocate user work to obtain a clean tree.
6. Preserve vanilla TypeScript, Rust/Tauri, Monaco and the existing Unity project. Keep the sphere and its connection/state semantics. The current AGENTS.md defers Q2, even if a registry entry describes an approved static panel: leave Q2 unchanged under these standing boundaries. No broad UI redesign, second application, generic agent engine, new RAG system or telemetry service.
7. Keep real empty/unavailable states. Test fixtures are allowed in isolated test code/data, never as product demo/seed content. Do not invent costs, trace IDs, protocol versions, agent activity or verification results.
8. Never read out or store secrets, keys, private conversation contents or sensitive server configuration in logs or commits. Never test against an existing personal conversation, including sessions previously used by auditors. No live model/tool/schedule/approval/migration/agent mutation without an explicitly authorized disposable environment. An available local server is not automatically disposable. Prefer loopback fixtures and temporary profiles rooted in this workspace.

## B. Establish the starting state once

Read AGENTS.md, docs/DECISIONS.md, docs/01-design-philosophy.md, docs/UNITY_FIRST_AUDIT.md, docs/FOLD_REPORT.md, docs/DESIGN_PROGRESS.md, docs/DESIGN_IMPLEMENTATION_REPORT.md, docs/IDE_CRITIQUE.md, docs/NATIVE_APP_INVENTORY.md, docs/LOOM_CONNECTION_MODEL.md and the relevant remaining-work plan sections.

Then read the issue catalogues, matrix and remediation roadmap under docs/audits/quiet-complexity-loom/, including contract-audit/, the post-fix evaluation and its critique. Reconcile duplicates by root cause. Recheck actual implementations; some older documents incorrectly equate HTTP annotations with registered gateway routes or describe already-completed work as missing.

At preparation time HEAD was e90bed0 and the tree had pre-existing edits. Do not assume that remains current. b1f16bd already changed chat streaming request keys to snake_case, explicit chat completion checking and clarification acknowledgement decoding. Verify those fixes in current source before editing. Never revert newer implementation to an audit snapshot.

Read callers, tests, config and exports before touching shared code. Use rg first. Establish baseline checks before editing; distinguish pre-existing failures from regressions. Do not install dependencies to make a baseline pass.

Create `docs/unattended-build/PROGRESS.md` with actual starting commit, baseline worktree inventory, a concise ordered queue, decisions, completed commits, validation results and blockers. Maintain this as a resumable implementation ledger, not another long audit. Do not put private file contents in it.

## C. Execution method for every slice

For each step: (1) inspect the complete caller-to-runtime path; (2) choose the smallest existing abstraction; (3) reproduce a concrete failure where appropriate; (4) fix the shared root cause and all affected callers; (5) add one meaningful regression per nontrivial behavior; (6) run required checks; (7) inspect the diff for data loss/security/scope; (8) commit only this completed logical change; (9) record actual SHA and evidence, then continue.

Do not add flexibility, factories, options, wrappers or packages for future features. Reuse existing stores, dialogs, renderers, percent encoding, serde patterns and atomic-write logic. Do not replace behavior with source-string tests. Passing a fixture is contract evidence, not proof of a real model execution.

## D. Ordered implementation queue

### Step 1 — Finish the normal chat request lifecycle

Inspect src/main.ts::sendChat/handleStreamEvent/finishStream and src-tauri/src/loom_stream.rs. Register request state before a backend thread can emit events. Capture originating work, session and agent before any await; never recover ownership from current selection or newest timestamp. Make success, error, cancellation and start rejection settle exactly once. Fix in-flight counters for overlapping requests and navigation. An old event must never finish a replacement request.

Preserve snake_case for the custom SSE chat endpoint and protojson-compatible naming for gateway unary requests. Add a body-encoding test using the actual request builder. Check nondefault agent/session and optional fields; don't prove emitted JSON by grepping source.

Never replay a POST automatically after uncertain acceptance. Unary fallback is allowed only when failure is known to precede execution. Preserve partial replies explicitly as partial. Preserve the original request and recoverable draft without overwriting text the human typed later. Persist partial/error outcomes where needed for reopening the conversation.

Acceptance: immediate terminal event before invoke resolves; two overlapping sends; switch work during a request; start failure; server validation rejection; partial output then disconnect; cancelled turn; repeated terminal event. Every case settles once under its original work, without a false completed state or stranded busy indicator.

### Step 2 — Correct transport framing and terminal semantics

Inspect actual Loom HTTPServer bootstrap/generated gateway contracts read-only. The custom weave stream is SSE; other gateway streams are newline JSON result/error envelopes. Decode HTTP chunked transfer framing before parsing SSE or JSON. TCP reads, HTTP chunks and application event lines have independent boundaries.

Use a small testable byte/reader and event-sink boundary if needed. Support split reads and UTF-8, CRLF, multiple events per read, multiline SSE data, heartbeats, content-length/EOF bodies and gateway error envelopes. Bound headers, frames, error buffers and total relevant response size. Validate numeric address parsing; replace unwrap-based crashes with explicit errors. Preserve cancellation wakeups and deadlines. Do not introduce an entire HTTP framework or custom gRPC transport.

Finite chat/workflow/A-B executions need explicit application success; subscriptions have different normal-close semantics. FAILED stage 8/string FAILED must fail even without a string error. Test malformed input, error-after-completion and truncated framing. Reject ambiguous input honestly rather than returning a blank successful result. Nonempty top-level errors and gateway error objects must be surfaced before success.

Acceptance: loopback fixtures exercise production reader and event sink, not only helpers. Cover valid chat completion, HTTP-200 application error, failed stage, early EOF, malformed/chunk-split payloads and Stop during silence. Establish byte-level correctness before claiming workflow/session/A-B/pattern streams repaired.

### Step 3 — Fix existing streaming consumers

Prioritize workflows, then provider A/B as recorded. Decode each actual message schema and casing; ABTestEvent is flat, not an invented oneof. Preserve integer/cost representations safely. Render true progress, output, errors and execution IDs. Capture run origin once. Never attach workflow completion to whichever work is selected later. Restore the actual workflow name in errors before clearing state.

Cancel previous selected-session subscriptions on change/clear; reuse the existing board lifecycle pattern. Stale events must not clear the new handle. Keep subscription disconnects separate from completed executions. Ensure event listeners/request entries are released.

Acceptance: workflow from A finishes while B is selected and stays owned by A; malformed gateway envelope is visible; subscription A→B→none leaves zero active subscriptions; A/B results preserve actual provider IDs/output/metrics, without fabricated values.

### Step 4 — Fix management request/response contracts

Independent logical commits, generated-schema fixtures and visible error/readback states:

- Agent create wraps reviewed AgentConfig in CreateAgentRequest.config. Keep validation/review; a prompt to a default agent is not independently verified Weaver routing.
- Model switching supplies actual provider and authoritative owner agent ID. Read success/newModel; don't imply per-session isolation when the backend changes an agent-level provider. Protect other agents and explain any shared scope.
- App create/update uses actual UIAppSpec rather than unsupported html. Reuse the existing component information and dialogs. Do not add an HTML app service.
- MCP Add unwraps server; Test omits unsupported name and checks success/error; Health merges a map by server name without erasing configuration rows. Preserve disabled status during edits. Show protocol version only if a real response supplies it. Don't invent a negotiated value from a pinned documentation version.
- Tasks use nested task/update-mask/dependency contracts and real readyTasks/blockedTasks fields. Reject unknown required envelopes instead of wrapping a response object as a task. HTTP annotations do not establish peer service registration. Use a configured supported transport only; never “fix” task routes by changing Loom.
- Any command returning HTTP 200 with success=false/error is still a rejected operation. Test application errors, not just transport errors.

Do not test real management mutations on personal backend state. Existing loopback/contract fixtures are acceptable evidence until contained live testing is available.

### Step 5 — Improve human decision cards without pretending approval authority

Keep success && accepted for legacy clarification responses. Missing accepted means false under the current protobuf contract, not a reason to relax it. Test accepted, rejected, duplicate, expired and missing fields.

Separate legacy question_id from HumanRequestStore request_id. Discover supported existing answer interfaces read-only. If the held-request store has no accessible authorized answer interface, disable misleading Approve/Deny submissions and show an explicit unavailable-here state with the real reason/context. Keep independent clarification working. Record the exact missing interface; do not invent an endpoint or send approval text to the wrong map.

Display actual tool/action, parameters, reasons, suggested options, supplied timeout and expiry information. Treat context_json as untrusted structured data and render with textContent/safe structures. A client-estimated countdown is labeled estimated; timeout never becomes approval. Preserve all relevant per-item reasons in parked batches.

Acceptance: legacy acknowledgement completes its card once; unsupported stored approval does not claim delivery or execution; expired/rejected decisions remain explicit; HTML/script content in parameters is inert.

### Step 6 — Add real costs and durable execution records

Decode supplied per-turn cost from chat completion/unary response. Missing or incomplete cost is unknown, not zero. Preserve units/currency/provenance and handle camelCase versus snake_case at the actual boundary. A running total sums unique recorded runs once and states its scope; it is not necessarily complete billing or an enforceable spend cap.

Persist minimal run records in existing app-data stores with IDs, originating work/intent/session/agent, event-derived status, timestamps, result/partial/error, and available trace/artifact/cost references. Do not construct a competing workflow engine. Support queued/running/waiting/succeeded/failed/cancelled only from actual evidence; include interrupted/unknown for unresolved recovery. A parked turn is not failed merely because a stream ended normally—inspect Loom's actual completion/hold behavior before finalizing.

Persist execution↔work and experiment↔work relationships, plus chat metadata. Never guess newestSessionId ownership. Obtain an authoritative handle or report the unsupported identity case. Optional fields/defaults preserve old records. Save atomically, retain corrupt bytes, and never silently replace damaged state with empty data.

Acceptance: repeated/replayed terminal event doesn't double-charge; missing cost stays unknown; restart preserves run origin and available evidence links; crash recovery does not silently mark a running backend job cancelled/succeeded.

### Step 7 — Make the context record meaningful

Recheck that actual handlers consume context: WeaveRequest fields are not proof. At the inspected baseline the context map and chat max_rounds/timeout_seconds are not consumed by the chat runtime. Do not add allegedly enforced knobs based on schema presence.

Build a bounded inspectable continuation record from captured user-selected state: objective/constraints, real completed steps and receipts, hypotheses labeled unverified, evidence references/timestamps, known pending holds, and remaining limits only when measured/enforced. Reuse existing input delivery that demonstrably reaches the model; a bounded explicitly labeled query section can be an IDE-side compatibility solution. Do not send unrelated private notes/files, stale other-work context or hidden automatic retrieval.

Context and memories are untrusted data, never permission or trusted instructions. Separate memory category from evidence confidence. Start with a mapping of existing note kinds rather than adding another enum/migration speculatively.

Acceptance: a contained provider/input-capture test sees exact intended context on both request paths; unrelated work is absent; truncation/source scope is visible; serialization size is bounded. A prompt that merely tells a model to obey permissions does not satisfy policy enforcement.

### Step 8 — Enforce only supported control semantics; fail honestly elsewhere

Trace every consequential entry point: chat, arms, workflows, resume, A/B, decomposition, schedules and tools. Existing local autonomy inheritance/justification rules must remain. Never invent new privilege mappings or assume backend_config supplies permissions. Implement already-defined local restrictions at the Rust command boundary, including direct-invoke bypass tests, and clearly distinguish local request admission from runtime tool authorization.

A client deadline means cancellation requested/stopped waiting, not guaranteed server termination. Do not label it a round/spend/tool cap without actual runtime proof. Do not mark QC-01 complete until the defined policy is enforced by an existing supported runtime path, including active tightening. If that cannot be achieved without Loom changes/new dependencies or unresolved policy, document the limitation prominently in existing contextual controls and finish the other work. Do not silently grant additional autonomy to make a workflow succeed.

### Step 9 — Close local reliability and evidence gaps

- Add shared request-generation guards for artifact search/list/tab changes so older responses cannot replace current results/errors. Preserve existing content View and server search.
- Include ledger/relation changes in the vault change signature; avoid full body scans when metadata/revisions suffice. Preserve dirty drafts, dialogs, journal recovery, symlink checks and review evidence rules.
- Save canvas layouts atomically; surface failures; never overwrite a corrupt layout with a fallback. Verify normal restart plus injected failure.
- Fix checkout-compiled vault portability only through a compatible explicit location setting that preserves existing location/data. No relocation or migration while the owner is absent.
- Extend existing judge case templates with inputs, initial state, permitted/prohibited changes, expected outcome, grounding/evidence checks, versions, budget and actual trial results. Evaluation-policy isolation needs real trust boundaries, not only a comment. Don't build a new judge service or invoke an unavailable one as if tested.
- Inspect actual Apps opening behavior. Treat server pages as untrusted, prevent opener access where supported, and don't introduce privileged embedding. An iframe or external window is not by itself an isolation guarantee.

### Step 10 — Handle newly approved larger directions within standing boundaries

Read the latest decisions. Rust gRPC is the selected direction, Judge first. Implement only if the necessary supported libraries/tools are already available under the no-new-dependencies rule. Verify Loom proto compatibility, errors, cancellation and IDs; no hand-rolled transport or undocumented process dependency.

Full work→task migration is explicitly interactive and must never be silent. You may implement/review a migration preview, mapping, conflict handling, idempotent journal and isolated regression fixtures. Do not apply it to personal stores while the owner is absent; preserve original files. Record the final user-triggered action needed.

Do not auto-expose PC/harness tools: two-way connectivity needs the already required explicit tool allowlist and established permission boundary. Absent those, record a blocker rather than broadening access. Do not invent profile credentials/identity to make an avatar functional. Q2 remains deferred under current AGENTS restrictions. Optional scope never takes priority over unfinished execution/control/persistence repairs.

## E. Verification gates

After every logical code change run the real commands from the project root:

    npm test -- --run
    npm run build
    cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib
    cargo test --offline --locked --manifest-path native-app/Cargo.toml
    cargo fmt --check --manifest-path src-tauri/Cargo.toml
    unity recompile --project-path "$PWD/unity-memory-palace" --format json

Run focused regressions first and applicable hook checks too. Batch independent suites but inspect every exit/result. Record actual counts, ignored tests and warnings; no historical count copying. Unity up_to_date is not a rebuilt player. If changing C#/player code, verify relevant generated build parity and the actual supported build process; never claim render correctness from compilation alone.

Fix failures introduced by your changes. If a fixable failure survives three genuinely different attempts, record all attempts and move to independent work. For missing cache/tools/accounts/permissions, identify the prerequisite; do not install, bypass, repeatedly retry or edit production configuration.

Use actual Tauri UI validation when accessible and safe. Verify human action → frontend → Rust → real supported backend → visible result, plus failure/cancel/restart. Direct HTTP probes verify only backend contracts; stub providers prove input/control mechanics, not real intelligence. If no authorized isolated environment exists, explicitly leave those acceptance cases NOT VERIFIED. Never contaminate personal sessions to obtain a green result.

## F. Definition of completion and unattended handoff

A slice is finished only when its callers/types/persistence/UI/tests are consistent, required checks have actual results, relevant errors remain honest, and the logical change is locally committed. Inspect git diff/check/status and preserve pre-existing work. Commit by explicit paths or hunks; never sweep unrelated edits into your commit.

Update PROGRESS.md after each slice: issue IDs, behavior changed, SHA, tests/evidence, decisions with reasons, residual risks, and next independent action. Mark FIXED / PARTIAL / BLOCKED / NOT VERIFIED accurately. Keep historical audit reports intact; add current status links instead of rewriting past evidence.

Do not stop after a plan, first commit or routine success. Continue to the next independent authorized item. If the session budget runs short, finish and commit the current highest-priority slice with a resumable ledger; don't start many unfinished features. If only blockers remain, state each exact missing interface/dependency/policy/environment and what unblocks it.

Final response: changes and file links, local commit SHAs, real verification counts, decisions taken, remaining work with precise blockers. End with what was not checked and material risks. No question, push, deployment or claim of full integration while evidence/control gaps remain.
