# Plan de trabajo restante: Loom IDE (7 x 7 x 7)

**Fecha:** 15 de noviembre de 2026. **Rama:** `tauri-prototype`. **Head revisado:** `faa2338`.
**Autor de la revisión:** Lolo, con cuatro auditorías paralelas de solo lectura (frontend,
Unity/nitidez, backend/Loom, documentos/filosofía). Nada se editó, se commiteó ni se pusheó
durante la revisión.

## Cómo se hizo

Cada auditoría leyó el código real en el portátil y lo contrastó con los documentos:
`UNITY_FIRST_AUDIT.md`, `IDE_CRITIQUE.md`, `FOLD_REPORT.md`,
`DESIGN_IMPLEMENTATION_REPORT.md`, `DESIGN_PROGRESS.md`, `DESIGN_BLOCKERS.md`,
`FOLD_BLOCKERS.md`, `NATIVE_APP_INVENTORY.md`, `QUIET_COMPLEXITY_REFINEMENT.md`,
`01-design-philosophy.md` y el plan de construcción (`Downloads/Beautiful Loom IDE
build plan.html`, 17 secciones).

## Dos correcciones importantes que cambian el plan anterior

1. **Tareas y skills son 100% HTTP.** El plan y el inventario decían que TaskService y
   SkillsImportService eran gRPC-only y que necesitaban una "decisión de transporte".
   Es falso para el Loom actual: `task.proto` tiene 19 anotaciones `google.api.http` y
   `skills_import.proto` tiene 3. Tareas y skills son trabajo puro del IDE, sin cambio
   en Loom y sin decisión de transporte. Solo Judge, graph memory, memory layer, tool
   registry, teleprompter, learning y scheduler son de verdad gRPC-only (0 anotaciones
   HTTP), y para esos la decisión de transporte sigue sin estar registrada en ningún
   sitio.
2. **La borrosidad tiene causa en el código, no es un ajuste olvidado.** El diagnóstico
   completo está en la sección 1. Resumen: el canvas se limita a 1.5x la densidad de
   píxeles (en una pantalla de 2x se renderiza pequeño y se reescala), la cámara se
   aleja 1.69x porque la columna central es estrecha, y el tier High tiene el
   antialiasing a cero. Y lo más serio: la nitidez nunca se midió con un píxel real
   de la ventana de la app (D14); todo lo verificado es geometría o HTTP.

## Cómo leer este plan

- **7 secciones x 7 subsecciones x 7 implementaciones = 343 grupos.** Cada
  implementación es un grupo de features que faltan o no están implementadas, con su
  evidencia y su criterio de aceptación. Un grupo se da por cerrado solo cuando su
  aceptación se cumple con evidencia (captura, test o llamada viva), no cuando el
  código "parece" estar.
- **[verificado]** = el hueco se confirmó en el código, con archivo y línea.
  **[por confirmar]** = necesita una comprobación en vivo (ventana real, servidor
  corriendo, pantalla de Eduardo) antes de afirmar nada.
- **Reglas vigentes mientras se ejecuta este plan:** sin dependencias nuevas sin la
  decisión de Eduardo por ítem; commits locales solamente, el push es una decisión
  aparte; Q2 sigue diferido; la esfera se queda; el vault markdown sigue siendo el
  store compartido detrás del adaptador; estados vacíos honestos, sin datos de
  demostración; cada superficie nueva llega con su test.
- **Orden sugerido:** sección 1 (la borrosidad es lo que Eduardo ve), luego 2 y 7
  (la conexión viva y la verificación, que es lo que impide afirmar que algo está
  hecho), luego 3, 4, 5 y 6.
---

## Decisiones registradas (15 nov 2026)

Las 10 decisiones del plan, decididas por Eduardo una por una el 15 de noviembre
de 2026. Esta sección prevalece sobre los defaults mencionados en los ítems: donde
un ítem diga "decisión pendiente", vale lo registrado aquí.

1. **Monaco** para Code mode, con su visor de diff. CodeMirror queda descartado.
   Desbloquea 5.1.1, 5.1.3, 5.1.4, 5.1.5 y 5.1.6.
2. **promptfoo + Docling** aprobados para empezar el benchmark. El resto de
   componentes (filex, FileBrowser Quantum, xterm.js, Filestash,
   Cognee/Mem0/Graphiti, E2B, Opik, LiteLLM) se decide uno por uno. Desbloquea
   6.6.1 y 6.6.2.
3. **Cliente gRPC en Rust** para el transporte de la Fase 5, con Judge primero.
   Loom no se toca. Desbloquea 4.4.1, 6.1.1 y 6.2.1.
4. **Panel estático "3D no disponible"** para Q2; las vistas no espaciales siguen
   alcanzables. Desbloquea 7.5.2.
5. **Sí, conectar** Loom como servidor MCP al harness, en las dos direcciones, con
   una lista explícita de qué herramientas del PC se exponen. Desbloquea 3.5.2 a
   3.5.7.
6. **Migración completa** del trabajo local a tareas de Loom. El mapeo de intents
   y attention se define antes de migrar, y la migración es explícita, nunca en
   silencio. Desbloquea 4.2.1 a 4.2.4.
7. **Cablear el avatar**. Su concepto de cuenta o perfil se define al implementar.
8. **Ambas superficies de estado con roles definidos**: píldora precisa con texto,
   esfera ambiental con color, un solo estado compartido. Desbloquea 2.6.2.
9. **Añadir el décimo tipo de relación: "blocks"**. Desbloquea 5.5.5.
10. **Workflow streaming primero, luego ABTest**. Desbloquea 4.3.1 y luego 4.4.2.


---

## 1. Nitidez y render 3D

Lo que el plan pedía de belleza está aplicado en lo estructural (HDR, ACES, bloom, rig
de tres puntos, PBR, tiers, SSAO, canaries, contact shadows, clamp DPR). Lo que nunca
se hizo es medir la nitidez: `CheckWorkbench` solo verifica geometría y devuelve
`visualRendering: "not inspected"` (`Tools/CheckWorkbench.cs:70`).

### 1.1 Resolución del canvas y densidad de píxeles

- **1.1.1 Subir el clamp DPR.** [verificado] `public/spatial-player.js:54,64` limita
  `devicePixelRatio` a 1.5. En una pantalla de DPR 2 el backing store es 1.5x los
  píxeles CSS y el navegador lo reescala a 2.0x: un reescalado del 33% que es
  borrosidad pura. Aceptación: en pantalla DPR 2 el backing store es 2x sin
  reescalado, o el recorte de rendimiento que lo impide queda medido y registrado.
- **1.1.2 RenderScale desde el tamaño medido del canvas.** [verificado] Es la
  alternativa que el plan ofrecía ("drive `renderScale` from measured canvas size")
  y no se implementó; el clamp quedó en el tope del rango permitido. Aceptación:
  el renderScale se decide por el tamaño real del canvas, no por un tope fijo.
- **1.1.3 Reducir el pull-back de cámara en columna estrecha.** [verificado]
  `MemoryPalaceController.cs:772`: `framing = Max(1, 1.1 / aspect)`. Con aspect
  ~0.65 la cámara se aleja 1.69x (distancia 11 a ~18.6, FOV 42°, línea 306) y cada
  objeto ocupa ~40% menos píxeles. Aceptación: los objetos ocupan más píxeles sin
  recorte; si el factor 1.1 no se puede bajar, el límite de `CheckWorkbench` (que
  hoy prohíbe recorte a 0.65/1/1.6) se revisa con números.
- **1.1.4 Handler de resize en `spatial-player.js`.** [verificado] No hay handler;
  el aspect debería actualizarse desde el tamaño real del embed al cambiar el
  tamaño de la ventana o del panel. Aceptación: al redimensionar, el aspect y el
  framing se actualizan sin recargar.
- **1.1.5 Verificar qué tier corre en runtime.** [por confirmar] `CheckWorkbench`
  corre en el Editor con `m_CurrentQuality: 1` (Balanced,
  `QualitySettings.asset:7`), no con el tier High que se embarca. Aceptación: la
  verificación de geometría corre con los ajustes de envío.
- **1.1.6 Capturas de la ventana real por bookmark.** [por confirmar] Es la
  aceptación de la Fase 1 del plan y no existe ninguna. Aceptación: capturas reales
  de la app Tauri en cada bookmark, antes y después, guardadas en el repo.
- **1.1.7 p95 por tier en el WebView real.** [por confirmar] El plan pedía perfilado
  con el loop de §8.3 y registro del p95 por tier en el tamaño real del embed.
  Aceptación: p95 registrado para High, Balanced y Low; Low mantiene su tope.

### 1.2 Antialiasing y sombras

- **1.2.1 High con antialiasing 0 a 4.** [verificado]
  `ProjectSettings/QualitySettings.asset:25`: High tiene `antiAliasing: 0`;
  Balanced 2 (línea 79), Low 4 (línea 138): invertido respecto a lo esperable.
  Aceptación: High en 4, sin coste, y la hipótesis queda descartada.
