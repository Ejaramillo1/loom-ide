# 01 — Design Philosophy: Quiet Complexity

*A front end for Loom designed around human intention, not around agents.*

## The one-sentence position

Loom already knows how to run agents, score them, remember them and ask a
person questions. What it does not yet have is a place where a person and the
system share the same work. This design builds that place: a quiet surface
where intent is stated once, work is visible as objects, evidence sits next to
every claim, and a person can always see — and change — how much freedom the
system has.

We call the philosophy **Quiet Complexity**: sophisticated capability that does
not demand attention until a decision, a risk, or a surprise makes attention
worth spending.

## Five principles (everything is tested against these)

### 1. Human Intention comes first

The person states what they want and why. The system proposes how. Chat may
*create* an intent, but it is never where intent *lives*. An intent is a
persistent, editable object: goal, constraints, success checks, owner,
autonomy level, and current state.

- Loom hook: Weaver already turns natural language into agents and workflows
  (`documentation/architecture/weaver-system.md`), and the task decomposer turns
  goals into task graphs (`documentation/architecture/task-system.md`).
- Design rule: no consequential run starts from a bare chat message. It starts
  from an Intent object the person can read, edit, pause, and cancel.

### 2. Human Agency is a visible dial, not a vibe

Autonomy is set per intent and per stage, on a five-step dial:
Manual → Assisted → Collaborative → Delegated → Autonomous.
Moving the dial is always an explicit human act, and moving it down takes
effect immediately.

- Loom hook: the decision layer already supports shadow mode (record only,
  never act) and per-site live bands with uncertainty thresholds
  (`documentation/reference/agent-configuration.md`, `spec.decision`), and
  learning has three autonomy modes including human-approval
  (`documentation/architecture/loom-system-architecture.md`).
- Design rule: defaults are low. The system may *propose* more autonomy with
  evidence; it may never grant itself more.

### 3. Human Understanding beats system narration

