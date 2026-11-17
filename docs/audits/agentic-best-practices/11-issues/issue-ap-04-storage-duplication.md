# AP-04 — Local work/intent/vault storage duplicates Loom tasks/artifacts/memory

- **Severity:** P1 (maintainability / data-integrity)
- **Classification:** Confirmed architectural weakness
- **Reference:** architecture.md — "Prefer using Loom's established capabilities over implementing competing infrastructure."

## Problem

The IDE keeps its own stores — `work.json`, `intents.json`,
`experiments.json`, a markdown vault — that overlap with Loom's tasks/boards
(now HTTP), artifacts, and graph memory. This creates two sources of truth
for "work" and risks divergence.

## Evidence

- `src-tauri/src/lib.rs:98-127`: `work_file_path`, `experiments_file_path`,
  `intents_file_path` under `<app-data>/loom-ide/`.
- `src-tauri/src/knowledge.rs`: one-way mirror of Loom sessions/agents/
  artifacts into the vault.
- `docs/DECISIONS.md` D6: "Task migration: full migration of local work to
  Loom tasks … explicit, never silent."

## Expected behavior

One source of truth for work/execution (Loom), with the IDE as a view +
human-planning layer, not a parallel system of record.

## Proposed solution

Complete D6: migrate local work/intent to Loom tasks via the existing
`work_migration_preview` (read-only) → explicit user-triggered migration.
Keep experiments and run records local (no Loom equivalent / client
durability). Keep the vault as a mirror until graph memory is reachable (AP-03).

## Acceptance criteria

- After an explicit migration, Loom tasks are the canonical work store.
- No silent data movement; collisions surfaced before migration.
- Local stores remain for client-only concerns (experiments, run records).

## Verification

Migration tests (name collisions, ownership) already exist; add a round-trip
verifying task state matches the migrated work.

## Dependencies

None (Loom tasks are already HTTP).

## Risks

Data loss if migration is silent — keep it explicit and previewable.