- **1.2.2 Verificar si `QualitySettings.antiAliasing` se honra en WebGL2.**
  [por confirmar] El plan lo exige ("runtime quality switches won't enable/disable
  it") y en URP es posible que el RP asset lo ignore. Aceptación: Development Build
  HDR + MSAA + bloom dentro del WebView de Tauri, con el resultado registrado.
- **1.2.3 MSAA por tier verificado en el build embarcado.** [por confirmar] Los
  assets dicen MSAA 4/2/1 y renderScale 1/0.85/0.75, pero nadie lo verificó en el
  build que se embarca. Aceptación: los valores del build coinciden con los de los
  assets.
- **1.2.4 Coherencia de sombras suaves.** [verificado]
  `m_SoftShadowsSupported: 0` (`Mobile_RPAsset.asset:66`) mientras la key light
  pide `LightShadows.Soft` (`MemoryPalaceController.cs:323`). Aceptación: la
  configuración pedida y la soportada coinciden; las sombras no caen a duras sin
  que nadie lo sepa.
- **1.2.5 Shadow distance de 50 m a pocos metros.** [verificado]
  `Mobile_RPAsset.asset:57`: el mapa de 1024 se estira sobre 50 m y las sombras
  salen blandas o bloqueadas; el plan pedía pocos metros, no el default de 50 m.
  Aceptación: distancia corta con la resolución de 1024 ya verificada.
- **1.2.6 Documentar cascadas y atlas de sombras.** [verificado] 1 cascada y atlas
  de 256 ya están; falta que queden documentados junto a los demás valores de
  render. Aceptación: la tabla de valores de render del repo incluye sombras.
- **1.2.7 Comparar MSAA 2x contra 4x en capturas reales.** [por confirmar]
  Aceptación: la elección queda tomada con números de capturas reales, no por
  intuición.

### 1.3 Bloom, viñeta y atmósfera

- **1.3.1 Bloom con filtrado de alta calidad.** [verificado]
  `MemoryPalaceController.cs:381-385`: threshold 1.05, intensidad 0.45, scatter 0.7,
  `highQualityFiltering = false` (el filtro barato, más blando). Aceptación: el
  filtro de alta calidad activado y la diferencia visible en capturas.
- **1.3.2 Viñeta al extremo bajo del rango en columna estrecha.** [verificado]
  Vignette 0.25 (`MemoryPalaceController.cs:394`), tope del rango 0.2-0.3 del plan;
  el plan advierte que en columna estrecha la viñeta pega más fuerte. Aceptación:
  viñeta reducida y los bordes dejan de perder mordiente.
- **1.3.3 Qué brilla de verdad.** [verificado] El comentario del código dice que
  "solo la esfera" brilla (`MemoryPalaceController.cs:48-49, 491-492`), y es falso:
  `AccentEmission = 1.35f` (línea 51) supera el threshold 1.05 y el material accent
  está en muchas piezas (lomo, cinta, mango, líquido del flask, pantalla del
  laptop). Aceptación: el comentario corregido y la decisión de qué brilla
  registrada (el plan sí quería accents brillando).
- **1.3.4 Volume profiles por tier.** [verificado] Un solo perfil creado en runtime
  (`MemoryPalaceController.cs:375-396`); el bloom es idéntico en Low y "Bloom off
  on Low tier" tampoco está hecho. Aceptación: tres perfiles, uno por tier, con el
  bloom apagado o reducido en Low.
- **1.3.5 Selector de tier en la UI.** [verificado] Los tiers existen pero son
  inalcanzables: cero coincidencias de `quality` en `src/main.ts`; solo se usa
  High. Aceptación: el usuario puede cambiar de tier desde la app.
- **1.3.6 Texturas de 256 px a 512 px.** [verificado] Mapas base y normal generados
  a 256 px (madera, papel, metal; `MemoryPalaceController.cs:531-545`): el mínimo
  del rango permitido por el plan; de cerca se notan. Aceptación: 512 px, o 1K CC0
  si las generadas resultan planas.
- **1.3.7 Tabla PBR en el repo.** [verificado] Los valores por superficie existen
  en el código (metal 0.88/0.72, madera 0.37, vidrio 0.1/0.85, papel 0.25) pero no
  hay tabla en el repo. Aceptación: tabla documentada con los valores por
  superficie.

### 1.4 Vidrio y reflejos

- **1.4.1 Opaque Texture activado en el RP asset embarcado.** [verificado]
  `m_RequireOpaqueTexture: 0` (`Mobile_RPAsset.asset:23`): apagado, así que la
  refracción por Scene Color es imposible tal como está. Aceptación: Opaque
  Texture a 1 en el asset que se embarca.
- **1.4.2 Receta §5.3 del flask: Fresnel, IOR y split front/back.** [verificado]
  Hoy el flask es transparencia plana de una sola malla Lathe con URP/Lit
  Transparent (`LoomGlass.mat:24,28-29,34`; `MemoryPalaceController.cs:627`).
  Aceptación: la receta aplicada o el fallback opaco aplicado con motivo.
- **1.4.3 Decisión receta contra fallback con números.** [por confirmar] El plan
  pedía decidir según si el flask ocupa menos del 10% del ancho, con capturas.
  Nunca se tomó. Aceptación: decisión registrada con los números de la captura.
- **1.4.4 Baked reflection probe con box projection.** [verificado] Cero
  coincidencias de `ReflectionProbe` en el controlador. Aceptación: un probe
  horneado; los metales y el vidrio dejan de leer grises.
- **1.4.5 Light Probe Group: anillo más una por objeto.** [verificado] Cero
  `LightProbe` en el controlador; APV tampoco. Aceptación: grupo colocado, con la
  decisión revisada (los portales orbitan a 12°/s, así que la justificación de
  "solo si los objetos se mueven mucho" merece revisarse).
- **1.4.6 Geometría del flask: de malla única a vidrio con lente.** [verificado]
  La lente sí usa el fallback opaco (smoothness 0.95, metallic 0.05,
  `MemoryPalaceController.cs:558`); el flask no. Aceptación: el flask deja de ser
  una sola malla con transparencia plana.
- **1.4.7 Metales y vidrio grises: verificar con probe.** [por confirmar] Es el
  síntoma exacto de la tabla del plan ("The flask reads as a grey blob";
  "smooth materials read grey-blue from the sky"). Aceptación: en capturas reales
  el metal y el vidrio se distinguen del cielo por defecto.

### 1.5 Texto y etiquetas 3D

- **1.5.1 TextMesh a SDF (TextMeshPro) para las etiquetas.** [verificado]
  `MemoryPalaceController.cs:501-508`: `TextMesh`, `characterSize = 0.07f`,
  `fontSize = 48`, sin distance-field: a la distancia a la que la cámara se aleja,
  las etiquetas se leen pequeñas y blandas. Aceptación: etiquetas SDF nítidas a la
  distancia de la cámara.
- **1.5.2 Tamaño de etiqueta frente a la distancia de cámara.** [verificado]
  Aceptación: el tamaño se decide por la distancia real de la cámara en la columna
  estrecha, no por el valor que se ve bien en el Editor.
- **1.5.3 Legibilidad de etiquetas en ambos temas, en ventana real.** [por
  confirmar] Es D11 sin evidencia de píxeles. Aceptación: etiquetas legibles en
  claro y oscuro, en capturas reales.
- **1.5.4 Panel OnGUI a tamaño real: verificar en ventana real.** [por confirmar]
  La escala `GUI.matrix` ya se quitó y el panel se dibuja a tamaño real
  (`MemoryPalaceController.cs:801-821`), pero nadie lo vio en la ventana real.
  Aceptación: captura real del panel.
- **1.5.5 Contraste de etiquetas sobre el backdrop `#0A0E14`.** [por confirmar]
  Aceptación: contraste medido en capturas reales.
- **1.5.6 Etiquetas bajo movimiento reducido.** [por confirmar] La órbita se pausa
  con hover, selección y movimiento reducido; las etiquetas deben seguir
  legibles. Aceptación: captura con movimiento reducido activado.
- **1.5.7 Capturas de etiquetas en los tres bookmarks.** [por confirmar]
  Aceptación: las tres capturas en el repo.

### 1.6 Iluminación y GI

- **1.6.1 GI horneado: decidir o dejar diferido con motivo.** [verificado] La
  escena se construye en runtime en `Awake`, así que el bake necesita escena
  estática authorada (`Tools/BeautifyBench.cs:5-9`; `DESIGN_PROGRESS.md:67`).
  Aceptación: la decisión queda registrada (hacerlo o diferirlo con el motivo),
  no solo aplazada en silencio.
- **1.6.2 Baked AO.** [verificado] Sustituido por SSAO y contact-shadow decals.
  Aceptación: la sustitución queda registrada y su efecto verificado en capturas.
- **1.6.3 SSAO en el tier Low.** [verificado] El renderer propio de Low no tiene
  SSAO (`Tools/BeautifyBench.cs:75-89`). Aceptación: verificado qué pierde Low y
  si importa.
- **1.6.4 Contact-shadow decals: verificar en ventana real.** [por confirmar]
  Existen (textura radial de 128 px, `MemoryPalaceController.cs:442-476`) y son
  los 6 "physical parts" extra que llevaron el conteo de 148 a 154. Aceptación:
  cada objeto se ve asentado en capturas reales.
- **1.6.5 Three-point rig juzgado por luz, con post off y luego on.** [por
  confirmar] El rig existe (key cálida, fill frío, rim blanco,
  `MemoryPalaceController.cs:316-342`); nadie lo juzgó luz por luz en capturas.
  Aceptación: juicio por luz registrado.
- **1.6.6 Esfera por emisión 2.6x: verificar que no satura en HDR.** [por
  confirmar] Aceptación: la esfera brilla sin quemar los objetos vecinos en
  capturas reales.
- **1.6.7 Backdrop `#0A0E14` en ambos temas.** [por confirmar] Hoy es oscuro fijo;
  la escena no sigue el tema claro del shell. Aceptación: decisión registrada
  (backdrop fijo por diseño, o backdrop por tema) con capturas en ambos temas.

### 1.7 Medición y evidencia (D14)

- **1.7.1 Habilitar el visual feedback local en el portátil.** [por confirmar]
  Es una acción que solo Eduardo puede hacer en la app y es lo que desbloquea
  toda la verificación visual. Aceptación: `screen.look` disponible.
- **1.7.2 Capturas reales por bookmark, antes y después, en el repo.** [por
  confirmar] Aceptación de la Fase 1 del plan. Aceptación: las capturas
  commiteadas.
- **1.7.3 Prueba ciega de materiales.** [por confirmar] Madera, metal, papel y
  vidrio distinguibles sin etiquetas, desde el bookmark frontal. Aceptación: la
  prueba hecha y registrada.
- **1.7.4 Emisión y vidrio sobreviven al build WebGL.** [por confirmar] El canary
  debe comprobarse en el build, no en el Editor. Aceptación: check de canary en el
  build.
- **1.7.5 Tamaño del build WebGL reportado y actualizado.** [verificado] El único
  número en el repo es el de las 16:38 (`spatial.wasm` 35,049,618 bytes); el actual
  es 35,066,162 bytes (23:26). Aceptación: el número actual en el repo en cada
  head.
- **1.7.6 CheckWorkbench con el tier High.** [verificado] Hoy corre en Balanced.
  Aceptación: el self-check corre con los ajustes de envío.
- **1.7.7 Comparar `dist/spatial/Build` contra `public/spatial/Build` en cada
  head.** [por confirmar] La comparación `cmp` quedó como verificación residual
  (el shell se bloqueó en la auditoría). Indicio a favor: el wasm es de las 23:26
  y el head `faa2338` es de las 23:28 y solo toca el self-check. Aceptación: el
  `cmp` hecho y registrado.

---

## 2. Chat, streaming y conexión con Loom

El streaming SSE, el botón Stop, las tarjetas HITL y la vista de traza existen. Lo que
falta es el modelo de conexión alrededor: cancelación con garantías, reconexión
visible, contexto real en el chat y el loop vivo ejercitado en la app.

### 2.1 Streaming

- **2.1.1 Cancelación con garantías.** [verificado] `cancel_loom_stream`
  (`loom_stream.rs:113-120`) solo pone un flag, y el flag solo se revisa arriba del
  bucle de lectura (`loom_stream.rs:275`); con un stream silencioso la cancelación
  puede tardar hasta el timeout de lectura de 310 s (`loom_stream.rs:254`) en
  surtir efecto. Aceptación: Stop cancela en segundos, también con un stream
  silencioso.
- **2.1.2 Cancelar un `request_id` desconocido debe fallar.** [verificado] Hoy
  `cancel_loom_stream` siempre devuelve `Ok(())`, incluso para un `request_id`
  desconocido, así que el frontend no puede saber si canceló algo. Aceptación: el
  error llega al frontend y se muestra.
- **2.1.3 Chunks no-JSON: registrar en vez de descartar en silencio.**
  [verificado] `loom_stream.rs:320-321` los descarta sin rastro. Aceptación: quedan
  en el registro con su contenido.
- **2.1.4 Líneas SSE `event:`, `id:` y `retry:`: manejarlas.** [verificado]
  `loom_stream.rs:330` las ignora. Aceptación: se procesan o su descarte queda
  documentado con motivo.
- **2.1.5 Errores HTTP no-2xx con su cuerpo.** [verificado] Hoy solo devuelven
  `Loom returned HTTP {code}.` con el cuerpo descartado (`loom_stream.rs:300`).
  Aceptación: el mensaje de error del servidor llega al usuario.
- **2.1.6 Reintento y reanudación tras una caída del stream.** [verificado] Hoy no
  hay reintento, ni reconexión, ni reanudación. Aceptación: una caída del stream se
  reintenta con backoff o se muestra como caída, nunca como silencio.
- **2.1.7 Primer token en menos de un segundo en llamada local.** [por confirmar]
  Es la aceptación de la Fase 3 del plan y nunca se midió. Aceptación: medido y
  registrado con el modelo local.

### 2.2 Modelo de conexión

- **2.2.1 Estado "reconnecting" visible.** [verificado] Cero coincidencias de
  `reconnect` en `main.ts`. La aceptación de Fase 3 (matar y reiniciar el servidor
  Loom en mitad de una sesión produce un estado visible de reconexión) no está
  implementada. Aceptación: matar el servidor mid-session muestra "reconnecting",
  no una UI congelada ni un "connected" viejo.
- **2.2.2 Health probe que valide el cuerpo.** [verificado] `get_loom_status`
  (`lib.rs:1125-1132`) hace un probe a `/v1/health` una vez al arrancar con timeout
  de 30 s; cualquier 2xx cuenta como "up" sin importar la forma del cuerpo.
  Aceptación: el probe valida la forma del cuerpo.
- **2.2.3 Re-probe continuo.** [verificado] Hoy solo hay un re-probe de un solo
  disparo tras error de stream (`main.ts:4061`) y un re-check manual al hacer clic
  en la píldora (`main.ts:6228-6229`). Aceptación: el estado de conexión se
  revalida solo, con su intervalo documentado.
- **2.2.4 Dirección de Loom configurable.** [verificado] Hardcodeada
  `127.0.0.1:5006` (`lib.rs:1195`; constante `LOOM_HTTP_URL` en `lib.rs:562`).
  Aceptación: la dirección se configura sin recompilar.
- **2.2.5 Reintento con backoff en `loom_request`.** [verificado]
  `lib.rs:1302-1307`: 180 s de lectura con cuerpo, 4 s para GETs; sin reintento,
  sin backoff, sin auth. Aceptación: los transitorios se reintentan; los
  definitivos se reportan.
- **2.2.6 Tope de respuesta de 16 MB: comportamiento documentado.** [verificado]
  `lib.rs:1211`; los cuerpos chunked se leen hasta EOF (`lib.rs:1230-1232`).
  Aceptación: qué pasa con una respuesta mayor queda documentado y probado.
- **2.2.7 Errores con más contexto.** [verificado] Un no-2xx con JSON reporta solo
  su campo `message` (`lib.rs:1313-1318`); si no, un snippet de 200 caracteres.
  Aceptación: el error que ve el usuario permite entender qué falló.

### 2.3 Sesiones

- **2.3.1 `resolveSessionGap` en la UI.** [verificado] El wrapper existe
  (`api.ts:1241`) pero `main.ts` tiene cero llamadas. Delete (`main.ts:3280`) y
  resume (`main.ts:3299`) sí están cableados. Aceptación: el hueco de sesión se
  resuelve desde la UI.
- **2.3.2 Session subscribe en la UI.** [verificado] El backend existe
  (`session_subscribe`, `lib.rs:2023`; `loom_stream.rs:147-159`) y emite eventos
  `loom-session`, pero cero coincidencias en `src/`. Aceptación: la sesión se
  suscribe y sus eventos llegan a la UI.
- **2.3.3 `switchModel` en la UI.** [verificado] Wrapper (`api.ts:1097`) más un
  test (`api.test.ts:429-430`); sin llamador en `main.ts`. Aceptación: cambiar de
  modelo desde la UI.
- **2.3.4 `getAgent` en la UI.** [verificado] Wrapper (`api.ts:1043`) sin llamador
  localizado en `main.ts`. Aceptación: el detalle de agente se abre desde la UI.
- **2.3.5 Sesiones 9/9 en la UI.** [verificado] El backend tiene las 9; la UI
  tiene 7 (faltan suscripción y cambio de modelo). Aceptación: las 9 accesibles
  desde la UI.
- **2.3.6 Loop vivo end-to-end ejercitado.** [por confirmar] Es la aceptación de
  la Fase 0 del plan (weave a sesión a traza visible en el IDE, con captura) y no
  está cumplida: `FOLD_REPORT.md:47` dice "Loom server not running (health probe
  HTTP 000); no live sync attempted". Aceptación: la traza viva visible en el IDE,
  con captura.
