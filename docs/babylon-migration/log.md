# Babylon migration — bitácora (Session 1)

Fase 1 · Sesión 1 · base `main` @ `70b5212`. Estatus: **piloto aprobado
técnicamente (go)**; la decisión go/no-go la cierra Eduardo.

## Stage 1.1 — Inventario y layout

- Inventario completo (objeto por objeto) en `inventory.md`: los seis
  portales son 100% procedurales (primitivas + lathe + texturas PBR
  generadas por campos de altura analíticos; **no hay modelos**), con
  paleta, estados de esfera, luces (rig de 3 puntos + lectura), cámara
  (FOV 42°, framing por aspect), órbitas, post (bloom+ACES+vignette) y
  los 4 fondos.
- Decisiones en `decisions.md`: deps aprobadas (`@babylonjs/core`,
  `loaders`, `gui` `^9.37.0` + `inspector` devDependency, Apache 2.0),
  arquitectura en el mismo iframe, origen **procedural**, etiquetas
  **GUI de Babylon**, Unity como fallback hasta Fase 3.
- Dependencias instaladas y fijadas a `^9.37.0`.
- Layout creado: `src/spatial/` (bench, bridge, player), la página del
  player y `docs/babylon-migration/`.

## Stage 1.2 — Escena mínima visible

- Escena Babylon mínima en `src/spatial/bench.ts`: esfera central con
  color por estado, dos objetos (notebook + flask) en sus posiciones del
  anillo, una luz key + ambiente hemisférico, `GlowLayer`, fondo
  charcoal y órbitas.
- Verificación headless (Chromium + SwiftShader): la página carga, el
  WebGL se inicializa, la escena **renderiza** (174 colores distintos en
  el frame — no es un lienzo vacío) y se emite `loom-spatial-ready`.
  Capturas en `evidence/babylon-{idle,error,dusk}.png`.
- **Bundle medido**: el entry del player Babylon pesa **1.32 MB gzip**
  (`dist/assets/spatial-*.js`), por encima de la referencia del plan
  (~350 KB). Es un riesgo medido, no bloqueante: es un entry separado y
  lazy (no engorda el bundle principal, que se mantiene en ~4.17 MB), y
  tiene mitigaciones (deep imports, StandardMaterial en vez de PBR,
  quitar GlowLayer) si el tamaño importa en Fase 2.

## Stage 1.3 — Puente mínimo

- `src/spatial/bridge.ts` reproduce el contrato de `spatial-player.js`
  punto por punto: mensajes `loom-state/theme/vault-changed/quality/
  background`, salida `loom-spatial-ready/error`, cola de pendientes
  (theme/background/state/vault), reporte de tamaño del canvas, reduced
  motion, y filtro source/origin.
- `src/spatial/babylon-player.ts` lo conecta a la escena; la página
  `spatial-player-babylon.html` es un entry propio de vite (multi-page).
- **vitest**: `src/spatial/bridge.test.ts` — 10 casos (cola de pendientes,
  latest-wins, quality dropeado antes de ready, defaults de params,
  reporte de tamaño, reduced motion, source/origin, ready/error).
- Verificación manual headless: `loom-state=error` y
  `loom-background=dusk` disparan el cambio (capturas en `evidence/`).

## Checks

- `npm test -- --run` (incluye los 10 del bridge) — verde.
- `npm run build` (tsc + vite, dos entradas) — verde.
- `npm audit` reporta 7 vulnerabilidades preexistentes (no introducidas
  por Babylon; no se corre `audit fix --force`).
- Unity **no se tocó**; sigue como fallback.

## Decisión pendiente (go/no-go de Eduardo)

El piloto cumple los tres criterios de salida de Fase 1. Se propone
**seguir a Fase 2** (paridad de escena completa). Riesgo a vigilar:
tamaño de bundle (1.32 MB gzip) y fidelidad del look PBR.
