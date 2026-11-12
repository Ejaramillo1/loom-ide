# Frontend UX Critique — loom-frontend (`~/.loom/app`, 1283-line `src/main.rs`, eframe 0.29)

Read in full on 2026-11-11. Pixel inspection was not possible (no X capture tools, no display access from the review sandbox), but every claim below is tied to exact code.

## Verdict

The builder understood the information architecture and almost none of the visual design. Page structure tracks the research (Workspace = Concept B default, Canvas = Concept C, Chat = Concept A, L0–L4, contact_human, Trust), but the verbs are stubs and the styling is zero. It reads as: nouns implemented, verbs labeled, look untouched.

## What works (keep)

- Honest data layer: "honest YAML reader", `—` for missing fields, built-in fallbacks labeled as copies (`bundled_agents`, `load_agents`, `load_patterns`).
- Offline-first with clear server messaging; health check on startup; Chat degrades to an explicit "start `looms serve`" message (`check_health`, `send_chat`).
- Real disk reads: agents from `agents/*.yaml`, patterns scanned to depth 3 / 500 files, pattern file preview (2500 chars).
- Working mechanics: Enter-to-send, chat scroll stick-to-bottom, pattern search + category filter, workflow step add/reorder/remove, Copy/Save YAML (`workflow_yaml`, `workflow_page`).
- Trust gap stated honestly in-UI: "Trust: not scored yet (no agreed formula)" (`workspace_page`).

## Look-and-feel failures (the "needs waaay work" part)

1. **Stock egui, zero theming.** No `set_visuals`, no fonts, no color system, `NativeOptions::default`, fixed 1180x780 (`main`). The app renders as default gray boxes. None of the Quiet Complexity transfers (Rams unobtrusive chrome, Vignelli grid + 2 typefaces, Martin muted tones, Hara empty states) made it into code.
2. **No hierarchy.** Top bar crams title + server URL field + Test + spinner + status; side panel stacks Pages + counts + tip at equal weight; every page opens with heading + sentence + controls. No grid, no progressive disclosure beyond two collapsing headers on Agents.
3. **Workspace review list is fake.** "Changes to review" renders the first 12 *pattern names* as review items, and the `[observed/derived/inferred]` badge is `i % 3` — decorative, not provenance (`workspace_page`). Apply = sets a notice string; "Sandbox preview" openly says "not wired up yet". Concept B's core promise (real artifact diffs) is unimplemented.
4. **Canvas is a static map.** Lanes render fixed labels per level with agent/pattern names sprinkled in; no drag between L0–L4, no cards, no take-over (`canvas_page`). Our spec's central Canvas interaction is absent.
5. **Chat is a plain log.** No evidence citations, no confidence display, no approval cards for L2 gates — the "decision required" attention state from the research does not exist (`chat_page`).
6. **Intent is an unstructured textbox.** Placeholder example text, no goal/acceptance-criteria structure, no versioning (`LoomApp.intent`). The pinned-Intent idea is present in placement only.
7. **Autonomy selector changes a label.** L0–L4 buttons set `self.autonomy` and a notice string; nothing gates, budgets, or demotes (`workspace_page`). No Trust scoring behind L3/L4 — correctly refused ("shown as a gate, not auto-approved"), but the feature is a mock.
8. **Anti-Quiet-Complexity.** The app shows everything at once: all six pages listed, all controls visible, no focus mode, no calm empty states (the empty review list says "No artifacts loaded yet" and stops). Compare research D1: contextual intelligence, attention-oriented quiet, intent-adaptive disclosure — none present.

## Builder-understanding assessment

Evidence it read the research: comments name Concept B/C, L0–L4 semantics, contact_human, the 30-card cap, the missing Trust formula. Evidence it stopped at structure: every hard interaction is either a stub notice or a label change, and visual design got zero passes. It understood *what pages to build*, not *what the experience should feel like* or *which behaviors must actually work*.

## Fix list, in priority order

1. **One visual pass first:** custom `Visuals` (quiet palette, one accent reserved for gates/focus), Inter or system-ui font, 8pt spacing scale, strict single-column reading measure. Highest ROI — this alone removes the "unfinished" impression.
2. **Make Workspace real or shrink the claim:** show actual session artifacts/diffs from `artifacts/` + `eventlog` with per-hunk Apply; delete the pattern-name filler and the `i % 3` badge until provenance is wired. A smaller honest page beats a larger fake one.
3. **Structure Intent:** goal field + acceptance-criteria checklist + version label. Wire it to the Workspace header and Canvas card.
4. **Attention states:** quiet default; one decision card pattern (what/why/evidence/options/consequences/uncertainty) reused for gates, approvals, denials. No notification firehose.
5. **Progressive disclosure + empty states:** collapse Chat/Patterns/Workflow detail behind the current task; design the three empty states (no intent, no changes, server offline) as Hara-style vessels, not dead ends.
6. **Canvas: implement one interaction** (drag card between two lanes, or take-over button) or cut the page until P2. A static map that promises spatial collaboration actively misleads.
7. **Then** Trust scoring, budgets, Memory-consolidate gating (needs the P1 definitions from `08-roadmap.md` — do not invent a formula).

## Scope note for the builder

Do not re-derive the research. Locked inputs: `/home/ed/work/agentic-ide/01-design-philosophy.md` … `08-roadmap.md`, plus this file. Build order above is the priority order.
