# Loom connection audit

Date: November 13, 2026. Repository: `/home/ed/loom-ide-tauri`, branch
`tauri-prototype`, HEAD `4505daf` **plus the current uncommitted changes**.
This audits the current source, including the recent integration and navigation
changes; it is not a claim about the committed revision alone.

> Follow-up: the sample/missing/unused frontend cleanup has now been implemented.
> This document preserves the pre-cleanup findings. See
> [Frontend cleanup](FRONTEND_CLEANUP.md) for what remains visible. The Canvas audit
> classification below understated its fixed sample cards; those have been replaced
> with real vault-note rendering.

## Findings at a glance

The product contains real Loom client code, a substantial local workbench, and
unfinished connections between them. A shared appearance and navigation do not
make their data models or execution controls shared.

- **Tauri: 55 registered command functions:** 24 contain Loom HTTP calls; 31
  handle local state, files, attention, an empty collaboration response or window
  navigation. These are command counts, not counts of completed product features.
- **Four Loom bridges have no call site in the frontend:** trace lookup, model
  switching, artifact content retrieval and artifact search.
- **Workbench's live chat discards its prepared context pack.** Only the typed
  query is submitted; local knowledge is not automatically available to Loom.
- **Planning and review are local.** Neither app translates these preferences or
  approvals into Loom execution policies or approval-request responses.
- **Evidence is incomplete.** It aggregates recorded choices and workflow text;
  it does not establish correctness or provide a source-inspection workflow.
- **Native experiments remain a demonstration**, separate from Tauri's real
  chat-backed arm runs. Native Traces remains a local journal plus a static
  empty execution panel.

## Scope, method and runtime limit

Inspected `src/`, `index.html`, `src-tauri/src/`, `native-app/src/`, the shared
navigation module, theme tokens and their storage paths. Followed visible UI
handlers through the TypeScript API, Rust commands/adapters, HTTP requests or
local persistence. Searched exported bridge functions for frontend callers.
No compiled binary was opened or decompiled. Older external project copies are
outside this audit.

A read-only request to `http://127.0.0.1:5006/v1/health` failed with connection
refused; no listener was reported on port 5006. **Loom was unavailable at audit
time.** Therefore, "wired" below means a reachable source-code path to a Loom
request, not a successful live verification of that request. Both adapters target localhost port 5006; no server-address/authentication profile
selector was found in either UI. No chat, workflow,
model switch or other server mutation was executed for this audit. Source-level
parsing and attribution risks below require a live/fixture-backed follow-up.

No application behavior was changed. Existing passing builds/tests from earlier
work are not presented as fresh integration tests for this audit.

## Classification

| Label | Meaning |
|---|---|
| Wired | A visible action reads from or submits to Loom through an implemented HTTP bridge. Live behavior is unverified while the server is offline. |
| Partial | Some part reaches Loom, but context, attribution, persistence or the user workflow is incomplete. |
| Local | Functional behavior backed by local files, JSON, browser storage or in-memory state. This is often intentional. |
| Sample | Demonstration or historical fixture, not a new Loom execution. |
| Unused bridge | HTTP implementation exists but has no frontend action/call site. |
| Missing | No corresponding end-to-end UI connection was found in the audited apps. This does not imply Loom itself lacks the capability. |

## Tauri feature inventory

