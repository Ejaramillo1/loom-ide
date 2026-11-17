# AP-10 — Engineering hygiene: fmt debt, dial/level drift, reserved attention kind

- **Severity:** P3 (minor)
- **Classification:** Improvement opportunity
- **Reference:** engineering best practices — reproducible builds, honest copy.

## Problem

Three small, independent hygiene items:

1. **`native-app` is not rustfmt-clean** (pre-existing since `41170a6`).
   Every "fmt ✓" claim is src-tauri-scoped, and the exclusion is now
   documented but the debt remains.
2. **Philosophy drift:** `docs/01-design-philosophy.md` describes a
   "five-step dial … → Autonomous"; the implementation has four levels
   (`manual`→`delegated`).
3. **Reserved attention kind:** the `finding` kind is typed and styled but
   never produced (`get_attention` returns only local `decision` items),
   leaving a reserved-but-dead branch.

## Evidence

- `cargo fmt --check --manifest-path native-app/Cargo.toml` → exit 1.
- `docs/01-design-philosophy.md:34` (five-step dial).
- `src-tauri/src/lib.rs:662` `get_attention` → only `decision` items.

## Proposed solution

1. Format `native-app` once (a mechanical, separate commit) or keep it
   explicitly excluded with the scope stated everywhere.
2. Align the philosophy text with the four-level implementation.
3. Either remove the unused `finding` rendering or document it as reserved.

## Acceptance criteria

- `cargo fmt --check` passes repo-wide, or every claim names its scope.
- Philosophy matches the shipped dial.
- The attention UI has no dead "comes from Loom" branch.

## Verification

`cargo fmt --check`; doc grep; a UI check of the attention dialog.

## Dependencies

None.

## Risks

Formatting `native-app` is a large but mechanical diff; review separately.
