# Craft Anything build prompt — Loom UI, Obsidian look-and-feel

Paste everything below the `=== PASTE BELOW THIS LINE ===` marker into Craft
Anything as the build request. It is self-contained: all tokens are inline,
and every referenced file exists in `/home/ed/.loom/app/docs/`.

=== PASTE BELOW THIS LINE ===

# Rebuild the Loom desktop UI shell with an Obsidian look-and-feel

## 1. Mission

Reshape the existing Loom desktop front end so it looks and feels like the
Obsidian launcher (dark, calm, sharp): same palette, type scale, spacing,
radii, row-and-rail layout grammar, and button language. This is a
**visual-shell rebuild plus honest-wiring fixes**, not a new app and not a
behavior rewrite. Every working feature must keep working; every fake/stub
element must be made real or cut (section 6).

## 2. Working directory and locked inputs

- Work ONLY in `/home/ed/.loom/app`. Build with `cargo build`, run with
  `./run.sh` or `cargo run`. Never touch the Loom server, `~/work`, or any
  other project.
- Before changing anything, read these in order:
  1. `src/main.rs` (the whole file, ~1340 lines — the entire app).
  2. `docs/01-design-philosophy.md`, `docs/02-design-research.md`,
     `docs/03-interaction-model.md` (Quiet Complexity; Concepts B/C; L0–L4).
  3. `docs/04-obsidian-look-and-feel.md` (measured Obsidian tokens + layout).
  4. `docs/img/launcher.png` and `docs/img/launcher-vaults.png` (the two
     launcher states to match). Also check `/home/ed/.loom/app/reference/`
     for earlier reference pictures, but the Obsidian spec wins on visual
     language.
  5. `/home/ed/work/agentic-ide/09-frontend-ux-critique.md` (what is fake
     today and the fix priority order — follow it).

## 3. Stack lock (do not change)

- Rust + `eframe 0.29` + `egui`, `serde/serde_json` only. No new crates.
- No rewrite to web/React/Electron — the `craft.json` stack field saying
  React is stale metadata; the real app is Rust and stays Rust.
- Single `src/main.rs` is fine; split into modules only if a file gets
  unmanageable, and say so in the final report.
- Fonts are embedded with `include_bytes!` from absolute system paths.
  ONLY these files exist — verify with `ls` before referencing any font:
  `/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf`,
  `/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf`,
  `/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf`,
  `/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf`.
  There is NO Inter, Medium, or Semibold on this machine — do not reference
  them or the build breaks. (Noto Sans Regular + Bold is the approved stand-in.)
- The Loom server (`http://localhost:5006`) is OPTIONAL. Browsing agents,
  patterns, and workflows works offline; Chat degrades to a clear
  "start `looms serve`" message. Never assume new server endpoints exist.

## 4. Current state (keep what works)

Six tabs, all functional at the data level: Workspace (Concept B review
list), Canvas (Concept C lanes), Agents (YAML browser + detail), Chat
(sessions + `POST /v1/weave`, Enter-to-send, stick-to-bottom),
Patterns (search + category filter + file preview), Workflow Builder
(add/reorder/remove, YAML preview, Copy/Save). Keep every one of these
mechanics. A first theme pass exists (`ACCENT`, `setup_theme`, type scale)
— replace it with the full Obsidian system below.

## 5. Target look (exact — implement all of it)

Palette (dark, forced — do NOT follow the OS theme):

- Page `#1C1C1C`, alt panels `#232323`, left rail `#282828`,
  input fields `#2E2E2E`, borders + secondary buttons `#333333`,
  hover `#3F3F3F`.
- Text: normal `#DADADA`, muted `#B3B3B3`, faint/placeholder `#666666`.
- Accent (CTA fill, focus, selection, links): `#8A5CF5`, hover `#A68AF9`,
  text-on-accent white. Selection = 33% accent wash, no border.
- Status colors only where they mean something: green `#44CF6E`
  (online/success), red `#FB464C` (error), orange `#E9973F` (warning).
- Online/offline dot keeps its current position in the top strip.

Type: Noto Sans UI, DejaVu Sans Mono for code/YAML/paths. Sizes 12 / 13 /
15 / 20 px; body and row titles 15 px (titles semibold → use Bold, it is all
we have); descriptions and sidebar detail lines 13 px muted; micro-labels
11–12 px. Line spacing relaxed, never cramped.

Shape and spacing: 4 px base scale (4/8/12/16/20/24/32). Radii: rows 4 px,
buttons and inputs 5 px, content card 12 px. Borders 1 px `#333333`.
Inputs 30 px tall on `#2E2E2E`; focus = 2 px accent outline, no egui
default stroke. Buttons: NO default egui bevel — primary is flat accent
fill + white text, secondary is flat `#333333` fill + `#DADADA` text,
~110x30 px when row-aligned.

