# How to build and open the Loom IDE (Tauri prototype)

This document is for the **Tauri 2 prototype** in this repo: a Rust backend
(`src-tauri/`) with a TypeScript frontend (`src/`). It is not the old
eframe/egui app — that one lives in `src/main.rs` with the root `Cargo.toml`
and `run.sh`, is deprecated, and is not built by any command here.

All commands below are typed in a terminal, from the repo folder
(the folder containing `package.json`).

## Prerequisites

- Node.js 20+ and npm
- Rust via rustup (see the main README, "Run it")
- The Tauri system dependencies from the main README
- The Loom server, for anything that talks to Loom
  (`looms serve --http-port 5006`); without it the app opens, but
  Loom-backed sections show honest empty states and errors — there is
  no demo data.

## Open it (development)

```bash
npm install   # first time only
npm run tauri dev
```

This starts Vite (frontend on `http://localhost:1420`) and the Tauri
desktop window. Edit the frontend and it reloads; edit Rust and the
window rebuilds.

## Frontend only (no Rust, in a browser)

For quick visual iteration:

```bash
npm run dev      # http://localhost:1420
```

Loom calls go through the `/api/loom` dev proxy to
`http://localhost:5006`. Start the Loom server first, or the chat shows
a connection error.

## Build installers (.deb / .AppImage)

```bash
npm run tauri build
# bundles land in src-tauri/target/release/bundle/
```

## If it does not work

- If you see "cargo: command not found", Rust is not installed yet.
  Install it from https://rustup.rs, close and reopen the terminal,
  then try again.
- If `npm run tauri dev` fails on missing system libraries (e.g.
  `gdk-3.0.pc` not found), install the dependencies from the main
  README's "System dependencies" section.
- If the window opens but says "Loom offline", the Loom server is not
  running: start it with `looms serve --http-port 5006`.
- `npm run tauri dev` and `npm run dev` both use port 1420 for the
  frontend; if it is already in use, stop the other one first.
- Do **not** run `cargo build` at the repo root or `./run.sh`: that
  builds the deprecated eframe app (`src/main.rs`), not this prototype.
