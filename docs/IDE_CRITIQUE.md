# IDE critique — elements, duplicates, and unimplemented surfaces

Scope: the application shell and its views, not the backend. Grounded in the source at head (Unity-first landing). This is the "what is actually there vs. what is decoration or a stub" pass.

## 1. Shell elements

The shell is a header, a left catalogue, a center workspace, a right pane, and a footer nav.

| Element | Where | Status |
| --- | --- | --- |
| Brand "Loom" + ring | header | Functional identity |
| App menu | `#app-menu` | Functional (File/View menus) |
| Objective line | `#objective-btn` | Functional, but only appears after a work item is selected (`main.ts:1341`) |
| Memory-garden bell | `#knowledge-bell` | Functional (pending-proposal count) |
| Conversation toggle | `#chat-toggle` | Functional (opens the right pane) |
| Status pill | `#loom-status` | Functional (Loom reachability) |
| **Avatar** | `.avatar` | **Decorative stub.** A `<span title="You">` with no handler and no account concept behind it. |
| `scene-light` / `.water` | backdrop | Decorative atmosphere (`aria-hidden`), not functional |

## 2. Duplicated things

- **Two Loom-state indicators.** The header status pill and the Unity sphere both encode Loom connection/state. They agree by design, but two surfaces carry the same meaning with no single source of truth in the UI.
- **Intent in two places.** The active intent is rendered both as a compact header (`#intent-header`) and as the full intent editor. Mild, but the same object has two persistent editors.
- **Three search inputs.** `#search-input` (work + notes), `#knowledge-search-slot` (knowledge), `#artifact-search` (artifacts). Scoped, but three separate search mechanics to maintain.
- **Two meanings of "experiment".** JSON experiment records (arms run through Loom) and markdown notes of kind `experiment` (knowledge vault). They are intentionally separate and never merged — but the same word names both, which reads as duplication.

## 3. Not really implemented

> Status update (14 Nov ~23:30, build-plan application): items marked ✅ were
> resolved by the build-plan pass; the rest remain open for the reasons noted.

- **Avatar** — renders but does nothing (no profile, no account, no menu).
- **Code editor** — a plain `<textarea id="code-editor">` (`index.html:158`), not Monaco. No syntax highlighting, line numbers, or language awareness. *Still open: Monaco/CodeMirror are benchmark candidates that need Eduardo's per-dependency decision (`docs/01-design-philosophy.md`); no new dependencies without it.*
- **Object-memory note editor** — ✅ demoted: selecting a bench object navigates to its Tauri view; the card offers "Open note in Notes". Text editing lives in the Tauri Notes view; the dead spatial-memory bridge was unregistered.
- **Q2 fallback** — if Unity fails to load, there is no fallback view; only a Retry control. *Still deferred (standing decision, AGENTS.md §4).*
- **The sphere** — kept as optional identity/atmosphere, not a functional surface (per your decision). *Still kept; it is the single live Loom-state indicator.*
- **Disk watcher** — ✅ the Knowledge surface polls a vault signature; external edits appear without a manual refresh (drafts and dialogs win).
- **Durable canvas layouts** — ✅ canvas card positions persist in the app data dir.
- **Orphan commands** — ✅ `get_collaboration` and `knowledge_pending_count` removed; the double-registered `knowledge_archive` fixed.
- **Live Loom loop / streaming** — ✅ chat streams over `/v1/weave:stream` with Stop, in-flight tool lines, and HITL cards; traces are viewable from replies.

## 4. Recommendations (in priority order)

1. Wire or remove the avatar. If there is no account concept, drop it — it is the clearest "chrome without a job".
2. Pick one Loom-state surface. Keep the header pill as the reliable indicator and let the sphere be ambient color only, or vice versa — not both carrying the same meaning.
3. Replace the Code textarea with Monaco (or CodeMirror), or explicitly scope Code as a plain-text editor (rename/relabel so it doesn't promise more than it does). *Needs Eduardo's per-dependency decision — see §3.*
4. ~~Move the object-memory note editor out of Unity IMGUI into the host HTML.~~ ✅ Done.
5. Decide Q2's fallback (Experiment view is the natural default, consistent with the nav). *Still deferred.*

## Not in scope here (already resolved or deferred elsewhere)

- The second window, the duplicated chat/intent/search from the fold — already consolidated.
- The full "AI experimentation workbench" layout and shell chrome reduction — tracked in `docs/DESIGN_PROGRESS.md`.
