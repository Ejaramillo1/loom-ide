# Native-app (eframe Living Workbench) inventory — fold into Tauri/Unity (audit Q1=b)

**Scope:** read-only inventory of `native-app/` in `Ejaramillo1/loom-ide`, branch `tauri-prototype`, laptop copy written 2026-11-14. Purpose: plan folding ALL eframe features into the Tauri app and the Unity bench and retiring the second window (Eduardo's decision, 2026-11-14, Q1=b). Q2 deferred; Q3 the sphere STAYS; Q4 consolidate anything duplicated (including audit D1 one New-experiment button, D2 one work-creation entry). Full version lives on the assistant VM at `~/workspace/loom-ide-fix/native-app-inventory.md`; this laptop copy is condensed. The module code is the source of truth — re-read it before building.

**Method:** every module in `native-app/src/` read in full. No shell, no edits, no commits, no pushes during the inventory. Tauri-side equivalents were checked by searching `src/` and `src-tauri/src/lib.rs`; §G closes the four uncertain flags by reading the Tauri code.

## 0. What the native app is

- **Crate:** `living-workbench` 0.1.0 (`native-app/Cargo.toml`), eframe 0.29.1 / egui with `glow` renderer, deps only `serde`, `serde_json`, `image` (png). Binary: `native-app/target/debug|release/living-workbench`.
- **Window:** default 1600x900, minimum 620x640, title `Loom — Living Workbench · Integrated`. CLI flags: `--vault <dir>`, `--view knowledge|canvas|experiments|decisions|activity|files|work`, `--scene-preview`, `--screenshot <file.png>`, `--self-test <file.json>`, `--width/--height`, `--help`.
- **Vault (the important fact):** the native app keeps its own **markdown-note vault** (default `Research Vault/` beside the repo manifest, `main.rs:2119`, overridable with `--vault`). This is a *different store* from Tauri's JSON records under `$XDG_DATA_HOME/com.loom.ide/loom-ide/` (`work.json`, `intents.json`, `experiments.json`) and from the Tauri workspace folder. The fold must decide what happens to this vault (see §E Q1 — decided by default in the Codex prompt: keep the markdown vault as the shared store, behind a store adapter).
- **Two windows today:** Tauri and native are linked by `shared/navigation.rs` — single-instance claim plus a localhost activation handshake (`TAURI 127.0.0.1:43761`, `WORKBENCH 127.0.0.1:43762`, messages `loom-activate-v1` / `loom-active-v1`, no paths or user data in the messages). Each surface restores/focuses the existing window instead of launching a duplicate.

## A. Per-module inventory

### main.rs (2,182 lines) — the whole UI shell

**Views** (`View` enum, `main.rs:23-33`): Home, Files, Work, Knowledge, Canvas, Experiments, Decisions, Activity. **Dialogs** (`Dialog`, `main.rs:34-45`): Search, Intent, More, Review, Note, New, Settings, Journal, Scene.

**Top bar** (`top()`, `main.rs:343-419`): Loom logo with small orb, File menu (Files & editor, Capture note, Go to Tauri environment), View menu (Home, Work, Files, Knowledge, Canvas, Experiments, Decisions, Activity), intent line (workspace views only), Dark/White switch, search icon (Ctrl+K), proposal bell (purple dot when proposals await review), profile avatar circle → Settings dialog.

**Home** (`home()`, `main.rs:420-564`): procedural atmosphere background, "You are working on:" + the active intent (click → Intent dialog), the large sphere (see below), a six-item glass bottom nav — Knowledge, Canvas, Experiments, Decisions, Activity, More — and the Conversation panel at right (position 1170,140 at reference size; becomes a drawer with a "Conversation" pill when the window is narrower than 1100 px). Home sphere at (630,435) at the 1600x900 reference size.

**Sphere** (`orb_image()`, `main.rs:290-342`): a 2D procedurally painted pearl (see `visual.rs`), a state-tinted halo mesh, and six wave ribbons. The halo tint follows the current state: amber = awaiting approval, green = completed, red = error, blue = exploring/executing, purple = everything else. Clicking the sphere opens Activity; hovering shows the state words ("At rest — nothing is running", etc.). The state rule lives in `mechanics.rs` (`sphere_state()`: attention beats processing beats busy beats non-empty input beats completed beats idle). **Q3: the sphere stays.** The 2D painting retires with the window, but this state→colour rule is the behaviour the Unity sphere should inherit.

**Conversation** (`conversation()` + `send_message()`, `main.rs:565-812`): right-side panel with message history (assistant replies can carry clickable linked-note cards that open the note), input "Ask or propose something...", Send button, a "Test connection" pill (`GET /v1/health` → toast "Connected to Loom" / "Loom offline"), and a footer status ("Loom connected" / "Local knowledge · No model connected"). Send flow: Manual guard first (`mechanics::prepare_chat`: empty input does nothing; Manual on shows a notice and keeps the draft; otherwise send), then a connectivity check (offline → draft preserved, honest notice), then `POST /v1/weave {"query": prompt}`. **Behaviour gap vs Tauri:** the native adapter builds a `ContextPack` (intent, selected object, token estimate) and then does not send it — `loom_adapter.rs:227` takes `_context` and posts only the bare query. Tauri's chat sends session context. The fold should keep Tauri's behaviour, not the native one.

**Workspace** (`workspace()`, `main.rs:813-1076`): sidebar (only when the window is wider than 1000 px) with "Research Vault", "+ Capture a note", "+ Capture an idea", section list (Knowledge, Canvas, Experiments, Decisions, Activity), a "VAULT LOCATIONS" folder list (clickable folder filters: 00 Inbox, 10 Fleeting Notes, 20 Literature Notes, 30 Permanent Notes, 40 Maps of Content, 50 Projects, Sessions, Agents, 60 Daily Notes, 70 Sources, 80 Attachments, 90 Templates, 99 Archive), and a "Memory garden · N" pill (N = pending proposals) opening the Review dialog. Narrow windows get a pill row instead of the sidebar.

**Knowledge graph** (`graph()`, `main.rs:1077-1214`): radial layout (selected node centred, others on an ellipse), edges with arrowheads, node colour by kind (result/memory green, experiment blue, question amber, everything else purple), click a node to open the note, "Show all knowledge" clears focus, focus mode shows a node plus its neighbours only, honest empty state ("No notes yet. Capture a note or sync from Loom to build your graph."). Counts shown: "N objects · M relationships". A "Sync from Loom" pill sits in the Knowledge header.

**Canvas** (`canvas()`, `main.rs:1215-1268`): draggable note cards on a grid (240x148 cells), ledger edges drawn as lines between card centres, click a card to open the note, "Export JSON Canvas" button (full view only). Positions are session-only (kept in a `HashMap`, not persisted).

**Experiments / Decisions lists** (`note_list()`, `main.rs:1269-1404`): notes filtered by kind `experiment` / `decision` (or by folder prefix), "+ New knowledge" button, cards showing title, `kind · vN · status` (status colour-coded), "View evidence and links". Empty state: "This space is ready for your first note."

**Activity** (`traces()` / `audit_list()`, `main.rs:1405-1445`): the last 100 audit entries, newest first — `action · title`, then `actor · timestamp · detail`. Historical fixture entries are hidden, not deleted.

**Dialogs** (`dialogs()`, `main.rs:1446-1534`): Search (Ctrl+K, full-text over title/body/kind, Enter opens first result; shortcuts Ctrl+K search, Ctrl+N capture, Esc close; Ctrl+H home handled in `update()`); Intent (edit active intent, Save intent, Linked knowledge → Knowledge view, switch to a stored intent, Create another intent); More (Scene preview, Memory garden, Activity journal, Workspace settings); Review / "Memory garden" (every `proposed` note as a card with "Needs your review", body excerpt, "Inspect evidence & review" → note dialog; Review history → Journal); Note (kind + `status · vN`, Edit/Preview toggle, title + body editing with Save/Discard, `##` headings rendered, "Source & provenance" (author, stable ID, created/modified, file path), "Connections & backlinks" (typed link via relation-type + target dropdowns, remove with ×), "Version history & review trail" (past versions from `.loom/history/` plus audit entries); proposed notes show "Review the wording and linked evidence before accepting", optional review-note field, "Approve memory" / "Reject proposal" ("Human decision · preserved in history")); New / "Capture an idea" (title, kind dropdown with all 21 kinds, body; "Create note" saves and opens the note dialog); Settings / "Local workspace" (Dark/White switch, vault path display, "Reduce motion" checkbox, "Keep chat as drafts (Manual)" checkbox, "Last connection check" status, "Refresh files from disk" button, "View shortcuts" button); Journal / "Activity journal" (same audit list as Activity, in a modal); Scene (see `scene.rs`).

**Self-test / screenshot** (`self_test_tick()`, `main.rs:1878-1945`, and `update()`, `main.rs:1948-2089`): scripted frames drive an end-to-end check (empty start, capture, inspect, save/link/reopen/export, Manual draft guard, canvas with real data, appearance toggle persistence, scene preset round-trip, HUD) and write a JSON result plus a PNG screenshot, then exit. Dev tooling, not user features. Repaint: every 120 ms normally (`mechanics::REPAINT_MS`), or only on expiry when reduced motion is on.

### knowledge.rs (915 lines) — the markdown vault store

**Model:** `Meta` (`knowledge.rs:76-87`: id `n-<nanoseconds>`, kind, title, created/modified unix seconds, author, source, status, version) + body, stored as a `.md` file with a JSON frontmatter block between `---` lines (`Note::encode()`, `knowledge.rs:96-103`).

**Taxonomy:** 15 folders (`FOLDERS`, `knowledge.rs:10-26`, from `00 Inbox/Agent Proposals` through `99 Archive`, including `50 Projects/Agent Memory/{Experiments, Decisions, Artifacts, Sessions, Agents}`), 21 note kinds (`KINDS`, `knowledge.rs:38-60`: note, intent, project, document, question, hypothesis, experiment, result, decision, code reference, issue, pull request, execution, memory, observation, finding, map, literature, session, agent, artifact), 10 relation types (`RELATIONS`, `knowledge.rs:27-37`: supports, contradicts, depends on, derived from, supersedes, tests, implements, references, generated by).

**On-disk layout under the vault root:** the 15 folders; `.loom/ledger.json` (edges + audit trail); `.loom/settings.json` (intent, reduced_motion, light_mode, manual_chat); `.loom/history/{id}/v{n}.md` (version snapshots); `.loom/pending.json` (crash-recovery transaction journal); `.loom/scene-preview.json`; `.loom/initialized` marker.

**Safety model:** `safe()` (`knowledge.rs:192-210`) rejects absolute paths, `..`, and symlinks (including a symlinked vault root); all writes are atomic (temp file + rename, directory fsync); multi-file changes go through a `Transaction` written to `.loom/pending.json` first and replayed on open if a previous run crashed; saves check the ledger is unchanged and the on-disk file still matches the draft's `original` text, otherwise they refuse and preserve the draft; note files are capped at 1 MB; duplicate note IDs are rejected at load; files without valid frontmatter are preserved, never overwritten.

**Operations:** `create()` (agent notes go to `00 Inbox/Agent Proposals` with status `proposed`; human notes are routed by kind — experiment → Experiments, decision → Decisions, session → Sessions, agent → Agents, artifact → Artifacts, everything else → `10 Fleeting Notes`); `save_note()` (agents may only create proposals and may never overwrite human knowledge; status can only change through `review()`; every save bumps the version and snapshots the previous version); `relate()` / `unlink()` (typed edges, no self-links, no duplicates); `review()` (human-only; **approval requires at least one linked edge**, i.e. supporting evidence; records the reason and an audit entry); `search()` (substring over title/body/kind); `backlinks()`; `pending()` (count of `proposed`); `set_intent()` / `set_motion()` / `set_appearance()` / `set_manual_chat()`; `export_canvas()` (writes an Obsidian JSON Canvas file to `50 Projects/Agent Memory/Artifacts/Knowledge.canvas`, nodes on a 4-column grid, edges from the ledger).

**Frontend vs fixture data:** `Vault::open_frontend()` starts a new vault empty and hides historical fixture records (author `research fixture` / `offline sparring fixture`, sources starting `Historical research fixture` / `Historical Mastermind fixture`, demo decision bodies) without deleting them. The fixture seed itself (`seed()`, test-only) is the Mastermind memory experiment: 59/100 with memory vs 40/100 without, +19 points, ~4x latency, >2x tokens, plus a hypothesis, result, decision, challenge, follow-up, map and memory note, with 11 typed edges.

**Vault I/O:** reads/writes the markdown vault described above only. It does **not** read Tauri's JSON store.

### files.rs (293 lines) — Files & editor

Root comes from Tauri's saved workspace folder: it reads `$XDG_DATA_HOME/com.loom.ide/loom-ide/workspace.json` and uses its `root` value, falling back to `~/Documents/Loom` (`files.rs:15-37`). UI: folder path field + "Open folder", "New name" + "Create file" / "Create folder" (single-component names only, no `/`, `\`, `..`, `.`), a file tree (symlinks skipped, "↑ Parent folder"), and a monospace text editor (28 rows, `code_editor()`). Rules: files over 1 MB or containing NUL cannot be opened or saved; save is explicit ("Save · Ctrl+S"), atomic via a sibling temp file + rename preserving permissions, and refuses when the file changed elsewhere ("File changed elsewhere. Your draft is preserved; reopen after copying your changes."); an unsaved draft blocks switching files or folders. `open_tauri()` (`files.rs:245-273`): first tries to activate the existing Tauri window via `navigation::activate(TAURI)`; otherwise spawns `src-tauri/target/release/loom-ide` (or the debug build) with `GDK_BACKEND=x11`, keeping a single tracked child process.

### work.rs (82 lines) — Work overview (read-only mirror of Tauri)

Reads Tauri's `work.json`, `intents.json`, `experiments.json` directly from `$XDG_DATA_HOME/com.loom.ide/loom-ide/` (missing files count as empty lists; parse errors are shown, files never modified). UI: "Work · shared with Tauri", "Refresh saved work" button, "Go to full Tauri tools" button (calls `files::open_tauri()`), and collapsible rows per record showing status, autonomy ("Planning preference"), success criteria, and an "Inspect full record" pretty-printed JSON view. Explicitly read-only: "Saved record · editing and runtime tools available in Tauri". **This view exists only to mirror Tauri; after the fold it disappears.**

### visual.rs (475 lines) — design tokens and painters

Reads `../../design-tokens.json` at compile time (`include_str!`) — the **same token file the Tauri app shares**. `Palette` (`visual.rs:14-47`): light flag plus text, second, muted, purple, blue, green, amber, red, deep; `control_radius()` 10, `panel_radius()` 22; `apply_appearance()` rebuilds the whole egui style (light/dark visuals, selection, widget fills, spacing 10/10, button padding 14/8, text sizes 14/14/12, animation time 0.15 s). `color_status()`: approved green, proposed amber, rejected red, recorded blue, everything else purple. Painters: `txt()` / `wrapped()` text, `glass()` panels (10-layer shadow, translucent surface, top highlight line), `pill()`, `icon()` (hand-drawn 24x24 line icons: search, bell, chat, down, chevron, close, nodes, flask, history, activity, grid, file, chart, send, plus, folder, check, arrow, back, link, shield, user), `icon_button()`, `atmosphere()` (1600x900 procedural background: deep gradient, glow, water reflection with streaks/ripples), `sphere()` (720 px procedural pearl with fresnel rim and coloured light wisps, from the `orb-pearl` / `orb-highlight` / `orb-line` tokens).

### mechanics.rs (252 lines) — rules recovered from the shipped ELF

Documented with ELF addresses in `MECHANICS.md`: repaint every 120 ms, send "processing" 1.5 s then "completed" 2.5 s, ribbon minimum 3 points / width 0.8, the Manual chat guard order (empty input returns before the Manual check), the eight state words, the sphere-state priority rule, glow pulse (`10 + 8·pulse`), halo radii, and the six wave curves (49 samples each, clipped to the circle, speed by state: thinking 0.07, executing 0.11, otherwise 0.02; frozen under reduced motion). Test-only: `ExperimentStage` (Baseline → Comparison → Choose → Recorded) and `record_choice()` (writes a "Memory strategy: Configuration A/B" decision note; explicitly says no server experiment ran). These test helpers are hidden from the frontend.

### scene.rs (158 lines) — scene preview (a 2D prototype, NOT Unity)

`Preset` (x, y in −1..1, scale 0.5..1.5, speed 0.25..2, `deny_unknown_fields`) saved to `.loom/scene-preview.json` (validated, atomic temp+rename); `ScenePreview::show()` renders a grid canvas with the orb image and six wave ribbons, Play/Pause/Stop/Reset buttons, Position X/Y, Scale and Animation speed sliders, and a "Save scene preset" button. The UI itself says: "A local visual prototype. Unity is not connected." Reduced motion freezes it; reopening loads the saved preset with playback paused. Opened from More → Scene preview or the `--scene-preview` flag. **Superseded by the real Unity bench — the natural retirement candidate; the only question is whether its sliders should become Unity bench view controls.** (Default in the Codex prompt: retire entirely, no sliders.)

### adapter.rs (33 lines) — agent port (mostly dormant)

`AgentAdapter` trait (`activity()`, `submit()`), `ContextPack` (intent, object_ids, excluded_ids, estimated_tokens), and `OfflineAdapter` (always Idle; `submit()` errors "No agent is connected. Local knowledge remains available."). The app wires `LoomHttpAdapter`, not `OfflineAdapter`; no use of `OfflineAdapter` was seen in `main.rs`.

### loom_adapter.rs (301 lines) — HTTP client to the Loom server

Raw HTTP over `TcpStream` to `127.0.0.1:5006` (no new dependencies; same pattern as `src-tauri/src/lib.rs`): 2 s connect timeout, 5 s write, 4 s GET read, 180 s POST read, 16 MB body cap, 64 KB header cap, Content-Length-bounded reads, chunked de-chunking, read-to-EOF only as a last resort. `activity()` = `GET /v1/health` → Idle or Error. `submit()` = `POST /v1/weave {"query": prompt}` → first non-empty string among `text`, `response`, `content`, `reply`, `message`. Fully unit-tested (dead-port error, key order, length-bounded/chunked/EOF bodies, bad JSON).

### loom_sync.rs (117 lines) — Sync from Loom

Manual button only, never automatic. `GET /v1/sessions?limit=500`, `GET /v1/agents`, `GET /v1/artifacts?limit=200`; each new item becomes a note of kind `session` / `agent` / `artifact` with a `Loom ID: <id>` marker line in the body; items already in the vault are skipped (searched by marker), never duplicated. Artifact content is referenced, not downloaded. Returns counts for the toast.

### shared/navigation.rs (95 lines) — the two-window bridge

Single-instance claim + activation handshake over localhost TCP (see §0). Used by both directions: native `files::open_tauri()` activates `TAURI`, Tauri's `open_living_workbench` activates `WORKBENCH`. Retires with the second window (the Tauri port can stay if anything else ever needs to focus the app; the workbench port goes).

### README.md / Cargo.toml / assets

README (56 lines) documents the two-window prototype honestly: vault starts empty, historical notes hidden, Phoenix deferred, Loom on `localhost:5006`, sync behaviour, the 1600x900 spec with sphere at (630,435) and conversation at (1170,140), Dark/White saved per vault, Manual drafts, the scene preview, and the bridge (build both executables; navigation reuses the existing window). `CREDITS.md` + `assets/Inter-400.ttf` / `Inter-500.ttf` are the only reused game assets, with the required non-sharing notice. `MECHANICS.md` + `mechanics.json` + `docs/native-*.json` are the recovered-rules evidence pack.

## B. Feature mapping — proposed home in the one app

Tauri modes today (`src/main.ts:91`): `code | experiment | work | agents | evidence | artifacts | spatial`. Tauri has: intent editor with autonomy dial and acceptance criteria, work/experiment JSON records, sessions/agents/workflows/artifacts live from the Loom server, Artifacts view with an Artifacts tab and a Documents tab, workspace file tools (`create_workspace_file`, `read_file`, `write_file` in `src/api.ts:868-880`), Conversation panel, search in the Work panel, View-menu Dark/White radios, status pill. Verified by search: Tauri `src/` contains **no** graph, **no** proposal/Memory-garden/approval review, **no** audit/journal, **no** scene preview (matches found were only comments mentioning "audit A5").

| # | Native feature | Proposed home | Status |
|---|---|---|---|
| 1 | Home sphere + atmosphere (2D painted pearl, halo, ribbons) | **Unity bench (Spatial view)** — the sphere stays (Q3); the state→colour rule from `mechanics::sphere_state` should drive the Unity sphere | Move behaviour, retire painting |
| 2 | Conversation panel + Loom chat | **Tauri Conversation panel** (already exists, session-based) | Consolidate; keep Tauri's context handling, not the native bare-query send |
| 3 | "Test connection" pill / "Loom connected" footer | **Tauri status pill** (D13, already in header) | Retire native copy |
| 4 | Knowledge graph (radial, focus mode, kind colours) | **No equivalent yet — needs new UI.** Propose a new Knowledge view in Tauri (or a Notes/Graph view) | New |
| 5 | Canvas (draggable cards + Obsidian JSON Canvas export) | **No equivalent yet — needs new UI.** Same Knowledge view, Canvas tab; keep the JSON Canvas export | New |
| 6 | Notes CRUD (21 kinds, 15 folders) + version history + provenance | **No equivalent yet — needs new UI.** Tauri's Documents tab only lists two local documents (`src/main.ts:3020-3046`), not a notes store | New |
| 7 | Typed links / backlinks (10 relation types) | **No equivalent yet — needs new UI**, part of the Notes view | New |
| 8 | Proposals + human review ("Memory garden", approval requires linked evidence) | **No equivalent yet — needs new UI.** Review queue; header bell with pending count carries over | New |
| 9 | Global search (Ctrl+K, title/body/kind) | **Partial:** Tauri search lives in the Work panel (D7). Extend it to cover notes, or scope it to the Notes view | Extend |
| 10 | Experiments / Decisions note lists | **Partial / duplicate:** Tauri's Experiment view holds runtime/JSON experiment records; native lists markdown notes of kind `experiment`/`decision`. Q4: make the note lists filtered views of the same Notes store; keep Tauri's Experiment view as the record of runs | Consolidate with care — two different meanings of "experiment" |
| 11 | Activity journal (audit trail, last 100) | **No equivalent yet — needs new UI.** Propose an Activity view fed by a Tauri-side audit log (today only the native ledger has one) | New |
| 12 | Intent editing (plain string in `.loom/settings.json`) | **Tauri intent editor** (richer: criteria, autonomy dial, status) | Consolidate; Tauri wins, native dialog retires |
| 13 | Dark/White appearance | **Tauri View-menu radios** — but persistence differs: native per-vault `.loom/settings.json`, Tauri `localStorage` (`loom:appearance`). Pick one store | Consolidate; store TBD (§E Q4) |
| 14 | Reduce motion setting | **Uncertain** — not verified whether Tauri has one; check before building, carry over if missing | Verify — see §G: resolved, Tauri honours the OS setting; no in-app toggle |
| 15 | "Keep chat as drafts (Manual)" guard | **No equivalent in Tauri** — adopt as a Tauri chat setting, or drop it (Tauri chat is session-based; the guard's job was offline safety) | Needs decision (§E Q5) — see §G: confirmed missing |
| 16 | Files & editor (explicit save, external-edit guard, 1 MB cap, symlink rules) | **Partial:** Tauri has workspace file commands (`read_file`/`write_file`/`create_workspace_file`). Whether Tauri has a full file-browser/editor UI was **not verified** — check; if thinner, carry the native editor's rules over | Verify — see §G: resolved, Tauri has a full file tree + editor |
| 17 | Work overview (read-only mirror of Tauri records) | **Tauri Work view itself** | Retire outright |
| 18 | Sync from Loom (mirror server objects as notes) | **Partial:** Tauri lists sessions/agents/artifacts live. The *mirroring as notes* behaviour is separate — keep or drop is a decision (§E Q3) | Needs decision |
| 19 | Scene preview (2D Unity-inspired prototype) | **Superseded by the real Unity bench** | Retire; sliders as bench controls only if Eduardo wants them (§E Q6) |
| 20 | Proposal bell + pending-count dot | **No equivalent in Tauri** — comes with the review queue (#8) | New |
| 21 | Keyboard shortcuts (Ctrl+K/N/H, Esc) | **Partial** — Tauri has search; shortcut parity not verified | Verify — see §G: resolved, no Ctrl+K/N/H in Tauri; add with Notes view |
| 22 | Design tokens / visual system | **Already shared:** `design-tokens.json` is used by both. The token file stays; the egui painters (`glass`, `pill`, icons, `atmosphere`, `sphere`) retire except where Tauri needs an equivalent it lacks | Keep tokens, retire painters |
| 23 | Self-test / screenshot CLI | Dev tooling; Tauri has vitest instead | Retire with the window |
| 24 | Single-instance activation ports (43761/43762) | Retire the workbench port (43762) with the window | Retire |

## C. How Tauri launches / links it today

- **Tauri → native:** `openLivingWorkbench()` in `src/api.ts:1076-1077` invokes the Tauri command `open_living_workbench`. It is wired to the View menu item "Living Workbench — knowledge, canvas & sphere" (`src/main.ts:4628`, disabled outside Tauri). Backend (`src-tauri/src/lib.rs:138-...`, registered at `:2031`): first `navigation::activate(WORKBENCH)` (focus the running window); otherwise spawn `native-app/target/debug/living-workbench` or `native-app/target/release/living-workbench`, erroring "Build Living Workbench first: cargo build --manifest-path native-app/Cargo.toml" when neither exists.
- **Native → Tauri:** File menu "Go to Tauri environment" and the Work view's "Go to full Tauri tools" button call `files::open_tauri()` (`files.rs:245-273`): activate `TAURI` (127.0.0.1:43761) or spawn `src-tauri/target/release|debug/loom-ide` with `GDK_BACKEND=x11`.
- **The "go refresh in Living Workbench" link:** the audit's D10 sentence ("Refresh files from disk in Living Workbench to see new saves") has **zero matches left in Tauri `src/`** — it was already removed in the overnight run (Phase 8; A5 host push replaced it). What still exists is the native app's own Settings button "Refresh files from disk" (`main.rs:1525`), which reloads the native vault only; that goes away with the window. The Tauri side also still mentions the vault in one user-visible string: `spatial.ts:53`, "Saved to Living Workbench vault." — that wording will need updating when the vault becomes one store.
- **Shared folder, already unified:** the native file editor reads its root from Tauri's `workspace.json` (`files.rs:22-26`), so both windows already browse the same workspace folder. The split is the *knowledge* store (native markdown vault vs Tauri JSON records), not the file folder.

## D. Duplicate surfaces found (Q4)

1. **Two homes / two spheres:** Unity bench (Spatial) vs native Home with its painted sphere. Q1=b resolves it: Unity is the home; the native painting retires, the state rule moves.
2. **Two chats:** Tauri Conversation (session context) vs native Conversation (bare query, Manual guard, Test-connection pill). Keep Tauri's; decide the Manual guard separately.
3. **Two intents:** Tauri JSON intent records with editor + autonomy dial vs native plain-string intent in `.loom/settings.json` with its own dialog. Tauri wins.
4. **Two appearances:** same Dark/White choice persisted in two places (Tauri `localStorage`, native per-vault `settings.json`).
5. **Two "experiment" meanings:** Tauri Experiment view (run records) vs native Experiments list (markdown notes). Do not merge them into one list; make the note list a filtered view of Notes.
6. **Two Loom-status indicators:** Tauri header pill vs native footer text + Test-connection pill.
7. **Two file editors:** native Files & editor vs Tauri workspace file commands (UI parity now verified — §G — Tauri has a full editor; duplicate confirmed).
8. **Two knowledge stores:** native markdown vault (+ ledger, history, settings) vs Tauri JSON records. This is the consolidation that matters most; everything else follows from it.
9. **Two search scopes:** native global knowledge search vs Tauri Work-panel search.
10. **Audit D1/D2 (from the audit, for Q4):** two "New experiment" buttons and three work-creation entries in Tauri — separate Tauri-side cleanups, not native-app work, but the same "one action, one place, one label" rule applies to the new Notes/Knowledge surfaces (one "New note" entry, one review queue).

## E. Open questions only Eduardo can answer

1. **The vault question (decides the whole fold):** the native knowledge store is a markdown vault (`Research Vault/`, JSON-frontmatter notes + `.loom/ledger.json` + `.loom/settings.json` + `.loom/history/`). Does the fold mean (a) Tauri gains a Notes/Knowledge view that reads and writes *those same files* (the markdown vault becomes the shared knowledge store), or (b) the notes migrate into Tauri's JSON record store? And where does the vault live going forward — `Research Vault/` beside the repo, or under `$XDG_DATA_HOME/com.loom.ide/loom-ide/` with the Tauri records? **Default recorded in the Codex prompt (2026-11-14): (a) keep the markdown vault as the shared store, behind a store adapter module so a later switch stays cheap. Vault location default: keep `Research Vault/` where it is; do not move user data without being asked.**
2. **Where does the Knowledge/Notes view live in the nav?** New bottom-nav tab, or inside Artifacts/Documents? (Note: the Documents tab currently holds only two local documents — it is not a notes surface today.) Default in the Codex prompt: new bottom-nav tab "Knowledge", after Evidence; do not add a seventh tab by stealth — it is part of the approved fold.
3. **Sync from Loom:** keep mirroring server sessions/agents/artifacts as vault notes, or is Tauri's live listing enough? (The mirror is what makes those objects browsable offline and linkable from notes.) Default in the Codex prompt: keep the mirroring behaviour, as a manual "Sync from Loom" action in the Knowledge view (never automatic).
4. **Appearance persistence:** keep Tauri's `localStorage`, the native per-vault `.loom/settings.json`, or sync the two? Default in the Codex prompt: Tauri `localStorage` wins (`loom:appearance`); do not write appearance into the vault.
5. **Manual drafts:** keep "Keep chat as drafts (Manual)" as a Tauri chat setting, or drop it? Default in the Codex prompt: drop it — Tauri's chat already preserves drafts on offline failure in its own way; do not add a second guard. If the existing Tauri chat loses drafts offline, record that as a bug instead of adding the setting.
6. **Scene preview sliders:** any interest in Position/Scale/Speed controls for the Unity bench, or retire the prototype entirely? Default in the Codex prompt: retire entirely, no sliders.
7. **Approval rule:** keep "approval requires at least one linked evidence edge" in the new review queue? Default in the Codex prompt: yes, keep it — it is the point of the review queue.
8. **Obsidian JSON Canvas export:** keep it? (It implies the vault is meant to stay Obsidian-compatible.) Default in the Codex prompt: yes, keep the export in the Knowledge view's Canvas tab.
9. **Reduced motion:** check Tauri parity first; if Tauri lacks it, add it or drop it? Resolved in §G: Tauri honours the OS setting; rely on it, no toggle.
10. **Historical fixture data:** the native vault hides old demo/fixture records without deleting them. When the window retires, delete them, keep them on disk, or migrate them? (Standing rule: do not delete files unless Eduardo names them.) Default in the Codex prompt: keep them on disk, hidden, exactly as today. Never delete.
11. **Activation ports:** retire 127.0.0.1:43762 with the window; anything else on the laptop expected to use it? Default in the Codex prompt: retire the workbench port; the Tauri port (43761) stays only if the Tauri app itself still uses it, otherwise leave the code alone and note it.

## F. What was not read (honest gaps)

- `MECHANICS.md`, `mechanics.json`, `docs/native-followup.json`, `docs/native-pseudocode.json`, `docs/native-verification.json`, `docs/FRONTEND_CLEANUP.md`, `design-tokens.json` contents, `native-app/test-data/`, `CREDITS.md` — not opened; the module code was treated as the source of truth.
- The Tauri frontend was only *searched* (targeted strings), not read end to end — the "uncertain" flags in §B (#14, #16, #21) need a Tauri-side look before building. (Done afterward — see §G.)
- No builds or tests were run (read-only task, no shell access from this chat); nothing here is verified by execution, only by reading the code.

## G. Tauri-side verification (2026-11-14, pre-mapping — read-only, harness chat)

The four "uncertain / verify" flags in §B are now resolved by reading the Tauri code (`src/main.ts`, `src/sphere.ts`, `src/style.css`, all of `src/`). No builds run; code read only.

- **#14 Reduce motion — RESOLVED, no in-app toggle needed.** Tauri honors the OS preference: `sphere.ts:39-40` reads `prefers-reduced-motion: reduce` (no animation loop under reduced motion) and `style.css:2416` has a `@media (prefers-reduced-motion: reduce)` block. The native app's explicit per-vault "Reduce motion" checkbox has no Tauri equivalent. Recommendation: rely on the OS setting; an explicit toggle is optional later, not a blocker.
- **#16 Files & editor — RESOLVED, Tauri already has it.** Code mode is a full file tree + editor: `main.ts:3762-4050` (file-create form for files/folders, `expandedDirs` tree, `openFile()` with `openFileOriginal` dirty tracking), Save / Close file / Reload file menu items (`main.ts:4610-4613`), `renderEditor()` with code tabs (`main.ts:4778+`). The native Files & editor is a duplicate — it can retire. Carry over the native editor's safety rules only where Tauri's differ (explicit save and external-edit handling exist in Tauri; the 1 MB cap and symlink rules were not compared line by line — detail for implementation).
- **#21 Shortcuts — RESOLVED, gap confirmed.** Tauri has no Ctrl+K, Ctrl+N, or Ctrl+H: zero `KeyK|KeyN|KeyH` matches anywhere in `src/`, and the global keydown handler (`main.ts:4975-5014`) handles only Escape (close drawers/menus/search) and Tab (drawer focus trap). Recommendation: add Ctrl+K (global search, extended to notes) and Ctrl+N (new note) with the Notes view; Ctrl+H optional.
- **#15 Manual drafts — RESOLVED, no equivalent.** "Manual" in Tauri `main.ts` appears only as autonomy level L1 ("Manual" in the dial, lines 431-434, 736) and in comments. There is no "Keep chat as drafts" guard. Whether to adopt it stays decision §E Q5 for Eduardo. (Default in the Codex prompt: drop it; see §E Q5.)

With these four closed, the only mapping input still missing is the vault decision (§E Q1). Once Eduardo answers it, the mapping proposal can be written without further Tauri-side research.
