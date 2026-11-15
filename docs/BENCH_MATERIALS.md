# Bench materials — chosen values

The PBR pass's documented values table (build plan §5.2, §8.2). One material
per surface type, generated tileable 256 px base + normal maps (no imported
assets; the project constraint). Assigned in
`unity-memory-palace/Assets/Loom/MemoryPalaceController.cs` (`BuildPhysicalPortal`).

| Surface | Metallic | Smoothness | Base map | Normal map | Notes |
| --- | --- | --- | --- | --- | --- |
| Wood — toolbox, pencil, hammer shaft, handle | 0 | 0.37 | Generated wood grain (multi-sine, 256 px) | Generated from the same height field | Matte against the metals around it |
| Metal — laptop body, hinges, rivets, brass rim | 0.88 | 0.72 | Generated brushed streaks (256 px) | Generated | Needs ambient/rim reflections or it reads grey |
| Paper — notebook pages, documents, robot torso | 0 | 0.25 | Generated fibre speckle (256 px) | Generated | Highest local luminance after the sphere (§5.5) |
| Graphite — bezels, keys, boots, faceplate | 0 | 0.30 | — | — | Near-black matte |
| Glass — flask | 0.10 | 0.85 | — | — | The only large transparent; render queue 3010 (after contact shadows at 3000) |
| Optical lens — magnifier | 0.05 | 0.95 | — | — | Opaque fallback (§5.3): tinted high-smoothness reads as glass at this size, no sorting cost |
| Accent — portal signature (spine, screen, grip, liquid, badge, eyes) | 0.015 | 0.42 | — | — | Emissive: 1.35× idle, ~1.75× hover, ~2× selected pulse — always under the sphere's 2.6× |
| Sphere — Loom state hero | 0.12 | 0.68 | — | — | HDR emission 2.6× + slow pulse; state colours unchanged |

## Lighting and grading

- Rig (§5.5): warm directional key (255,240,222) front-left at 1.15 · cool
  fill (133,158,202) front-right at 0.42 · white rim spot behind the
  sphere. Evidence adds a dedicated reading spot over the documents
  (legibility surface).
- Ambient (dark): sky (44,52,66) / equator (34,40,52) / ground (22,26,34) —
  brighter than the first pass because there is no baked indirect light to
  do the fill; the trilight ambient carries it.
- One global Volume (§5.6): ACES · Bloom (threshold 1.05, intensity 0.45,
  scatter 0.7) · Color Adjustments (post-exposure +0.45, contrast +8,
  saturation −5, warm filter) · Shadows lift +0.07 · Vignette (0.18,
  smoothness 0.4). Tuned against pixel captures (docs/bench-shots/): the
  sphere reads as a warm pearl (≈230,218,207) with zero clipped pixels,
  the backdrop sits at #0A0E14, and props separate from the desk.
- Camera (§5.8): vertical FOV 42°, solid backdrop #0A0E14 (dark theme),
  exponential-squared fog at 0.005; MoveCamera keeps a 17.9° pitch at
  distance 12.76 so all six portals stay framed at column aspects
  (self-checked at 0.65/1.0/1.6).
- Quality tiers: High (renderScale 1, MSAA 4×) / Balanced (0.85, 2×) /
  Low (0.75, 1×, no SSAO). SSAO: intensity 0.5, downsample on, 4 samples.
- Dust motes: <100 additive particles near the sphere, paused under
  reduced motion.
- Fixed camera bookmarks (§8.2): front (0, 5.37, −12.76), three-quarter,
  top-down, plus a column-aspect shot — captured by
  `unity-memory-palace/Tools/CaptureBookmarks.cs` into `docs/bench-shots/`.

## Deferred, honestly

Baked GI, baked reflection probes and light probe groups need an authored
static scene; the bench is built at runtime in `Awake`, and realtime probes
are unsupported on WebGL. The runtime equivalents (rig, ambient, SSAO,
contact-shadow decals) ship instead.