Shell layout (copy the launcher grammar, adapt to six tabs):

- Slim top strip (~24–32 px): app mark + name left, server address field +
  Test + status right. Quiet, muted, single row. The current two-row
  top panel with the status sentence must go — compress to one strip with
  a tooltip/secondary line only when offline or busy.
- Left rail (~200–280 px, `#282323`-family fill, 1 px right border): the
  six pages as stacked rows (15 px label + optional 13 px muted detail),
  4 px radius, transparent until hover (6.7% white wash), selected row gets
  the accent wash. Below the rows, muted counts. No tips paragraph.
- Center: max-width content column (~540–720 px) with 12 px rounding,
  generous padding, one idea per screen. No full-bleed walls of controls.
- Universal row pattern everywhere (vault list = agents list = patterns
  list = workflow steps = review items): title (15 px) + muted description
  (13 px) stacked on the left, ONE right-aligned action button, 1 px
  `#333333` separators between rows, 4 px hover radius.

Per-tab direction (visual; behavior stays):

- Workspace: pinned Intent card on top (structured: goal line +
  acceptance-criteria checklist + version label, not one textbox), autonomy
  L0–L4 as a segmented control, review items as the universal row pattern
  with Apply/Reject as small secondary buttons and one primary per decision.
  Empty states are calm centered vessels ("No changes to review", "Server
  offline — browsing still works"), not dead ends.
- Agents/Patterns: left list uses the rail row pattern (name + muted
  detail); detail pane uses title + description + hairline sections.
- Chat: message list with clear You/Agent blocks, muted timestamps if
  available, input bar pinned at the bottom (30 px+ multiline, Send =
  primary). No fake citations — only render what the server returned.
- Workflow: two-column add→steps with the row pattern; YAML preview in
  mono on `#232323` with Copy (primary) + Save (secondary).
- Canvas: EITHER implement one real interaction (click a card to jump to
  it in Workspace, or move a card between two lanes) OR cut the page to a
  calm "coming soon" placeholder. A static map that promises spatial
  collaboration is forbidden.

## 6. Honesty rules (from the critique — non-negotiable)

- No decorative data. The `[observed/derived/inferred]` badge that is
  really `i % 3`, the review list filled with pattern names, any
  notice-string pretending to be an action: make it real from disk
  (`agents/`, `patterns/`, `artifacts/`, eventlog) or delete it. A smaller
  honest page beats a larger fake one.
- No invented formulas. Trust scoring, budgets, memory gating: show the
  gate honestly ("not scored yet", "not granted here") exactly as today.
  Never compute a score from nothing.
- L3/L4 are never auto-approved. Any delegated/autonomous affordance ends
  in a visible gate, not an action.
- Never show a control whose click only says "not wired up yet" — wire it,
  cut it, or replace it with honest static text.

## 7. Build order (do it in this order; build after each phase)

- Phase 0: `cargo build` clean on the untouched tree. Report warnings.
- Phase 1: Theme + shell (palette, type, top strip, left rail, content
  card, buttons, inputs, row pattern). Done when every tab renders in the
  new shell with zero stock-egui chrome and the app still does everything
  it did.
- Phase 2: Workspace honesty (structured Intent, real-or-cut review items,
  segmented L0–L4, calm empty states).
- Phase 3: Per-tab row-pattern pass (Agents, Patterns, Chat blocks,
  Workflow columns) + Canvas real-or-cut decision.
- Phase 4: Polish (spacing audit on the 4 px scale, focus states, offline
  banner behavior, `HOW_TO_OPEN.md` update if run steps changed).

## 8. Verification (must all pass before you report done)

- `cargo build` succeeds with no errors; fix or report every warning.
- `cargo run` opens the window; click through all six tabs without panic.
- Kill the server (or point at a dead port): browsing still works, Chat
  shows the clear offline message, status reads Offline.
- Every button in the app either acts or is gone (no "not wired up" left).
- Re-read your diff against section 6 and confirm each rule holds.

## 9. Forbidden

- No stack change, no new dependencies, no network calls except the
  existing localhost server client.
- No changes outside `/home/ed/.loom/app`. No commits unless asked.
- No secrets, tokens, or personal data in code, docs, or logs.
- No guessing at Loom server APIs beyond `GET /health`, `POST
  /v1/sessions`, `POST /v1/weave` as already coded.

## 10. Report back

Changed files, what each phase delivered, verification results (build
output tail, smoke notes), anything cut under section 6 and why, and what
remains (Trust scoring, budgets, Canvas depth) with the reason each is
blocked. Keep it short and factual.

=== END OF PROMPT ===
