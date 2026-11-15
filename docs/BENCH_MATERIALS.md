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

- Rig (§5.5): warm directional key (255,240,222) front-left · cool fill
  (133,158,202) front-right at ~0.32 · white rim spot behind the sphere.
  Evidence adds a dedicated reading spot over the documents (legibility
  surface).
- One global Volume (§5.6): ACES · Bloom (threshold 1.05, intensity 0.45,
  scatter 0.7) · Color Adjustments (post-exposure +0.1, contrast +15,
  saturation −5, warm filter) · Vignette (0.25, smoothness 0.4).
- Camera (§5.8): vertical FOV 42°, solid backdrop #0A0E14 (dark theme),
  exponential-squared fog at 0.005.
- Quality tiers: High (renderScale 1, MSAA 4×) / Balanced (0.85, 2×) /
  Low (0.75, 1×, no SSAO). SSAO: intensity 0.5, downsample on, 4 samples.
- Dust motes: <100 additive particles near the sphere, paused under
  reduced motion.

## Deferred, honestly

Baked GI, baked reflection probes and light probe groups need an authored
static scene; the bench is built at runtime in `Awake`, and realtime probes
are unsupported on WebGL. The runtime equivalents (rig, ambient, SSAO,
contact-shadow decals) ship instead.