- **2.3.7 View trace: verificar que `GetTrace` existe en el servidor.** [por
  confirmar] `docs/loom-integration.md` (11 nov) dice que no está implementado en
  el servidor; la vista depende de ello (`main.ts:3231`). Aceptación: comprobado en
  vivo antes de darla por hecha.

### 2.4 Contexto del chat

- **2.4.1 Enviar el context pack del vault al chat.** [verificado] `ask_loom`
  (`lib.rs:1690-1745`) y `ask_loom_stream` (`loom_stream.rs:76-109`) envían solo
  `query` más `sessionId`/`agentId` opcionales y `enableTrace: true`. La auditoría
  del 13 nov ya lo decía ("el chat descarta su context pack preparado") y sigue
  igual. Aceptación: el chat envía contexto del vault.
- **2.4.2 Incluir work, intent y política en el contexto.** [verificado]
  Aceptación: el contexto incluye el trabajo y la intención activos.
- **2.4.3 Incluir contenido de archivos relevantes.** [verificado] Aceptación: el
  archivo abierto (o los referenciados) llega al modelo.
- **2.4.4 Chat unario de respaldo cancelable.** [verificado] `ask_loom` es POST
  `/v1/weave` con timeout de 180 s y sin mecanismo de cancelación; si el frontend
  cae al camino unario, el botón Stop no hace nada (`cancelLoomStream` solo
  cancela ids de stream). Aceptación: Stop funciona también en el camino unario.
- **2.4.5 Stop cancela de verdad en el servidor o solo deja de renderizar.**
  [por confirmar] Nadie lo probó en vivo. Aceptación: comprobado en vivo y
  registrado.
- **2.4.6 Clarificaciones aceptadas por el servidor.** [por confirmar] Las
  tarjetas HITL responden por `answer_clarification`; no se verificó en vivo si el
  servidor acepta una aprobación de herramienta por ese endpoint. Aceptación:
  comprobado en vivo.
- **2.4.7 Tool calls en vuelo fieles a lo que el servidor reporta.** [por
  confirmar] Aceptación: lo que se muestra en vuelo coincide con los eventos del
  servidor.

### 2.5 Trazas y observabilidad

- **2.5.1 View trace: vista de spans completa.** [verificado] La vista existe
  (`main.ts:3231`); falta verificarla contra un trace real del servidor (ver
  2.3.7). Aceptación: un trace real se ve completo en la vista.
- **2.5.2 `trace_id` en cada respuesta.** [verificado] Ya existe; falta verificarlo
  en vivo. Aceptación: cada respuesta trae su `trace_id` y su "View trace"
  funciona.
- **2.5.3 Espejar trazas desde Loom al vault.** [verificado]
  `knowledge_sync_from_loom` (`knowledge.rs:1063-1086`) espeja solo sesiones,
  agentes y artefactos; no espeja trazas. Aceptación: las trazas se espejan o su
  ausencia queda documentada con motivo.
- **2.5.4 Traza viva visible en el IDE, con captura.** [por confirmar] Es la
  aceptación de la Fase 0. Aceptación: la captura en el repo.
- **2.5.5 Errores de agente visibles en la UI.** [verificado] La campana jamás
  muestra errores de agente (ver 2.6.3). Aceptación: un error de agente se ve sin
  abrir el log.
- **2.5.6 Logs del servidor accesibles desde el IDE.** [por confirmar] Aceptación:
  existe el acceso o se registra que no hay endpoint para ello.
- **2.5.7 Enlace a Phoenix/observabilidad desde el IDE.** [por confirmar]
  Aceptación: existe el enlace o se registra que no hay.

### 2.6 Salud y estado

- **2.6.1 Ambas superficies con roles definidos.** [verificado] Decidido el 15 nov
  2026: la píldora es el estado preciso con texto y la esfera el estado ambiental
  con color, las dos del mismo estado único. Es la recomendación 2 de la crítica.
  Aceptación: las dos superficies coherentes, sin contradecirse.
- **2.6.2 Píldora y esfera con una sola fuente de verdad.** [verificado]
  `loomState()` (`loom-state.ts:4`) es la derivación única para la esfera y
  `setSphereState` (`main.ts:266-270`) re-renderiza la píldora, pero siguen siendo
  dos superficies sin una única fuente de verdad en la UI. Aceptación: un solo
  estado, dos vistas coherentes.
- **2.6.3 Atención: clarificaciones, permisos, errores y huecos de sesión.**
  [verificado] `get_attention` (`lib.rs:532-556`) deriva los ítems solo de
  experimentos locales con 2 o más brazos terminados y sin decisión. Aceptación: la
  campana muestra lo que Loom expone.
- **2.6.4 Tipo `"finding"` de `AttentionItem`: cablearlo o quitarlo.**
  [verificado] Nunca se produce (`store.rs:51`). Aceptación: se produce o se
  elimina del tipo.
- **2.6.5 Corregir la expectativa de `collaboration.proto`.** [verificado]
  `store.rs:1-5` dice que los pasos de colaboración y los ítems de atención están
  "vacíos hasta que el servidor Loom los exponga", pero `collaboration.proto` no
  tiene ningún servicio: esa expectativa no tiene base en el proto. Aceptación: el
  comentario corregido.
- **2.6.6 Estado "Server reachable" contra "Connected": definir.** [verificado]
  La píldora tiene 4 estados propios (Checking, Connected, Server reachable, Loom
  offline). Aceptación: cada estado tiene su significado documentado.
- **2.6.7 Salud del servidor visible sin abrir otra herramienta.** [por confirmar]
  Aceptación: el estado de cada componente del servidor se ve en el IDE o se
  registra que no hay endpoint.

### 2.7 Robustez

- **2.7.1 Timeouts documentados por operación.** [verificado] Connect 2 s, write
  5 s, lectura 180 s, tope global 1800 s, lectura de stream 310 s. Aceptación: la
  tabla de timeouts documentada en el repo.
- **2.7.2 Autenticación: decidir si hace falta.** [verificado] Hoy no hay auth en
  `loom_request`. Aceptación: decisión registrada.
- **2.7.3 Cuerpos chunked hasta EOF: límite.** [verificado] Aceptación: el límite
  queda documentado y probado.
- **2.7.4 Respuestas mayores de 16 MB.** [verificado] Aceptación: el
  comportamiento queda documentado.
- **2.7.5 Matar el servidor mid-stream: qué ve el usuario.** [por confirmar]
  Aceptación: el estado visible queda registrado (ver 2.2.1).
- **2.7.6 Reiniciar el servidor: la sesión se reanuda o se pierde.** [por
  confirmar] Aceptación: el comportamiento queda registrado.