Every claim the system makes is labelled as one of four kinds:
**Observed** (the system did or saw this), **Recorded** (evidence stored,
with a link), **Inferred** (the system's best explanation — may be wrong),
**Unknown** (not yet established). Explanations are never presented as ground
truth.

- Loom hook: observability already records traces, spans, token/cost/latency,
  pattern match scores and judge verdicts
  (`documentation/architecture/observability.md`), but its own document says a
  real-time query UI is a non-goal. Understanding is the layer we must add.
- Design rule: no green tick without evidence one click away. No summary
  without its sources reachable.

### 4. Human Creativity is protected from premature automation

Automation that finishes your sentence also finishes your thinking. The
interface keeps manual and assisted work first-class: a person can always do
the task by hand, watch how the system would do it, compare, and choose.
Suggestions arrive as alternatives, not as a single take-it-or-leave-it answer.

- Design rule: for creative and judgement work, show at least two genuinely
  different options, or show one option plus "do it myself". Never silently
  collapse the option space to one.

### 5. Human Development: the tool should make the person better

If the person cannot do the task without the system after a month of use, the
design has failed even if the output is good. The interface explains *why*,
not just *what*; it lets people rehearse at lower autonomy; it keeps a visible
trail of what they decided so they can learn from their own history.

- Design rule: every automated step keeps a "show me how" view. Skill use is
  measured, not assumed (see `research/07-validation-strategy.md`).

## Quiet Complexity — what it means in practice

Minimalism here does **not** mean fewer features. It means fewer *demands*.

| Quiet Complexity rule | What it forbids |
|---|---|
| Silence is the default state | Activity feeds, agent "typing" theatre, live token streams on the home screen |
| Attention is spent, not taken | Badges, red dots, and auto-opening panels for routine events |
| Consequential things are never quiet | Approvals, irreversible actions, cost spikes, anomalies — these interrupt, clearly |
| Complexity is one layer down, not deleted | Full traces, raw logs and YAML exist — behind the object they belong to, not on the main surface |
| White space is a feature | Crowded dashboards that make everything look equally urgent |

## Anti-patterns (we will not build these)

1. **The agent parade.** A wall of live agent activity that makes the person a
   spectator of their own work. Agents are not the protagonists.
2. **Chat as the database.** Anything that matters only existing inside a
   conversation transcript. If it matters, it is an object.
3. **Confidence theatre.** Percentages and green ticks with no evidence
   behind them.
4. **Autonomy creep.** Quietly widening what the system may do without asking.
5. **Explanation as proof.** Fluent AI narration treated as verification.
   Judges score; evidence proves; narration only suggests.
6. **The hidden expert mode.** Consequential controls buried where only
   power users find them. Quiet must never mean secret.
7. **Dashboard maximalism.** Every metric on one screen. That is not
   transparency; it is outsourcing the filtering work to the person's eyes.

## The three attention states

1. **Normal operation — quiet.** The work surface shows objects and their
   state. Nothing moves unless state changed. The person works; the system
   helps in place.
2. **Decision required — clear.** One card, in context, showing: what is being
   asked, why now, the evidence, the alternatives, the consequences of each,
   and the uncertainty. In Loom, only an approval request carrying a non-empty
   `hitl_request.request_id` is answerable
   (`documentation/guides/human-in-the-loop.md`) — the interface must never
   show an answer box for keep-alive or hint messages.
3. **Unexpected behaviour — honest.** Anomalies are visible where they
   happened, with three always-available actions: inspect, interrupt, recover.
   Loom already supports durable workflow checkpoints that survive process
   exit and refuse to resume against a changed workflow definition
   (`documentation/guides/human-in-the-loop.md`) — recovery builds on that.

## What we keep from traditional tools

Files, editors, diffs, tests and terminals are proven. We do not remove them.
We demote them: they become views *inside* work objects instead of the
organising principle of the whole environment.

## The test for every future feature

Before anything ships, it must answer yes to all five:

1. Does it start from, or update, a human-stated intent?
2. Can the person see and change the autonomy level it runs at?
3. Is every claim labelled observed / recorded / inferred / unknown?
4. Could the person still do this by hand if they chose to?
5. Will the person be better at this task next month because of it?

---

## The full philosophy — Quiet Complexity (Spanish reconstruction, 14 Nov 2026)

The text below is the full reconstruction of the design philosophy, in the
original Spanish, added verbatim on 14 Nov 2026. The English sections above
are the working summary; this section is the source of record for the
philosophy's principles, references, visual language, and evaluation
checklist.

### Adaptation to the current state (14 Nov 2026)

The philosophy above is direction, not a description of what is built. What
differs today, on `tauri-prototype` at head `faa2338` (and later):

- **Composition.** §6 describes brand + banner top-left, work list and chat
  on the left, a large sphere in the centre, and collaboration/attention
  panels on the right. The app today is the unified workbench from the
  approved visual reference: conversation on the left, the Unity bench in the
  centre, and the Knowledge Graph/Canvas pane on the right; it opens on
  Spatial (Unity-first), not on the static composition in §6. The Agentic
  Collaboration and Attention panels in §6/§9 are not built as such —
  attention is a design state (see "The three attention states" above), not
  a panel.
- **Sphere states.** §7's conceptual states map onto the decided colour rule:
  amber = awaiting approval, green = completed, red = error, blue =
  exploring/executing, purple = everything else. The sphere is the Loom
  connection/state indicator, not a mascot.
- **Palette.** §6's tokens are starting points. The visual refinement already
  overrode one: the brief's `#77716D` secondary text reaches only 4.25:1 on
  `#F5F0EB`, so essential secondary text uses `#645D57` (see
  `docs/QUIET_COMPLEXITY_REFINEMENT.md`).
- **Water.** §6's discreet water surface exists only as a decorative backdrop
  (`aria-hidden`); no water system was built.
- **What is still missing.** Code mode is a plain textarea (no Monaco —
  dependency decision pending). The note editor moved out of Unity IMGUI
  into the Tauri Notes view, canvas positions persist durably, and a disk
  watcher picks up external vault edits. There is no Unity failure
  fallback (Q2, deferred) and no real-window pixel check (D14, blocked;
  Editor captures exist in `docs/bench-shots/`). The philosophy's §10 rule
  applies to all of it: refine the existing Tauri / TypeScript / Unity
  stack, no new framework, no second app.

# Quiet Complexity
## Filosofía de diseño minimalista para Loom

**Documento de reconstrucción · 14 de noviembre de 2026**
**Proyecto:** Loom — entorno de desarrollo human-centered, AI-native y agentic
**Estado:** Filosofía y dirección de diseño; no especificación cerrada de producto

> **La inteligencia puede estar en todas partes sin exigir atención en todas partes.**
>
> **La interfaz debe desaparecer como obstáculo, no desaparecer al ser humano.**

---

## 1. La premisa

Loom no busca ser otro VS Code, Cursor o un chatbot acoplado a un editor. Su propuesta es un **entorno de desarrollo humano-céntrico y nativo de IA**, donde las capacidades de los agentes, el contexto, los artefactos, las pruebas y el trabajo compartido forman parte del propio espacio de interacción.

El diseño parte de tres fundamentos que deben coexistir:

1. **Experiencia human-centered.** La persona conserva la iniciativa, el juicio, la comprensión, la creatividad y el control.
2. **Infraestructura AI-native.** La IA se relaciona con los objetos y procesos del entorno; no vive únicamente en una ventana de chat.
3. **Colaboración agentic.** Los agentes pueden investigar y ejecutar tareas delimitadas, pero su actividad es observable, interrumpible y subordinada a los límites autorizados por el humano.

**AI-first no significa AI-centered.** La pregunta inicial no es «¿qué están haciendo los agentes?», sino **«¿qué está intentando comprender, crear o resolver la persona?»**.

## 2. Definición de Quiet Complexity

**Quiet Complexity** es una filosofía en la que una plataforma técnicamente sofisticada se experimenta como un espacio tranquilo, coherente y legible. La complejidad necesaria permanece disponible; el ruido visual, mecánico y cognitivo se reduce.

No implica suprimir funcionalidades, ocultar riesgos ni maquillar incertidumbre. Implica presentar **la información adecuada, en el momento adecuado, con el nivel de profundidad adecuado**.

### Principios centrales

- **Menos, pero mejor:** cada elemento visible debe tener una razón de existir.
- **La intención humana antes que la actividad del agente:** organizar la experiencia alrededor del trabajo que importa.
- **Calma con profundidad:** superficies discretas, luz suave, sombras, jerarquía y espacio negativo sin caer en un diseño plano.
- **Divulgación progresiva:** mostrar lo esencial y permitir inspección profunda cuando se requiera.
- **Interacción natural:** preferir acciones contextuales sobre instrucciones artificialmente complejas.
- **Control legible:** mostrar cuándo se delega, qué se modifica, qué requiere aprobación y cómo detenerlo.
- **Evidencia sobre espectáculo:** las afirmaciones de IA deben enlazar a resultados, archivos, pruebas o trazas verificables.
- **Crecimiento humano:** la IA debe aumentar las capacidades de la persona, no volverla un aprobador pasivo.
- **Movimiento con significado:** la animación comunica estados; no existe solo para entretener.
- **Coherencia por encima de novedad:** los patrones estables y predecibles son parte del minimalismo.

## 3. Referentes y traducción a diseño

Estas son influencias, **no una afirmación de que todos pertenecen a la misma escuela minimalista**. Las aplicaciones a Loom son interpretaciones de diseño.

| Referente | Disciplina | Idea que recuperamos | Traducción para Loom |
|---|---|---|---|
| **Dieter Rams** | Diseño industrial | «Less, but better»; utilidad y claridad | Eliminar controles redundantes; justificar cada pieza |
| **John Pawson** | Arquitectura | Proporción, silencio, espacio negativo | Superficies amplias, composiciones aireadas, pocos bordes |
| **Naoto Fukasawa** | Diseño industrial | Interacciones intuitivas, *Without Thought* | Acciones contextuales que no exigen diseñar prompts complejos |
| **Kenya Hara** | Diseño gráfico | Vacío como capacidad y posibilidad | El entorno deja espacio a las ideas del usuario |
| **Tadao Ando** | Arquitectura | Luz, sombra, geometría y contraste | Profundidad arquitectónica y énfasis reservado para lo importante |
| **John Maeda** | Diseño y tecnología | Organizar la complejidad | Capas de inspección, de lo esencial a lo técnico |
| **Agnes Martin** | Pintura | Ritmo, retículas sutiles, calma | Espaciado consistente y variaciones visuales pequeñas |
| **Donald Judd** | Escultura | Modulación y estructuras consistentes | Componentes y artefactos con reglas visuales compartidas |
| **Massimo Vignelli** | Diseño gráfico | Sistemas tipográficos y coherencia | Jerarquía y lenguaje visual disciplinados |
| **Josef Müller-Brockmann** | Diseño gráfico | Retícula y legibilidad | Layout preciso, alineaciones sin ruido |
| **Mies van der Rohe** | Arquitectura | Claridad estructural | Organización simple del espacio |
| **Kazuyo Sejima / SANAA** | Arquitectura | Ligereza, transparencia | Paneles ligeros y relaciones fluidas |
| **Jony Ive** | Diseño industrial | Refinamiento en detalles | Calidad en estados, transiciones y microinteracciones |
| **Luis Barragán** | Arquitectura | Emoción, luz y uso selectivo del color | Calidez y personalidad sin saturación |

La síntesis más importante para el proyecto combina **Rams (función), Pawson (espacio), Ando (luz), Fukasawa (interacción), Hara (posibilidad) y Maeda (organización)**.

## 4. La persona es protagonista

La filosofía evita que la persona se convierta en un mero supervisor de máquinas. Puede trabajar directamente, pedir asistencia, colaborar o delegar. El nivel de autonomía se adapta a su decisión y a los límites autorizados.

Cinco compromisos guían la UX:

1. **Intención:** el objetivo humano define el trabajo.
2. **Agencia:** se puede iniciar, redirigir, pausar, rechazar e intervenir.
3. **Comprensión:** las conclusiones se explican mediante evidencia inspeccionable, sin presentar explicaciones generadas como acceso infalible al razonamiento interno del modelo.
4. **Creatividad:** el sistema permite explorar alternativas y cuestionar hipótesis.
5. **Desarrollo:** el uso de IA debe fortalecer el aprendizaje y la independencia intelectual.

Una tarea de investigación puede ofrecer **Entender, Investigar, Resolver juntos, Delegar o Descartar**, según el contexto; no tiene por qué imponer la automatización.

## 5. El modelo de interacción: trabajo, no solo mensajes

El chat permanece, porque conversar es una forma natural de expresar ideas. **Pero chat no es la arquitectura conceptual del IDE.**

Los objetos que deben organizar el entorno son:

- **Intención:** qué se quiere lograr o entender.
- **Trabajo:** actividades y estado de ejecución.
- **Artefactos:** código, documentos, experimentos y resultados.
- **Evidencia:** pruebas, trazas, mediciones, fuentes y observaciones.
- **Control:** permisos, decisiones, interrupciones y límites.

El mismo contexto debe poder recorrerse desde un archivo, una hipótesis, un experimento o un agente; no depender de encontrar una conversación antigua.

### Capas de información

- **Enfocar:** objetivo actual y herramientas indispensables.
- **Inspeccionar:** decisiones, resultados, cambios y actividad relevante.
- **Diagnosticar:** ejecución detallada, trazas, errores, memoria y costos cuando corresponda.

La profundidad se abre bajo demanda. **No se eliminan las funciones avanzadas: se evita obligar a mirarlas todo el tiempo.**

## 6. Lenguaje visual aprobado

La exploración visual convergió en una pantalla de escritorio con **profundidad sutil, mucha calma y una esfera central de gran tamaño**.

### Composición

- **Arriba a la izquierda:** marca Loom y un banner mínimo: `You are working on: [intent]`.
- **Izquierda:** lista discreta de trabajo; debajo, chat contextual, compacto pero presente.
- **Centro:** una gran esfera luminosa abstracta, sin un bloque grande de texto de intención ni hileras de botones.
- **Derecha:** panel pequeño de colaboración agentic y otro de atención que requiera decisiones humanas.
- **Abajo:** navegación compacta entre modos. La exploración inicial usó `Code · Experiment · Work`; la evolución real del proyecto puede incorporar más vistas sin cargar el centro.

### Profundidad y atmósfera

- Fondos cálidos (marfil, beige, gris piedra) o equivalentes oscuros (carbón profundo), sin extremos de blanco puro o negro absoluto.
- Luz ambiental suave y direccional, con **sombras amplias y difusas**.
- Gradientes tenues, translucidez moderada y una jerarquía clara entre planos.
- **Superficie de agua discreta** en la zona inferior: reflejos apagados, amplitud de onda baja, movimiento lento. Su función es sugerir profundidad, no recrear un paisaje.
- Espacio negativo suficiente para que la esfera y el trabajo respiren.

### Elementos explícitamente descartados

- Árboles, rocas y objetos escenográficos.
- Agujero o tragaluz en el techo.
- Fondos recargados, texturas ruidosas y elementos arquitectónicos invasivos.
- Demasiados controles flotando alrededor de la esfera.
- Texto de intención gigante en el centro: la intención pertenece al **banner superior**.
- UI de dashboard tradicional cargada de tarjetas, métricas y botones.

### Paleta de partida (no regla inmutable)

| Token | Valor inicial | Uso |
|---|---|---|
| Fondo claro | `#F5F0EB` | Plano principal cálido |
| Superficie cálida | `#F1EAE5` | Paneles y capas |
| Texto principal claro | `#292725` | Lectura |
| Texto secundario | `#77716D` | Metadatos |
| Borde discreto | `#DDD5D0` | Delimitación mínima |
| Realce cálido | `#E9D7CA` | Iluminación y detalles |
| Azul agente | `#6A91CC` | Estado activo, sin saturar |
| Ámbar atención | `#D9A65F` | Decisiones y avisos importantes |
| Fondo oscuro profundo | `#1D1B1A` | Base del tema oscuro |
| Superficie oscura | `#2C2825` | Separación en dark mode |
| Texto claro oscuro | `#F0E9E2` | Lectura en dark mode |
| Perla de la esfera | `#F8EEE6` | Material central |

Los colores son **tokens iniciales**; el criterio real es contraste, legibilidad y coherencia entre modo claro y oscuro. En la exploración posterior se buscó que ningún tema fuera demasiado luminoso u oscuro y que el sombreado no ocultara elementos.

## 7. La esfera como pieza distintiva

La esfera es el centro visual, pero **no una mascota ni una inteligencia antropomorfizada**.

Se concibe como representación ambiental del estado del entorno:

- Forma grande, simple, perlada y levemente translúcida.
- Curvas internas finísimas, con sensación de flujo.
- Brillo de borde moderado y sombra/reflejo suave.
- Movimiento lento, orgánico y casi imperceptible en reposo.
- Variaciones controladas ante eventos del sistema.

### Estados conceptuales

| Estado | Comportamiento visual propuesto |
|---|---|
| Reposo | Movimiento interno muy lento |
| Escuchando/interacción | Pulso suave |
| Ejecución | Ondas o flujo levemente más activo |
| Requiere atención | Matiz cálido contenido, acompañado de información textual |
| Finalización | Retorno gradual a reposo |
| Error | Señal reconocible, acompañada de evidencia y acción recuperable |

**No presentar la esfera como si revelara literalmente el pensamiento de un modelo.** Su estado debe derivarse de eventos reales y verificables, no de animaciones que aparenten ejecución cuando no la hay.

La escena 3D debe ser funcional, eficiente y respetar `prefers-reduced-motion`. La atmósfera visual **no puede competir con la legibilidad del editor**.

## 8. Movimiento, accesibilidad y ergonomía

- Animaciones suaves, cortas o lentas según su función; no rotaciones veloces, efectos de neón, bloom exagerado ni partículas densas.
- El movimiento puede proporcionar profundidad y continuidad espacial, pero no ser indispensable para entender el estado.
- El contraste de texto y controles tiene prioridad sobre la estética translúcida.
- Navegación por teclado, foco visible, etiquetas textuales y estados distinguibles sin depender exclusivamente del color.
- Presupuesto de rendimiento: el renderizado visual no debe degradar la edición, el desplazamiento ni los flujos de trabajo.

## 9. IA integrada, no ornamental

Un ejemplo resume la dirección: al abrir una función que participa en un fallo, la interfaz puede relacionarla con ejecuciones, pruebas y hallazgos. El usuario puede inspeccionar la evidencia, formular otra hipótesis, corregir junto con la IA o delegar una solución acotada.

El sistema debe informar **qué ocurrió, qué se sabe, qué se infiere y qué falta por comprobar**. Nunca debe convertir una sugerencia del modelo en un hecho demostrado por el mero hecho de presentarla elegantemente.

El panel **Attention** no es un feed de notificaciones: presenta exclusivamente decisiones, errores relevantes o hallazgos que ameritan intervención.

El panel **Agentic Collaboration** ofrece actividad real y opciones pertinentes, sin convertir la pantalla principal en un monitor de logs.

## 10. Restricciones para construir sobre Loom

La filosofía debe aplicarse **sin rehacer innecesariamente el proyecto existente**.

- Inspeccionar primero los componentes, tokens, estilos, estados, adaptadores e integraciones que ya existen.
- Refinar y reutilizar el frontend y la escena Unity existentes; no sustituirlos por otra aplicación o un nuevo framework por comodidad.
- Respetar el stack real del prototipo: **Tauri, TypeScript sin React y Unity** para la experiencia espacial integrada.
- Mantener contratos, navegación, estado, accesibilidad y conexión funcional con Loom.
- No inventar métricas, estados de ejecución ni datos para aparentar capacidades reales.
- No agregar dependencias ni rediseñar la arquitectura completa para realizar cambios visuales puntuales.
- Mantener separadas las decisiones de diseño que todavía requieren validación humana.

La tecnología 3D sirve al objetivo de **profundidad y comprensión**; no es un objetivo por sí misma.

## 11. Antipatrones

Evitar especialmente:

1. **Chatbot con editor adjunto:** AI como accesorio, no como parte del entorno.
2. **AI como protagonista:** agentes dominando la experiencia y reduciendo a la persona a aprobar propuestas.
3. **Minimalismo cosmético:** esconder información crítica para conservar una imagen limpia.
4. **Autonomía opaca:** cambios o decisiones sin límites, evidencia ni capacidad de intervención.
5. **Panelitis:** demasiadas tarjetas, opciones y números simultáneos.
6. **Espectáculo 3D:** efectos intensos sin propósito de interacción.
7. **Interfaz cambiante e impredecible:** adaptación que desorienta a la persona.
8. **Dependencia por diseño:** resolver tareas sin ayudar a comprender cuando la comprensión importa.
9. **Refactor total sin necesidad:** confundir una mejora estética con reconstruir todo el sistema.

## 12. Cómo evaluar una propuesta

Antes de agregar una función o elemento visual, preguntar:

1. ¿Qué objetivo humano facilita?
2. ¿Qué información o esfuerzo innecesario elimina?
3. ¿La persona entiende qué hace la IA y qué no hace?
4. ¿Permite recuperar el control e inspeccionar la evidencia?
5. ¿La misma utilidad se podría conseguir con una interacción más simple?
6. ¿El movimiento o la profundidad añaden orientación real o solo decoración?
7. ¿Funciona en light y dark mode con contraste suficiente?
8. ¿Respeta componentes, estados y contratos existentes?
9. ¿Se puede verificar con interacción real, pruebas y observación?
10. ¿La persona termina más capaz o simplemente más dependiente?

## 13. Manifiesto breve

**Loom debe sentirse como un lugar para pensar, no como una máquina que exige atención.**

La arquitectura hace posible que la inteligencia participe en el trabajo. El diseño asegura que esa participación siga siendo humana en propósito, legible en sus consecuencias y voluntaria en sus límites.

La pantalla tiene espacio. La luz explica la profundidad. La esfera respira, pero no reclama protagonismo. El chat está disponible, pero no gobierna el producto. Los agentes trabajan, pero no sustituyen el juicio. Los detalles aparecen cuando importan. La complejidad no desaparece: se vuelve navegable.

> **Inteligencia en todas partes. Ruido en ninguna. La persona siempre al centro.**

---

## 14. Alcance de esta reconstrucción

Este documento reúne los principios y decisiones expresados durante las conversaciones sobre el IDE de Loom y sus iteraciones visuales. La definición de los objetos fundamentales, la semántica final de la esfera y el alcance preciso de algunas vistas siguen siendo **hipótesis de diseño o decisiones abiertas**, no hechos de implementación. Los tokens de color y estados de animación son propuestas iniciales sujetas a pruebas de usabilidad y verificación en el código.

---

## Open-source components for the benchmark

Files, editors, diffs, tests and terminals are proven — the section above
keeps them as views *inside* work objects. For the benchmark, that means each
one gives an agent something real to act on and the person something real to
inspect: the editor shows the agent's proposed change, the diff view is where
that change is accepted or rejected, the terminal shows the test run, the file
manager shows what changed on disk. Score the agent on the artifact, not on
its narration.

Checked 14 Nov 2026; verify the LICENSE file of each project before adopting
it — licenses and maintenance status below are a snapshot, not a guarantee.

Status: candidates for evaluation, **not approved additions**. The standing
rules for this repo say no new dependencies — installing any of these needs
Eduardo's decision for that specific addition, and each one must arrive as a
view inside a work object, not as a second application. The vault constraint
also applies: the markdown vault stays the shared store behind a store
adapter, so a file component must work over the existing vault/workspace
files, not replace them with its own server.

| Need in the workbench | Project | License | Why it fits / what to watch |
|---|---|---|---|
| Code editor — Code mode is a plain textarea today | Monaco Editor (`microsoft/monaco-editor`, npm `monaco-editor`) | MIT | The VS Code editor as an embeddable library: highlighting, IntelliSense, minimap, workers. First pick for Code mode — one dependency closes two gaps at once: the editor
and the diff-review boundary. Cost: heavy bundle, needs web workers inside Tauri. |
| Lighter code editor | CodeMirror 6 (`codemirror.net`) | MIT | A modular toolkit — assemble only the pieces you need. Smaller and lighter than Monaco; pick this if Monaco's weight hurts the Tauri bundle. |
| File manager — the vault needs a real file view | FileBrowser Quantum (`gtsteffaniak/filebrowser`) | Apache-2.0 | Active fork of FileBrowser: one binary, web UI, users and permissions, share
links. Standalone server, not an embeddable view — useful as a reference and
as a sidecar, not as a pane inside the workbench. **Do not adopt the original
`filebrowser/filebrowser` — archived 2026-09-01, no more security fixes.** |
| File manager an agent can drive | filex (`BRF-Tech/filex`) | MIT | One Go binary, embeds as a `<filex-explorer>` web component, and ships a built-in MCP server an agent can drive — the closest match to "files as objects agents act on" — and the only file
candidate here that is both embeddable as a view and agent-drivable via MCP. |
| File manager over many backends | Filestash (`mickael-kerjean/filestash`) | AGPL-3.0 | One web UI over SFTP, S3, SMB, WebDAV and more, plus MCP and workflows. Copyleft: fine for a non-commercial project, but check what AGPL means before embedding it in anything distributed. |
| Terminal | xterm.js (npm `@xterm/xterm`) | MIT | The terminal VS Code uses: full VT emulation in the browser. Frontend only — it needs a PTY backend (a Tauri shell command or `node-pty`) to run a real
shell; the backend for that would be a Tauri (Rust) command, consistent with
the current backend. |
| Diff review — the trust boundary for agent edits | Monaco diff editor (`createDiffEditor`) | MIT | Side-by-side or inline diff with highlighting and minimap. Comes free with Monaco; this is where an agent's proposed change is accepted or rejected, with evidence attached. |
| Reference implementations to study | Caret (`Fast-Editor/Caret`), Claudette (utensils.io) | MIT, MIT | Tauri 2 + Monaco + xterm agent editors. Caret wires tools through MCP/ACP; Claudette is a Claude Code companion with a full diff viewer. Study how they mount the editor, terminal and diff — do not copy their React frontends (this project is vanilla TypeScript). |

These are components, not new applications: per §10 of the philosophy they
are refined into the existing Tauri / TypeScript / Unity stack — no new
framework, no second app. They also stay separate from the evaluation layer
(promptfoo, Docling and the other workbench additions): these components give
the benchmark something to observe; the eval layer decides what the
observation means.
