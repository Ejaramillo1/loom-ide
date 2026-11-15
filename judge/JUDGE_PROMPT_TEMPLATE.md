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

## Criterio de aceptación

- <comandos que deben pasar, p. ej. npm test, cargo test, Unity recompile>
- <qué debe ser visible/comprobable al terminar>

## Al terminar

Commitea localmente (un commit lógico por paso) e informa: archivos
cambiados con SHAs, resultados de verificación con números, decisiones
tomadas y qué queda con su motivo. No termines con una pregunta.
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