- **2.7.7 Documentar el modelo de conexión en el repo.** [verificado] Aceptación:
  un documento corto con probe, reintentos, timeouts y estados.

---

## 3. Agentes, MCP y herramientas

El panel de control de agentes, la vista MCP y la shelf de patrones existen. Lo que
falta es probarlos en vivo, completar los wrappers huérfanos, el flujo de permisos y
el lado servidor MCP hacia el harness.

### 3.1 Ciclo de vida de agentes

- **3.1.1 Crear, iniciar, detener, recargar y eliminar desde el IDE, en vivo.**
  [por confirmar] El panel existe (`main.ts:3147-3189`; `api.ts:1214-1221`); nadie
  lo ejercitó contra el servidor vivo. Aceptación: el ciclo completo hecho desde el
  IDE.
- **3.1.2 Weaver describe-to-create, en vivo.** [por confirmar] El flujo existe
  (formulario de revisión JSON); nadie lo probó en vivo. Aceptación: un agente
  descrito en lenguaje natural aterriza en el formulario de revisión antes de
  guardarse.
- **3.1.3 Presets y templates, en vivo.** [por confirmar] Aceptación: un agente se
  crea desde un preset, se inicia, se le pregunta con streaming y se detiene, todo
  desde el IDE (aceptación de la Fase 4).
- **3.1.4 Detalle de agente más allá de la lista.** [verificado] Hoy la vista es
  una lista con controles; falta el detalle (estado, herramientas, sesiones).
  Aceptación: el detalle se abre desde la lista.
- **3.1.5 `getAgent` en la UI.** [verificado] Wrapper (`api.ts:1043`) sin llamador
  en `main.ts`. Aceptación: el detalle usa el wrapper.
- **3.1.6 Errores de agente visibles.** [verificado] Hoy no llegan a la UI (ver
  2.5.5). Aceptación: el error de un agente se ve en su detalle.
- **3.1.7 Agentes que el servidor no conoce: estado vacío honesto.** [por
  confirmar] Aceptación: sin agentes, la vista dice qué falta y cuál es el
  siguiente paso.

### 3.2 Weaver y presets

- **3.2.1 Describe-to-create con revisión humana.** [por confirmar] El formulario
  de revisión existe; falta verificar que nada se guarda sin pasar por él.
  Aceptación: ningún agente se crea sin revisión.
- **3.2.2 Presets del servidor contra presets locales.** [por confirmar]
  Aceptación: queda claro cuáles vienen de Loom y cuáles son locales.
- **3.2.3 Un preset creado en el IDE se guarda en Loom.** [por confirmar]
  Aceptación: el preset persiste en el servidor.
- **3.2.4 Weaver con un agente complejo (varias herramientas).** [por confirmar]
  Aceptación: el flujo aguanta un agente con varias herramientas y permisos.
- **3.2.5 Errores de Weaver visibles.** [por confirmar] Aceptación: si Weaver
  falla, el error se ve con su motivo.
- **3.2.6 Recargar un agente tras cambiar su definición.** [por confirmar]
  Aceptación: el reload aplica la definición nueva.
- **3.2.7 Eliminar un agente con sesiones activas.** [por confirmar] Aceptación:
  el comportamiento queda definido y probado.

### 3.3 MCP cliente

- **3.3.1 Añadir un servidor, health-check y listar sus herramientas, todo desde
  el IDE.** [por confirmar] La vista existe (`main.ts:2815-3135`); es la
  aceptación de la Fase 4 y nadie la hizo en vivo. Aceptación: el flujo completo
  desde el IDE.
- **3.3.2 `getMcpServer` y `updateMcpServer` en la UI.** [verificado] Wrappers
  (`api.ts:1189,1195`) sin llamador. Aceptación: el detalle y la edición de un
  servidor usan los wrappers.
- **3.3.3 Drawer de herramientas por servidor, en vivo.** [por confirmar]
  Aceptación: las herramientas de un servidor se listan desde su drawer.
- **3.3.4 Restart, delete y add-with-test, en vivo.** [por confirmar] Aceptación:
  cada acción probada contra un servidor real.
- **3.3.5 Health check con su resultado visible.** [por confirmar] Aceptación: el
  estado de salud se ve por servidor.
- **3.3.6 Servidor que no responde: estado vacío honesto.** [por confirmar]
  Aceptación: el error se muestra con el siguiente paso.
- **3.3.7 Los 9 RPCs de gestión verificados.** [verificado] Los 9 comandos existen
  (`loom_http.rs:111-266`); falta verificarlos uno por uno en vivo. Aceptación:
  los 9 probados.

### 3.4 MCP Apps

- **3.4.1 Get, Create, Update y Delete de apps.** [verificado] Hoy solo existe
  `apps_list` (`loom_http.rs:403`, `GET /v1/apps`); faltan las otras cuatro
  operaciones (`loom.proto:645-698`). Aceptación: el CRUD completo.
- **3.4.2 `ListComponentTypes`.** [verificado] Falta. Aceptación: los tipos de
  componente se listan.
- **3.4.3 Conversation Viewer y Data Chart primero.** [por confirmar] El plan los
  pedía primeros entre las 4 apps embebidas. Aceptación: las dos visibles en el
  IDE.
- **3.4.4 Las 4 apps embebidas visibles.** [por confirmar] Aceptación: Conversation
  Viewer, Data Chart, Data Quality Dashboard y Explain Plan Visualizer
  accesibles desde el tab Apps.
- **3.4.5 Una app creada desde el IDE.** [por confirmar] Aceptación: crear una app
  y verla listada.
- **3.4.6 Una app eliminada desde el IDE.** [por confirmar] Aceptación: eliminar
  con confirmación.
- **3.4.7 Apps sin servidor: estado vacío honesto.** [por confirmar] Aceptación:
  la vista dice qué falta y cuál es el siguiente paso.

### 3.5 MCP servidor hacia el harness

- **3.5.1 Decisión: conectar `cmd/loom-mcp` al harness.** [verificado] Decidido
  el 15 nov 2026: se conecta, en las dos direcciones. Aceptación: la conexión
  hecha, con la lista explícita de herramientas del PC expuestas.
- **3.5.2 Documentar `cmd/loom-mcp` y sus ~50 herramientas `loom_*`.**
  [verificado] No hay ningún comando, wrapper ni entrada en el IDE. Aceptación:
  el documento existe.
- **3.5.3 El harness puede llamar al menos una herramienta `loom_*`.** [por
  confirmar] Es la aceptación de la Fase 4. Aceptación: la llamada hecha y
  registrada.
- **3.5.4 Loom puede llamar al menos una herramienta del harness.** [por
  confirmar] Es la aceptación de la Fase 4. Aceptación: la llamada hecha a través
  de la configuración de la vista MCP.
- **3.5.5 Configuración del servidor MCP desde la vista MCP.** [verificado]
  Aceptación: el servidor se configura sin editar archivos a mano.
- **3.5.6 Guardas: qué herramientas del harness se exponen y con qué permisos.**
  [verificado] Aceptación: la lista de herramientas expuestas y sus permisos queda
  registrada.
- **3.5.7 Flujo completo harness a Loom y de vuelta.** [por confirmar]
  Aceptación: el flujo hecho y registrado.

### 3.6 Herramientas y permisos

- **3.6.1 `RegisterTool`.** [verificado] Hoy solo existe `list_tools`
  (`lib.rs:1491`, `GET /v1/tools`); falta `RegisterTool`
  (`loom.proto:164-170`). Aceptación: registrar una herramienta desde el IDE.
- **3.6.2 `RequestToolPermission`.** [verificado] Cero coincidencias en todo
  `src-tauri/src/`, pese a que el commit `c5678d0` dice haber añadido
  "tool-permission requests". Aceptación: el RPC existe y se usa.
- **3.6.3 Tool permission flow en la UI.** [verificado] Cero coincidencias de
  `permission` en `main.ts` y `api.ts`. La Fase 4 lo pedía como superficie de
  aprobación de capacidades del agente. Aceptación: pedir permiso se hace desde la
  UI.
- **3.6.4 Detalle de herramienta más allá de la lista.** [verificado] Hoy la
  vista es una lista. Aceptación: el detalle se abre desde la lista.
- **3.6.5 Aprobaciones por el camino correcto.** [por confirmar] Hoy las
  aprobaciones van por clarificaciones (ver 2.4.6) y el proto tiene un RPC
  dedicado. Aceptación: comprobado en vivo cuál camino trata el servidor como
  aprobación.
- **3.6.6 Tool registry: qué herramientas hay y quién las puede usar.** [por
  confirmar] Aceptación: el registro visible en el IDE.
- **3.6.7 Una herramienta registrada por un agente, aprobada por un humano.** [por
  confirmar] Aceptación: el flujo completo hecho en vivo.

### 3.7 HITL y aprobaciones

- **3.7.1 HITL cards: clarificaciones y aprobaciones de herramientas.** [por
  confirmar] Hoy ambas van por el camino de clarificaciones. Aceptación: cada
  tipo de tarjeta usa su camino correcto.
- **3.7.2 El `request_id` del hold como handle.** [verificado] Ya existe; falta
  verificarlo en vivo. Aceptación: el hold se responde por su `request_id`.
- **3.7.3 `answer_clarification` sin inventar el status.** [verificado]
  `loom_stream.rs:227-231` inventa `"answered"` si falta el status. Aceptación:
  el status que falta se reporta como error, no se inventa.
- **3.7.4 Una clarificación mid-turn se responde sin perder el turno.** [por
  confirmar] Es la aceptación de la Fase 3. Aceptación: probado en vivo.
- **3.7.5 Aprobación requiere evidencia: mantener la regla.** [verificado] La
  regla del vault (al menos un edge de evidencia) sigue vigente. Aceptación: la
  regla se cumple en el flujo nuevo.
- **3.7.6 Review con evidencia obligatoria: verificar.** [por confirmar]
  Aceptación: una revisión sin evidencia no se puede aprobar.
- **3.7.7 Stop durante una clarificación pendiente.** [por confirmar] Aceptación:
  el comportamiento queda definido y probado.

---

## 4. Trabajo, tareas y experimentos

La corrección grande de esta revisión vive aquí: TaskService es 100% HTTP (19
anotaciones en `task.proto`), así que las tareas no necesitan decisión de transporte
ni cambio en Loom. El IDE hoy re-implementa el trabajo localmente (`get_work_items`,
`store.rs`, `experiment.rs`) y el tablero kanban de Loom no existe.

### 4.1 Tareas Loom: CRUD

- **4.1.1 Crear, leer, actualizar, eliminar y listar tareas.** [verificado] Cero
  de 19 RPCs conectados: `CreateTask POST /v1/tasks`, `GetTask`, `UpdateTask PATCH
  /v1/tasks/{id}`, `DeleteTask`, `ListTasks` (`task.proto:26-54`). Aceptación: el
  CRUD completo desde el IDE, sin cambio en Loom.
- **4.1.2 Flujo de tarea: Claim, Release, Close, Transition.** [verificado]
  (`task.proto:61-90`). Aceptación: el ciclo de vida completo desde el IDE.
