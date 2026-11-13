# Frontend cleanup after the Loom audit

Removed from the normal interfaces:

- Tauri's empty Collaboration section, sample badges, associated rendering/state
  and `getCollaboration` frontend wrapper.
- Unused frontend wrappers/types for trace lookup, model switching, artifact
  contents and artifact search. Existing Rust HTTP implementations remain intact.
- Workbench's context-pack preview and demonstration memory-strategy workflow.
- Workbench's static remote-execution Traces panel. The functional local journal
  is now labeled **Activity**, including navigation and the sphere's activity link.
- Workbench's canned offline research replies. Offline Send preserves the draft
  and reports that Loom is unavailable.
- Historical starter records from normal vault views: lists, search, graph,
  proposal counts, linked records, Canvas/export and the activity journal.

Canvas now renders actual visible vault notes and their stored relationships,
with note opening, dragging, scrolling and JSON Canvas export. The previous
fixed six-card Mastermind layout was a sample, even though the original audit
classified the Canvas too broadly as local functionality.

New application vaults initialize empty. Existing historical/sample files are
filtered by provenance and recognized demo-record format, **not deleted**. They
remain available on disk. Personal notes are retained. Fixture initialization
and old demonstration mechanics remain confined to unit tests.

Kept: working Loom chat/sync, sessions/agents/workflow/artifact metadata views,
local work/intents/criteria/decisions, Evidence's existing partial functionality,
local files and editing, knowledge relationships and reviews, appearance,
sphere, scene preview, journal, and single-instance cross-window navigation.
The audit's other **Partial** features have not been claimed as fully integrated.

Validation includes both Rust suites, frontend build/Vitest, a rewritten graphical
self-test using newly captured notes instead of built-in research records, and
screenshots of the cleaned views. No server mutations are required for this pass.
