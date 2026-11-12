# Loom IDE — Tauri prototype

A human-centered, AI-native development environment built on the Loom
agentic platform. This is the **Tauri 2 prototype**: a Rust backend with
a web frontend, built to reproduce the light minimal design reference —
warm beige palette, glass translucent panels, soft shadows, lots of
whitespace.

> Design reference: `Agent_Memory_Experiment_Dashboard_1.png` (light
> minimal dashboard). The heart of the design is the cleanliness and
> transparency of the elements; the glowing sphere is nice but secondary.

![Loom IDE prototype — Experiment view](docs/screenshot-1648.png)

![Loom IDE prototype — Work view at 1322×768](docs/screenshot-work-1322.png)

![Loom IDE prototype — Agents view](docs/screenshot-agents.png)

## The shell

Three rows, no absolute positioning:

- **Header (~56px)** — current objective, Work and Context toggles,
  a search input that filters the work list, and the Loom status pill.
- **Main (flexible)** — icon rail (48px), work catalogue (~260px)
  with the Conversation always live below the work list, center floor
  (min ~520px), right inspector (~280px, Context only).
- **Footer (~56px)** — the mode switcher, in normal flow:
  **Experiment · Work · Code · Agents · Evidence · Layers · Artifacts**.

Every long region has its own scroll owner; mode headings stay outside
scrolling bodies and never clip.

**Breakpoints.** ≥ ~1440px shows all panes. ~1100–1439px collapses
the right inspector behind the labeled **Context** toggle. < ~1100px
also moves the left catalogue behind the **Work** toggle. The
Conversation is not a drawer or a tab: it lives in the left column
directly below the work list, and it is always visible and ready to
type — in every mode, at every width. Below ~1100px it travels with
the left drawer, so it is reached through the **Work** toggle there.
An unsent message is saved as you type, so it survives closing the
drawer and restarting the app. Drawers close with Escape and return
focus to the control that opened them. Drawers span only the main
row — they never cover the header or the footer.

**Depth, not transparency.** The window is opaque — the desktop never
shows through. The sense of 3D comes from layering: a painted warm
backdrop with a light beam, translucent glass panels floating above it,
and one restrained shadow separating the layers. The water reflection
is kept as background atmosphere in **Experiment** overview only; in
Work and Code modes the background behind reading surfaces is flatter,
so text stays easy to read. (An earlier build made the window itself
transparent; that was a misunderstanding and was reverted.)

## Modes and how to reach them

- **Experiment** — the luminous sphere (canvas 2D: radial gradients +
  fine flowing contour lines + water reflection), states idle /
  listening / processing / executing / attention / completed, with a
  caption in plain words. The sphere animation pauses when its view is
  hidden.
- **Work** — the left panel is the work catalogue; the center is the
  selected work's detail view: full title and state, a control row for
  the planning preference and the supported local action, goal,
  success criteria (or an honest empty state), artifacts or
  "No artifacts attached", evidence or "No evidence attached".
- **Code** — a plain notes editor (design philosophy note + scratch
  notes, saved locally, both starting empty). "Ask about this note"
  sends the note to Loom through the always-visible Conversation.