- **4.1.3 Dependencias entre tareas.** [verificado] `AddDependency POST
  /v1/tasks/dependencies`, `RemoveDependency DELETE
  /v1/tasks/dependencies/{from}/{to}` (`task.proto:97-106`). Aceptación: añadir y
  quitar dependencias desde el IDE.
- **4.1.4 Ready y blocked por tablero.** [verificado] `GET
  /v1/boards/{board_id}/ready`, `/v1/boards/{board_id}/blocked`
  (`task.proto:109-116`). Aceptación: el frente de tareas listas y bloqueadas se
  ve por tablero.
- **4.1.5 Tableros: crear, leer y listar.** [verificado] `CreateBoard`, `GetBoard`,
  `ListBoards` (`task.proto:122-136`). Aceptación: el CRUD de tableros desde el
  IDE.
- **4.1.6 `DecomposeTask`: descomposición LLM a DAG de subtareas.** [verificado]
  `POST /v1/tasks:decompose` (`task.proto:141-146`). Aceptación: una tarea se
  descompone en subtareas desde el IDE.
- **4.1.7 `GetTaskContext` por agente.** [verificado] `GET
  /v1/agents/{agent_id}/task-context` (`task.proto:152-154`). Aceptación: el
  contexto de tareas de un agente se ve en su detalle.

### 4.2 Tableros en Work

- **4.2.1 Vista kanban de tableros Loom en Work.** [verificado] No existe ninguna
  vista de tableros. Aceptación: un tablero se ve como kanban en Work.
- **4.2.2 Tareas Loom junto al trabajo local, etiquetadas por fuente.**
  [verificado] Es la aceptación de la Fase 5. Aceptación: Work muestra las tareas
  de Loom junto a los ítems locales, con su fuente marcada.
- **4.2.3 `StreamTaskUpdates` en vivo.** [verificado] `GET
  /v1/boards/{board_id}/updates:stream` (`task.proto:159-161`). Aceptación: el
  tablero se actualiza en vivo sin refrescar.
- **4.2.4 Nada migrado en silencio.** [verificado] La migración completa está
  decidida (ver 4.2.5), pero cada movimiento es explícito: ninguna tarea local se
  mueve a Loom sin una acción explícita. Aceptación: la migración hecha con
  registro de cada movimiento.
- **4.2.5 Decisión de migración: migración completa.** [verificado] Decidido el
  15 nov 2026: todo el trabajo local se mueve a tareas de Loom. Aceptación: la
  decisión registrada y el mapeo de intents y attention definido antes de migrar
  (ver 4.2.4).
- **4.2.6 Filtros por tablero, estado y agente.** [verificado] Aceptación: el
  tablero se filtra sin perder su fuente.
- **4.2.7 Dependencias visibles en el tablero.** [verificado] Aceptación: una
  tarea bloqueada muestra por qué está bloqueada.

### 4.3 Workflows

- **4.3.1 Workflow streaming en la UI.** [verificado] El backend existe
  (`execute_workflow_stream`, `lib.rs:2022`; `loom_stream.rs:125-141`; `POST
  /v1/workflows:stream`) y emite eventos `loom-workflow`, pero cero coincidencias
  en `src/`. Priorizado el 15 nov 2026: primero, antes que ABTest. Aceptación: la
  ejecución de un workflow se ve en vivo.
- **4.3.2 Scheduling UI.** [verificado] El backend tiene 7 de 10 comandos
  (`lib.rs:2041-2047`); ninguno tiene UI (cero coincidencias de
  `workflow_schedule` en `src/api.ts` y `src/`). Aceptación: la vista de horarios
  existe.
- **4.3.3 Pause de schedules (backend).** [verificado] Falta `POST
  /v1/workflows/schedules/{id}:pause` (`loom.proto:443-448`). Aceptación: pausar
  un horario desde el backend.
- **4.3.4 Resume de schedules (backend).** [verificado] Falta `POST
  /v1/workflows/schedules/{id}:resume` (`loom.proto:453`). Aceptación: reanudar
  un horario desde el backend.
- **4.3.5 `CancelScheduledExecution` (backend).** [verificado] Falta (después de
  `loom.proto:463`): cancela una ejecución en vuelo, distinto de pausar.
  Aceptación: cancelar una ejecución en vuelo desde el backend.
- **4.3.6 Listar, crear, editar, eliminar, disparar e historial de schedules en
  la UI, con sus templates.** [verificado] `listWorkflowTemplates` es un wrapper
  (`api.ts:1221`) sin llamador. Aceptación: las 7 operaciones y los templates
  desde la vista.
- **4.3.7 Una ejecución programada se dispara y su historial se ve.** [por
  confirmar] Aceptación: el flujo completo hecho en vivo.

### 4.4 Experimentos y Judge

- **4.4.1 Judge scoring dentro de Experiments.** [verificado] Cero RPCs:
  `judge.proto` tiene 0 anotaciones HTTP (gRPC-only). El plan §14.5 lo pedía y
  la aceptación de la Fase 5 no se cumple. Aceptación: una corrida muestra un
  judge score producido por JudgeService.
- **4.4.2 ABTest junto a los brazos locales.** [verificado] El backend existe
  (`provider_abtest`, `lib.rs:2024`; `loom_stream.rs:165-200`; `POST
  /v1/providers:abtest`, streaming; el proto lo confirma:
  `rpc ABTest(...) returns (stream ABTestEvent)`, `loom.proto:290-295`), pero
  cero coincidencias en `src/`. Priorizado el 15 nov 2026: después del workflow
  streaming. Aceptación: el ABTest se ve junto a los brazos locales de
  Experiments.
- **4.4.3 Decisión de transporte: cliente gRPC en Rust.** [verificado] Decidido el
  15 nov 2026: cliente gRPC (tonic) en el backend del IDE; Loom no se toca.
  Aceptación: la decisión registrada y aplicada en 4.4.1, 6.1.1 y 6.2.1.
- **4.4.4 Judge por el cliente gRPC.** [verificado] La recomendación del plan
  (Judge como bindings) quedó sustituida por la decisión del 15 nov 2026: Judge
  llega por el cliente gRPC en Rust. Aceptación: Judge conectado por gRPC.
- **4.4.5 Brazos locales contra brazos Loom: comparar.** [verificado] Aceptación:
  la comparación se ve en la misma vista.
- **4.4.6 Judge score reproducible desde el trace.** [por confirmar] Es la
  aceptación de la Fase 5. Aceptación: el score se reproduce desde el trace de la
  corrida.
- **4.4.7 Judge en vivo: el score llega al experimento.** [por confirmar]
  Aceptación: probado en vivo contra el servidor.

### 4.5 Trabajo local

- **4.5.1 Trabajo local y tareas Loom no se mezclan en el modelo de datos.**
  [verificado] Aceptación: cada sistema guarda lo suyo; la vista los muestra
  juntos sin fusionar los modelos.
- **4.5.2 Intents y attention locales: sin contraparte Loom (documentado).**
  [verificado] Aceptación: queda documentado que no hay contraparte.
- **4.5.3 Experimentos locales: attention por brazos sin decisión.** [verificado]
  Ya existe (`get_attention`, `lib.rs:532-556`). Aceptación: verificado en vivo.
- **4.5.4 Decisión de experimento registrada.** [verificado] Aceptación: una
  decisión se registra desde la vista.
- **4.5.5 Exportar un experimento a Loom.** [por confirmar] No consta que exista.
  Aceptación: existe o se registra que no hay endpoint.
- **4.5.6 Historial de experimentos.** [por confirmar] Aceptación: el historial
  se ve.
- **4.5.7 Comparación entre corridas.** [por confirmar] Aceptación: dos corridas
  se comparan en la vista.

### 4.6 Sincronización vault a Loom

- **4.6.1 Espejar patrones.** [verificado] `knowledge_sync_from_loom`
  (`knowledge.rs:1063-1086`) no espeja patrones. Aceptación: los patrones se
  espejan o su ausencia queda documentada.
- **4.6.2 Espejar trazas.** [verificado] No se espejan. Aceptación: las trazas se
  espejan o su ausencia queda documentada.
- **4.6.3 Espejar workflows y ejecuciones.** [verificado] No se espejan.
  Aceptación: se espejan o su ausencia queda documentada.
- **4.6.4 Espejar modelos y proveedores.** [verificado] No se espejan.
  Aceptación: se espejan o su ausencia queda documentada.
- **4.6.5 Sincronización automática o manual documentada.** [verificado] Hoy es
  manual. Aceptación: la decisión (manual o automática) queda registrada con su
  motivo.
- **4.6.6 Sentido inverso vault a Loom: decidir si existe.** [verificado] Hoy es
  unidireccional (nunca vault a Loom). Aceptación: la decisión registrada.
- **4.6.7 Límites de la sincronización (500 sesiones, 200 artefactos).**
  [verificado] Aceptación: qué pasa al superar los límites queda documentado.

### 4.7 Servidor y administración

- **4.7.1 `GetTLSStatus`.** [verificado] Falta (`loom.proto:194-197`).
  Aceptación: el estado TLS se ve desde el IDE.
- **4.7.2 `RenewCertificate`.** [verificado] Falta (`loom.proto:199`).
  Aceptación: renovar el certificado desde el IDE.
- **4.7.3 `RunMigration`.** [verificado] Falta (`loom.proto:214`). Aceptación:
  correr una migración desde el IDE.
- **4.7.4 Config y storage, en vivo.** [verificado] Ya conectados
  (`lib.rs:1671,1681`); falta verificarlos en vivo. Aceptación: probados en vivo.
- **4.7.5 Estado del servidor visible en el IDE.** [por confirmar] Aceptación: el
  estado de cada componente se ve o se registra que no hay endpoint.
- **4.7.6 Migraciones: quién las corre y cuándo.** [por confirmar] Aceptación: el
  flujo documentado.
- **4.7.7 AdminService: confirmado fuera de alcance.** [verificado] El plan dice
  que es solo-admin y aceptable omitirlo. Aceptación: la omisión queda registrada
  con su motivo.

---

## 5. Conocimiento, vault y archivos

El watcher de 3 s, los layouts durables y el editor de notas en Tauri existen. Lo que
falta es Monaco, la terminal, el explorador de archivos, el watcher alimentando al
bench Unity y la limpieza del código muerto del frontend.

### 5.1 Monaco y Code mode

- **5.1.1 Monaco en Code mode.** [verificado] Cero coincidencias de `Monaco` en
  `main.ts`; `index.html:158` sigue siendo `<textarea id="code-editor">`.
  Aceptación: Monaco abierto en Code mode con resaltado.
- **5.1.2 Decisión: Monaco.** [verificado] Decidido el 15 nov 2026: Monaco (MIT).
  CodeMirror 6 queda descartado. Aceptación: la decisión registrada y aplicada en
  5.1.1.
- **5.1.3 Resaltado y autocompletado básico.** [verificado] Aceptación: el editor
  resalta el lenguaje del archivo abierto.
- **5.1.4 Vista de diff para cambios propuestos por agentes.** [verificado] No
  existe visor de diff (las únicas coincidencias de `diff` en `main.ts` son
  diferencia de tiempo y prosa). El plan lo pedía como frontera de confianza.
  Aceptación: un cambio propuesto se revisa en diff antes de aplicarse.