| Feature / control | Status | Actual implementation and boundary |
|---|---|---|
| Conversation Send | Wired / partial context | `POST /v1/weave` with query, optional sessionId and agentId. No automatic vault context or structured work policy. |
| Session list, create, selection, history and detail | Wired | Sessions GET/POST, session history and detail endpoints. Linking a selected session to a work item is local metadata. |
| Agent list, selection and detail | Wired | Agents GET endpoints; selection supplies agentId to chat. Does not create, pause or stop an agent. |
| Work catalogue, create work, capture idea, search work | Local | WorkStore JSON; search filters the local catalogue. Capture idea creates local work, not a Loom task. |
| Intents: statement, why, acceptance, active intent, history | Local | IntentStore JSON. No Loom intent/task creation or policy update. |
| Planning mode / autonomy, change history and justifications | Local | Saves and validates local fields. Does not enforce agent permissions, budgets or tool access. |
| Mark active / Mark paused | Local | Changes work.json. Does not pause/resume a server execution. The current labels acknowledge this. |
| Goal and success criteria | Local | Saved intent/work text. No automatic measurement, test execution or acceptance verification. |
| Work-session association | Partial | Persists a real Loom session ID locally; not a server-owned work/task relationship. |
| Work artifact attachments | Partial | Artifact objects originate from Loom; attached IDs belong to local work records. No upload or synchronized work-object model. |
| Today / work counts | Local | Derived from local work statuses; not agent execution progress. |
| Workflow catalogue | Wired | `GET /v1/workflows`. |
| Run workflow and execution polling | Wired / partial | `POST /v1/workflows:execute` sends workflowRef; GET execution endpoints retrieve results. Selected work, its criteria and planning policy are not part of that request. |
| Dismiss tracking | Local | Stops local tracking/polling; does not cancel the server run. |
| Experiment definitions, hypotheses, arms and decisions | Local | ExperimentStore JSON. Choosing an arm records the person's choice; does not alter a server configuration. |
| Run experiment arm | Partial | Builds a natural-language prompt and sends it through `/v1/weave`; stores the reply as the arm's result. This is not a structured benchmark runner or guaranteed application of the configuration text. |
| Reset arm | Local | Resets the saved arm status; does not cancel an in-flight Loom request. |
| Side-by-side experiment comparison | Partial | Displays stored replies. No independent measurement, scoring or verification is performed by this view. |
| Evidence destination and Work evidence section | Partial | Local chosen arms plus readable Loom workflow output. Read-only summaries; no opening of source traces/results, attaching external evidence or independent claim verification. |
| Work-specific evidence attribution | Partial / volatile | `executionWorkIds` and `experimentWorkIds` are in-memory maps. Associations disappear on restart; historical evidence can remain workspace-wide without being linked to a work item. |
| Agentic Collaboration / step progress | Missing | `get_collaboration()` always returns an empty vector. A healthy server cannot populate this panel through the current function. |
| Attention / decision inspector | Local | Derived from local experiments with two completed arms and no choice. Not a subscription to Loom HITL requests or server incidents. |
| Tools inspector | Wired, read-only | Lists registered tool definitions. No tool execution or permissions editor here. |
| Models/providers inspectors | Wired, read-only | Reads server models/providers. Does not switch the model from the current UI. |
| Server configuration, storage health and artifact statistics | Wired, read-only | GET endpoints. Inspector text does not configure the server. |
| Artifact catalogue and detail metadata | Wired | Reads Loom artifact records. |
| Artifact contents and artifact search | Unused bridges | Rust/API functions exist; current frontend has no calls to them. Artifact metadata browsing is not content inspection. |
| Trace detail | Unused bridge | `get_trace` / `getTrace` exist; frontend never calls `getTrace`. Evidence does not link to this bridge. |
| Session model switching | Unused bridge | `switch_model` / `switchModel` exist; frontend never calls `switchModel`. |
| Files, folders, editor, save and reload | Local | Operates on the selected local workspace. Local editing is useful without Loom. |
| Ask Loom about this text | Partial | Explicitly sends only the first 280 characters of the editor text to chat. It does not attach the whole file, path, workspace or vault. |
| Documents / older notes | Local | Compatibility access to saved note text, separate from Loom artifact storage. |
| Conversation draft, local cache and clear | Local / partial | Draft and cached messages use browser/WebView storage; session history can be loaded from Loom. Clearing the UI cache is not deleting a server session. |
| Sphere, captions and completion tints | Local presentation | Driven by UI request states/timers. Not an independent live stream of agent activity or reliable global progress monitor. |
| Dark/White, light/water/glass/sphere settings | Local | Appearance preferences and shared design tokens; no Loom connection is needed. |
| File/Edit/View/Help, navigation, drawers and window switching | Local | Desktop UI functions and localhost activation between the two app processes; the activation ports are not the Loom server. |

