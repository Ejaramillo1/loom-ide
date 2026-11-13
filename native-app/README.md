> Current interface: historical starter notes, canned offline replies, the context-pack
> preview and the experiment demonstration controls are no longer shown. New vaults
> start empty. Existing sample files remain on disk. Canvas uses real vault notes;
> Activity shows the local journal. See `../docs/FRONTEND_CLEANUP.md`.

This build contains the original game's own files, for the private use of the person who owns the game, on their own computer. It must not be shared or published.

# Loom — Living Workbench

Craft Anything requires the notice above for builds that reuse files from the original. This is a knowledge workbench; the reused assets are the Inter font files described in CREDITS.md.

Build with `cargo build --offline`, then run `target/debug/living-workbench`. Knowledge is stored locally in `Research Vault/` beside this manifest. Use `--vault <directory>` to choose another location.

Phoenix is deferred. The current workbench works offline without external observability services.

When a Loom server is running on `localhost:5006`, the workbench connects to it over plain HTTP (no new dependencies). **Test connection** in the conversation footer probes the server and reports "Connected to Loom" or "Loom offline". When connected, chat sends the message to Loom (`POST /v1/weave`) and shows its reply, or the error honestly; when offline, Send preserves the draft and reports that Loom is unavailable. **Sync from Loom** in the Knowledge header pulls sessions, agents, and artifacts into the vault as notes (kinds `session`, `agent`, `artifact`, stored under `50 Projects/Agent Memory/Sessions`, `.../Agents`, and `.../Artifacts`); items already synced are skipped. The vault folders are clickable filters, so the synced objects are browsable like any other notes.

## Source and verification

This native workbench lives in `native-app/` in the `Ejaramillo1/loom-ide` repository, on the `tauri-prototype` branch. Keep its Rust source, Cargo.lock, documentation and licensed fonts together. Build output, screenshots, test vaults and the local Research Vault are excluded by `native-app/.gitignore`.

From the repository root, run `cargo test --offline --manifest-path native-app/Cargo.toml` and `cargo build --offline --manifest-path native-app/Cargo.toml`. To exercise the desktop workflow, run `native-app/target/debug/living-workbench --self-test /tmp/loom-self-test.json`; this creates an isolated test vault and writes a JSON result plus a screenshot. A graphical session is required.

The mandatory 1600 × 900 blue/lavender specification governs the visual design. Picture 1 supplies the atmospheric home and knowledge-workspace references; the earlier warm and architectural concepts in pictures 2–4 are superseded. Home keeps the sphere at (630, 435), the conversation at (1170, 140), and the six-item navigation at (320, 790) at the reference size. On smaller windows the sphere remains below the intent, and conversation opens as a drawer.

Switch between **Dark** and **White** in the top bar or Local workspace settings. The appearance applies throughout the workspace and is saved per vault in `.loom/settings.json`; older vaults keep the original dark appearance.

In Local workspace settings, **Keep chat as drafts (Manual)** makes Send preserve your draft without adding messages or creating knowledge. Turn it off to send to Loom. The preference is saved per vault; existing vaults keep their current reply behavior. This follows the original program's decompiled Manual send guard, documented with its address in MECHANICS.md.

Open **More → Scene preview** for a small Unity-inspired scene inspector. Move the preview sphere with Position X/Y, change its scale and animation speed, and use Play, Pause, Stop or Reset. Reduced motion freezes animation. Save scene preset writes `.loom/scene-preview.json` in the active vault; reopening the preview loads that preset with playback paused. Edits are isolated from the home sphere. This is a native preview prototype; no Unity runtime, physics, C# execution or Unity project connection is included. A full engine integration would be a separate, substantially larger project. Use `--scene-preview --screenshot <file.png>` to capture the inspector.

## Integrated workbench surfaces

Living Workbench remains the visual home: sphere, Dark/White, conversation,
proposal bell, vault graph, canvas, experiments, decisions and traces stay available.
The new **File** and **View** menus add:

- **Files & editor**: uses Tauri's saved workspace folder on startup, supports
  browsing folders, creating files/folders and explicit text saves. Unsaved drafts
  block switching files; changes made externally block saving and preserve the draft.
- **View → Work**: reads the same Tauri work, intent and experiment JSON records,
  with a refresh action and full record inspection. It does not copy or migrate data.
- **File → Go to Tauri environment**: opens the existing Tauri application for its
  full work editing, sessions, agents, workflows, artifacts and file tools.
- Tauri's **View → Living Workbench** opens the native knowledge surface.

This is an integrated two-window prototype, not a single renderer or unified database.
Local vault experiments and Tauri experiments remain distinct. The bridge currently
locates executables in this repository's build folders; standalone distribution of
both executables together is not implemented. Build both before using the bridge:
`cargo build --manifest-path native-app/Cargo.toml` and `npm run tauri build`.

Navigation reuses the existing window, restores it when minimized and requests
focus. Each surface registers a localhost activation listener before creating a
window, so launching it again also returns to the existing instance. If a surface
is closed, navigation starts it once. Capture/self-test runs remain isolated.
