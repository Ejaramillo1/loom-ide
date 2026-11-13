# Unity first: audit of the running app + recommendations

**Date:** 2026-11-13. **Source:** 6 screenshots of the app running on the laptop
(Firefox, http://127.0.0.1:1420, 12:55-12:56 PST): Spatial, Evidence, Agents,
Work, Experiment, Code. **Audience:** the coding agent working in this repo.
**Goal:** Unity (Spatial) is the first thing that renders when the user opens
the program, and the end state stays minimalist.

## 0. Context

- The repo holds two projects: the Tauri app (this UI) and the eframe Living
  Workbench (`native-app/`). The Unity Resolute workbench is embedded inside
  the Tauri app's Spatial view, not a separate app.
- Eduardo's instruction to the coding agent is to go big on the Unity-first
  experience. This document is the constraint set for that work: what to
  change, what is duplicated, and what the end state must look like.
- Design direction (shared separately as the Living Workbench board): Loom's
  minimalism and atmosphere + Obsidian's interconnected knowledge; calm,
  focused, human-centered; one unified workspace for knowledge, experiments,
  and decisions.

## 1. The decision: Unity renders first

Acceptance criteria:

- A1. Launch shows the Spatial view (Unity bench). No other view flashes first.
- A2. Unity starts loading eagerly at app start, not lazily on first visit to
  Spatial. The loading state is a sphere pulse plus "Starting the bench..."
  and it resolves to a ready state. No stale "Unity is starting" text once
  the bench is visible.
- A3. The Unity canvas is full-bleed in the Spatial view. No Tauri title or
  subtitle above it. The bottom nav and a minimal header stay.
- A4. Clicking a Unity object opens the matching Tauri view with that item
  selected: Notes opens knowledge, Work opens Work, Code opens Code,
  Experiment opens Experiment, Agents opens Agents. The selection must be
  visible in the opened view.
- A5. Creating, selecting, or changing work in Tauri updates the Unity bench
  without a manual refresh (watch the vault on disk). The sentence "Refresh
  files from disk in Living Workbench to see new saves" is gone.
- A6. No duplicated action from section 3 remains.

## 2. How the setup makes sense (the model)

One source of truth: the vault on disk (`~/.loom`) holding work, sessions,
artifacts, and notes. Three surfaces, one navigation:

| Surface | Job | First render? |
|---|---|---|
| Unity Spatial bench (Tauri Spatial view) | Home. Ambient state, spatial selection of Notes / Work / Code / Experiment / Agents. | Yes, default view on launch. |
| Tauri structured views (Code, Experiment, Work, Agents, Evidence) | Doing the work. Each view owns one domain. | No, reached by selecting a Unity object or via the bottom nav. |
| eframe Living Workbench (separate window) | Undecided, see Q1. Today it is the second window the Tauri app tells the user to go refresh files in. | No. |

The connection to restore is two-way:

- Unity to Tauri: clicking an object opens the matching Tauri view with that
  item selected (A4).
- Tauri to Unity: changes in Tauri appear in the bench without a manual
  refresh (A5). There is no "go refresh in the other project" step.

## 3. Duplicates and doubles found in the screenshots

- D1. Experiment view has two "New experiment" buttons: one in the left card
  under the sphere, one in the right pane ("No experiment selected"). Keep
  one. Suggested: keep the right pane's, remove the left card's.
- D2. Work view has three work-creation entries: "Create work" in the main
  pane, "Add work" in the sidebar, "+ New work..." in the sidebar. Keep one
  primary label and one place. Suggested: keep "Create work" in the main
  pane; the sidebar keeps the work list only.
- D3. Spatial view has two titles: the Tauri title "Spatial Workbench" above
  the Unity header "LOOM / RESOLUTE WORKBENCH". When Unity is first, drop
  the Tauri title and subtitle on this view. The Unity header is the title.
- D4. Spatial subtitle is stale: "Unity is starting. Once the bench appears,
  select an object to open its memory..." is still visible after the bench
  has rendered. Make it a real status (starting, then ready) or remove it
  once ready. See A2.
- D5. Intent lives in two places: the header ("You are working on: No work
  selected") and the sidebar INTENT input ("State the intent, in one
  line..."). Display versus input is fine, but when empty the header shows
  dead text. Collapse or hide the header intent line until an intent exists.
- D6. The sphere appears in four places with unclear meanings: the app logo,
  a header icon (job unknown), the center of the Unity scene, and a static
  image in the Experiment view ("At rest, nothing is running"). Give the
  sphere one meaning everywhere: Loom connection and system state. Remove
  the decorative copies, starting with the static image in Experiment.
- D7. The header holds five controls whose jobs overlap or are undefined:
  Dark/White, Context, Conversation, search, sphere. Context versus
  Conversation is unclear, and the sphere icon's job is undefined. Define
  each control's job or remove it. The header should end up as: logo,
  intent, one panel toggle.
- D8. The bottom nav lists Spatial last of six (Code, Experiment, Work,
  Agents, Evidence, Spatial), but Spatial is now the home. The order
  contradicts the priority. Reorder: Spatial first.
- D9. Empty states are worded five different ways ("No work yet", "No
  experiments yet", "No evidence yet", "Loom offline", "No work selected").
  Unify the pattern: one line plus one action.
- D10. The Spatial subtitle tells the user to "Refresh files from disk in
  Living Workbench to see new saves". That is the lost connection between
  the two projects, visible in the UI. Fix it with the shared vault and the
  watcher (A5), and delete the sentence.
- D11. Unity 3D labels are small and partly illegible: the sphere's label is
  unreadable and the "Agents" label is garbled. Legibility pass: larger,
  higher-contrast labels, or show labels on selection only.
- D12. The Unity canvas is letterboxed: a large dark empty band sits below
  the scene and the bench does not fill the view. Full-bleed when Spatial is
  active (A3).
- D13. Loom server status surfaces only inside the Agents view ("Loom
  offline"). Nothing in the header shows it. Surface it once, in the header,
  using the sphere (ties D6 and D13 together: the sphere is the Loom
  connection and state indicator).
- D14. The screenshots are the browser preview (Firefox, three tabs of the
  same app at 127.0.0.1:1420), not the Tauri desktop window. Verify the
  first-render behavior in the real Tauri window too; the browser preview
  may differ in how Unity embeds.

## 4. Minimalism rules for the end state

- One action, one place, one label. If two buttons do the same thing, one goes.
- One title per screen. The embedded Unity header is the title on Spatial.
- The sphere means one thing (Loom connection and system state). No
  decorative copies.
- The header stays thin: logo, intent, one panel toggle. Everything else
  lives in its view.
- Empty states: one line plus one action, same wording pattern everywhere.
- No status text that stays visible after its condition has ended.
- Keep the honest empty states. Do not invent demo or seed data to fill views.

## 5. Ordered changes

P0, Unity first:

1. Default view is Spatial. Unity loads eagerly at startup. (A1, A2)
2. Spatial goes full-bleed: remove the Tauri title and subtitle above the
   Unity canvas. (A3, D3, D12)
3. Real loading state (sphere pulse, "Starting the bench...") that resolves
   to ready; remove the stale subtitle. (A2, D4)
4. Build the bridge: clicking a Unity object opens the matching Tauri view
   with that item selected. (A4)
5. Vault watcher: Tauri changes appear in Unity without manual refresh;
   delete the "refresh in Living Workbench" sentence. (A5, D10)

P1, de-duplication:

6. One "New experiment" button. (D1)
7. One work-creation entry. (D2)
8. Sphere, one meaning: Loom connection and system state. Remove the static
   sphere image in Experiment; define or remove the header sphere icon.
   (D6, D13)
9. Header: keep logo, intent, Conversation toggle. Define what Context and
   search do, then move them into their views or a single menu. (D5, D7)
10. Unity labels legibility pass. (D11)

P2, polish:

11. Reorder the bottom nav: Spatial, Work, Experiment, Code, Agents,
    Evidence. (D8)
12. Unify empty-state wording. (D9)
13. Verify first render in the real Tauri window, not only the browser
    preview. (D14)

## 6. Decisions needed from Eduardo

- Q1. What is the eframe Living Workbench's job now? Options: (a) knowledge
  companion window (graph and canvas) that Unity links to; (b) fold its
  features into Tauri and Unity and retire the second window. Do not delete
  anything until he answers.
- Q2. If Unity fails to load, what is the fallback landing view? Suggested:
  Work.
- Q3. Confirm the sphere means Loom connection and system state everywhere.
- Q4. Bottom nav: keep six tabs reordered, or consolidate Agents and
  Evidence?

## 7. Guardrails (standing rules)

- Do not create a new app or a copy of the repo. Work in this repo, on this
  branch.
- Do not delete files unless Eduardo names them. Deletions are approved
  per file.
- Verify with real builds. A "ready" check that runs nothing is not
  verification.
- Keep the honest empty states. Do not invent demo or seed data.
