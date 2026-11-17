# 17 — Autonomy enforcement: making the dial govern execution

> Owner-directed work order (2026-11-17): the dial must control what Loom
> is allowed to do. Four parts: define the levels, check at every entry
> point (IDE), enforce inside Loom (runtime), and handle mid-run changes.
> **Loom source changes remain outside the write boundary** — the runtime
> part is a prepared contract + tests, not applied.

## 1. The four levels, defined precisely (the contract)

Action classes: **A-exec** = agent-execution entry points (chat turns,
experiment arms, workflow runs, schedule triggers, session resume);
**T-read** = read-only tools (recall, query_tool_result,
shared_memory_read, load_pattern, group_by_query, top_n_query,
tool_search); **T-write** = consequential tools (everything else:
shell_execute, workspace/file writes, publish, agent_management,
shared_memory_write, send_message, web tools, MCP tools, tool
registration).

| Level | A-exec | T-read | T-write |
|---|---|---|---|
| **Manual** | **Forbidden** — enforced at the IDE Rust boundary today (rejected before any request leaves the app) | n/a (no turn runs) | n/a |
| **Assisted** | Allowed (intent budget applies) | **Approval required** | **Approval required** |
| **Collaborative** | Allowed (intent budget applies) | Immediate | **Approval required** |
| **Delegated** | Allowed (intent budget applies) | Immediate | Immediate (server-global bounds still apply) |

Mid-run lowering: the IDE stops the affected in-flight runs
(cooperative cancel; completed actions are never undone). The runtime
contract additionally requires: a lowered level takes effect for all
**subsequent** tool calls of that run (snapshot updated when the dial
changes), and the stream carries an acknowledgment event so the UI can
distinguish "restriction requested" from "restriction applied".

## 2. What is enforced today (IDE, this change)

- **Rust boundary** (`execution_admission`, `lib.rs`): every agent-
  execution command now takes the governing autonomy and rejects
  **Manual** with a clear error before any network work —
  `ask_loom`, `ask_loom_stream`, `execute_workflow`,
  `execute_workflow_stream`, `session_resume`,
  `workflow_schedule_trigger`. Experiment arms run through `ask_loom`
  and are covered by the same gate.
- **Wire**: both weave bodies now carry the governing level —
  `backendConfig.autonomy` (protojson unary) and
  `backend_config.autonomy` (SSE snake_case) — so the prepared Loom
  patch can enforce per-call without an IDE change.
- **Frontend**: `governingAutonomy()` (selected work → active intent →
  collaborative) is captured at send time on every path; lowering the
  dial mid-run cancels the affected work's in-flight streams and the
  terminal marks the reply partial; the dial's scope note states
  exactly what is enforced and what is pending.
- **Honest limitation (stated in the UI):** until the Loom patch lands,
  Assisted/Collaborative/Delegated all behave identically server-side
  (server-default tool permissions). Manual is the level whose promise
  fully matches execution today.

## 3. What Loom must do (prepared contract, not applied)

Anchors (verified in Loom `8082078` source):

- `pkg/shuttle/permission_checker.go:164-177` — the checker currently
  **errors** ("permission request mechanism is not yet implemented")
  instead of holding; `RequireApproval`/`allowed_tools`/`yolo` are
  global config only.
- `pkg/shuttle/admission_hook.go` — `Evaluate` runs the name-level check
  on **every** tool request (the right enforcement point).
- `pkg/server/multi_agent.go` — the weave paths have the request in
  hand (`backend_config`), so the level can be put into the turn
  context at start.
- Holds infrastructure exists: `HumanRequestStore` +
  `POST /v1/human-requests/{id}:respond` (statuses
  `approved`/`rejected`/`responded`) — the same store the approval
  cards already use.

Required behavior (the patch):

1. The weave paths read `backend_config.autonomy` and stamp the turn
   context with it; the permission checker resolves the level per call
   (context value wins over global config).
2. `Manual` never reaches tools (the turn is refused at dispatch, or
   tools are absent); `Assisted` raises a hold for **every** tool call;
   `Collaborative` raises holds only for the T-write class; `Delegated`
   uses the existing global config. Classify via an explicit set in the
   checker (no prompt-based guessing).
3. A hold = park the call + create a stored human request + emit an
   HITL stream event (same shape the IDE already renders); the answer
   arrives via the existing respond endpoint; approve resumes the call,
   deny/expiry fails the tool with the server's real state.
4. Mid-run lowering: the checker re-reads the level per call from the
   turn context, and the IDE updates it through a defined channel
   (contract option A: a `POST /v1/sessions/{id}:setAutonomy`-style
   endpoint writing the turn context; option B: the IDE cancels and
   restarts the run at the lower level — the IDE already implements B
   as the interim). The server must acknowledge whichever lands.

Prepared tests: `evidence/qc1-autonomy-runtime-tests.go.txt`
(expected-behavior tests over a fake hold store: allowed/held/refused
per level, approval resume/deny, mid-run lowering, unknown level).

## 4. Proof table status (counter tool)

| Situation | Status |
|---|---|
| Action forbidden by the selected level | ✅ IDE-side (Manual): counter can't be reached — every entry point rejects before sending. Runtime-side: prepared, unapplied |
| Action requires approval | ⏳ prepared contract (Assisted/Collaborative holds) — not applied |
| Approval granted → exactly once | ⏳ prepared contract |
| Approval denied → zero | ⏳ prepared contract |
| Autonomy lowered during execution | ✅ IDE-side v1: affected run cancelled (subsequent actions impossible); runtime acknowledgment: prepared |
| Same action via another entry point | ✅ same gate function used by all six entry commands + wire carries the level |

## 5. Changed files (this commit)

- `src-tauri/src/lib.rs` — `execution_admission`; autonomy on
  `ask_loom`/`execute_workflow`; `backendConfig` in `weave_unary_body`;
  wire/gate tests (136 lib tests now).
- `src-tauri/src/loom_stream.rs` — autonomy on `ask_loom_stream`/
  `execute_workflow_stream`; `backend_config` in `weave_stream_body`;
  snake_case wire test.
- `src-tauri/src/loom_http.rs` — autonomy gate on `session_resume` and
  `workflow_schedule_trigger`.
- `src/api.ts` — autonomy params on all six bridge functions; browser
  fallback carries `backendConfig`.
- `src/main.ts` — `governingAutonomy()`, captured-at-send autonomy,
  `cancelInFlightForAutonomyLower` on work/intent lowering, honest
  scope note.
- `src/chat-lifecycle.test.ts` — harness injection + 2 new tests
  (stream autonomy pass-through; Manual admission rejection).
