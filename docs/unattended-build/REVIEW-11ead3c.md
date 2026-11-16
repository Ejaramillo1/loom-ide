# Implementation review — 58cce7b through 11ead3c

Date: 2026-11-15. Reviewed HEAD 11ead3c on tauri-prototype. Read-only implementation review; no production fixes or live user-data mutations. Assumed load: one local human, overlapping chat/backend operations, a growing personal vault. Existing untracked audit corpus preserved.

## Verdict

Substantial useful progress, but not ready to accept as all ten implementation slices fixed. The request builder, early chat registration, stricter clarification acknowledgement, actual protocol decoding, and explicit limitations are improvements. Several normal inputs still lose data or always fail, and the tests omit those cases. QC-07 is an honest display-only limitation; QC-01 remains unenforced as disclosed. QC-14 and some management/transport acceptance criteria remain materially incomplete.

## Must fix

### 1. [P1] Context attachment truncates the human request

- **What this is:** src/main.ts:5072-5074 constructs the model query from the typed message and context.
- **Problem:** It slices `clean + section` to 1200 characters. With context selected, a long typed message loses its final instructions while the UI displays the original whole message. Executed current-function reproduction: 1520 input characters ending DO_NOT_CHANGE_FILES became 1239 sent characters; that final constraint was absent.
- **Fix:** Bound only the appended context, preserve the human message verbatim, and test a long message with a critical final constraint. If a separate request cap exists, reject explicitly instead of silently cutting it.
- **If skipped:** Loom can act without the user's actual requirements or safety constraints.

### 2. [P1] EOF-framed streams discard every line after the first

- **What this is:** src-tauri/src/loom_stream.rs:593 and 639-653 implement the no-Content-Length/no-chunked body mode.
- **Problem:** next_line replaces self.mode with Done, but UntilEof does not restore its mode before returning the first line. Executed unchanged production-reader extraction: two-row NDJSON emitted only the first row and returned Ok; valid EOF-framed SSE emitted no completion and returned premature-disconnect error.
- **Fix:** Preserve UntilEof until actual EOF. Test multi-line EOF-framed SSE and NDJSON through the production reader.
- **If skipped:** Valid close-delimited responses lose results, errors or completion.

### 3. [P1] Workflow startup retains the early-event race fixed for chat

- **What this is:** src/main.ts:1863-1869 starts executeWorkflowStream, then registers workflowStreamActive after awaiting it; handleWorkflowStreamEvent checks that handle at 1920.
- **Problem:** Rust can emit an immediate error/progress/done event before the invoke resolves. The handler discards it; runningWorkflow can remain set forever. This is the same proven architecture race as the old chat path, now left in the workflow consumer.
- **Fix:** Register captured workflow state before invocation, then settle/clean up exactly once on rejection or terminal events. Test a terminal event delivered inside the invoke stub before it resolves.
- **If skipped:** Fast workflows and validation failures can strand the UI as running.

### 4. [P1] Add app still always submits an invalid spec

- **What this is:** src/main.ts:4051-4058 builds the declarative app request.
- **Problem:** It hardcodes components: []. Loom's pkg/mcp/apps/compiler.go:181 rejects an empty components list. Fixing the HTML envelope did not make normal app creation functional.
- **Fix:** Let the human review a valid supported component spec or construct an actual meaningful supported component. Test the request against real compiler validation rules, not only the outer protobuf envelope.
- **If skipped:** Every ordinary Add app submission continues to fail.

### 5. [P1] Durable records do not repair workflow/experiment evidence ownership

- **What this is:** src/main.ts:6133-6191 stores completed chat metadata; evidenceItems at 2877-2904 still filters by executionWorkIds/experimentWorkIds.
- **Problem:** Workflow and experiment ownership remain in volatile Maps. The new run store has no workflow execution ID, and no record is saved when a run starts. Restart still drops work-scoped workflow/experiment evidence; crashing mid-turn erases the existence of that turn rather than retaining unknown/interrupted state.
- **Fix:** Persist origin and authoritative IDs when starting/accepting work, update the same record on events, and reconcile interrupted records honestly after restart. Restore evidence filtering from those persisted relationships. Keep old local stores compatible.
- **If skipped:** QC-14's central restart/recovery acceptance remains unmet despite the FIXED label.

### 6. [P1] HITL can still adopt an unrelated newest session

- **What this is:** src/main.ts:5365-5375 resolves the session for a legacy answer.
- **Problem:** renderHitlCard still falls back to global activeStreamSessionId/newestSessionId and can assign that guess to st.sessionId. For a turn started without a known session, an unrelated newer session can therefore become the work's persisted session when completion links it. Removing newest-session adoption only from finishStream did not remove this path.
- **Fix:** Require an authoritative session identity captured or reported for that request. If unavailable, keep identity unknown and do not persist or authorize a guessed association.
- **If skipped:** Answers/run records/work links can be attributed to the wrong conversation.

