# Credits and assets

The sphere, icons, atmosphere, reflections and interface are original procedural drawings. No proprietary application code, photographs, screenshot pixels, logos, game models, game maps, sounds or other original game assets are included.

Inter Regular and Medium are converted from the open-source Fontsource Inter package already installed in the reference repository:
- `/home/ed/loom-ide-tauri/node_modules/@fontsource/inter/files/inter-latin-400-normal.woff`
- `/home/ed/loom-ide-tauri/node_modules/@fontsource/inter/files/inter-latin-500-normal.woff`
- License: SIL Open Font License 1.1; retained in assets/Inter-LICENSE.txt. Conversion only changes the container from WOFF to TrueType, preserving font tables.

The historical Mastermind numbers and short example labels come from the user's supplied specification; they are labeled as fixtures throughout the application.

Direct dependencies: eframe/egui (MIT OR Apache-2.0), serde (MIT OR Apache-2.0), serde_json (MIT OR Apache-2.0), image (MIT OR Apache-2.0). Exact versions are locked in Cargo.lock. System windowing libraries remain dynamically linked. No Obsidian code or assets are used. The JSON Canvas format is used for interoperable export; its official specification is https://jsoncanvas.org/spec/1.0/ .