- **5.1.5 Diff de Monaco (`createDiffEditor`).** [verificado] Una dependencia
  cierra dos huecos (editor y diff). Aceptación: el diff usa el editor elegido.
- **5.1.6 Tamaño del bundle registrado.** [verificado] Aceptación: el tamaño del
  bundle JS queda registrado en el reporte de la implementación.
- **5.1.7 Editar, guardar y preguntar a Loom con Monaco.** [por confirmar] La
  vista Code ya tiene árbol de archivos funcional (crear carpeta y archivo,
  refrescar, guardar, "Ask Loom about this", `index.html:126-164`); falta el
  editor en sí. Aceptación: el flujo completo con Monaco.

### 5.2 Terminal

- **5.2.1 Terminal embebida (xterm.js).** [verificado] Cero coincidencias de
  `xterm|terminal` en `main.ts`; ningún elemento terminal en `index.html`.
  Aceptación: la terminal abierta en el IDE.
- **5.2.2 Decisión por dependencia (xterm.js MIT).** [verificado] Aceptación: la
  decisión registrada.
- **5.2.3 Backend PTY (comando Tauri/Rust).** [verificado] xterm.js es solo
  frontend; necesita un backend PTY. Aceptación: el PTY funciona desde el IDE.
- **5.2.4 Terminal como vista dentro de un objeto de trabajo.** [verificado] No
  es una segunda app: cada superficie llega como vista dentro de un objeto de
  trabajo. Aceptación: la terminal vive dentro de Work.
- **5.2.5 Comandos, salida y scrollback.** [por confirmar] Aceptación: la
  terminal ejecuta, muestra y conserva la salida.
- **5.2.6 Seguridad: qué puede ejecutar la terminal.** [verificado] Aceptación:
  los permisos de la terminal quedan registrados.
- **5.2.7 Integración con el chat.** [por confirmar] Aceptación: pedir a Loom que
  corra algo llega a la terminal.

### 5.3 Explorador de archivos

- **5.3.1 Decisión: filex, FileBrowser Quantum o Filestash.** [verificado] Los
  tres son candidatos en `01-design-philosophy.md` (filex MIT, embebible y con
  MCP; FileBrowser Quantum Apache-2.0, servidor standalone; Filestash AGPL-3.0).
  Aceptación: la decisión registrada.
- **5.3.2 Explorador como vista dentro de un objeto de trabajo.** [verificado]
  Aceptación: el explorador vive dentro de Work, no como segunda app.
- **5.3.3 Operaciones: crear, mover, renombrar y eliminar con confirmación.**
  [verificado] Aceptación: cada operación con su confirmación.
- **5.3.4 El vault sigue siendo el store compartido detrás del adaptador.**
  [verificado] Aceptación: el explorador no crea un segundo store.
- **5.3.5 El explorador no duplica el árbol de archivos de Code mode.**
  [verificado] Aceptación: un solo árbol, dos vistas coherentes.
- **5.3.6 MCP: el agente maneja archivos vía el explorador.** [por confirmar]
  Aceptación: filex (o el elegido) expone sus operaciones por MCP.
- **5.3.7 Permisos: qué carpetas puede tocar.** [verificado] Aceptación: las
  carpetas permitidas quedan registradas.

### 5.4 Vault: watcher y sincronización

- **5.4.1 El watcher alimenta al bench Unity.** [verificado] El watcher
  (`knowledge.ts:100-109`) detecta cambios externos cada 3 s y llama solo a
  `refresh()`, que recarga la superficie DOM de Knowledge; `knowledge.ts` tiene
  cero referencias a Unity. Aceptación: un cambio externo actualiza el bench.
- **5.4.2 Contadores del bench actualizados por ediciones externas.** [verificado]
  `refreshSpatialVault()` (`main.ts:216-218`) empuja contadores al bench vía
  `notifySpatialVaultChanged` (`spatial.ts:49-52`), pero solo tiene 2 llamadores
  (`main.ts:5304, 6006`, mutaciones locales). Aceptación: las ediciones externas
  actualizan los contadores.
- **5.4.3 Editar en disco y verlo en el bench sin refrescar.** [por confirmar]
  Aceptación: la ronda completa hecha en vivo.
- **5.4.4 Conflictos: edición externa contra borrador abierto.** [verificado]
  Hoy los borradores y diálogos abiertos siempre ganan. Aceptación: el
  comportamiento verificado en vivo.
- **5.4.5 Polling de 3 s contra watcher de filesystem.** [verificado] Hoy es
  polling por firma, no watcher de filesystem; el comportamiento pedido se cumple.
  Aceptación: la decisión (quedarse con polling o cambiar) registrada.
- **5.4.6 Firma: qué la cambia.** [verificado] Conteo de notas y pendientes más
  el mtime más reciente (`knowledge_signature`). Aceptación: la definición
  documentada.
- **5.4.7 Rendimiento del polling con un vault grande.** [por confirmar]
  Aceptación: medido con el vault real.

### 5.5 Vault: edición y revisión

- **5.5.1 Editor de notas en Tauri, en vivo.** [por confirmar] La edición vive en
  Tauri desde el pase del plan; falta verificarla en vivo. Aceptación: crear y
  editar una nota en Tauri.
- **5.5.2 OnGUI degradado a navegación: verificar que no queda edición en Unity.**
  [verificado] `OnGUI` sigue existiendo (`MemoryPalaceController.cs:801`), pero
  como tarjeta de navegación, no como editor; el puente de memoria espacial se
  retiró (`61373a7`). Aceptación: ninguna edición ocurre en Unity.
- **5.5.3 Revisión con evidencia obligatoria.** [verificado] La regla sigue
  vigente (al menos un edge de evidencia para aprobar). Aceptación: verificada en
  vivo.
- **5.5.4 Archival de notas: verificar "Show archived".** [verificado] El
  archival existe (status `archived`, archivo preservado, versiones y auditoría
  retenidas); falta verificarlo en la UI. Aceptación: archivar y ver archivadas.
- **5.5.5 Décimo tipo de relación: "blocks".** [verificado] Decidido el 15 nov
  2026: se añade "blocks" (bloquea). El miscount original queda corregido (eran
  nueve). Aceptación: los diez tipos definidos en `RELATIONS`.
- **5.5.6 Crear, editar, archivar y ver archivadas.** [por confirmar]
  Aceptación: el ciclo completo hecho en vivo.
- **5.5.7 Notas propuestas por agentes solo como "proposed".** [por confirmar]
  Aceptación: un agente no crea notas activas sin revisión.

### 5.6 Knowledge: vistas y layouts

- **5.6.1 Graph y Canvas en un solo panel con toggle.** [verificado] Ya hecho
  (`index.html:331-339`); falta verificarlo en vivo. Aceptación: el toggle cambia
  de vista sin perder el estado.
- **5.6.2 Layouts durables entre reinicios.** [verificado] Las posiciones persisten
  en el app data dir (`lib.rs:2001-2002`; `knowledge_canvas_layout_save/load`);
  falta verificarlas tras reiniciar. Aceptación: las posiciones sobreviven a un
  reinicio.
- **5.6.3 Tres estanterías: Vault, Patterns y Skills, Graph Memory.** [verificado]
  Es la aceptación de la Fase 5; hoy solo hay Vault y Patterns. Aceptación: las
  tres estanterías visibles, sin un cuarto sistema y sin modelo fusionado.
- **5.6.4 Estado vacío de Patterns con su siguiente paso.** [verificado]
  `knowledge.ts:188`: "No patterns reported by Loom." es el único estado vacío
  nuevo de las Fases 3-5 que no nombra el siguiente paso (el error de la misma
  vista, `:183`, sí dice "Start the Loom server and refresh"). Aceptación: el
  estado vacío nombra el siguiente paso.
- **5.6.5 Búsqueda: tres inputs, unificar o dejar por ámbito.** [verificado]
  `#search-input` (`index.html:64`), `#knowledge-search-slot` (`:211`),
  `#artifact-search` (`:226`): ámbitos distintos, tres mecánicas separadas.
  Aceptación: la decisión registrada.
- **5.6.6 Notes, Review y Activity: completar lo que falte.** [por confirmar]
  Aceptación: cada pestaña hace lo que promete.
- **5.6.7 El graph de Knowledge es el del vault, no la memoria de grafo de Loom.**
  [verificado] Cero coincidencias de `Graph Memory` en `main.ts`. Aceptación:
  queda claro en la UI cuál graph se está viendo (ver 6.1).

### 5.7 Duplicados y código muerto del frontend

- **5.7.1 `sphere.ts` muerto (260 líneas): eliminar o resucitar con decisión.**
  [verificado] La clase `Sphere` (esfera canvas 2D) nunca se instancia: cero
  coincidencias de `new Sphere` en los 17 archivos de `src/`; `main.ts:107` y
  `spatial.ts:1` solo importan el tipo `SphereState`. La esfera viva es la de
  Unity. Aceptación: el archivo eliminado o resucitado con una decisión.
- **5.7.2 `TINTS` sin el ámbar de "awaiting approval".** [verificado]
  `sphere.ts:18-27`: `attention` es crema cálido (`250,238,214`), no el ámbar
  decidido. Relevante solo si se resucita la clase. Aceptación: corregido si se
  resucita.
- **5.7.3 Avatar decorativo: cablearlo.** [verificado] Decidido el 15 nov 2026:
  se cablea. `index.html:40`: `<span class="avatar" title="You">`; cero
  coincidencias de `avatar` en `main.ts` (sin handler); solo CSS. Es la
  recomendación 1 de la crítica. Aceptación: cableado, con su concepto de cuenta
  o perfil definido.
- **5.7.4 Dos significados de "experiment": documentar o fusionar.**
  [verificado] Registros JSON contra notas kind `experiment` en el vault; persiste
  por decisión, sin fusionar. Aceptación: la decisión documentada en la UI o en el
  repo.
- **5.7.5 "Intent en dos lugares": verificar que está resuelto.** [verificado] El
  auditor del frontend dice que sí (un solo editor dentro de `#intent-header`,
  `main.ts:499-514`); la crítica §2 dice que no. Aceptación: verificado y la
  crítica corregida.
- **5.7.6 Un solo New-experiment y un solo new-work-submit.** [verificado] Ya
  verificados (D1, D2). Aceptación: se mantienen así en cada pase.
- **5.7.7 Sin "Create work" ni "Spatial Workbench" residuales.** [verificado]
  Cero coincidencias. Aceptación: se mantienen en cero en cada pase.

---

## 6. Memoria, patrones y skills

El vault markdown y la memoria de Loom son dos sistemas que nunca se encuentran. Los
patrones están a 4 de 5 (falta el stream). Las skills son 100% HTTP y no necesitan
ninguna decisión de transporte: son trabajo puro del IDE. Y el juez, que Eduardo pidió
aparte, tiene aquí su sección.

### 6.1 Graph memory (gRPC-only)

- **6.1.1 Decisión de transporte: cliente gRPC.** [verificado]
  `graph_memory.proto` tiene 0 anotaciones HTTP: es gRPC-only de verdad y llega
  por el cliente gRPC decidido el 15 nov 2026 (ver 4.4.3). Aceptación: la decisión
  registrada y aplicada.
