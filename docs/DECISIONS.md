# Decisions registry

Every decision that shapes the app, registered in one place. "Open" items
need Eduardo; "decided" items were resolved by him on 15 Nov 2026; "taken"
items are recorded defaults he can override.

## Decided — 15 Nov 2026 (Eduardo, one by one)

The ten decisions below were taken by Eduardo on 15 Nov 2026 and close the
"open" items they replace. They are also recorded in
`docs/REMAINING_WORK_PLAN_7X7X7.md` ("Decisiones registradas (15 nov 2026)").

1. **Code-mode editor: Monaco**, with its diff viewer. CodeMirror is out.
2. **Benchmark components: promptfoo + Docling** approved to start; the
   rest (xterm.js, filex / FileBrowser Quantum / Filestash, Cognee/Mem0/
   Graphiti, E2B, Opik, LiteLLM) are decided one by one.
3. **Phase-5 transport: a Rust gRPC client** in the IDE backend, Judge
   first. Loom is not touched.
4. **Q2: a static "3D no disponible" panel**; the non-spatial views stay
   reachable.
5. **Loom-as-MCP-server ↔ harness: connect**, in both directions, with an
   explicit list of which PC tools are exposed.
6. **Task migration: full migration** of local work to Loom tasks; the
   intents/attention mapping is defined before migrating, and the
   migration is explicit, never silent.
7. **Avatar: wire it**; its account/profile concept is defined at
   implementation time.
8. **Both state surfaces with defined roles**: the pill is the precise
   text state, the sphere the ambient colour state, both from one shared
   state.
9. **Tenth relation type: "blocks"** — the count is ten, not nine.
10. **Workflow streaming first, then ABTest.**

## Still open

- Canvas 2D `sphere.ts`: the `Sphere` class is dead code (only the
  `SphereState` type is imported); delete it or resurrect it.

## Taken (recorded defaults, override-able)

- Home view: Spatial (Unity-first). Experiment is a bottom-nav tab.
- Code mode editor: Monaco (`monaco-editor`, MIT) — Eduardo's "Pon Monaco"
  resolves the former open item. One dependency; workers wired for Vite,
  theme follows Dark/White, language from the file path.
- Vault: the markdown vault stays the shared store behind the adapter.
- Sphere: kept; it is the live Loom-state indicator; decorative copies
  kept by decision (D6).
- Amber = awaiting approval (ships; approval still pending).
- Notes editing: Tauri only; the bench navigates.
- Note deletion: in-place archive/restore; destructive deletion forbidden.
- Lightmap baking / baked probes / light probe groups: deferred — the
  bench is built at runtime in `Awake`; baked GI needs an authored static
  scene, and realtime probes are unsupported on WebGL. Runtime
  equivalents ship (rig, ambient, SSAO, contact-shadow decals).
- Flask glass: transparent stays (one large transparent, render queue
  3010); the lens uses the opaque fallback. At ~10% of the column width
  either path is valid per §5.3.
- Quality tiers: High/Balanced/Low switchable in the View menu; Low turns
  bloom off; WebGL and Standalone default to High.
- Disk watcher: 3 s signature polling (no fs-watcher dependency). A
  draft or open dialog always wins; external edits re-push the bench.
- Traces/patterns/workflows/models are not mirrored into the vault
  (patterns have a shelf; traces have no list endpoint to enumerate).
- Vault→Loom direction: not implemented; no endpoint was found to export
  local objects.
- AdminService: out of scope (admin-only).
- No client auth; localhost only (see docs/LOOM_CONNECTION_MODEL.md).
- The two meanings of "experiment" (local JSON records vs vault notes of
  kind `experiment`) are intentionally separate; the same word names both.
- Three scoped search inputs stay (work/notes, knowledge, artifacts).
- Attention items keep both kinds in the type (`decision` is produced;
  `finding` stays reserved for a future Loom surface).
- Experiment history is the local experiment list; run comparison happens
  through the arms and the provider A/B dialog. No export endpoint exists.
- renderScale stays tier-driven (High 1 / Balanced 0.85 / Low 0.75); the
  measured canvas size drives the camera aspect instead, so framing
  follows the real embed on resize.
- The unary weave path is the fallback only; Stop is a streaming-path
  control (the server offers no unary cancel).
- Intent rendering: one editor inside `#intent-header` (the critique's
  "two places" is stale — verified resolved).
