# Fold report — Living Workbench into Tauri (audit Q1=b)

- Branch: `tauri-prototype`. Baseline `1f20256` (overnight run) → head `0dface2`.
- Codex run: 14 Nov 08:37–09:06, ended early on usage limit (165,642 tokens). Phase 5 verification finished by the assistant 14 Nov ~12:00.
- Outcome: Phases 0–5 complete. The fold is done and the second window is retired. Nothing pushed.

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

## What is left for Eduardo

- Q2 fallback view if Unity fails to load: still deferred by his choice. Unity-failure behaviour unchanged.
- Tenth relation type: name it if wanted.
- Note deletion: not implemented. Needs his authorization or an archival rule.
- `WORKBENCH` constant and the workbench port code in `shared/navigation.rs`: retained deliberately; delete when he says so (removing it also clears the one build warning).
- D14 real-window pixel check: still blocked (needs automatic visual feedback enabled locally; desktop controls fail on this Linux laptop).
- Push: the branch is 13 commits ahead of origin (6 overnight + 5 Codex + 1 Phase-5 fix + this report). Nothing pushed.
- Stretch work (only if wanted): Unity physical object forms (Notes notebook, Experiments flask, Work toolbox, Code laptop, Agents robot, Evidence magnifying glass), D9 empty-state wording unification, D12 full-bleed verification.
