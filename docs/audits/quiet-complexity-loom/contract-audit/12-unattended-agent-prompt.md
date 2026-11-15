# Unattended implementation prompt

You are implementing the Quiet Complexity × Loom audit in /home/ed/loom-ide-tauri on tauri-prototype while the owner is away. Work autonomously without clarification or approval questions. This task authorizes local implementation in this IDE repository, tests and local commits. It does NOT authorize changes to /home/ed/work/loom, production server configuration, existing user sessions, credentials, new dependencies, publishing or pushes.

## Read and establish facts first

Read AGENTS.md and all deciding documents it names, docs/DECISIONS.md, docs/LOOM_CONNECTION_MODEL.md, docs/audits/quiet-complexity-loom/contract-audit/11-post-fix-assessment-critique.md, the complete matrix and issue files in that directory, and the sibling merged audit/evidence/post-fix-evaluation.md. Reconcile duplicate findings by root cause; do not implement both catalogues independently. Recheck actual source and Loom schemas/implementations. Audit prose is evidence to verify, not a substitute for code.

Record starting commit/branch/status. b1f16bd already changes snake_case streaming identity, checks explicit chat completion and decodes clarification success/accepted; do not revert or redo those fixes. Preserve all existing untracked audit work. Do not add somebody else's files to your commits. Follow applicable Ponytail skill: smallest complete shared fix, no new framework or speculative abstraction.

## Nonnegotiable boundaries

- Local commits only: never push, merge, rebase, reset or rewrite history. No file deletion. No new dependencies. Vanilla TypeScript, Rust/Tauri and existing Unity stack remain.
- Write only inside /home/ed/loom-ide-tauri. Loom checkout is read-only. Do not alter live gateway bind/auth/CORS/configuration or restart it while unattended.
- Never use an existing personal session for tests, including sess_d7f154c9. Never trigger real schedules, tools, approval requests, model switches, agents or migrations against personal state. No paid/provider calls without an explicitly isolated authorized test profile. Loopback fixtures and protocol test data are fine; never seed product views or fabricate evidence.
- Keep manual files/notes/planning usable offline; preserve the sphere and recorded meanings. Q2 fallback remains deferred. Do not move existing vault data, choose a new autonomy policy or resolve open transport/product decisions by guessing.
- No questions while owner is away. If a step needs external write scope, secrets or an unresolved product policy, record the exact blocker and continue independent authorized work. Never bypass it.

## Work order: finish and commit each slice before starting another

### 1. Secure the primary chat lifecycle and its proof

Trace every caller before editing shared functions. Register per-request state/listeners BEFORE invoking a backend that can emit immediately. Capture work/session/agent IDs at send time, never after an await or from current selection. Make start rejection, stream error, cancellation and success settle exactly once. Never replay an uncertain accepted POST as unary fallback. Keep in-flight counters correct for overlapping requests and navigation.

Extract the smallest testable request builder or existing boundary needed to assert exact streamed query/session_id/agent_id/enable_trace/context. Assert unary gateway naming remains compatible separately. Test empty optional fields and non-default identity. Do not test this by grepping source strings.

Test the real reader with loopback HTTP fixtures or a minimal reader/event-sink seam: successful numeric/string completion; HTTP-200 application error; FAILED stage with no error text; disconnect before any output and after partial output; malformed JSON; valid UTF-8 split across reads; Stop during silence/near completion; immediate terminal event before invoke resolves. Preserve partial output as explicitly partial and retain original request/draft metadata without overwriting a newer human draft. A helper test alone does not close transport/UI acceptance.

Keep success && accepted for legacy clarification. Test accepted, rejected, missing accepted, expiry and duplicate rejection. Stored approval IDs are a different store; do not send them to the legacy question map or treat arbitrary approve/deny text as a server grant. If no authorized answer endpoint exists, show an explicit unavailable-here state with inspectable context, record the backend dependency, and do not claim approval integration complete.

### 2. Repair actual streaming protocols

Decode HTTP chunk framing before decoding event payloads. Support the custom chat SSE contract and standard gateway newline JSON result/error envelopes with their actual content types/casing/int64 representations. Inspect each feature's real schema; ABTestEvent fields are flat, not guessed oneofs. Handle split/multiple chunks, CRLF, multiline SSE data, heartbeats, bounded headers/frame/body buffers, non-2xx bodies and malformed/truncated data. Reject invalid LOOM_ADDR with a Result rather than parse().unwrap(). Keep existing no-dependency constraint; use a small shared implementation, not a new transport framework.

Give finite runs explicit terminal success/error semantics; long-lived subscriptions have different closure/cancellation semantics. Preserve namespaced request IDs and cancel old selected-session subscriptions following the existing board pattern. An old terminal event cannot clear its replacement. Add protocol and feature-handler regressions. No successful-looking empty arrays when a required response shape is invalid.

### 3. Correct existing IDE management contracts

