# Bench backgrounds — selectable scene skyboxes

The 3D workbench background is no longer a single fixed backdrop. The user
picks one of four dark, low-saturation backgrounds in the View menu
(Settings), the choice is persisted and pushed to Unity over the spatial
bridge, and Unity swaps it at runtime with `RenderSettings.skybox`. The
ambient light source stays **Gradient (Trilight)**, so a switch is a cheap
visual change — no `DynamicGI.UpdateEnvironment`, no re-bake.

## The four backgrounds

| id | Label (menu) | Kind | Source | How to change it |
| --- | --- | --- | --- | --- |
| `charcoal` | Background: Charcoal | Procedural gradient | `Loom/SkyboxGradient` shader | `Tools/ConfigureHdri.cs` → `SkyboxCharcoal.mat` (`_Top`, `_Horizon`, `_Ground`) |
| `dusk` | Background: Dusk | Procedural gradient | `Loom/SkyboxGradient` shader | `SkyboxDusk.mat` |
| `moss` | Background: Moss | Procedural gradient | `Loom/SkyboxGradient` shader | `SkyboxMoss.mat` |
| `night` | Background: Night sky | Imported CC0 HDRI | `Loom/SkyboxPanoramic` shader | `SkyboxNight.mat` (`_MainTex`, `_Exposure`, `_Tint`, `_Saturation`, `_Rotation`) |

All four are dark and low-saturation so the light labels (white text on a
dark reading plate) and the pearl sphere keep full contrast. The three
gradients are warm charcoal / cool slate / moss umber; the HDRI is a
moonless night panorama dimmed and desaturated into the same palette.

Gradient colors (RGB 0–255, top / horizon / ground):

- Charcoal — (43,38,33) / (66,57,49) / (28,25,23)
- Dusk — (38,42,50) / (52,55,64) / (26,29,35)
- Moss — (40,43,36) / (55,57,46) / (27,31,28)

## The imported HDRI

- Asset: **Dikhololo Night** by Greg Zaal, Poly Haven.
- URL: `https://polyhaven.com/a/dikhololo_night`
- Download: `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/dikhololo_night_2k.hdr` (2K, ~7.0 MB — the task's 2K cap, not 16K).
- License: **CC0** (public domain, no attribution required).
- Import: `Assets/Loom/Resources/Textures/dikhololo_night_2k.hdr`, 2D
  equirectangular, linear (non-sRGB), RGBA Half, 2048 max, uncompressed.

This is the only imported asset in this task; the shaders are project code,
not assets.

## How the switch works

1. **Settings (View menu)** — `src/main.ts`: `BACKGROUNDS` + `setBackground`
   persist `loom-ide-tauri:background` and post `loom-background`.
2. **Bridge** — `src/spatial.ts` (`notifySpatialBackground`) and
   `public/spatial-player.js` forward `loom-background` to
   `MemoryPalaceController.ApplyBackground`, queuing it until the player is
   ready and re-applying it on load.
3. **Unity** — `ApplyBackground` resolves the id to a Resources material and
   sets `RenderSettings.skybox`; `SkyboxFor` caches the four materials. The
   camera uses `CameraClearFlags.Skybox`; the ambient mode stays
   `AmbientMode.Trilight` (Gradient). The former radial-gradient backdrop
   quad was removed — the skybox is now the background.

Shaders (`Assets/Loom/Shaders/`): `LoomSkyboxGradient` (three-stop vertical
gradient) and `LoomSkyboxPanoramic` (latitude-longitude HDR sampling with
exposure/tint/saturation). The four materials live in `Resources/` and
reference those shaders, which is what keeps them bundled in the WebGL
build (the same mechanism that retains the transparent `LoomGlass` variant).

## Verification

- `unity recompile`: 0 errors, 0 warnings.
- `Tools/CheckWorkbench.cs` (Play Mode): `backgrounds = 4` — the camera
  clear flags are Skybox, the ambient mode is Trilight, and all four ids
  resolve to a `Loom/Skybox*` material.
- `Tools/ConfigureHdri.cs` reports the HDRI imports as 2048×1024 RGBA Half,
  linear, 2D.
- Frontend: vitest green (background push queued/flushed, URL carries the
  choice), `npm run build` clean.
