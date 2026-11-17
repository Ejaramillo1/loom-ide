# 17 — IDE execution admission and cancellation

Current IDE repair, 2026-11-17. Implementation: `9496f41`. Starting point: `cca3cb5` with a clean tree
and 100 frontend tests passing. This record supersedes the earlier
`db6471c` / `41124ae` / `cca3cb5` completion claims (which were mistakenly
dated 2026-11-18). Loom is a separate project; no Loom code, configuration,
processes or personal sessions were changed or tested in this repair.

## What is enforced

The Rust commands resolve stored work and intent policy before dispatch.
Manual rejects execution. Assisted, Collaborative and Delegated admit a
request; their tool-level behavior remains governed by the separate server.
Sending an autonomy string from the frontend has no authority.

A work item's linked intent supplies its ceiling: the stricter of work
and intent governs. Missing owners, missing parents, invalid levels,
blank identifiers, and mismatched work/intent references reject execution.
A known session's stored work link cannot be bypassed by omitting an owner
or supplying another work item. Ambiguous session ownership also rejects.

Requests with no work or intent must explicitly declare `unscoped`, and
that is accepted only when no active intent exists. Supported UI callers
capture their identifiers at the start and preserve them across awaits;
API wrappers turn explicit `null, null` into unscoped and never treat
omitted arguments as permission. The project default is Collaborative.
This local policy is not authentication of a hostile desktop client or
protection against someone editing the user's own local policy files.

The shared guard takes locks in the same intents→work order as policy
mutations. No store lock crosses a network await. Every new dispatch,
including a unary fallback, re-reads stored policy. Browser preview chat
re-reads its local store too, fails closed on unreadable policy, and uses
the same owner and ceiling rules; that is a convenience check, not a
server security boundary.

## Execution inventory

| Path | Owner captured by IDE | Admission | Cancellation available here |
|---|---|---|---|
| Chat stream | Selected work and linked intent; otherwise session-linked work or active intent | Rust `ask_loom_stream` | Local stream close request |
| Chat unary fallback | Original chat owner | Rust `ask_loom`, fresh policy; browser local-store check | No unary cancellation |
| Experiment arm | Experiment's known work, otherwise selected work; linked intent | Same `ask_loom` command | No unary cancellation |
| Workflow stream and unary fallback | Original selected work and linked intent, or active intent | Both Rust execution commands | Stream close only; unary/polling cannot cancel remote execution |
| Session resume | Stored session-linked work, otherwise active intent | Rust `session_resume`, session association verified | No cancellation through the local dial |
| Schedule Run now | Selection captured at click | Rust trigger | Server-owned execution; limitation shown |
| Schedule create, enable, resume, edit | Selection captured at submission/click | Create unless explicitly disabled; updates unless explicitly disabled; separate resume command guarded | Existing server schedule stays server-owned |
| Agent-description generation | Selection captured before request | `ask_loom` | No unary cancellation |
| Provider A/B | Selection captured at start | `provider_abtest` | Local stream close request |
| Skill classification | Shell captures owner when classification starts | `skills_classify` (makes a model call) | No unary cancellation |
| Task decomposition API | Explicit identifiers required from callers | `loom_task_decompose` guarded | No UI caller; current server implementation is unimplemented |

Observations, session subscriptions, schedule inspection, disabling,
pausing and deletion remain available under Manual. Agent lifecycle,
manual task CRUD, skill import without classification, and recording a
session-gap result are not new model-execution paths and remain unchanged.

## Cancellation is a request, not proof of remote termination

Lowering work or intent autonomy matches captured ownership, including
intent-only chat and workflows. Chat, workflow and provider A/B streams
request cancellation. An attempted cancellation prevents a later startup
rejection from launching a unary fallback. Errors remain visible.

The existing Rust `kind: cancelled` event is synthesized from its local
reader cancellation flag. It confirms **local stream closure only**.
The UI distinguishes:

- cancellation requested, waiting for local closure;
- local stream stopped, server termination unconfirmed;
- cancellation failed or unavailable.

Chat's durable run outcome is `unknown` after local closure, with partial
output retained. Provider output and workflow attribution/last progress
are retained. Completed results are never undone. Pending unary requests
are tracked by owner, and lowering produces an explicit unsupported
cancellation notice while still preserving any successful result.
A server-owned schedule or resumed execution can outlive its HTTP request;
the corresponding UI says the local dial cannot cancel it.

## Evidence and acceptance

| Acceptance | Evidence |
|---|---|
| Stored Manual cannot execute via inventoried commands | `execution_admission_tests.rs` calls actual Rust command functions under a Tauri mock runtime; disposable loopback peer counts all requests |
| Rejected requests send nothing | Command matrix permits exactly five requests: allowed chat, disabled schedule create/update, pause and delete; every Manual execution command must return its refusal |
| Missing/blank/mismatched owners and intent ceiling reject | Command matrix plus resolver/store tests; session link cannot be changed or omitted to escape policy |
| Fresh policy at fallback dispatch | Allowed command is run, stored policy lowered, same command rejects without another request |
| Original selection survives awaits | Extracted production chat/workflow/experiment functions exercised in lifecycle tests; linked intent and original session retained |
| Intent-only/workflow/provider cancellation | Production handler tests assert the actual cancellation call, failure message, partial results, and suppressed fallback |
| Unary limitation and completed output | Pending unary lifecycle test lowers autonomy, checks unsupported notice, then confirms the returned output is preserved |
| API ownership | All twelve execution bridges checked for owner propagation and explicit unscoped behavior; no authority-level field sent |
| Browser convenience | Stored policy re-read, Manual ceiling, session ownership, invalid/missing references, corrupt-store refusal before fetch |

The command fixture runs in a child test process with its own `LOOM_ADDR`,
so no process-wide environment mutation races the parallel test suite.
It uses the already-installed Tauri test feature only in dev dependencies;
no new package was added. Frontend lifecycle tests use extracted production
functions, a minimal fake DOM, and mocked bridges. These are not rendered
Tauri UI tests or a live model journey.

Final gates: 116 frontend tests (14 files), 143 Tauri tests passed / 2 ignored,
22 native tests passed, build and src-tauri fmt passed, Unity 0 errors /
0 warnings. Production `cargo check` passed with the existing unused
`StreamRead.completed` warning. Command exit codes are recorded in
`evidence/ide-repair-20261117-results.json`, with matching logs for frontend,
build, Tauri, native, scoped fmt and Unity. Historical logs remain preserved.

## Decisions taken

- Keep Loom runtime permissions, approval holds and gateway work outside this repair, as directed.
- Reuse stores and existing stream handles; require explicit ownership instead of an implicit policy fallback.
- Gate classification and the separate schedule-resume command after inventory showed they initiate execution.
- Guard the task-decomposition execution API despite its current server-side unimplemented response; no feature was added.
- Treat local cancellation as remote status unknown; never manufacture a server acknowledgment.
- Preserve the existing src-tauri-only formatting gate and add no dependencies.

The code and caller changes were committed together to keep the required
owner contract compatible at each commit. The user explicitly authorized
pushing the completed IDE branch after verification.