Primary evidence: `src-tauri/src/lib.rs` (commands at lines 164–1858),
`src/main.ts:1126` (planning controls), `:1636` (workflow runs), `:180` (temporary
associations), `:1874` and `:2883` (evidence), `:2057` (models), `:2983`
(artifacts), `:4380` (experiment arm runs), `:4789` (editor-to-chat).
`src/api.ts:760` onward contains the API bridges and browser limitations.

## Living Workbench feature inventory

| Feature / control | Status | Actual implementation and boundary |
|---|---|---|
| Conversation Test connection | Partial | Calls `/v1/health`, accepting any 2xx response as Idle. It does not inspect health component statuses or retrieve active execution state. |
| Live conversation Send | Partial | Real `/v1/weave` request, but only `{query: prompt}`. No sessionId, agentId, prior conversation, intent, note bodies or context pack is transmitted. |
| Conversation history | Local, volatile | In-memory messages. No server history reload or persisted session identity. Restart loses this displayed history. |
| Offline conversation replies | Sample / local | Keyword rules and local search; can return fixed Mastermind fixture text or create an offline proposed question. No model generates those responses. |
| Manual chat preference | Local | Preserves a draft when Send is pressed. Not a Loom autonomy mode. |
| Knowledge → Sync from Loom | Partial, one-way | Fetches sessions, agents and artifacts into Markdown notes. Existing IDs are skipped; no updates/deletes/push-back, no artifact contents and no server graph synchronization. |
| Synced session and agent notes | Partial | Local snapshots of remote records; opening a note does not resume that session or operate the agent. Field parsing risks are listed below. |
| Work overview | Local shared-file read | Reads Tauri's existing work/intents/experiments JSON on load/Refresh. No duplicate migration, live subscription, server task synchronization or native editing of those records. |
| Files & editor / create file/folder | Local | Reads Tauri's selected workspace at startup, then uses local filesystem operations. Folder changes are not a two-way workspace-selection synchronization. |
| Knowledge catalogue, folders, search and note kinds | Local | Markdown objects and local substring search. Not Loom semantic memory retrieval. |
| Capture note / capture idea / create intent | Local | Vault creation and settings changes. No server task, intent or agent request. |
| Note editing, versions, relationships and backlinks | Local | Markdown plus ledger and history. Not updates to Loom memory or artifacts. |
| Knowledge graph | Local | Draws vault objects and ledger edges. Synced notes can appear as local nodes; no GraphMemory queries or remote graph writes. |
| Canvas, node positioning and export | Local | Local visual arrangement/export; no Loom planning workflow, graph execution or engine integration. |
| Experiments list and memory strategy dialog | Sample / local | Historical experiment notes and a demonstration state machine. Record baseline / Prepare comparison do not run Loom. |
| Choose strategy / Decisions | Local / sample | Saves a local decision about a proposed future experiment; no runtime memory configuration change. |
| Bell / Memory garden / approve or reject | Local | Reviews proposed vault notes. These are not Loom approval requests; no request identity or server response handler. |
| Traces destination | Missing remote traces | Static empty agent-execution message plus a local activity journal. Never calls the Tauri trace bridge or a Loom trace endpoint. |
| Activity journal and review history | Local | Vault audit events. Not model spans, tool-call traces, server audit or execution metrics. |
| Intelligence activity dialog | Local, misleading static copy | Shows locally computed sphere state and static disconnected/no-network wording, even though chat/sync have network paths. |
| Context pack dialog | Local preview / missing transmission | Displays a fixed list of fixture note IDs and rough token estimates. Cannot actually select/exclude/transmit those notes to the adapter. |
| Sphere and its attention state | Local presentation | Driven by draft text, local timers, errors and pending vault proposals/demo stage. The executing input is hardcoded false in current_state; not remote agent telemetry. |
| Scene preview / inspector / presets / playback | Local prototype | Native sphere transform/animation controls. No Unity runtime, project connection or Loom execution. |
| Dark/White, reduced motion, vault reload and shortcuts | Local | Useful desktop behavior; no Loom link required. |
| Home, bottom bar, File/View and Go to Tauri | Local | View changes or activation of the other process. Does not merge their models or session state. |

