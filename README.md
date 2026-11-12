# Loom IDE — Tauri prototype

A human-centered, AI-native development environment built on the Loom
agentic platform. This is the **Tauri 2 prototype**: a Rust backend with
a web frontend, built to reproduce the light minimal design reference
pixel for pixel — warm beige palette, glass translucent panels, soft
shadows, lots of whitespace.

> Design reference: `Agent_Memory_Experiment_Dashboard_1.png` (light
> minimal dashboard). The heart of the design is the cleanliness and
> transparency of the elements; the glowing sphere is nice but secondary.

![Loom IDE prototype — Experiment view](docs/screenshot-1648.png)

![Loom IDE prototype — Work view at 1322×768](docs/screenshot-work-1322.png)

![Loom IDE prototype — Agents view](docs/screenshot-agents.png)

## What it is

- **Backend (Rust, `src-tauri/`)** — Tauri 2 commands:
  - `get_work_items` / `add_work_item` / `set_work_status` /
    `set_work_autonomy` — work items persist as structured JSON in
    `<app-data>/loom-ide/work.json`, like the existing eframe app.
  - `get_collaboration` / `get_attention` — demonstration data (the Loom
    server does not expose step-by-step execution yet; the UI labels it).
  - `get_loom_status` — probes `localhost:5006`.
  - `ask_loom` — tries the real Loom server first (`POST /v1/weave` on
    `http://localhost:5006`) and falls back to a clearly labelled
    demonstration reply when the server is not reachable. Nothing here
    fakes agent progress.
- **Frontend (Vite + TypeScript, `src/`)** — no framework: plain
  TypeScript + CSS, chosen deliberately because the UI is a static,
  design-driven layout and hand-written DOM/CSS gives the closest
  control over the glass/transparency look with the smallest bundle.
  - Top bar with the current objective and a live/demonstration status pill.
  - Left icon rail, Work list, and a chat panel with the example exchange.
    Every rail button opens a real view now: **Work**, **Code**,
    **Agents**, **Evidence**, **Layers**; **···** opens a menu with
    **Artifacts** and **Documents**. The search button focuses the chat
    input, the agent pause button pauses/resumes the Research Agent, the
    chat **···** menu clears the chat, and Code mode has two notes
    (design philosophy + scratch notes) that save separately.
  - Center luminous sphere (canvas 2D: radial gradients + fine flowing
    contour lines + water reflection), with states idle / listening /
    processing / executing / attention / completed.
  - Right Agentic Collaboration panel (Research Agent checklist, 3/5) and
    Attention panel.
  - Bottom segmented nav: **Code | Experiment | Work**. Code mode is a
    plain notes editor (design philosophy note + scratch notes, saved
    locally); Work mode is headed by the selected work item and shows
    work cards with pause/resume and autonomy controls.
  - **Agents view** — the agents in this workspace (Research Agent with
    its checklist; room for more when the Loom server exposes them).
  - **Evidence view** — what the claims rest on (the ~340 ms finding
    with its basis, traces, experiment progress), labelled demonstration.
  - **Layers view** — toggles for the scene layers: light beam, water
    reflection, glass panels, sphere.
  - **Artifacts view** (from the ··· menu) — two tabs: **Artifacts**
    (experiment design, design-philosophy note, decision, finding) and
    **Documents** (the two notes). Clicking a note opens it in Code
    mode; the finding opens Evidence.
- **Window**: 1648×928 by default (the design's fidelity target),
  minimum 1200×760. The window is **transparent** (`"transparent": true`
  in `tauri.conf.json`) and html/body paint nothing, so on a composited
  desktop the wallpaper tints through the translucent scene and glass
  panels; without a compositor the painted scene (diagonal light beam +
  water reflection) still reads as the reference. On Linux a compositor
  is required for the real see-through effect.

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

The UI also runs in a plain browser with local demo data, for quick
visual iteration:

```bash
npm run dev      # http://localhost:1420
```

## Project layout

```
loom-ide-tauri/
├── index.html            # app shell (top bar, rail, panels, nav)
├── src/
│   ├── main.ts           # app logic, panels, chat, modes
│   ├── api.ts            # Tauri invoke wrappers (+ browser fallback)
│   ├── sphere.ts         # canvas sphere + water reflection
│   └── style.css         # light minimal theme
├── src-tauri/
│   ├── src/lib.rs        # Tauri commands, Loom HTTP client
│   ├── src/store.rs      # work-item JSON persistence + seed data
│   ├── src/main.rs       # entry point
│   ├── tauri.conf.json   # window 1648×928, bundle id com.loom.ide
│   └── capabilities/default.json
└── README.md
```

## Status / known gaps

- The sphere is canvas 2D, not a 3D shader — it matches the reference's
  line-art look but is not a true 3D object.
- Code mode is a plain notes editor (no Monaco yet).
- The Loom server integration is the same honest attempt as the eframe
  app: real `POST /v1/weave` when the server runs, labelled demo data
  otherwise. The exact Loom HTTP/gRPC interface still needs to be
  verified against the real Loom server (never invent endpoints).
- Collaboration steps and attention items are static seed data until
  Loom exposes live execution state.
- The transparent window was verified to build and run under Xvfb, but
  Xvfb has no compositor, so the real see-through effect still needs
  checking on a composited desktop (Eduardo's laptop).

## License

Prototype — no license chosen yet.
