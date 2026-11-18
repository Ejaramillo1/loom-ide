# Babylon migration — inventory (Stage 1.1)

Source of truth: `unity-memory-palace/Assets/Loom/MemoryPalaceController.cs`
(the whole scene is built procedurally at runtime by this one component;
`Tools/CreateWorkbenchScene.cs` only creates an empty scene + adds it) and
`public/spatial-player.js` (the iframe contract). No model files exist in
`Assets/` — only `.mat` materials and skybox shaders — so every object is
primitives + lathe + generated PBR maps. **Decision: procedural, no glTF.**

## Portals (the six objects)

Placements are local to the bench surface (`y = 0.36`); each object is a
`MemoryAnchor` that orbits the sphere and carries an accent colour.

| Portal | Object | Accent | Position | Construction (all Unity primitives) |
|---|---|---|---|---|
| Work | toolbox | Amber `217,166,95` | `(0, 0.36, -2.65)` | wood floor/side planks/raised ends + metal corner straps/rivets + wood handle + hammer (wood shaft, metal head) + screwdriver (accent grip, metal shaft) |
| Code | laptop | Blue `106,145,204` | `(-2.85, 0.36, 1.35)` | metal base + ink keyboard well + 44 metal keys + ink trackpad + hinged lid (metal casing, ink bezel, **accent screen**, ink camera, metal reflection) |
| Experiments | flask | Green `120,155,137` | `(2.7, 0.36, -0.1)` | glass **lathe** flask + accent tinted-liquid lathe + metal rolled lip ring + paper etched graduations |
| Evidence | docs + magnifier | Red `184,117,112` | `(2.8, 0.36, -2.55)` | 4 paper documents (rotated) + magnifier (metal ring, lensGlass sphere, metal ferrule, accent handle) + reading light + metal clip |
| Agents | robot | Purple `161,134,116` | `(2.65, 0.36, 2.05)` | ink boot capsules + metal legs/joints/hands + paper arms + ceramic torso + accent chest + rounded paper head + ink faceplate + accent eye lenses + metal antenna |
| Notes | notebook | Pearl `235,220,211` | `(-2.8, 0.36, -1.2)` | accent cloth spine + wood leather covers + paper page edges + metal ruled-paper lines + accent ribbon + wood pencil |

Babylon equivalent per primitive: Cube→`CreateBox`, Sphere→`CreateSphere`,
Cylinder→`CreateCylinder`, Capsule→`CreateCapsule`, Lathe→`CreateLathe`
(Babylon has `MeshBuilder.CreateLathe`), Plane/Quad→`CreatePlane`/
`CreateGround`. Shared PBR materials: paper, ink, metal, wood, glass,
lens, accent (per portal).

## Materials (shared PBR)

| Material | Colour | smoothness | metallic | notes |
|---|---|---|---|---|
| Ivory paper | `229,218,195` | .25 | 0 | 512px paper base+normal (analytic fibre) |
| Graphite ink | `47,51,54` | .3 | 0 | |
| Brushed nickel | `150,159,162` | .72 | .88 | 512px brushed base+normal |
| Oiled walnut | `105,66,39` | .37 | 0 | 512px wood base+normal |
| Optical glass | LoomGlass template | .85 | .1 | renderQueue 3010 (only large transparent) |
| Optical lens | `148,166,178` | .95 | .05 | opaque glass fallback |
| Accent | portal colour | .42 | 0 | emissive `1.35×` |

Generated textures are tileable 512px base+normal pairs from analytic
height fields (wood grain, paper fibre, brushed metal) — no imported
assets. Babylon can reproduce these with `DynamicTexture`/procedural
textures (Fase 2 parity item).

## Sphere (state indicator)

Pearl base `248,238,230`, smoothness .55, metallic .12, radius 2.35 at
`(0, 1.75, 0)`. State tints the base (`Lerp(pearl, colour, .4)`) and the
emission (`colour × 1.0` HDR). Pulse: scale ±0.4% and emission
`+0.12·sin(1.1t)`; slow yaw 1.2°/s.

| State | Colour |
|---|---|
| attention | Amber `217,166,95` |
| completed | Green `120,155,137` |
| error | Red `184,117,112` |
| exploring / executing | Blue `106,145,204` |
| idle / listening / processing | Purple `161,134,116` |

(Dark theme uses the dark palette: `DarkAmber 217,166,95`, `DarkGreen
147,177,159`, `DarkRed 211,146,138`, `DarkBlue 139,166,204`, `DarkPurple
185,164,144`.)

## Palette (design tokens)

White: Deep `245,240,235`, Reading `248,244,240`, Surface `241,234,229`,
Text `41,39,37`, Muted `100,93,87`, Pearl `235,220,211`.
Dark: Deep `29,27,26`, Reading `36,33,31`, Surface `44,40,37`, Text
`240,233,226`, Muted `178,168,160`; Sky `56,49,44`, Equator `48,42,38`,
Ground `40,35,32`; floor `58,48,40` (light floor `214,198,188`).
Lighting: FillCool `133,158,202`, RimWhite `228,236,248`.

## Lighting & atmosphere

Three-point rig: warm key directional `255,240,222` (1.15 white / 0.9
dark, rot 44,-38, soft shadows); cool fill directional `FillCool` (0.42 /
0.32, rot 30,118); white rim spot `RimWhite` (0.55 / 0.35, range 30,
spot 60, at `0,2.6,4.2`). Ambient trilight (sky/equator/ground). Evidence
gets a reading spot. Fog: exponential-squared, Deep colour, density
.005. Dust: 40 additive particles near the sphere.

Post: bloom (threshold 1.15, intensity .3, scatter .7, high quality),
ACES tonemapping, colour adjustments (postExposure .45, contrast 8,
saturation -5, filter `1,.95,.9`), shadows lift .07, vignette .18/.4.
Low quality tier disables bloom.

## Camera

Target `(0,1.25,0)`, FOV 42°, distance 7.5–15 (default 12.76, scroll),
`framing = max(1, 1/aspect)`, position
`(parallax.x·0.25, 1.25 + 4.12·framing + parallax.y·0.12, -distance·framing)`.
Aspect is driven by the measured canvas size (`ApplyCanvasSize`).

## Orbits, labels, motion

Orbits: inner radius 4.1 / height 1.05 (colour `216,191,180`), outer
5.75 / 1.35 (`221,213,208`), ellipse `z×0.62`, 128-segment loops.
Labels: screen-space, bold 15px, on a rounded reading plate (0.94 α),
drawn after the 3D scene so never occluded; skip if behind camera.
Motion: portals orbit 12°/s (pause on hover/select), sphere pulses;
reduced-motion freezes all.

## Backgrounds (selectable)

charcoal (default), dusk, moss, night — gradient + panoramic skybox
shaders. Babylon: `scene.clearColor` gradient or `Layer`/skybox mesh.

## Contract (reproduced verbatim)

See `public/spatial-player.js` — the Babylon player must reproduce the
same postMessage contract: in `loom-state`/`loom-theme`/
`loom-vault-changed`/`loom-quality`/`loom-background`; out
`loom-spatial-ready`/`loom-spatial-error`; `ApplyLoomState`, `ApplyTheme`,
`RefreshVault`, `ApplyQuality`, `ApplyBackground`, `ApplyCanvasSize`,
`ApplyReducedMotion`; URL `?theme=`/`?background=`; measured canvas size
reported on load and resize.