Primary evidence: `native-app/src/main.rs:240` (sync), `:277` (sphere state),
`:776` (chat), `:1605` (Traces), `:1717` (Activity), `:1755` (Settings), `:1772`
(Context), `:1806` (experiment demonstration); `native-app/src/loom_adapter.rs:212`
and `:227` (health/chat); `native-app/src/loom_sync.rs`; `native-app/src/work.rs`;
`native-app/src/files.rs`; `native-app/src/scene.rs`.

## Concrete gaps and misleading connections

### 1. Prepared native context is discarded — high priority

Workbench constructs ContextPack with intent/object IDs, but
`LoomHttpAdapter::submit(&mut self, _context, prompt)` ignores it and builds
`{"query": prompt}`. A user looking at the graph or Context dialog can reasonably
expect that knowledge to inform a reply; it currently does not.

Next step: explicit context selection and an inspectable outgoing context,
using a verified Loom request contract. Include actual note content or resolvable
server references, not just opaque local note IDs.

### 2. Native chat has no shared Loom conversation identity — high priority

The adapter neither supplies nor retains a session ID or agent ID, and extracts
only reply text. The visible transcript is in-memory. Repeated submissions do
not explicitly identify the prior session. Server-side continuity cannot be
assumed from the displayed chat.

Next step: choose/create a Loom session, retain returned identity, reload history,
and make the selected agent/session consistent with Tauri.

### 3. Review and planning are not execution governance — high priority

Work status, planning preferences, criteria, intent acceptance and vault approval
are local. No path sends their policy to Loom or answers a server approval
request. The native bell is not a Loom HITL inbox. The Tauri work labels correctly
call these local preferences; preserve that honesty while integrating.

Next step: separately design server run ownership, permitted runtime controls and
approval handling around verified request IDs. Do not silently treat local note
approval as permission to execute tools.

### 4. Experiment results can be generated prose — high priority

Tauri Run arm submits an instruction describing the configuration and stores the
reply as the result. It does not configure memory, run a benchmark harness or
collect measurements itself. Native experiment controls are a demonstration.
The historical 59/100 versus 40/100, 4× latency and >2× token figures originate in
`Vault::seed`, not this machine's current runs. The starter chat summary was
removed earlier; the underlying fixture notes remain.

Next step: distinguish a proposed run, model response and measured result. Real
measurements need explicit executable evaluations and linked records.

### 5. Evidence is a summary feed, not a verification chain — high priority

It contains local recorded decisions and readable workflow output. "Observed"
means the output was returned by the server, not that its factual claims were
verified. No trace inspection, test attachments, citations or source-opening
workflow is wired from Evidence. Work-level associations are temporary maps.

Next step: persist object/run relationships and open the originating experiment,
workflow run, trace, artifact or test record from each evidence item. Keep source
provenance separate from confidence or correctness.

### 6. Four usable HTTP bridges stop before the frontend — medium priority

| Bridge | Source | Missing UI connection |
|---|---|---|
| getTrace / get_trace | `src/api.ts:1021`, `src-tauri/src/lib.rs:1450` | Trace links/details in results and Evidence |
| switchModel / switch_model | `src/api.ts:1041`, `src-tauri/src/lib.rs:1508` | Session model-switch action |
| getArtifactContent / get_artifact_content | `src/api.ts:1055`, `src-tauri/src/lib.rs:1562` | Open actual artifact contents |
| searchArtifacts / search_artifacts | `src/api.ts:1062`, `src-tauri/src/lib.rs:1585` | Server artifact search |

These have no references in current `src/main.ts`. Their presence in the API
file does not make them user-facing features.

### 7. Collaboration is empty; some status text overstates integration — medium priority

