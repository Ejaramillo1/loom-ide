# Decisions registry

Every decision that shapes the app, registered in one place. "Open" items
need Eduardo; "taken" items are recorded defaults he can override.

## Open — Eduardo's call

1. **Benchmark components**: xterm.js (terminal), filex / FileBrowser
   Quantum / Filestash (file explorer), promptfoo, Docling, Cognee/Mem0/
   Graphiti, E2B, Opik, LiteLLM — one decision per dependency.
2. **Phase 5 transport** for the genuinely gRPC-only services (judge,
   graph memory, memory layer, tool registry beyond HTTP, teleprompter,
   learning, scheduler): gateway bindings in Loom vs a Rust gRPC client
   vs per-service mix. Tasks and skills are NOT in this decision — both
   are 100% HTTP.
3. **Q2**: Unity-failure fallback stays deferred (the "3D unavailable"
   panel exists as the cheap option if approved).
4. **Loom-as-MCP-server ↔ MuseBridge harness** connection.
5. **Task migration**: read-bridge only (current) vs full migration vs
   local forever.
6. **Avatar**: wire it or remove it.
7. **One Loom-state surface**: pill or sphere (both exist; roles to be
   defined).
8. **Canvas 2D `sphere.ts`**: delete the dead class or resurrect it.
9. **Tenth relation type**: already resolved — nine, not ten (miscount).

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
