# Plantilla del juez — de tarea a prompt de OpenCode

El juez recibe una tarea en palabras de Eduardo y produce un prompt completo
para OpenCode. El prompt siempre tiene estas cinco partes:

1. **Rol + repo + rama + HEAD actual.** Dónde trabaja y desde qué estado.
2. **La tarea**, tal como la escribió Eduardo, más el contexto necesario
   (archivos implicados, decisiones ya tomadas, qué no tocar).
3. **Las reglas de AGENTS.md.** El archivo ya las carga solo al iniciar la
   sesión; el prompt repite las tres críticas: no hacer preguntas, verificar
   con comandos reales, commits locales solamente (nunca push).
4. **Criterios de aceptación.** Los comandos que deben pasar y qué significa
   "terminado" para esta tarea en concreto.
5. **Formato del reporte final.** Archivos cambiados con SHAs, verificación
   con números reales, decisiones tomadas (una línea cada una) y qué queda con
   su motivo. Sin preguntas al final.

## Esqueleto del prompt

```
Trabajas en /home/ed/loom-ide-tauri, rama tauri-prototype, HEAD <sha>.
Lee AGENTS.md en la raíz del repo y síguelo: no hagas preguntas, decide
según los docs, verifica con comandos reales, commits locales solamente,
nunca push.

## Tarea (palabras de Eduardo)

<texto de la tarea>

## Contexto

- Archivos implicados: <...>
- Decisiones que ya están tomadas y no se re-litigan: <...>
- Qué no tocar: <...>

## Entradas (inputs)

- <entrada 1: ruta o recurso exacto con su contenido/estado de partida>
- <entrada 2: ...>

## Estado inicial

- HEAD <sha>; árbol con/sin cambios sin commitear (inventariados).
- <estado relevante del feature: "no existe", "parcial en X", ...>

## Cambios permitidos

- <lista de archivos/áreas que la tarea puede tocar>

## Cambios prohibidos

- <lista de archivos/áreas que no debe tocar, p. ej. Loom, Unity, datos del vault>

## Resultado esperado

- <comportamiento observable tras terminar>
- <qué NO debe ocurrir>

## Criterio de aceptación (grounding/evidencia)

- <comandos que deben pasar, con los números que el reporte debe mostrar>
- <evidencia concreta exigida: archivo de log, captura, conteo de tests, bundle size>
- <prueba de que el cambio se ejecutó de verdad, no solo que compila>

## Versiones

- OpenCode <versión>, Node <versión>, Rust <versión>, Unity <versión>.
- Herramientas instaladas que la tarea puede usar; ninguna instalación nueva.

## Presupuesto

- <presupuesto de tiempo/llamadas del agente>; si se agota, commit de lo
  completo con el ledger de progreso actualizado y el bloqueante exacto.

## Al terminar

Commitea localmente (un commit lógico por paso) e informa: archivos
cambiados con SHAs, resultados de verificación con números, decisiones
tomadas y qué queda con su motivo. No termines con una pregunta.

## Resultado del juicio (lo llena el juez, no el agente)

- Veredicto: PASS / FAIL / NEEDS-DECISION.
- Juicio por criterio: <criterio → pasado/fallado, con la evidencia revisada>.
- Lo que el agente probó (de su reporte) y lo que el juez re-verificó.
- Intentos reales registrados: <intento N → resultado>.
- Pendiente / unblock para el siguiente intento.
```

## Ejemplo (tarea real: Monaco en Code mode)

```
Trabajas en /home/ed/loom-ide-tauri, rama tauri-prototype, HEAD 440bb3d.
Lee AGENTS.md en la raíz del repo y síguelo: no hagas preguntas, decide
según los docs, verifica con comandos reales, commits locales solamente,
nunca push.

## Tarea (palabras de Eduardo)

Pon Monaco como editor en Code mode. Hoy es un textarea plano.

## Contexto

- Archivos implicados: src/main.ts (vista Code), src/style.css, package.json.
- Decisiones que ya están tomadas y no se re-litigan: frontend en
  TypeScript vanilla, sin React; Monaco está decidido (decisión 1, 15 nov 2026),
  ver docs/01-design-philosophy.md (sección de componentes open source);
  el bundle debe seguir siendo razonable (regla de tamaño del plan).
- Qué no tocar: el resto de vistas, la escena Unity, el vault.

## Criterio de aceptación

- npm test -- --run y npm run build pasan; cargo fmt --check limpio.
- En Code mode se abre Monaco con resaltado, y el diff de Monaco muestra
  los cambios propuestos por un agente antes de aplicarlos.
- El tamaño del bundle JS queda registrado en el reporte.

## Al terminar

Commitea localmente (un commit lógico por paso) e informa: archivos
cambiados con SHAs, resultados de verificación con números, decisiones
tomadas y qué queda con su motivo. No termines con una pregunta.
```

## Reglas del juez (para quien lo opera)

- El juez no aprueba dependencias nuevas: si la tarea añade una, el
  veredicto lo marca como "necesita decisión de Eduardo" aunque todo lo
  demás pase.
- El juez no empuja a GitHub: los commits quedan locales; el push es
  decisión aparte.
- Un veredicto FAIL no se reintenta solo: el juez registra qué falló y qué
  probó el agente; el siguiente intento lo decide un humano (o el juez, con
  una tarea nueva que diga qué cambiar).