`get_collaboration()` unconditionally returns `Vec::new()`, but the online
inspector says agent activity comes from Loom. Native Activity, Settings and
Traces contain fixed "not connected" / "Network activity: none" language that
can contradict a successful chat or sync. Native health accepts any 2xx instead
of checking the health body.

Next step: derive status from actual capability/health data. Until step events
are wired, explain that step progress is unavailable instead of implying a live
feed. A health probe alone is not agent execution telemetry.

### 8. Native sync is an import with parsing/deduplication risks — medium priority

- It skips previously imported IDs; remote changes do not refresh their notes.
- Deduplication uses a substring search for `Loom ID: <id>` across all notes and
  all kinds; IDs that overlap or collide across entity types can be skipped.
- It reads snake_case metadata and numeric-only counters. Tauri's client handles
  the gateway's camelCase fields and string-encoded integers. Native imported
  metadata can therefore be blank or zero for those response shapes. This is a
  source-level compatibility risk, not a live failure reproduced in this audit.
- The three imports run sequentially. If a later category fails, earlier notes
  may already have been saved despite the overall error toast.
- No remote deletes, bidirectional edits, artifact bytes or memory relationships.

Next step: shared typed response decoding, exact type+ID provenance and explicit
import/update semantics with partial-result reporting.

### 9. The two windows are not one persistent domain model — medium priority

Tauri JSON, Workbench Markdown/ledger, WebView/browser storage and server objects
have separate identities/lifecycles. The native Work overview reads the same
Tauri JSON, but is read-only and manually refreshed. Appearance preferences and
conversation state are not shared. Navigation activation only switches windows.

Next step: choose ownership for work, sessions, experiments, knowledge and
relationships before adding more cross-window actions. Reuse existing records
rather than copying them into a second representation without provenance.

### 10. Native network calls block the UI — integration limitation

Health, sync and weave use blocking TcpStream calls from UI callbacks. POST reads
can wait up to 180 seconds. During that wait the UI cannot offer normal responsive
navigation or interruption. Input is cleared before submission and not restored
on a live failure.

Next step: move requests off the UI thread, retain the draft on failure, expose
pending/error states and implement cancellation only where a verified server
control exists.

## Features appropriately kept local

File creation/editing, drafts, visual layout, graph navigation, canvas layout,
appearance, accessibility, window switching and offline note editing do not need
to become network operations. Keep them functional offline. The missing link is
selective transmission, attribution and execution state where the user actually
asks Loom to act—not networking every button.

## Missing end-to-end capabilities found in the apps

No current UI connection was found for Loom HITL request/response handling,
remote GraphMemory browsing/updating, MCP server management or MCP App panels,
streaming agent/tool activity, server execution pause/resume/cancel controls,
enforced per-work budgets/permissions, file diff approval/application, automated
test/evaluation collection or a unified evidence-to-source chain.

This list concerns the frontend integration. It makes no assertion that the
underlying Loom server lacks these capabilities; its live endpoint/schema
inventory remains to be checked when running.

## Browser preview caveat

A plain browser is not equivalent to the desktop app. It has its own local work
and intent storage. Health/chat have a dev-proxy fallback. Most other bridge
functions explicitly require Tauri, including sessions, agents, experiments,
workflows, artifacts and real filesystem operations. Browser screenshots cannot
prove those desktop integrations work.

## Recommended order of follow-up work

1. Start the configured Loom server and perform read-only contract checks for
   health, sessions, agents, workflows, artifacts, tools, models and traces.
2. Fix native session identity, context transmission and truthful status labels.
3. Persist work ↔ run ↔ experiment ↔ evidence relationships and wire source
   inspection; expose the existing trace/artifact bridges.
4. Add actual execution controls/HITL only after verifying server contracts.
5. Replace the native experiment demonstration with real, inspectable execution
   while retaining fixture provenance and useful offline behavior.
6. Consolidate synchronization and state ownership between the two interfaces.

No features were removed and no integration behavior was changed during this
audit; the follow-up sequence above is a recommendation.
