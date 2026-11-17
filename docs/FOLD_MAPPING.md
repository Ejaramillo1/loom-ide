# Living Workbench fold mapping

Phase 0, 2026-11-14. Baseline `1f20256`, branch `tauri-prototype`.
Initial status: only `docs/CODEX_FOLD_PROMPT.md` and `docs/NATIVE_APP_INVENTORY.md` untracked; tracked diff empty. No personal context required for this programming task.

## Verified stores and adapter

`native-app/src/main.rs:2119` joins its Cargo manifest directory with `Research Vault`: `/home/ed/loom-ide-tauri/native-app/Research Vault/`. Existing Tauri spatial commands already point there. Preserve that location and all existing files. The Tauri identifier is `com.loom.ide`; `work_file_path`, `intents_file_path`, and `experiments_file_path` resolve to `$XDG_DATA_HOME/com.loom.ide/loom-ide/{work,intents,experiments}.json` (XDG default is `~/.local/share`). Do not migrate or modify these records.

One Rust module, `src-tauri/src/knowledge.rs`, owns the markdown store and its Tauri commands. Functions: `open`, `list`/`search`, `read` (versions, provenance, backlinks), `create`, `save`, `relate`, `unlink`, `review`, `pending_count`, `activity`, `export_canvas`, `sync_from_loom`. Reimplement safety rules, do not import/copy the native store. Serialize access, retain draft original text and ledger revision across UI edits, use atomic writes and recoverable multi-file journals. Keep legacy frontmatter/ledger/history formats readable. Agent creation is proposal-only; human review is the only status transition. No settings writes. Spatial memory must also use the adapter so saves appear in Knowledge and its journal.

## Inventory B: all 24 features

| B | Feature | Home and disposition |
|---|---|---|
| 1 | Home sphere and atmosphere | Unity Spatial remains home. Port state priority and colour rule; retire native painting with its window. Preserve Experiment sphere image. |
| 2 | Conversation | Existing Tauri session-aware chat, including its offline draft restoration. No second chat. |
| 3 | Connection test/footer | Existing Tauri header status pill; state rule also drives it. |
| 4 | Radial graph | Knowledge → Graph: focus/neighbours, arrows, kind colours and counts. |
| 5 | Canvas | Knowledge → Canvas: 240×148 grid, draggable cards, ledger edges, JSON Canvas export. Positions session-only. |
| 6 | Notes, provenance, history | Knowledge → Notes, same markdown files, all 21 kinds and 15 folders. One New note entry. No destructive delete; see blocker. |
| 7 | Typed links/backlinks | Note inspector. Preserve all nine relation types actually defined in source; missing tenth is a blocker. |
| 8 | Proposals/review | Knowledge → Memory garden; inspect note/evidence, approve/reject with reason, approval needs a linked edge. |
| 9 | Search | Extend existing search across work and notes; reuse the same input in Notes, Ctrl+K opens global search. |
| 10 | Experiment/decision notes | Filters in Notes labelled Experiment notes / Decision notes. Tauri Experiment remains runtime run records. |
| 11 | Activity | Knowledge → Activity, last 100 visible ledger entries, newest first. |
| 12 | Intent | Existing richer Tauri intent editor; native settings remain on disk but are not used. |
| 13 | Appearance | Existing View-menu Dark/White radios; `localStorage` key `loom:appearance` only. |
| 14 | Reduced motion | OS preference, already honoured by Tauri. No toggle. |
| 15 | Manual drafts | Retire setting. Existing Tauri `sendChat` catch restores composer and persisted draft. |
| 16 | Files/editor | Existing Tauri Code view; verify explicit save, conflict, cap, symlink safety. |
| 17 | Work overview | Existing Tauri Work view, native mirror retires. |
| 18 | Loom mirroring | Manual Sync from Loom in Knowledge, sessions/agents/artifacts with exact marker deduplication, no artifact download. |
| 19 | Scene preview | Retire UI with native window, no sliders. Keep source/settings on disk. |
| 20 | Proposal bell | Header bell opens the one Memory garden queue, shows pending count. |
| 21 | Shortcuts | Ctrl+K search, Ctrl+N new note, Escape close; Ctrl+H optional and omitted. |
| 22 | Visual system | Existing shared design tokens; vanilla TypeScript/CSS, no new dependencies. |
| 23 | Native CLI checks | Retired with window; retain source and native tests, use Rust/Vitest/build verification. |
| 24 | Activation ports | Remove Tauri launch/activation path for WORKBENCH. Keep shared code untouched. Tauri itself claims/serves 43761, so it stays. |

Navigation: Spatial, Work, Experiment, Code, Agents, Evidence, **Knowledge**. Artifacts remains accessible as today. Knowledge subviews: Graph, Canvas, Notes, Memory garden, Activity. Unity Notes portal opens Knowledge.

## Inventory D: all 10 duplicate surfaces

| D | Resolution |
|---|---|
| 1 | Unity home/sphere wins; state behaviour moves; native home retires. |
| 2 | Tauri Conversation only. |
| 3 | Tauri intent editor only, native intent data preserved. |
| 4 | Tauri localStorage appearance only. |
| 5 | Experiment run records separate from clearly labelled filtered experiment notes. |
| 6 | One header connection/state pill, no native footer or connection action. |
| 7 | Tauri Code editor only. |
| 8 | One markdown knowledge adapter; JSON work/intent/run records remain distinct domain records. |
| 9 | One existing search input, extended to knowledge. |
| 10 | Audit D1 keep right-pane New experiment; D2 keep main-pane Create work, sidebar lists only. |

## Inventory E: all 11 recorded defaults

1. Read/write the existing markdown vault, behind one adapter; no migration or relocation.
2. New bottom-nav Knowledge after Evidence.
3. Manual Sync from Loom retains mirroring, never automatic.
4. `loom:appearance` localStorage only; never write appearance into vault.
5. Drop Manual drafts setting; preserve Tauri's draft handling, report any observed loss.
6. Retire preview and sliders entirely.
7. Approval requires a linked evidence edge; preserve source semantics (any existing linked note, no invented evidence taxonomy).
8. Keep Obsidian JSON Canvas export at `50 Projects/Agent Memory/Artifacts/Knowledge.canvas`.
9. OS reduced-motion setting; no toggle.
10. Keep historical fixture files on disk, exclude them and their audit/edges from visible views.
11. Retire workbench launch/port usage in Tauri; leave shared port definitions for Eduardo. Tauri 43761 is actively used.

## Scope, risks, and unresolved decisions

Touch backend adapter/command registration/spatial adapter, frontend API/view/HTML/CSS/search/navigation/state bridge, player bridge and Unity controller; add focused safety and state tests. Existing stores and native source are reference only. No fixture generation in product; isolated test inputs are assertion data only. Never delete user files. Journal completion can use an empty journal instead of removing files. Snapshot conflicts must stop rather than overwrite.

Source has **nine**, not ten relation types. Native Notes has no delete operation; prompt asks CRUD but forbids deleting files and exposes no delete command. Preserve create/read/update/review/link capabilities and defer destructive deletion/tenth relation pending a decision. See FOLD_BLOCKERS.md.

Q2 (Unity failure fallback) is deferred: leave failure behaviour untouched. Custom native `--vault` paths are not discovered/moved. Default compile-time repo vault path remains a packaging limitation. Canvas positions are session-only. Existing hidden fixtures must be preserved byte-for-byte. Concurrent external writes require conflict checks; unsafe recovery must fail closed. A preview cannot exercise Tauri IPC; use real disk adapter tests as well as build checks.
