# Resolute Spatial Workbench

An experimental Unity surface for Loom. The metaphor is a carpenter's
workbench: AI research is made here, tools and workpieces have stable places,
and an object can remember the thought left with it.

This is the Unity bench embedded in the existing Tauri Spatial mode. The shared
conversation sits on the left, with the vault Knowledge Graph above Canvas on the
right. The scene follows the shell’s Dark/White palette and reduced-motion setting.
The retired native-app source is retained; no second window is launched.

## Embedded in Tauri

With the Unity Editor connected, run from the repository root:

```bash
unity command script eval --file Tools/BuildWeb.cs \
  --project-path "$PWD/unity-memory-palace" --timeout 900 --format json
npm run tauri dev
```

Loom opens **Spatial** and loads Unity automatically. WebGL files are generated into ignored `public/spatial/`; build them before packaging Tauri. Use the Vite URL or Tauri application, rather than opening source `index.html` with `file://`.

The tracked `../public/spatial-player.html`, `.css`, and `.js` host the generated player. This host fills the panel and shows a pulsing sphere until `createUnityInstance` resolves, independently of download progress reaching 100%. Loading errors are sent to Loom's Retry control. Reduced motion disables the pulse. The generated Unity `index.html` remains build output and is not used as Loom's embedded page.

Embedded object memories are read from the default repository vault’s `10 Fleeting Notes` folder. **Keep at bench** creates a new note; previous saves remain intact. Reopening an object reads its newest spatial note, including body edits made in Knowledge. The shared Knowledge views refresh after embedded saves; **Knowledge → Refresh files** also reloads the vault. Custom vaults and moved/renamed spatial files are not tracked.

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

Editor and standalone object memories use Unity PlayerPrefs. The embedded WebGL player uses the native vault bridge instead; these PlayerPrefs are not migrated. The WebGL player receives current work/experiment counts and sphere state from the Tauri host; it does not read those record files or connect directly to Loom.

## Visual refinement

The central sphere, bench, camera controls and IMGUI note panel remain. Six physical
forms replace the former portal silhouettes: an open notebook, laptop, wooden
toolbox, glass flask, small robot, and magnifier over documents. Parts use existing
URP materials and runtime meshes, without external packages. Child colliders select
the original portals. Objects keep their orientation while hover/selection lift
and scale remain. Camera framing accommodates the narrow Spatial center column.
 Materials are now warm and mostly matte; the sphere uses ivory/pearl tones with low emission. Neutral lighting replaces the violet point-light treatment. Object movement and parallax are gentler, while the existing reduced-motion switch still stops them. Rounded IMGUI textures change appearance without replacing the controls.

The sphere remains an opaque URP Lit approximation of pearl. No refraction, volumetric waves, new water system or rendering pipeline was introduced. See [the refinement report](../docs/QUIET_COMPLEXITY_REFINEMENT.md).

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


## Approved composition verification

After recompiling, run the nonvisual geometry/behavior self-check:

```bash
unity command editor.playmode start --project-path "$PWD/unity-memory-palace"
unity command script eval --file Tools/CheckWorkbench.cs --project-path "$PWD/unity-memory-palace"
unity command editor.playmode stop --project-path "$PWD/unity-memory-palace"
```

It checks portal identities, physical mesh integrity, child collider routing, reduced
motion, both themes and camera bounds at three aspect ratios. It does not validate
pixels, glass appearance, occlusion or performance. The approved implementation
could not receive a visual rendering check because browser/computer inspection was
permission-blocked. No photorealistic parity is claimed. See the
[implementation report](../docs/DESIGN_IMPLEMENTATION_REPORT.md).
