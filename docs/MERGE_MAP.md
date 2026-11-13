# Merge map — Tauri app + eframe native workbench

Contract for merging the two projects in this repo. Written from reading both
codebases at head `93591780` (Phase 1.1.1–1.1.2). If you want to build something
not on this map, add it to the map first.

## The two projects

- **Tauri app** (root: `src/`, `src-tauri/`): talks to a real Loom server at
  `http://localhost:5006`. 54 Tauri commands. Modes: Code, Experiment, Work,
  Agents, Evidence, Artifacts. Code is the default mode, backed by a user
  workspace folder (default `Documents/Loom`).
- **eframe native app** (`native-app/`): local-only knowledge workbench
  (`living-workbench`). Vault of Markdown notes with JSON frontmatter,
  typed ledger edges, graph view, canvas, six views: Home, Knowledge, Canvas,
  Experiments, Decisions, Traces. The `AgentAdapter` trait exists but is dead
  code: nothing constructs or calls it.

## The map

| Tauri app has | eframe app has | What we need to connect |
|---|---|---|
| Loom server HTTP client (`loom_http_raw`, 24 endpoints) | Offline adapter stub (`AgentAdapter` trait, `OfflineAdapter`, never wired in) | New `LoomHttpAdapter` over blocking `TcpStream`: `POST /v1/weave` with `{"query", "sessionId"?, "agentId"?}`, text = first non-empty of `text`/`response`/`content`/`reply`/`message`. Parse `Content-Length`; de-chunk when `transfer-encoding: chunked`; 16 MB cap. Add a `Box<dyn AgentAdapter>` field to `Workbench`, construct it in `Workbench::new`, keep `OfflineAdapter` as the fallback type. Add a connection-test button that calls `activity()` and toasts "Connected to Loom" / "Loom offline". |
| Sessions, agents (`GET /v1/sessions?limit=500`, `GET /v1/agents`, `POST /v1/sessions`) | Vault notes (`Vault::create(title, body, kind, actor)`, kinds restricted to `KINDS`) | Sync sessions and agents as vault notes. Add `"session"` and `"agent"` to `KINDS` and route them to new folders `50 Projects/Agent Memory/Sessions` and `.../Agents`. Dedup: store `Loom ID: <id>` in the note body and check with `vault.search()` first (`get()` looks up by note ID only and can never match a Loom ID). Synced notes are `Actor::Human` (status `working`, not proposals). |
| Artifacts (`GET /v1/artifacts?limit=200`, `GET /v1/artifacts/{id}/content`) | Vault artifacts folder (`50 Projects/Agent Memory/Artifacts`) + `export_canvas` | Sync artifacts as notes. Add `"artifact"` to `KINDS`, routed to the existing `Artifacts` folder. Store name, purpose, source, and a reference to the artifact; do not download binary content into the vault. |
| Graph memory hooks (none: the Tauri backend exposes no graph-memory or MCP endpoint, and no streaming) | Local graph view (`graph()` reads `vault.notes` + `ledger.edges`; `"result"` is the center node) | Nothing to connect yet. The local graph stays as-is; sync adds nodes automatically because `graph()` reads the vault each frame. A Loom GraphMemory connection waits on a backend endpoint that does not exist. Do not reimplement GraphMemory in the native app. |
| Intent → Work model (intents, work items, active intent) | Intent setting in vault (`settings.intent`, `set_intent`) | Unify the intent concept: the `ContextPack` sent to Loom uses `vault.settings.intent`; "Capture idea" creates `Idea: ...` objects on both sides (a work item in Tauri, a note in native-app). |
| Work modes (Code, Experiment, Work, Agents, Evidence, Artifacts) | Six nav views (Home, Knowledge, Canvas, Experiments, Decisions, Traces) | No shared view; each side keeps its own navigation. There is no Work view in the native app. Projects and Sessions in native-app are folder-filtered Knowledge views (`50 Projects/...`, click a vault location to filter by path prefix). Sessions in Tauri are a new list section in Work detail. |

## Verified facts the guide got wrong (do not reintroduce)

- 54 Tauri commands, not 36.
- `AgentActivity.state` is `knowledge::State` (8 variants), not a new
  `AgentActivityState` enum. The guide's sample `loom_adapter.rs` does not
  compile as written; use `crate::knowledge::State`.
- `Vault::create` rejects kinds not in `KINDS`; `"session"`, `"agent"`,
  `"artifact"` must be added first.
- `vault.get(id)` cannot dedupe Loom objects (note IDs are `n-<nanos>`).
- The guide's `loom_request`/`parse_json` are private but called from
  `loom_sync.rs`; they must be `pub`.
- There is no `spawn_blocking` in the eframe app (no async runtime, no
  threads). Blocking `TcpStream` calls run on the UI thread; the submit path
  uses the backend's timeouts (connect 2 s, read 180 s for POST, 4 s for GET)
  and the UI blocks while waiting. This is a known limitation, not a bug to
  hide.
- `POST /v1/weave` is real (`ask_loom`, `src-tauri/src/lib.rs:1597`).
  The browser fallback in `src/api.ts` uses snake_case keys
  (`session_id`, `agent_id`); the Rust path uses camelCase
  (`sessionId`, `agentId`).
- The guide's 2.3.3 steps are blank; the Sync button goes in the Knowledge
  view header (beside the `N objects · M relationships` count) and runs only
  on click, never per frame.
- `MECHANICS.md` and `native-app/README.md` still refer to paths (`app/`,
  `../checks/round-0/`) from before the directory was named `native-app/`.

## Decisions recorded here (so the implementer does not re-decide)

- New kinds + folders (see table) instead of mapping Loom objects onto
  existing kinds; type fidelity matters and `KINDS`/`FOLDERS` are plain
  lists designed to be extended.
- Dedup via a `Loom ID: <id>` body marker + `search()`, no new Vault API.
- `OfflineAdapter` stays in the code as the fallback type; the runtime
  fallback is `LoomHttpAdapter`'s own error paths (`activity()` → `State::Error`
  when unreachable, `submit()` → `Err` with an honest message).
- `send_message()` keeps its local keyword behavior when Loom is unreachable;
  when connected it submits to Loom and shows the reply (or the Loom error,
  honestly). Offline behavior is unchanged.
- Pre-existing warning `State::Exploring` never constructed
  (`knowledge.rs:156`) is left alone: no Loom endpoint reports an
  "exploring" state, and removing a documented enum variant to chase a
  zero-warning count would be cosmetic surgery on a shared contract.
