# Fold report — Living Workbench into Tauri (audit Q1=b)

- Branch: `tauri-prototype`. Baseline `1f20256` (overnight run) → head `0dface2`.
- Codex run: 14 Nov 08:37–09:06, ended early on usage limit (165,642 tokens). Phase 5 verification finished by the assistant 14 Nov ~12:00.
- Outcome: Phases 0–5 complete. The fold is done and the second window is retired.

## Status update (14 Nov ~21:30)
This report was written at ~12:00; the following happened after, and supersedes the stale items below.

- The branch was pushed to `origin/tauri-prototype` at 21:19 and is in sync.
- Both recorded blockers are resolved: the "tenth relation type" was a miscount (the inventory lists the same nine the source defines), and note deletion is satisfied by an in-place archive/restore rule (status `archived`, file preserved).
- The `WORKBENCH` constant is retained with `#[allow(dead_code)]` (native-app still uses it); the build warning is cleared.
- A critique pass (Eduardo, 21:00) changed the app: it now opens on **Experiment** (not Spatial), the compact Canvas no longer shrinks text, the bench has one Graph/Canvas pane, Unity no longer scales its UI, and the render runs at full resolution with 4× MSAA. Commits `7e5a950`–`cc61643`.
- D14 (real-window pixel check) has still not been performed; visual claims rest on geometry checks and the browser preview.

### Further update (14 Nov ~23:30)

The "Beautiful Loom IDE" build plan was applied in full (see
`docs/DESIGN_PROGRESS.md` for the record): streaming chat, MCP and agent
lifecycle surfaces, a Patterns shelf, the disk watcher, durable canvas
layouts, the Unity beauty pass (HDR + ACES + Bloom grade, three-point rig,
SSAO, quality tiers, shader canaries), and the demotion of the Unity IMGUI
note editor to navigation. `get_collaboration` and the spatial-memory note
bridge were removed after the orphan sweep — the plan's "wire or remove"
rule. Local commits only, per AGENTS.md.

## Per phase

- Phase 0 — mapping (`5eedfb9`): `docs/FOLD_MAPPING.md` covers inventory rows B1–24, duplicates D1–10, and open questions E1–11 with the recorded defaults applied.
- Phase 1 — data layer (`b1953fc`): markdown-vault store adapter as one Rust module (`src-tauri/src/knowledge.rs`), porting the safety rules from `native-app/src/knowledge.rs` (atomic writes, symlink rejection, 1 MB cap, draft preservation, version snapshots, pending-transaction journal, agent notes only as `proposed`, approval requires a linked evidence edge). Tauri JSON records (`work.json`, `intents.json`, `experiments.json`) untouched.
- Phase 2 — Knowledge UI (`bff4ba2`): new bottom-nav tab "Knowledge" after Evidence, with Graph, Canvas (+ JSON Canvas export), Notes (CRUD, 21 kinds, 15 folders, typed links/backlinks, versions, provenance), Review queue ("Memory garden", bell with pending count), and Activity (audit trail, fixtures hidden not deleted). Global search extended to notes; Ctrl+K (search) and Ctrl+N (new note) added. Honest empty states everywhere; no demo data.
- Phase 3 — consolidation Q4 (`a235563`): one "New experiment" button, one work-creation entry; sphere state rule (`mechanics::sphere_state`, amber/green/red/blue/purple) wired into the Unity sphere and the header pill; `spatial.ts` wording updated; scene preview retired. No sphere rendering removed (Q3).
- Phase 4 — retire the second window (`1801f86`): View-menu item, `api.ts` wrapper, `open_living_workbench` command, and the WORKBENCH activation path removed. `native-app/` source retained on disk with a DEPRECATED note in its README. `grep -ri living.workbench src/ src-tauri/src/` finds only a CSS comment.
- Phase 5 — verification and report (`6e8c06e` + this file): final-review fixes committed after verification (see below).

## Final verification (14 Nov ~12:00, assistant, real command output)

- `npm test -- --run`: 50/50 passed (6 files).
- `npm run build`: clean.
- `cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib`: 89 passed, 0 failed, 2 ignored (second ignore is the real-vault smoke test, now opt-in).
- `cargo test --offline --locked --manifest-path native-app/Cargo.toml`: 22/22 passed.
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`: clean.
- Unity recompile: 0 errors, 0 warnings. Editor self-check: `work=4, experiments=1, palette=true`.
- WebGL build files refreshed 09:00–09:04 (`spatial.wasm` 35 MB). No C# changed since, so no rebuild was needed.
- `npm run tauri build -- --no-bundle`: clean, binary 25 MB at `src-tauri/target/release/loom-ide` (11:59). One expected warning: `WORKBENCH` constant never used (retained deliberately, see below).
- Preview smoke (`npm run preview`, port 4173): HTTP 200; 2 built entry assets loaded; 6 player resources HTTP 200; single search input and single creation entries (`knowledge-new`, `exp-new`, `new-work-submit`) verified.
- Loom server not running (health probe HTTP 000); no live sync attempted.

## Deviations from the prompt

- The inventory says 10 relation types; `native-app/src/knowledge.rs::RELATIONS` defines 9. The nine are preserved; a tenth needs a name from Eduardo (recorded in `docs/FOLD_BLOCKERS.md`).
- The real-vault read-only smoke test is now opt-in (`#[ignore]`) and refuses to run with a pending journal, so ordinary unit tests never depend on or touch user data.
- The Codex run ended at 09:06 on the usage limit, mid-Phase-5. Phase 5 was completed by the assistant instead; no stretch work was done (Unity physical object forms, D9 empty-state wording, D12 full-bleed check).
- Two files appeared mid-run from outside the fold (`docs/APPROVED_VISUAL_REFERENCE.md` and `docs/loom-unified-workbench-reference.webp`, 08:47–08:50, from the main-chat image work). They are not implementation output and were left untracked.

## What is left for Eduardo (updated 14 Nov ~21:30)

- Q2 fallback view if Unity fails to load: still deferred. No fallback decided.
- Tenth relation type: **resolved** — the inventory's "10" was a miscount (it lists the same nine the source defines); nothing to add.
- Note deletion: **resolved** — notes archive/restore in place (status `archived`, file preserved); destructive deletion stays forbidden.
- `WORKBENCH` constant: retained with `#[allow(dead_code)]` (native-app still uses it); the one build warning is cleared.
- D14 real-window pixel check: still not performed (no screenshot tool on this machine).
- Push: done at 21:19; branch in sync with `origin/tauri-prototype`.
- Stretch work: the Unity physical object forms, D9 empty-state wording, and D12 full-bleed check were subsequently completed (see `docs/DESIGN_PROGRESS.md`).