- **6.1.2 Visor de graph memory en Knowledge.** [verificado] Cero RPCs
  conectados. Aceptación: entidades, relaciones y recall visibles en Knowledge.
- **6.1.3 Escritura después; forget detrás de confirmación explícita.**
  [verificado] Aceptación: escribir llega después de leer; olvidar exige
  confirmación.
- **6.1.4 Vault markdown contra graph memory: dos sistemas, sin modelo
  fusionado.** [verificado] Aceptación: la vista los muestra separados, sin
  mezclar los datos.
- **6.1.5 Recall desde el IDE.** [por confirmar] Aceptación: una consulta de
  recall devuelve sus resultados en la vista.
- **6.1.6 Entidades y relaciones visibles.** [por confirmar] Aceptación: el grafo
  se navega.
- **6.1.7 Decisión: qué se escribe en el grafo y qué queda en el vault.**
  [verificado] Aceptación: la regla registrada.

### 6.2 Memory layer

- **6.2.1 MemoryLayerService (5 RPCs, gRPC-only): conectar por el cliente gRPC.**
  [verificado] `memory.proto` tiene 0 anotaciones HTTP; llega por el cliente gRPC
  decidido el 15 nov 2026 (ver 4.4.3). Aceptación: la decisión registrada.
- **6.2.2 Memoria de agente visible en el IDE.** [verificado] El experimento de
  memoria (59% contra 40%, +19 puntos, p=0.03) no se ve en el IDE. Aceptación: el
  resultado y sus trazas se ven.
- **6.2.3 Qué memoria expone Loom hoy.** [por confirmar] Aceptación: el inventario
  de la memoria expuesta queda registrado.
- **6.2.4 Decisión: memoria local contra memoria Loom.** [verificado]
  Aceptación: la regla registrada.
- **6.2.5 Recall en el chat.** [por confirmar] Aceptación: el chat usa la memoria
  para responder.
- **6.2.6 Olvido (forget) con confirmación.** [por confirmar] Aceptación: olvidar
  exige confirmación explícita.
- **6.2.7 Documentar el modelo de memoria en el repo.** [verificado] Aceptación:
  el documento existe.

### 6.3 Patrones

- **6.3.1 `StreamPatternUpdates`.** [verificado] 4 de 5 RPCs conectados
  (list/get/create/load, `loom_http.rs:367-391`); falta `StreamPatternUpdates GET
  /v1/patterns:stream` (`loom.proto:85`). Aceptación: la shelf recibe
  actualizaciones en vivo.
- **6.3.2 `createPattern` y `loadPatterns` en la UI.** [verificado] Wrappers
  (`api.ts:1227,1229`) sin llamador; solo `listPatterns` y `getPattern` se usan
  (desde `knowledge.ts:180,209`). Aceptación: crear y cargar patrones desde la UI.
- **6.3.3 Patterns shelf con datos vivos de Loom.** [por confirmar] Aceptación:
  la shelf muestra los patrones del servidor.
- **6.3.4 Crear un patrón desde el IDE.** [por confirmar] Aceptación: el patrón
  creado se ve en la shelf.
- **6.3.5 Cargar un patrón en un agente.** [por confirmar] Aceptación: el patrón
  cargado afecta al agente.
- **6.3.6 158 patrones, 16 dominios: navegables.** [por confirmar] Aceptación: los
  patrones se navegan por dominio.
- **6.3.7 Patrones sin Loom corriendo: estado vacío honesto.** [por confirmar]
  Aceptación: la vista dice qué falta y cuál es el siguiente paso (ver 5.6.4).

### 6.4 Skills (100% HTTP, sin decisión de transporte)

- **6.4.1 `BulkImportSkills`.** [verificado] `POST /v1/skills:bulkImport`
  (`skills_import.proto:52-57`), respuesta en stream. Cero RPCs conectados.
  Aceptación: importar skills en lote desde el IDE.
- **6.4.2 `AddSkill`.** [verificado] `POST /v1/skills`
  (`skills_import.proto:72-77`). Aceptación: añadir una skill desde el IDE.
- **6.4.3 `ClassifySkill`.** [verificado] `POST /v1/skills/{skill_name}:classify`
  (`skills_import.proto:92-97`). Aceptación: clasificar una skill desde el IDE.
- **6.4.4 Vista de skills en el IDE.** [verificado] Cero coincidencias de `skill`
  en `main.ts` y `api.ts`. Aceptación: la vista existe.
- **6.4.5 Skills read-only primero.** [verificado] Es lo que pedía la Fase 5.
  Aceptación: la vista de lectura existe antes que la escritura.
- **6.4.6 Catálogo de skills de Loom y vault: que se encuentren.** [verificado]
  Hoy nunca se encuentran. Aceptación: la vista muestra ambos sin fusionarlos.
- **6.4.7 Una skill importada se ve en el IDE.** [por confirmar] Aceptación:
  probado en vivo.

### 6.5 Comunicación tri-modal y Lua (backlog)

- **6.5.1 Bus pub/sub (5 RPCs): documentar o conectar.** [verificado] El plan
  §12 lo lista; no hay ningún comando ni UI. Aceptación: documentado o
  conectado.
- **6.5.2 Unicast (2 RPCs).** [verificado] Aceptación: documentado o conectado.
- **6.5.3 Shared memory (6 RPCs).** [verificado] Aceptación: documentado o
  conectado.
- **6.5.4 Lua (4 RPCs): superficie de scripts.** [verificado] Aceptación:
  documentado o conectado.
- **6.5.5 Decisión: cada uno espera un caso de uso nombrado.** [verificado] El
  plan §14.5 los marca como backlog ("list-don't-build"). Aceptación: cada uno
  tiene su caso de uso o sigue en backlog con motivo.
- **6.5.6 Teleprompter, Learning y Scheduler UIs: backlog explícito.** [verificado]
  Son gRPC-only y el plan los deja para después. Aceptación: el backlog registrado.
- **6.5.7 El backlog registrado, no olvidado.** [verificado] Aceptación: el
  backlog vive en un documento, no en la memoria de nadie.

### 6.6 Evaluación y benchmark (componentes open source)

- **6.6.1 promptfoo: evaluación de prompts.** [verificado] Aprobado el 15 nov 2026
  (MIT). Aceptación: adoptado y en uso.
- **6.6.2 Docling: PDF a Markdown al vault.** [verificado] Aprobado el 15 nov 2026
  (MIT). Aceptación: adoptado; los archivos no confiables se procesan en sandbox
  (28 avisos de seguridad entre junio y octubre de 2026).
- **6.6.3 Cognee contra Mem0 contra Graphiti: elegir UNO.** [verificado]
  Decisión por dependencia (memoria y grafo de conocimiento). Aceptación: uno
  elegido con motivo.
- **6.6.4 E2B: sandboxes para agentes.** [verificado] Aceptación: la decisión
  registrada.
- **6.6.5 Opik: tracing y eval junto a Phoenix.** [verificado] No reemplaza a
  Phoenix. Aceptación: la decisión registrada.
- **6.6.6 LiteLLM: gateway de proveedores y costos.** [verificado] Aceptación: la
  decisión registrada.
- **6.6.7 A2A, ACP, Temporal y Presidio: priorizar o descartar con motivo.**
  [verificado] Aceptación: cada uno priorizado o descartado con su motivo.

### 6.7 El juez

- **6.7.1 Plantilla del juez.** [verificado] Ya escrita en
  `~/workspace/judge/JUDGE_PROMPT_TEMPLATE.md`: de tarea en palabras de Eduardo a
  prompt completo para OpenCode. Aceptación: la plantilla en el portátil.
- **6.7.2 Corredor `run-judge.sh`: instalar en el portátil.** [verificado]
  Borrador en `~/workspace/judge/run-judge.sh` (tarea a prompt a `opencode run` a
  verificación a veredicto). Aceptación: instalado en `/home/ed/judge/`.
- **6.7.3 Prueba headless: `opencode --version` y una pasada corta.** [por
  confirmar] Aceptación: la pasada corta hecha y su veredicto leído.
- **6.7.4 Veredictos: dónde viven y quién los lee.** [verificado] Los veredictos
  quedan en `/home/ed/judge/verdicts/`; Lolo los lee y los reporta. Aceptación: el
  flujo documentado.
- **6.7.5 Cola de tareas del juez: este plan 7x7x7 como primera cola.**
  [verificado] Aceptación: los 343 grupos convertidos en tareas, una por pasada.
- **6.7.6 Regla: el juez no aprueba dependencias ni empuja a GitHub.** [verificado]
  Aceptación: la regla en la plantilla.
- **6.7.7 Primera pasada real del juez sobre un ítem del plan.** [por confirmar]
  Aceptación: el primer veredicto leído por Eduardo.

---

## 7. Calidad, verificación y entrega

El hallazgo más serio de la revisión vive aquí: las pruebas no crecieron con unas
2.000 líneas nuevas (vitest sigue en 60/60, Rust en 90 pasados y 2 ignorados), el loop
vivo nunca se ejercitó, no hay evidencia de píxeles (D14) y varios documentos afirman
cosas falsas. Sin esta sección, ninguna otra se puede dar por hecha.

### 7.1 Tests

- **7.1.1 Tests UI para streaming, MCP, agentes y patrones.** [verificado]
  `api.test.ts` tiene cero coincidencias de `stream|mcp|pattern|weaver`: ninguna
  prueba cubre las superficies nuevas. Aceptación: cada superficie nueva tiene su
  test.
- **7.1.2 Vitest: crecer con el código.** [verificado] Sigue en 60/60, igual que
  a las 21:38, pese a las superficies nuevas. Aceptación: el número crece con cada
  superficie.
- **7.1.3 Rust: tests para `loom_http` y `loom_stream`.** [verificado] Hoy solo
  hay cobertura a nivel de parseo. Aceptación: los módulos nuevos tienen sus
  tests.
- **7.1.4 Tests para el watcher (3 s) y los layouts durables.** [verificado]
  Aceptación: el watcher y la persistencia probados.
- **7.1.5 Tests para la cancelación de streams.** [verificado] Aceptación: la
  cancelación probada, incluido el stream silencioso (ver 2.1.1).
- **7.1.6 Cobertura por superficie nueva.** [verificado] Aceptación: cada
  superficie nueva reporta su cobertura.
- **7.1.7 Regla: ninguna superficie nueva sin test.** [verificado] Aceptación: la
  regla en AGENTS.md.

### 7.2 D14 y evidencia visual

- **7.2.1 Habilitar el visual feedback local.** [por confirmar] Ver 1.7.1.
  Aceptación: `screen.look` disponible.
- **7.2.2 Capturas reales por bookmark.** [por confirmar] Ver 1.7.2. Aceptación:
  las capturas en el repo.
- **7.2.3 Seis objetos separables con post off.** [por confirmar] Es la
  aceptación de la Fase 1. Aceptación: los seis separables por luminancia o tono
  en el bookmark frontal.
- **7.2.4 La esfera brilla; las páginas del notebook no.** [por confirmar] Es la
  aceptación de la Fase 1. Aceptación: comprobado en capturas reales.