In independent tested commits:
- Agent creation: send CreateAgentRequest.config, validate actual nested AgentConfig, retain review. A default-agent prompt saying “you are Weaver” is not proof of Weaver routing.
- Model switch: supply provider and authoritative owner agent ID; inspect returned success/effective model. Explain agent-wide scope rather than claiming private per-session settings. Do not switch a live personal agent for validation.
- App creation/update: submit actual UIAppSpec, not unsupported html. Reuse installed component/schema surfaces; do not invent an HTML upload backend.
- MCP: unwrap Add.server; remove unsupported name from Test; validate success/error; merge name-keyed Health map into existing rows; preserve enabled status when editing. Test failures must never display passed.
- Tasks: nested UpdateTaskRequest.task/update mask; correct dependency and readyTasks/blockedTasks envelopes; reject unknown shapes. Backend HTTP registration is absent: capability-gate honestly and record a Loom-side blocker instead of changing Loom or pretending a transport fix enables it.

### 4. Close work identity and evidence gaps

Capture originating work for workflow stream completion; never use selectedWorkId at completion. Guard artifact search/list responses against out-of-order completion and tab/query changes using existing request-generation patterns. Persist execution/experiment/work associations and reply trace/session metadata in existing stores with backward-compatible fields and atomic writes. Never adopt the “newest session” as proof of ownership. Use an authoritative precreated session or actual backend ID where supported; otherwise report the missing identity contract.

Prove the context pack reaches actual agent/model input. The current server accepts req.Context but its inspected chat calls do not consume it. A bounded, explicitly labeled query context using existing supported input may be an IDE-side repair; include only the captured relevant user-selected work/intent/file, make truncation visible, and keep context separate from authorization. Do not attach unrelated private vault content. Preserve manual editing and classify generated explanations as inferred/unknown, not observed tests.

### 5. Address control honestly, without inventing server authority

Inspect every consequential entry point: chat, experiment arms, workflows, resume, task decomposition, provider comparison and schedules. Identify what local policy can enforce and what runtime permissions cannot yet express. Do not invent a Manual/Assisted/Collaborative/Delegated privilege mapping or assume backend_config/context text enforces permissions. Implement only already-defined restrictions at the Rust trust boundary and test bypass attempts through direct invokes. Where semantics/transport are unresolved, make advisory scope and unavailable enforcement explicit; do not mark QC-01 fixed. Record exact runtime/approval contract needed, including tightening active runs. Treat unauthorized execution risk as higher priority than adding more administrative controls.

### 6. Local reliability, then documentation

Fix relation-only external changes missed by vault signature while preserving draft/recovery guards. Make layout writes atomic with visible load/save errors; never replace a corrupt layout with an empty fallback. Do not relocate the existing vault without the documented location decision. Keep packaging-path blockers explicit. Measure hidden Unity/rendering/resource behavior before claiming performance improvement; no visual redesign or Q2 fallback.

Correct current connection/docs claims only after code and tests support them. Keep immutable historical audit evidence. Update issue status with fixed/partial/blocked/not verified and commit/test links; a green unit suite is not full Loom integration.

## Verification after every logical change

Run the exact required project commands and fix regressions within scope:

    npm test -- --run
    npm run build
    cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib
    cargo test --offline --locked --manifest-path native-app/Cargo.toml
    cargo fmt --check --manifest-path src-tauri/Cargo.toml
    unity recompile --project-path "$PWD/unity-memory-palace" --format json

Run focused new regressions and applicable hook checks too. Batch independent commands. Retain actual exit codes/counts and distinguish Unity up-to-date from rebuilt WebGL. Missing cached dependencies/services are blockers; no installations or production edits to turn checks green. Follow AGENTS.md's three genuinely different attempts rule for fixable failures; never repeat cosmetic retries for unavailable prerequisites.

Prefer a contained backend profile and actual Tauri window for final workflow evidence. If unavailable, use loopback tests and state exactly what remains unverified. HTTP probes alone validate backend contracts, not the patched Rust/Tauri/UI chain. Mocks validate failure/control mechanics but never count as real model execution. Do not mutate personal data to satisfy an end-to-end claim.

## Durable unattended handoff

Maintain a small implementation-progress Markdown file under the contract-audit directory with baseline, completed issue IDs, evidence, commit SHA per slice, decisions taken, remaining priorities and exact blockers/unblock conditions. Commit only your logical changes locally as you go. If budget is tight, complete the highest-priority slice and its checks rather than scattering unfinished edits. Stop only when authorized independent work is complete, all remaining work is externally blocked, or the available budget forces a committed handoff.

Final report: concrete behavior fixed; files and commit SHAs; exact checks/counts; decisions taken with reasons; remaining issues and exact dependencies. End with what was not checked and material risks. Never claim the whole audit is fixed while backend policy/exposure, actual UI execution or durable evidence remains unverified. Do not end with a question.
