# 17 — Autonomy enforcement: the IDE's admission and cancellation scope

> Owner-directed work order (2026-11-17, hardened 2026-11-18): the dial
> must control what Loom is allowed to do — within the IDE's real
> authority. **Loom's runtime permissions, approval holds, and gateway
> patches stay outside this task** (separate project). This document
> separates three statuses everywhere:
>
> 1. **IDE admission** — what the IDE rejects before sending (enforced
>    here, tested at the Rust command boundary).
> 2. **IDE cancellation** — what the IDE can request and observe
>    (cooperative cancel for streams; limitation stated for one-shot
>    requests).
> 3. **Loom runtime policy** — server-side tool permissions and holds;
>    not part of this repair.

## 1. The four levels, defined precisely (the contract for later)

Action classes: **A-exec** = agent-execution entry points (chat turns,
experiment arms, workflow runs, schedule triggers/enabling, session
resume, provider A/B); **T-read** = read-only tools (recall,
query_tool_result, shared_memory_read, load_pattern, group_by_query,
top_n_query, tool_search); **T-write** = consequential tools (everything
else). These classes belong to the **Loom runtime contract** (status 3) —
the IDE does not and cannot enforce per-tool-call behavior.

| Level | A-exec (IDE admission, enforced) | T-read / T-write (Loom runtime, outside this task) |
|---|---|---|
| Manual | **Rejected before sending** | n/a (no turn runs) |
| Assisted | Allowed (intent budget applies) | every call held (future) |
| Collaborative | Allowed (intent budget applies) | T-write held, T-read immediate (future) |
| Delegated | Allowed (intent budget applies) | immediate within server bounds |

## 2. Execution-path inventory (every path, not a command count)

| Path | Where | Governing record (captured at start) | Cancellation mechanism | Restriction applied |
|---|---|---|---|---|
| Chat, streaming | `sendChat` → `ask_loom_stream` | selected work → active intent → stored active intent → default | `cancel_loom_stream` (supported) | Rust admission (stored policy) |
| Chat, unary fallback | `sendChatUnary` → `ask_loom` | same ids, captured before the stream; Rust re-resolves **current** stored policy at dispatch | none (one-shot) — limitation stated | Rust admission, re-read at fallback time |
| Experiment arms | `runExperimentArm` → `ask_loom` | selected work + intent | none (unary) — limitation stated | Rust admission |
| Workflow run, stream | `execute_workflow_stream` | selected work + intent | `cancel_loom_stream` (supported) | Rust admission |
| Workflow run, unary | `execute_workflow` | selected work + intent | none — limitation stated | Rust admission |
| Session resume | `session_resume` | owning work (by `session_id` link) + active intent | none — limitation stated | Rust admission |
| Schedule "Run now" | `workflow_schedule_trigger` | selected work + intent | none — limitation stated | Rust admission |
| Schedule create (enabled) / enable | `workflow_schedule_create` / `_update(enabled: true)` | selected work + intent | n/a (server-owned scheduling) | Rust admission; inspecting/disabling/deleting always allowed |
| Agent-description generation | `ask_loom` (agent prefill) | selected work + intent | none (unary) | Rust admission |
| Provider A/B | `provider_abtest` | selected work + intent | `cancel_loom_stream` (supported) | Rust admission |

Observing an execution (listing sessions, schedules, artifacts, traces)
is never gated — only starting one is.

## 3. Authoritative resolution (status 1, implemented)

- Commands take **stable work/Intent identifiers**, never a level
  string. `resolve_execution_policy` (`lib.rs`) resolves from the
  stored records: referenced work → referenced intent → stored active
  intent → project default (`collaborative`).
- Manual (rank 0) is rejected **before any network work**, with an
  error naming the governing record and the next action.
- Missing or invalid referenced records are rejected; store loading
  itself rejects unknown levels loudly (second layer).
- Each command resolves fresh at dispatch time, so a fallback that
  starts after the owner became Manual is rejected (re-read, not
  cached).
- The browser dev fallback (no Rust) refuses Manual chat as a
  **convenience** check; it is not, and is not claimed to be, a
  security boundary.

## 4. Cancellation (status 2, implemented honestly)

Three states are kept distinct, in code and copy:

- **Cancellation requested** — lowering autonomy calls
  `cancel_loom_stream` for the affected in-flight streams (matched by
  captured work id, or by captured intent id for intent-owned requests)
  and annotates the reply: "cancellation requested; waiting for the
  server to confirm."
- **Confirmed terminal cancellation** — the stream's `cancelled`
  terminal event (existing `finishStream` path) marks the reply
  partial. That is the only thing the IDE calls "cancelled".
- **Cancellation unavailable or failed** — one-shot (unary) requests,
  resumed sessions, schedules and experiment arms have no supported
  cancellation: the UI states the limitation. A cancellation request
  that fails is shown as an error, never swallowed.

Completed results are never undone by moving the dial, and the IDE
never marks a server-owned operation cancelled merely because it
stopped displaying or reading it.

## 5. Proof table status

| Situation | Status |
|---|---|
| Action forbidden by the selected level | ✅ IDE admission: rejected before sending (stored policy, tested) |
| Action requires approval | ⏳ Loom runtime policy — outside this task |
| Approval granted → exactly once | ⏳ Loom runtime policy — outside this task |
| Approval denied → zero | ⏳ Loom runtime policy — outside this task |
| Autonomy lowered during execution | ✅ streams: cancellation requested, confirmation observed; one-shot paths: limitation stated |
| Same action via another entry point | ✅ same resolver on every inventoried path (inventory §2) |

## 6. Tests

- Rust (141 lib tests): stored-Manual rejection regardless of the
  caller's intent, stored-Manual intent rejection, missing-record
  rejection, invalid-level rejection (both layers), owner naming,
  active-intent/default fallback, and the pre-fallback re-read.
- Frontend (100 vitest): identifiers passed on the stream path; the
  convenience Manual refusal never invokes the backend and preserves
  the draft; the earlier lifecycle/settle tests unchanged.
- The tests fail if the shared resolver is removed or bypassed: every
  command calls it before building a request, and the wire tests pin
  the resolved level in `backend_config`.

## 7. Changed in this hardening round

- `src-tauri/src/lib.rs` — `resolve_execution_policy` +
  `ExecutionPolicy`; `ask_loom`/`execute_workflow` take
  `work_id`/`intent_id` + `State`; resolver tests.
- `src-tauri/src/loom_stream.rs` — same for `ask_loom_stream`,
  `execute_workflow_stream`, `provider_abtest`.
- `src-tauri/src/loom_http.rs` — same for `session_resume`,
  `workflow_schedule_trigger`; create/enable gating on schedules.
- `src/api.ts` — identifier params on all execution bridges; the
  browser fallback keeps a convenience Manual refusal only.
- `src/main.ts` — ownership captured at send time and carried through
  awaits/fallbacks; cancellation status notes; honest dial copy
  ("Manual prevents new execution requests for this work. Lowering
  autonomy requests cancellation where supported. Server-side tool
  permissions remain governed by Loom."); schedule limitation copy.
- `src/chat-lifecycle.test.ts` — harness + identifier/cancellation
  tests.