- **7.2.5 Emisión y vidrio sobreviven al build.** [por confirmar] Es la
  aceptación de la Fase 1. Aceptación: check de canary en el build.
- **7.2.6 Legibilidad de etiquetas en ventana real.** [por confirmar] Ver 1.5.3.
  Aceptación: capturas reales.
- **7.2.7 Ambos temas en ventana real.** [por confirmar] Ver 1.6.7. Aceptación:
  capturas en claro y oscuro.

### 7.3 Documentos al día

- **7.3.1 `FOLD_REPORT.md`: corregir.** [verificado] Afirmaciones falsas u
  obsoletas: head `0dface2` (hoy `faa2338`); "opens on Experiment" (revertido a
  Spatial en `650441a`); "The build plan was applied in full" (los ítems con
  decisión quedaron fuera); "Local commits only" (los commits están en origin);
  WebGL "09:00-09:04" (reconstruido 23:26); referencia y WebP "untracked" (hoy
  trackeados); "npm test: 50/50" (hoy 60/60). Aceptación: cada línea corregida.
- **7.3.2 `DESIGN_IMPLEMENTATION_REPORT.md`: corregir.** [verificado] "open on
  Experiment" (hoy Spatial); "148 physical mesh parts" (hoy 154); "Canvas
  dragging accounts for the compact scale" (la escala 0.62 se eliminó); números
  WebGL y binario de las 16:38 (hoy 23:26 y 23:31); "backend source unchanged"
  (cambió mucho); "Nothing was merged" (hubo un merge, `7b867b8`); "untracked"
  (hoy trackeados); "canvas session-only" (hoy durable). Aceptación: cada línea
  corregida.
- **7.3.3 `01-design-philosophy.md`: actualizar la nota de adaptación.**
  [verificado] Dice "at head `3240c30`" (hoy `faa2338`) y da por pendientes tres
  ítems ya resueltos (editor IMGUI, layouts durables, watcher). Aceptación: la
  nota al día.
- **7.3.4 `UNITY_FIRST_AUDIT.md`: marcar como snapshot histórico.** [verificado]
  Un solo commit ever (13 nov): Q1 "Undecided" (resuelto: Q1=b); vault en
  `~/.loom` (falso: es `Research Vault/`); D3 y D6 con la prescripción invertida
  o rechazada. Aceptación: el documento marcado como histórico.
- **7.3.5 `NATIVE_APP_INVENTORY.md`: marcar secciones históricas.** [verificado]
  "10 relation types" (son nueve); "Two windows today" (la segunda se retiró);
  "Canvas: Positions are session-only" (en Tauri ya son durables); §B "no graph,
  no review" (el fold añadió Knowledge). Aceptación: las secciones marcadas.
- **7.3.6 `QUIET_COMPLEXITY_REFINEMENT.md`: actualizar.** [verificado] Dice que
  la sincronización de tema "would require a bridge change and was deferred";
  el puente existe (`spatial-player.js:24-26, 76`, `ApplyTheme`). Aceptación: la
  línea corregida.
- **7.3.7 `LOOM_CONNECTION_AUDIT.md`: reescribir.** [verificado] Dice 55
  comandos, 24 endpoints HTTP y que las tareas son gRPC-only: las tres
  afirmaciones son falsas hoy (~100 comandos registrados, 40+ endpoints
  conectados, tareas 100% HTTP). Aceptación: reescrito desde el estado actual.

### 7.4 Filosofía: las 10 preguntas

- **7.4.1 Pregunta 3: explicar qué pueden y no pueden hacer los agentes.**
  [verificado] HITL y trazas ayudan, pero ninguna UI explica las capacidades y
  límites de los agentes. Aceptación: la explicación existe en la UI.
- **7.4.2 Pregunta 5: aplicar "¿se podría con una interacción más simple?" a las
  3 superficies nuevas.** [verificado] El pase añadió el tab MCP, el tab Apps y
  la Patterns shelf sin que ningún documento registre haber hecho esta pregunta.
  Aceptación: la pregunta respondida por superficie.
- **7.4.3 Pregunta 6: demostrar que la profundidad orienta.** [por confirmar]
  Sin evidencia de píxeles no se puede afirmar que la profundidad se lea; el
  reporte de blur apunta en contra. Aceptación: demostrado con capturas reales.
- **7.4.4 Pregunta 7: contraste 4.5:1 en ambos temas, en ventana real.** [por
  confirmar] El test de tema lo exige en el shell; el backdrop de la escena es
  `#0A0E14` fijo. Aceptación: medido en capturas reales.
- **7.4.5 Pregunta 9: verificar con interacción real, pruebas y observación.**
  [verificado] Es el hallazgo más serio: sin prueba viva del loop Loom, sin
  evidencia de píxeles y sin tests nuevos. Aceptación: las tres verificaciones
  hechas.
- **7.4.6 Manifiesto: "el chat no gobierna el producto".** [verificado] La app
  abre en Spatial, pero la composición mantiene el panel de conversación fijo a
  la izquierda siempre y la arquitectura sigue siendo modos más chat, no objetos
  (intención, trabajo, artefacto, evidencia, control). Aceptación: la
  composición por objetos realizada o la divergencia registrada.
- **7.4.7 Manifiesto: "Inteligencia en todas partes. Ruido en ninguna."** [por
  confirmar] Sin D14 no se puede afirmar; el reporte de blur apunta en contra.
  Aceptación: verificado con capturas reales.

### 7.5 Q2 y robustez ante fallo de Unity

- **7.5.1 Decisión Q2: panel estático.** [verificado] Decidido el 15 nov 2026:
  panel estático "3D no disponible". El plan la re-preguntaba porque HDR+MSAA+post
  sube las odds de fallo. Aceptación: el panel construido (ver 7.5.2).
- **7.5.2 Panel estático "3D no disponible" (opción barata).** [verificado]
  Aprobado el 15 nov 2026. Aceptación: el panel existe y las vistas no espaciales
  siguen alcanzables.
- **7.5.3 Retry es hoy el único control.** [verificado] `index.html:77-80` solo
  ofrece Retry. Aceptación: el control existe o se añade el panel.
- **7.5.4 Qué pasa si WebGL no carga (WebGL 2.0 only).** [por confirmar]
  Aceptación: el comportamiento probado y registrado.
- **7.5.5 Qué pasa si el build WebGL está desactualizado.** [por confirmar]
  Aceptación: el comportamiento probado y registrado.
- **7.5.6 Mensaje de error honesto (no "cargando" infinito).** [por confirmar]
  Aceptación: el error se muestra con su motivo.
- **7.5.7 Vistas no espaciales alcanzables sin Unity.** [por confirmar]
  Aceptación: Work, Experiment, Code, Agents y Evidence funcionan sin el bench.

### 7.6 Duplicados y coherencia (A6/D13)

- **7.6.1 Una sola superficie de estado Loom (decisión).** [verificado] Ver
  2.6.1. Aceptación: la decisión registrada.
- **7.6.2 Avatar: cablear o quitar (decisión).** [verificado] Ver 5.7.3.
  Aceptación: la decisión registrada.
- **7.6.3 Tres inputs de búsqueda: unificar o dejar por ámbito (decisión).**
  [verificado] Ver 5.6.5. Aceptación: la decisión registrada.
- **7.6.4 Dos significados de "experiment": documentar.** [verificado] Ver
  5.7.4. Aceptación: la decisión documentada.
- **7.6.5 "Intent en dos lugares" resuelto (auditor contra crítica).**
  [verificado] Ver 5.7.5. Aceptación: verificado y la crítica corregida.
- **7.6.6 `IDE_CRITIQUE.md` L36 contra §2: resolver la tensión interna.**
  [verificado] L36 dice que la esfera es "the single live Loom-state indicator"
  mientras §2 registra dos indicadores (píldora y esfera). Aceptación: el
  documento coherente.
- **7.6.7 Sin duplicados nuevos en cada pase (regla).** [verificado] Aceptación:
  la regla en AGENTS.md y verificada en cada pase.

### 7.7 Entrega y release

- **7.7.1 Binario release reconstruido en cada head.** [verificado] Hoy es de
  las 23:31 (26,718,768 bytes). Aceptación: la regla registrada y cumplida.
- **7.7.2 WebGL reconstruido en cada head.** [verificado] Hoy es de las 23:26
  (35,066,162 bytes). Aceptación: la regla registrada y cumplida, con el `cmp`
  de 1.7.7.
- **7.7.3 Tamaño del build reportado y actualizado.** [verificado] Ver 1.7.5.
  Aceptación: el número actual en el repo.
- **7.7.4 Regla: ningún documento afirma "nothing pushed" ni lista un resuelto
  como abierto.** [verificado] Aceptación: la regla en AGENTS.md.
- **7.7.5 Push con aprobación por acción.** [verificado] Es la regla de Eduardo.
  Aceptación: se mantiene.
- **7.7.6 El binario instalado reporta el head actual.** [por confirmar]
  Aceptación: comprobado en la app instalada.
- **7.7.7 El player WebGL empaquetado coincide con el head.** [por confirmar]
  Aceptación: comprobado con el `cmp` de 1.7.7.

---

## Decisiones registradas (resumen, 15 nov 2026)

1. **Monaco** para Code mode, con su visor de diff (5.1.2).
2. **promptfoo + Docling** aprobados para empezar el benchmark; el resto de
   componentes (filex, FileBrowser Quantum, xterm.js, Filestash,
   Cognee/Mem0/Graphiti, E2B, Opik, LiteLLM) se decide uno por uno (5.2.2, 5.3.1,
   6.6).
3. **Cliente gRPC en Rust** para el transporte de la Fase 5, con Judge primero;
   Loom no se toca (4.4.3).
4. **Panel estático "3D no disponible"** para Q2; las vistas no espaciales siguen
   alcanzables (7.5.1).
5. **Sí, conectar** Loom como servidor MCP al harness, en las dos direcciones, con
   una lista explícita de qué herramientas del PC se exponen (3.5.1).
6. **Migración completa** del trabajo local a tareas de Loom; el mapeo de intents
   y attention se define antes de migrar y la migración es explícita, nunca en
   silencio (4.2.5).
7. **Cablear el avatar**; su concepto de cuenta o perfil se define al implementar
   (5.7.3).
8. **Ambas superficies de estado con roles definidos**: píldora precisa con texto,
   esfera ambiental con color, un solo estado compartido (2.6.1).
9. **Añadir el décimo tipo de relación: "blocks"** (5.5.5).
10. **Workflow streaming primero, luego ABTest** (4.3.1, 4.4.2).

## Lo que ya está resuelto (para no dejarlo como pendiente)

Q1 (fold, segunda ventana retirada), Q3 (la esfera se queda), Q4 (consolidación D1/D2),
A1 (Spatial es home), décimo tipo de relación (era un miscount), vault (markdown vault
como store compartido en `Research Vault/`), color ámbar de la esfera (ámbar =
awaiting approval), streaming SSE con Stop, MCP cliente con sus 9 RPCs, panel de
agentes con Weaver, Patterns shelf, watcher de 3 s, layouts durables, editor de notas
en Tauri, archival de notas, D9 (empty states), D14 sigue bloqueado (ver 1.7.1).
