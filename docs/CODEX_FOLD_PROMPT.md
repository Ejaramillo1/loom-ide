# CODEX — Fold the eframe Living Workbench into the Tauri app (audit Q1=b)

## 0. Mission

You are working unattended on Eduardo's laptop for up to ~10 hours. Eduardo is away from the house and the Bluetooth link to this laptop is down. Do not try to message anyone. Do not wait for input. Do not use the harness. Work locally in `/home/ed/loom-ide-tauri`, commit locally per phase, and leave a written report when you finish.

**The job:** fold ALL features of the eframe Living Workbench (`native-app/`, the second window) into the Tauri app and the Unity bench, and retire the second window. One project, one application. Eduardo's words: "I like the idea to consolidate as much and eliminate the second window but I would like to incorporate all the features into our application. All of them are part of the same project."

**Success looks like:** a new Knowledge view in Tauri holding the workbench's notes, graph, canvas, review queue and activity journal; the duplicates in audit §3/D1/D2 gone; the Unity sphere driven by the workbench's state rule; the Tauri app no longer launching the second window; every phase verified with real command output; local commits only; a final report in `docs/FOLD_REPORT.md`.

## 1. Standing authorization — read this first

You have standing approval to do the following WITHOUT asking, for the items in the backlog below only:

- Read any file in `/home/ed/loom-ide-tauri`.
- Edit source files in the repo (TypeScript, Rust, C#, CSS, docs).
- Run builds, tests, the Unity editor, and the WebGL rebuild.
- Commit LOCALLY on branch `tauri-prototype` (never push).

You do NOT have approval for these, even though you are running autonomously. They stay forbidden:

- `git push`, `git merge`, `git reset`, `git rebase`, `git clean -fdx`, `rm -rf`. Never push. Never merge. Never reset.
- Deleting any file. Retiring the second window means disabling its launch path and marking it deprecated (Phase 4). The `native-app/` source stays in the repo. Eduardo deletes files himself later.
- Adding dependencies (Cargo, npm, or Unity packages). If one seems necessary, record it as a blocker and work around it.
- Touching anything outside `/home/ed/loom-ide-tauri`. Never touch `~/Documents/Craft Anything/`, `~/work/loom`, `~/work/agentic-ide`, `~/work/frontend-fix`, `~/Documents/Loom`.
- Inventing demo or seed data. Empty states stay honest and empty.
- Deciding anything in §4 marked as a recorded default differently from what is written there, or deciding Q2 (below).

If a fix needs a decision that is not covered in this prompt, STOP that item, record the blocker in `docs/FOLD_BLOCKERS.md` (one line per blocker: what, why, what you need), and move to the next independent item. Never guess a user decision. Never silently switch a recorded default.

## 2. Current state (verified 2026-11-14)

- Repo: `Ejaramillo1/loom-ide` (private), branch `tauri-prototype`, path `/home/ed/loom-ide-tauri`. Head: `1f20256` ("Phase 4 follow-up: queue theme changes sent before the Unity player loads"). Tree is clean except the two new docs files you are about to commit (this prompt and `docs/NATIVE_APP_INVENTORY.md`). If `git status` shows anything else at start, inspect `git diff --stat` first and record it before touching anything.
- Overnight run 13–14 Nov is COMPLETE: Phases 0–8 done and verified, 6 local commits (`41170a6`, `2c1a5c7`, `7514c68`, `46223cc`, `ae4f8e3`, `1f20256`), never pushed. Unity palette (distinct muted hue per portal), theme sync (ApplyTheme + `?theme=` plumbing), click-to-navigate (A4; Notes opens Artifacts/Documents), header minimalism (D7), vault push (A5, host push of counts, not a disk watcher), Round-2 backend/frontend items, autonomy-dial follow-ups. Final numbers: vitest 45/45, npm build clean, cargo lib 78 passed + 1 ignored, cargo native-app 22/22, Tauri crate `fmt --check` clean, Tauri release build clean.
- The audit is `docs/UNITY_FIRST_AUDIT.md`. Read it before starting. The inventory is `docs/NATIVE_APP_INVENTORY.md` (condensed laptop copy; the full version is on the assistant VM and not reachable from here — this copy plus the source code is your ground truth).
- Design heart, from Eduardo: cleanliness and transparency of the elements. Minimalism rules (audit §4): one action, one place, one label; one title per screen; the sphere means one thing; the header stays thin; empty states are one line plus one action; no status text that stays visible after its condition ended; honest empty states.
- Frontend is vanilla TypeScript. No React. No Astryx (Eduardo decided against a rebuild with Meta's design system on 13 Nov; do not re-litigate).
- The 3D object language (decided 13 Nov): physical-world forms with meaning — Notes = open notebook, Experiments = glass flask, Work = wooden toolbox, Code = laptop, Agents = small robot, Evidence = magnifying glass on documents; central glowing sphere = Loom's state indicator. Style: realistic, not cartoonish — photorealistic materials, muted palette, soft glow. The current Unity controller shapes (cylinders/capsule/cubes) do NOT yet match that language — that is stretch work (§6), not the core fold.

## 3. Decisions on record (do not re-decide these)

- **Q1 = b.** Fold ALL eframe features into Tauri/Unity; retire the second window.
- **Q2 = deferred.** The fallback view if Unity fails to load is NOT decided. Do NOT implement a fallback view choice. Leave Unity-failure behaviour exactly as it is and note it in the report.
- **Q3 = the sphere stays.** Do NOT remove any sphere rendering, including the static sphere image in the Experiment view — Eduardo likes it. Its meaning is Loom connection and system state. The 2D painting retires only because its window retires; the state→colour rule moves to the Unity sphere (Phase 3).
- **Q4 = consolidate anything duplicated.** Includes audit D1 (one "New experiment" button) and D2 (one work-creation entry), plus the duplicates in the inventory §D.
- **Vault (inventory §E Q1) — DEFAULT, recorded 2026-11-14:** Tauri gains a Notes/Knowledge view that reads and writes the SAME markdown vault files as the shared knowledge store. Do not migrate notes into Tauri's JSON store. Isolate the store behind a small adapter module (one file) so a later switch stays cheap. Vault location default: keep `Research Vault/` where it is (verify the exact default path in `native-app/src/main.rs:2119` before assuming); do not move user data.
- **Other inventory §E defaults (recorded, apply as written):** Knowledge view = new bottom-nav tab "Knowledge", after Evidence. Sync from Loom = keep the mirroring behaviour, as a manual "Sync from Loom" action in the Knowledge view, never automatic. Appearance persistence = Tauri `localStorage` (`loom:appearance`) only; do not write appearance into the vault. Manual drafts = drop the setting (if Tauri chat loses drafts offline, record that as a bug, do not add the setting). Scene preview sliders = retire entirely, no sliders. Approval rule = keep "approval requires at least one linked evidence edge" in the review queue. Obsidian JSON Canvas export = keep it, in the Knowledge view's Canvas tab. Reduced motion = rely on the OS setting (already honoured); no toggle. Fixture data = keep on disk, hidden, exactly as today; never delete. Activation ports = retire the workbench port (127.0.0.1:43762); the Tauri port (43761) stays only if the Tauri app itself still uses it, otherwise leave the code alone and note it.

## 4. Backlog — work in order, commit per phase

### Phase 0 — Mapping proposal (documentation first)

Read the audit, the inventory, and the relevant code (`native-app/src/knowledge.rs`, `native-app/src/main.rs`, `src/main.ts`, `src-tauri/src/lib.rs`). Verify the vault default path and the Tauri JSON record paths (`$XDG_DATA_HOME/com.loom.ide/loom-ide/work.json`, `intents.json`, `experiments.json`). Write `docs/FOLD_MAPPING.md`: every inventory §B row mapped to its Tauri/Unity home with the §3 defaults applied, the store-adapter design (one module, functions listed), the nav placement, what retires, what stays, and risks. Commit this prompt, the inventory, and the mapping together as Phase 0. Acceptance: the mapping covers all 24 §B rows, all 10 §D duplicates, and all 11 §E questions with the recorded defaults applied.

### Phase 1 — Notes data layer (Rust, in `src-tauri/`)

Build the markdown-vault store adapter behind one module. Port the SAFETY RULES from `native-app/src/knowledge.rs` (do not copy the file; reimplement the rules in the Tauri crate): JSON frontmatter between `---` lines; the 21 kinds, 15 folders, 10 relation types; atomic writes (temp file + rename, directory fsync); symlink rejection (including a symlinked vault root); 1 MB note cap; duplicate-ID rejection at load; files without valid frontmatter preserved, never overwritten; save refuses when the ledger changed or the on-disk file no longer matches the draft's original text; version snapshots in `.loom/history/{id}/v{n}.md`; multi-file changes via a pending-transaction journal replayed on open; agent notes only ever create `proposed` notes in `00 Inbox/Agent Proposals` and may never overwrite human knowledge; status changes only through `review()`; approval requires at least one linked evidence edge. Expose Tauri commands for: list/search notes, read a note (with versions, backlinks, provenance), create, save, relate/unlink, review (approve/reject with reason), pending count, export canvas (Obsidian JSON Canvas to `50 Projects/Agent Memory/Artifacts/Knowledge.canvas`), and manual Sync from Loom (`GET /v1/sessions?limit=500`, `/v1/agents`, `/v1/artifacts?limit=200`, marker `Loom ID: <id>`, skip existing, never duplicate, artifact content referenced not downloaded). Do NOT touch the existing JSON records (`work.json`, `intents.json`, `experiments.json`) — they stay exactly as they are. Add unit tests mirroring the safety rules. Acceptance: `cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib` passes with new tests covering create/save/review/relate/search plus the safety rejections.

### Phase 2 — Knowledge UI (Tauri frontend)

New bottom-nav tab "Knowledge" (mode `knowledge`, after Evidence) with these sub-views, following the existing view patterns in `src/main.ts` and the design tokens in `design-tokens.json`:

- Graph: radial layout (selected node centred, others on an ellipse), edges with arrowheads, node colour by kind (result/memory green, experiment blue, question amber, everything else purple), click a node to open the note, "Show all knowledge" clears focus, focus mode shows a node plus its neighbours only. Counts: "N objects · M relationships". Honest empty state, no demo data.
- Canvas: draggable note cards on a 240x148 grid, ledger edges as lines between card centres, click a card to open the note, "Export JSON Canvas" button. Positions session-only is acceptable; persist them only if it is cheap, otherwise record it as a known limitation.
- Notes: CRUD for all 21 kinds across the 15 folders, version history, provenance (author, stable ID, created/modified, file path), typed links/backlinks (10 relation types, no self-links, no duplicates). One "New note" entry, one place.
- Review queue ("Memory garden"): every `proposed` note as a card with "Needs your review", body excerpt, "Inspect evidence & review"; approve/reject with reason; approval requires a linked evidence edge. Header bell with pending count.
- Activity: the audit trail (last 100, newest first, `action · title`, then `actor · timestamp · detail`); fixture entries hidden, not deleted.
- Search: extend the existing search to cover notes (title/body/kind) and add Ctrl+K (global search) and Ctrl+N (new note). Ctrl+H optional. Search lives where it already lives plus the Notes view — do not create a second search box.
- Experiments/Decisions note lists become filtered views of the same Notes store. Do NOT merge them with the Tauri Experiment view (run records) — two different meanings of "experiment"; keep them separate and label them clearly.

Acceptance: `npm test -- --run` and `npm run build` pass; every sub-view has an honest empty state; no demo or seed data anywhere; the view works with the vault on disk (verify against the real `Research Vault/` contents if any exist, and against an empty vault).

### Phase 3 — Consolidation (Q4)

- D1: one "New experiment" button. Audit suggestion: keep the right pane's, remove the left card's. Follow it.
- D2: one work-creation entry. Keep "Create work" in the main pane; the sidebar keeps the work list only.
- Sphere state rule → Unity sphere: the halo/state colours from `mechanics::sphere_state` (amber awaiting approval, green completed, red error, blue exploring/executing, purple everything else; priority attention > processing > busy > non-empty input > completed > idle) must drive the Unity sphere's state. The header status pill already exists; wire the same rule to it if it is not already wired. Do NOT remove any sphere rendering.
- Update the user-visible string in `src/spatial.ts:53` ("Saved to Living Workbench vault.") to the one-store wording.
- Appearance persistence: `localStorage` (`loom:appearance`) is the one store. Document it in the mapping; remove nothing that does not exist.
- Scene preview: retire the 2D prototype (no sliders). This means its UI entry points go away with the window (Phase 4); do not build bench controls for it.
- Do not re-add a second chat, second intent editor, or second status indicator anywhere. Tauri's versions are the only ones.

Acceptance: tests pass; `grep` finds no remaining duplicate creation entries; the Unity sphere changes colour with state (verify by code path + Unity recompile, §5).

### Phase 4 — Retire the second window

- Remove the View-menu "Living Workbench — knowledge, canvas & sphere" item (`src/main.ts:4628`) and the `openLivingWorkbench()` wrapper (`src/api.ts:1076-1077`) and the `open_living_workbench` Tauri command (`src-tauri/src/lib.rs`, registered near `:2031`) plus its use of `navigation::activate(WORKBENCH)`.
- Add a short DEPRECATED note at the top of `native-app/README.md`: the window is retired, the Tauri Knowledge view replaces it, the crate source remains for reference.
- Do NOT delete `native-app/` or any file in it. Do NOT delete the workbench activation port code in `shared/navigation.rs` — leave it and note it in the report for Eduardo to delete later.
- After this phase, `grep -ri "living.workbench" src/ src-tauri/src/` must show no UI path that launches the workbench (comments and the README note are fine).

Acceptance: `npm run build` and `cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib` pass; no UI path launches the workbench; `native-app/` still present on disk.

### Phase 5 — Full verification and report

Run the whole suite (§5). If C# changed, also do the Unity recompile and the WebGL rebuild. Do a preview smoke check (`npm run preview`, `curl` the page, confirm HTTP 200 and that the built files load; no browser needed). Write `docs/FOLD_REPORT.md`: per-phase results with commit SHAs, final test/build numbers, deviations from this prompt, unresolved issues, and what is left for Eduardo (including anything in `docs/FOLD_BLOCKERS.md`). Commit. Acceptance: report exists, numbers are real, tree is clean, nothing pushed.

## 5. Verification commands (run these; do not trust a tool's "ready" signal)

Run from `/home/ed/loom-ide-tauri`:

- `npm test -- --run` (vitest; expect 45+ tests, all passing — the count grows with your new tests)
- `npm run build` (tsc + vite)
- `cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib`
- `cargo test --offline --locked --manifest-path native-app/Cargo.toml` (do NOT break the native-app tests; you are not changing that crate, but confirm it still passes at the end)
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml` (format only files you touch in `src-tauri/`; if it flags files you did not touch, leave them and note it)
- `npm run tauri build -- --no-bundle` (release build; takes ~2–3 minutes. If the shell kills it around 120 s, rerun it detached with `nohup` writing to a log file and poll the log — do not keep retrying it in the foreground.)
- Pre-commit hook: committing frontend files runs `npm run build` automatically. Let it run. If it fails, fix and retry the commit.

Known pre-existing condition (do NOT "fix" it): the `native-app` crate is not rustfmt-clean (about 100 diffs; its files were already non-clean before this work). Do not reformat the crate. Only format files you touch, and only in `src-tauri/`.

Unity (only if you change C# or the player): editor is Unity 6000.6.9f1 at `/home/ed/Unity/Hub/Editor/6000.6.9f1/Editor/Unity`, project `/home/ed/loom-ide-tauri/unity-memory-palace`, log at `unity-memory-palace/Logs/Editor.log`. The editor is usually already running; the `unity` CLI is on PATH.

- Recompile check: `unity recompile --project-path "$PWD/unity-memory-palace" --format json` (expect success, 0 errors, 0 warnings. If it fails with EDITOR_NOT_RUNNING right after a recompile triggered a domain reload, wait 60 s and retry once.)
- Editor self-check: `unity command script eval 'var c = Loom.MemoryPalace.MemoryPalaceController.ReadLoomRecordCounts(); return new { work = c.x, experiments = c.y, palette = Loom.MemoryPalace.MemoryPalaceController.PaletteMatchesDesignTokens()};' --project-path "$PWD/unity-memory-palace" --format json`
- WebGL rebuild (only after all C# changes are done — one rebuild, not one per edit): `timeout 880 unity command script eval --file Tools/BuildWeb.cs --project-path "$PWD/unity-memory-palace" --timeout 900 --format json` (takes ~7 minutes, mostly the wasm link step; do NOT kill it for being slow; check the tail of `Editor.log` if worried. Expect `{"result":"Succeeded"}` and fresh timestamps in `public/spatial/Build/`.)
- `public/spatial/` is git-ignored build output. Never commit it. `dist/` is build output. Never commit it.

## 6. Stretch work (only if Phases 0–5 are done and time remains)

In order, each as its own commit, each noted in the report:

1. Unity 3D object language: replace the controller's primitive shapes with the decided physical forms — Notes = open notebook, Experiments = glass flask, Work = wooden toolbox, Code = laptop, Agents = small robot, Evidence = magnifying glass on documents. Realistic materials, muted palette, soft glow. Keep the central glowing sphere. Verify with the Unity recompile + WebGL rebuild + self-check.
2. D9: unify empty-state wording across the app (one line plus one action, same pattern everywhere).
3. D12: verify Spatial is full-bleed (it was done in earlier work — verify, do not redo; if it regressed, fix it and say so).

If time runs short, finish the current phase cleanly, commit, write the report, and stop. A finished subset with a report beats an unfinished everything.

## 7. Environment and tool notes (this laptop)

- Ubuntu 26.04.1 LTS, Wayland + GNOME, 4 CPUs, 10 GiB RAM, 112 GiB free disk. Tools on PATH: node 24, npm 11, git 2.53, cargo 1.99, uv, `unity`, `codex`. NOT available: `python`, `py`, `powershell`, `cmd`, `rg`. Use `grep`, `sed`, `awk`.
- Git identity is already configured (`Ejaramillo1 / ejaramillobarrera@gmail.com`). Branch `tauri-prototype`. Commit messages: short imperative summary line, then a body explaining what and why. One commit per phase (plus smaller commits inside a phase if it helps).
- The Loom server (if running) is at `127.0.0.1:5006` (`/v1/health`, `/v1/weave`, `/v1/sessions`, `/v1/agents`, `/v1/artifacts`). Do not start it unless a task needs it. If it is not running, record that and test what you can without it; never fake a server response.
- The harness (MuseBridge) is DOWN while Eduardo is away — that is expected and does not affect you. You work directly on the laptop.
- `send_message` probes `/v1/health` per send (~2 s stall offline); Loom submit blocks the UI thread (up to 180 s). These are known Tauri limits, not your bugs — do not "fix" them in this run.
- Progress notes: after each phase, append a short entry to `docs/FOLD_PROGRESS.md` (phase, commit SHA, test numbers, what is next). If you are interrupted, that file is how the next session resumes.

## 8. What "done" means

All of Phases 0–5 complete, each committed locally, full verification green, `docs/FOLD_REPORT.md` written, tree clean, nothing pushed, nothing deleted, no new dependencies, no demo data. The report's last message (also written to the file) states plainly what is finished, what is not, and what Eduardo still has to decide.