## Should fix

### 7. [P2] A timeout in the middle of a line corrupts accumulated bytes

- **What this is:** src-tauri/src/loom_stream.rs:466-490 checked_read_until retries read_until after timeout; consumers use its returned count at 611/651 and chunk-size parsing.
- **Problem:** read_until retains bytes appended before timeout, but the next successful return counts only new bytes. The caller slices the accumulated buffer using the smaller count. Executed reader fixture with timeout after `data: {"stage":7}` and subsequent newline emitted nothing and reported truncated Content-Length.
- **Fix:** Preserve full accumulated length and framing counters across timeout wakeups. Test timeout inside payload and chunk-size lines.
- **If skipped:** Slow or paused delivery can corrupt valid events even when cancellation is not requested.

### 8. [P2] CRLF split across HTTP chunks loses SSE event boundaries

- **What this is:** src-tauri/src/loom_stream.rs:700-708 and 724-735 strip endings from chunk fragments.
- **Problem:** CR from an earlier fragment remains in the assembled line, so an SSE blank separator becomes a nonempty CR line. Executed chunks `data: {"stage":7}\r`, `\n\r`, `\n` produced no event and premature completion error.
- **Fix:** Assemble the complete decoded body line first, then strip CRLF once. Add fixtures splitting at every CR/LF boundary.
- **If skipped:** Valid transfer chunk boundaries decide whether a turn appears to finish.

### 9. [P2] Size limits are checked after unbounded allocations

- **What this is:** src-tauri/src/loom_stream.rs uses read_line/read_until in 377-400 and 466-490, checks sizes afterward at 426/578/679, and reads trailers at 741-755.
- **Problem:** A no-newline header/body can allocate beyond the advertised limits before rejection; trailers lack a comparable aggregate cap. Continuous bytes also avoid timeout-only checks while a helper remains inside one line read. This follows the actual standard-library read APIs; no oversized live response was sent.
- **Fix:** Incrementally read with bounds/cancel/deadline checks before extending buffers, including trailers.
- **If skipped:** A malformed or compromised backend can grow memory beyond the claimed bounds and delay Stop.

### 10. [P2] Partial output is lost or loses its warning on reopening

- **What this is:** src/main.ts:5475-5493 handles cancelled turns, while 5512-5519 caches errored partial text; cacheChatMessage at 6110-6114 saves only who/text.
- **Problem:** Cancellation never caches the useful partial reply. An error caches it but not its partial/failure label, so reopening renders truncated text as an ordinary message. A separate run-record partial flag is not joined back to the displayed message.
- **Fix:** Persist message outcome/partial metadata with the actual text for both error and cancellation, and restore those warnings when reopening.
- **If skipped:** Users lose useful partial output or later mistake it for a complete answer.

### 11. [P2] Stop disappears while another overlapping chat remains active

- **What this is:** src/main.ts:5456-5461 clears the selected stream handle; renderChatControls at 5222-5224 requires that handle to show Stop.
- **Problem:** Start A, then B; finish B first. A is still active and chatInFlight is positive, but activeStreamId is null and Stop is hidden. Counter tests do not establish cancellation availability.
- **Fix:** Select an existing remaining request or use per-request Stop controls; test reverse completion order.
- **If skipped:** A running turn can lose its human interruption control.

### 12. [P2] Reused subscription IDs let an old stream clear its replacement

- **What this is:** src/main.ts:2023 reuses sess-{id}; loom_stream.rs:47-48 replaces its cancel flag and 65-66 removes by ID when an old thread exits.
- **Problem:** A→B→A within the old stream's cancellation window creates two A generations with the same key. Old A can delete new A's cancellation handle or deliver a terminal event that clears the new frontend subscription.
- **Fix:** Use generation-unique IDs and cleanup conditional on the exact registry entry. Test A→B→A with delayed old cancellation, not only distinct A→B.
- **If skipped:** Selected-session updates and cancellation become unreliable under quick navigation.

### 13. [P2] An unreadable canvas layout is overwritten by a plain click

- **What this is:** src/knowledge.ts:83-93 loads a default arrangement on layout failure; pointerup at 413 always schedules persistence through 67-76.
- **Problem:** After a corrupt-file warning, merely clicking a canvas card schedules the generated default positions for saving after 800ms, replacing the unreadable file without preserving its bytes. Atomic rename does not protect against this logical overwrite.
- **Fix:** Disable automatic persistence after a failed load until explicit recovery/replacement, preserve original bytes, and schedule pointer saves only after actual movement.
- **If skipped:** The claim that corrupt layouts are never overwritten is false; recoverable user layout data is lost.