- **Agents** — the agents in this workspace. Empty ("No agents
  running") until the Loom server exposes live agents.
- **Evidence** — what the claims rest on. Empty ("No evidence yet")
  until the Loom server shares findings and traces.
- **Layers** — toggles for the scene layers: light beam, water
  reflection, glass panels, sphere.
- **Artifacts** (footer mode, and the rail's ··· menu) — two tabs:
  **Artifacts** (empty, "No artifacts yet", until the Loom server
  shares them) and **Documents** (the two local notes; clicking one
  opens it in Code mode).

Both navigation mechanisms — the icon rail and the footer mode
switcher — show the same current destination.

## What it is

- **Backend (Rust, `src-tauri/`)** — Tauri 2 commands:
  - `get_work_items` / `add_work_item` / `set_work_status` /
    `set_work_autonomy` — work items persist as structured JSON in
    `<app-data>/loom-ide/work.json`, like the existing eframe app. The
    store starts empty; work items come from the user creating them.
  - `get_collaboration` / `get_attention` — empty until the Loom
    server exposes live execution state.
  - `get_loom_status` — a real `GET /health` against localhost:5006
    (async, via the raw HTTP client below).
  - `ask_loom` — a real `POST /v1/weave` on `http://localhost:5006`
    with `{"query": ...}`. The Rust HTTP client reads framing
    explicitly, including chunked responses from gRPC-gateway. When
    the server cannot be reached, or answers without usable text, the
    command fails and the UI shows the error. Nothing invents a reply.
- **Frontend (Vite + TypeScript, `src/`)** — no framework: plain
  TypeScript + CSS, chosen deliberately because the UI is a static,
  design-driven layout and hand-written DOM/CSS gives the closest
  control over the glass/transparency look with the smallest bundle.
  In `vite dev` (plain browser) the Loom calls go through the
  `/api/loom` dev proxy in `vite.config.ts`, which forwards to
  `http://localhost:5006`; work items fall back to localStorage. The
  same no-demo rule applies there: a failed call is an error, not a
  made-up reply.

### Truthfulness rules (the UI must not pretend)

- The status pill shows **Loom offline** when the server is not
  reachable, **Server reachable** when the health probe answers, and
  **Connected to Loom** only after a verified Loom-level response.
- There is no seed or demonstration data anywhere in the app. Empty
  states are honest: "No work yet", "No agents running",
  "No attention items", "No evidence yet", "No artifacts yet",
  "No artifacts attached", "No evidence attached",
  "No success criteria recorded."
- The chat starts empty with a short hint. If the Loom server is not
  reachable, the chat shows a connection error ("Could not reach
  Loom: …") and keeps the failed text in the composer for retry. It
  never invents a demo reply.
- Work controls are **local planning labels**: "Planning mode" and
  "Mark paused" / "Mark active" save a preference on this device.
  They do not pause a running agent. Execution controls that the
  server does not expose do not exist yet.
- Progress is stated as "Step 3 of 5" and "2 of 5 completed" — the
  active step is not counted as done.
- Every active control performs its labeled action. A click that
  redirected to an unrelated mode was a defect and was fixed.
- A failed save shows a readable error beside the control; the
  control's previous value is restored.

### Type scale and tokens

- Body 14–15px, secondary 12–13px, section titles 16–18px,
  line height 1.4–1.5, 4px spacing base.
- Palette: app background `#F5F0EB`, text `#292725`, secondary
  `#77716D`, boundary `#DDD5D0`, focus/selection muted blue `#6A91CC`,
  amber `#D9A65F` for decisions.
- Panel radii 12–16px, control radii 6–8px, one restrained panel
  shadow, flat list rows with a quiet selection wash.
- **Window**: 1648×928 by default (the design's fidelity target),
  minimum 1024×640, opaque.

## Before / after (the 2026-11-11 redesign)

Before — the version Eduardo ran and screenshotted:

- The window was transparent, so the desktop showed through the IDE.
- Work mode showed the catalogue twice (left panel and center); the
  center had no detail view of the selected work.
- The mode nav was absolutely positioned over the content with
  104–110px of bottom padding as compensation; headings could clip.
- Work cards truncated titles, repeated the autonomy label, and said
  "Now ago".
- The search button focused the chat input; the agent pause button
  pretended to pause a real agent; a chat card jumped to Experiment;
  a decision only tinted the sphere for 4 seconds.
- The water horizon ran behind reading surfaces in every mode.
- The app shipped seeded work items, seeded collaboration steps and
  attention items, a seeded example chat, seeded notes, and demo
  replies when the server was down.

After — this version:

- Opaque window; depth through layered paint, glass, and shadow.
- Work mode: catalogue left, selected work's detail center.
- Three-row shell; footer mode nav in normal flow; headings never clip.
- Work summary component: title on its own first row, metadata on
  its own line, controls below the text; "Updated now" / "Updated 2h
  ago"; autonomy once, in its labeled planning control.
- Search filters the work list; chat cards open the Artifacts view.
- Water reflection only in Experiment overview; flat warm background
  behind reading surfaces.
- No seeds, no demo replies, no sample labels, no test fixtures in
  the app. Empty states are honest, and a failed Loom call is a
  visible connection error.

## Run it (Ubuntu 24.04)

### 1. System dependencies

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  libgtk-3-dev pkg-config
```

### 2. Rust (via rustup) and Node.js 20+

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
# then restart your shell, or: source ~/.cargo/env
node --version   # needs 20+
```

### 3. Run the app

```bash
npm install
npm run tauri dev
```

### 4. Build installers (.deb / .AppImage)

```bash
npm run tauri build
# bundles land in src-tauri/target/release/bundle/
```

### Frontend only (no Rust, in a browser)

The UI also runs in a plain browser with local persistence, for quick
visual iteration. The Loom calls go through the `/api/loom` dev proxy
to `http://localhost:5006`; start the Loom server first
(`looms serve --http-port 5006`) or the chat shows a connection error.

```bash
npm run dev      # http://localhost:1420
```

## Project layout

```
loom-ide-tauri/
├── index.html            # app shell (header, main, footer, drawers)
├── src/
│   ├── main.ts           # app logic, panes, chat, modes
│   ├── api.ts            # Tauri invoke wrappers (+ browser fallback)
│   ├── sphere.ts         # canvas sphere + water reflection
│   └── style.css         # light minimal theme (tokens, shell, panes)
├── src-tauri/
│   ├── src/lib.rs        # Tauri commands, Loom HTTP client
│   ├── src/store.rs      # work-item JSON persistence (starts empty)
│   ├── src/main.rs       # entry point
│   ├── tauri.conf.json   # window 1648×928, bundle id com.loom.ide
│   └── capabilities/default.json
└── README.md
```

## Status / known gaps

- The sphere is canvas 2D, not a 3D shader — it matches the reference's
  line-art look but is not a true 3D object.
- Code mode is a plain notes editor (no Monaco yet).
- The Loom server integration is real-or-error: real `POST /v1/weave`
  when the server runs, a visible connection error otherwise. The
  exact Loom HTTP interface still needs to be verified against the
  real Loom server (never invent endpoints). The chunked-response
  handling in the Rust client came from the backend-fix round.
- Collaboration steps, attention items, evidence, and artifacts are
  empty until Loom exposes live execution state; the UI shows honest
  empty states meanwhile.

## Historical note

An earlier direction — a single-file eframe/egui desktop app
(`src/main.rs`, 1,747 lines, on the `main` branch) with an Obsidian
integration — is **historical**. The current direction is this Tauri 2
prototype. The egui app is kept in the repo history for reference; do
not extend it.

## License

Prototype — no license chosen yet.
