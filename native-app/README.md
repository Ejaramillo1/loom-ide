This build contains the original game's own files, for the private use of the person who owns the game, on their own computer. It must not be shared or published.

# Loom — Living Workbench

Craft Anything requires the notice above for builds that reuse files from the original. This is a knowledge workbench; the reused assets are the Inter font files described in CREDITS.md.

Build with `cargo build --offline`, then run `target/debug/living-workbench`. Knowledge is stored locally in `Research Vault/` beside this manifest. Use `--vault <directory>` to choose another location.

Phoenix is deferred. The current workbench works offline without external observability services.

## Source and verification

This native workbench lives in `app/` in the `Ejaramillo1/loom-ide` repository, on the `tauri-prototype` branch. Keep its Rust source, Cargo.lock, documentation and licensed fonts together. Build output, screenshots, test vaults and the local Research Vault are excluded by `app/.gitignore`.

From the repository root, run `cargo test --offline --manifest-path app/Cargo.toml` and `cargo build --offline --manifest-path app/Cargo.toml`. To exercise the desktop workflow, run `app/target/debug/living-workbench --self-test /tmp/loom-self-test.json`; this creates an isolated test vault and writes a JSON result plus a screenshot. A graphical session is required.

The mandatory 1600 × 900 blue/lavender specification governs the visual design. Picture 1 supplies the atmospheric home and knowledge-workspace references; the earlier warm and architectural concepts in pictures 2–4 are superseded. Home keeps the sphere at (630, 435), the conversation at (1170, 140), and the six-item navigation at (320, 790) at the reference size. On smaller windows the sphere remains below the intent, and conversation opens as a drawer.

Switch between **Dark** and **White** in the top bar or Local workspace settings. The appearance applies throughout the workspace and is saved per vault in `.loom/settings.json`; older vaults keep the original dark appearance.

In Local workspace settings, **Keep chat as drafts (Manual)** makes Send preserve your draft without adding messages or creating knowledge. Turn it off to use the existing offline replies. The preference is saved per vault; existing vaults keep their current reply behavior. This follows the original program's decompiled Manual send guard, documented with its address in MECHANICS.md.

Open **More → Scene preview** for a small Unity-inspired scene inspector. Move the preview sphere with Position X/Y, change its scale and animation speed, and use Play, Pause, Stop or Reset. Reduced motion freezes animation. Save scene preset writes `.loom/scene-preview.json` in the active vault; reopening the preview loads that preset with playback paused. Edits are isolated from the home sphere. This is a native preview prototype; no Unity runtime, physics, C# execution or Unity project connection is included. A full engine integration would be a separate, substantially larger project. Use `--scene-preview --screenshot <file.png>` to capture the inspector.
