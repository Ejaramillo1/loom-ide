# Resolute Spatial Workbench

An experimental Unity surface for Loom. The metaphor is a carpenter's
workbench: AI research is made here, tools and workpieces have stable places,
and an object can remember the thought left with it.

This project does not replace the Tauri environment or the Rust/egui Living
Workbench. It remains a prototype, but both Editor Play Mode and a standalone
Linux player have been verified. It uses the same dark palette as
`../design-tokens.json`.

## Open and use

From the repository root:

```bash
unity open "$PWD/unity-memory-palace"
unity status --until-ready --project-path "$PWD/unity-memory-palace"
```

Open `Assets/Scenes/ResoluteWorkbench.unity` if it is not already selected and
press Play.

- Move the pointer to shift the camera gently.
- Scroll to move closer or farther from the bench.
- Hover a workpiece to lift it; click to inspect it.
- Type a short note and choose **Keep at bench** to persist it locally.
- Choose **Motion: ambient/reduced** to enable or stop spatial movement.

## Data boundary

The scene reads only the number of records in Tauri's `work.json` and
`experiments.json` under the normal local app-data directory. Missing,
unreadable or unrecognized files appear as zero records. Unity never changes or
repairs those files.

Text kept with a spatial object uses Unity PlayerPrefs and is not yet synced to
the Workbench vault or Loom server.

## Source and verification

- `Assets/Loom/MemoryPalaceController.cs` builds the current world and handles
  motion, selection and local object memories.
- `Assets/Scenes/ResoluteWorkbench.unity` is the enabled scene.
- `Tools/CreateWorkbenchScene.cs` is the repeatable Editor command used to
  create the scene root.

Compile through the connected Editor:

```bash
unity recompile --project-path "$PWD/unity-memory-palace" --format json
unity command script eval \
  'var c = Loom.MemoryPalace.MemoryPalaceController.ReadLoomRecordCounts(); return new { work = c.x, experiments = c.y, palette = Loom.MemoryPalace.MemoryPalaceController.PaletteMatchesDesignTokens() };' \
  --project-path "$PWD/unity-memory-palace" --format json
```

Generated Unity state (`Library/`, `Temp/`, `Logs/`, builds and user settings)
is ignored at the repository root and must not be committed.