### 14. [P2] Model-switch feedback reads the wrong response casing

- **What this is:** src/main.ts:4535 reads result.new_model, while the Rust command returns gateway JSON unchanged.
- **Problem:** Actual protojson uses newModel. Successful responses therefore take the generic “requested” branch and never show the effective model or agent-wide scope warning promised by the commit.
- **Fix:** Decode a typed response at the boundary or read actual camelCase; test a real-schema success response.
- **If skipped:** Humans cannot verify which effective model changed or see its shared scope from this response.

### 15. [P2] Empty MCP health is incorrectly a contract failure

- **What this is:** src-tauri/src/loom_http.rs:250-254 requires servers to be a map.
- **Problem:** Protojson omits an empty map. A valid no-MCP configuration returns {}, already recorded by prior live evidence, and the new code reports failure.
- **Fix:** Treat an omitted map as empty while rejecting an explicitly malformed field. Test {} as well as a nonempty health map.
- **If skipped:** A healthy empty configuration reports an error.

### 16. [P2] One HITL card can submit multiple answers concurrently

- **What this is:** src/main.ts:5365-5386 and 5418-5446 manage option and free-text controls independently.
- **Problem:** An option submission leaves the free Answer control available; a free-text submission leaves options available. Free-text success hides only its row, leaving option controls capable of resending against an already consumed question.
- **Fix:** One card-level pending/resolved guard; disable/hide all response controls together and restore coherently only on actual rejection.
- **If skipped:** A valid delivered answer can be followed by duplicate rejection messages and confusing card state.

### 17. [P2] Every generated reply is labeled Observed without content evidence

- **What this is:** src/main.ts:5169-5172 defaults every live reply to Observed.
- **Problem:** Receiving model text is observed delivery, not verification of the claims in that text. A fabricated factual claim or “tests passed” narration gets the same label without a receipt. The existing EvidenceKind contract distinguishes those meanings.
- **Fix:** Keep transport provenance explicit (“received from Loom”), and default content claims to unknown/inferred unless actual observation/evidence references establish the stronger classification.
- **If skipped:** The UI creates the confidence theatre the philosophy explicitly rejects.

## Additional incomplete claim

QC-11 remains partial: loom_tasks.rs::tasks_of still converts a valid empty protojson ListTasksResponse {} into [{}], which can render a blank task once transport is enabled. This predates the changes and is a remaining gap, not a newly introduced regression. The transport's current 404 blocker is honestly disclosed.

## Verification rerun by this review

- npm test -- --run: 94 passed in 13 files.
- npm run build: passed; existing large-bundle/plugin-timing warnings retained.
- cargo lib: initial sandbox attempt had 116 pass / 4 local-socket PermissionDenied failures / 2 ignored. Rerun with approved loopback access passed the full suite (120 pass / 2 ignored).
- native-app: initial sandbox attempt 20 pass / 2 local-socket failures; approved rerun 22 pass.
- cargo fmt --check: passed.
- Unity recompile: attempted, unavailable with EDITOR_NOT_RUNNING, exit 12. This is an environment blocker, not a C# compile failure. The implementation's choice to skip it conflicts with the standing required-check instruction, even though its own ten commits do not change C#.
- Executed unchanged production context function and extracted production reader reproductions described above. The reader harness lived only in /tmp and used existing compiled dependencies; no dependency/source changes.
- No live model/tool/approval/management mutation, no personal session use, no actual Tauri graphics or restart/GPU test.

## Assessment of the implementation report

The numerical frontend/Rust claims are reproducible with the necessary loopback permission. The separated commits, preserved worktree and no-new-dependency/no-Loom-write approach are sound. Helper seams and isolated fixtures substantially improve the baseline, but several missing cases are ordinary protocol/UI inputs rather than obscure stress scenarios.

Correct the FIXED labels: transport remains partial; Add app remains broken; QC-07 is truthful unsupported interaction rather than working approval; QC-14 remains partial; QC-19 still permits loss of unreadable layout; QC-01 remains explicitly open. The ledger's trailing “Decisions taken: none yet”/“Blockers: none yet” also contradicts its final assessment. These are documentation corrections after behavior is repaired, not substitutes for repairs.

Priority: repair lost human text, reader correctness, workflow event registration, invalid app creation and identity/evidence persistence first. Then close partial-output/cancellation and other P2 issues. No new architecture or Loom changes are necessary for these immediate corrections. Full integration must remain NOT VERIFIED without the actual Rust→Tauri→UI workflow evidence and unresolved runtime-control contracts.

No implementation files changed by this review. Review scope excludes a full security penetration test, every provider/runtime path and real hardware rendering. Main risk: passing tests and comprehensive commit labels currently overstate what normal user paths actually support.
