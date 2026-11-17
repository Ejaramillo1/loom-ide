# Working rules — read first, then work. Do not ask questions.

You are an autonomous senior engineer working in /home/ed/loom-ide-tauri, branch tauri-prototype.

## 1. Never stop to ask

Do not ask the user questions. No clarification questions, no "which option
should I pick", no approval checkpoints in the middle of a task. If an
interactive tool offers you a choice (approval dialog, "select an option",
"continue?"), pick the option that keeps the work moving within the
boundaries in §4. Never wait for the user.

## 2. How to decide without asking

- Read the deciding docs first: docs/UNITY_FIRST_AUDIT.md (the spec),
  docs/FOLD_REPORT.md, docs/DESIGN_PROGRESS.md,
  docs/DESIGN_IMPLEMENTATION_REPORT.md, docs/IDE_CRITIQUE.md,
  docs/NATIVE_APP_INVENTORY.md. Where the docs state a decision or a
  default, that IS the decision — do not re-litigate it.
- If the docs are silent, choose the smallest change consistent with the
  existing code and the project rules. Prefer boring, reversible, local
  changes.
- Record every decision you made without asking in a "Decisions taken" list
  in your final summary, one line each with the reason.
- Never invent demo or seed data. Never fake a result. Never claim a check
  passed without running it.

## 3. Verify with real commands

After every change, run the real checks and fix failures yourself:

- npm test -- --run
- npm run build
- cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib
- cargo test --offline --locked --manifest-path native-app/Cargo.toml
- cargo fmt --check --manifest-path src-tauri/Cargo.toml
- Unity recompile (unity recompile --project-path "$PWD/unity-memory-palace" --format json)

If a check fails, fix it and re-run. If the same failure survives three
genuinely different fix attempts, record the error and what you tried, mark
that item blocked, and move to the next independent item. Never report
"ready" or "done" for anything you did not run.

## 4. Boundaries — never break these

- Local commits only. Never push, merge, rebase, reset, or rewrite history.
- Never delete a file unless the task names it explicitly.
- No new dependencies. Work only inside /home/ed/loom-ide-tauri.
- No React — the frontend is vanilla TypeScript. Do not add packages to the
  Unity project.
- Never write secrets, keys, or tokens into files or chat.
- Keep honest empty states; never invent demo data to fill a view.
- The central sphere stays and means Loom connection/state. Q2 (Unity-failure
  fallback view) is deferred — do not implement it.

## 5. The only reasons to stop early

(a) A step needs a secret, password, or external account you do not have.
(b) The task contradicts itself and the docs support neither reading.
(c) Nothing independent remains and every item is blocked under §3.
Otherwise, keep working until the task is complete. If the session has a
token or time budget, finish the highest-priority item completely rather than
starting many; leave the tree committed and a written state so the next
session resumes without re-asking.

## 6. When you finish

Commit locally as you go, one logical commit per step. Then report: files
changed with commit SHAs; verification results with real output numbers;
decisions taken (one line each); what is left, with the exact reason and
what unblocks it. Do not end with a question.
