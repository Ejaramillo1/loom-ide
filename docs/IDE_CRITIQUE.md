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

- **Avatar** — renders but does nothing (no profile, no account, no menu).
- **Code editor** — a plain `<textarea id="code-editor">` (`index.html:158`), not Monaco. No syntax highlighting, line numbers, or language awareness.
- **Object-memory note editor** — still Unity IMGUI, not the host HTML (deferred from the critique pass).
- **Q2 fallback** — if Unity fails to load, there is no fallback view; only a Retry control.
- **The sphere** — kept as optional identity/atmosphere, not a functional surface (per your decision).

## 4. Recommendations (in priority order)

1. Wire or remove the avatar. If there is no account concept, drop it — it is the clearest "chrome without a job".
2. Pick one Loom-state surface. Keep the header pill as the reliable indicator and let the sphere be ambient color only, or vice versa — not both carrying the same meaning.
3. Replace the Code textarea with Monaco, or explicitly scope Code as a plain-text editor (rename/relabel so it doesn't promise more than it does).
4. Move the object-memory note editor out of Unity IMGUI into the host HTML.
5. Decide Q2's fallback (Experiment view is the natural default, consistent with the nav).

## Not in scope here (already resolved or deferred elsewhere)

- The second window, the duplicated chat/intent/search from the fold — already consolidated.
- The full "AI experimentation workbench" layout and shell chrome reduction — tracked in `docs/DESIGN_PROGRESS.md`.
