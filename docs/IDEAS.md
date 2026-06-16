# IDEAS — DualSub (backlog post-v0.1)

> Ideas de producto aún NO planificadas como spec. No son compromisos; se
> convierten en spec (`/speckit-specify`) cuando toque. Lo más reciente arriba.

## Guardar/restaurar proyecto + exportar video con subtítulos (2026-06-15)

**Origen**: feedback del usuario validando spec 003 en teléfono.

**Problema raíz observado**: en móvil, al apagar la pantalla / mandar la pestaña a
segundo plano, el SO **descarta la pestaña** para liberar memoria → al volver, la
página **recarga de cero** y se pierde el video (`mediaUrl` es un `blob:` en memoria)
y la traducción (doc en RAM). Hoy `playerStore` no persiste nada.

**1. Guardar/restaurar proyecto (cercano — también arregla el "se reinicia y pierdo todo")**
- Persistir el **doc dual** y el **archivo de video** en **IndexedDB** (un Blob sí se
  puede guardar; un `blob:` URL no — hay que recrearlo con `createObjectURL` al
  restaurar). localStorage NO sirve para el video (límite ~5MB).
- Al arrancar, si hay proyecto guardado, ofrecer **"Continuar"** y reconstruir el
  Object URL + cargar el doc → el usuario vuelve al mismo video doble-subtitulado.
- Lista de "proyectos recientes" (varios videos). Encaje técnico: sin tocar el core;
  es una capa de storage alrededor de `loadProject`/`pickMedia`.

**2. Exportar video con subtítulos (más adelante — pesado)**
- Quemar (burn-in) los dobles subtítulos en el propio archivo. Opciones: `ffmpeg.wasm`
  (potente pero pesa decenas de MB y es lento en móvil) o captura por `<canvas>` +
  `MediaRecorder` (más ligero, calidad/compatibilidad variable). Decisión de codecs/
  coste a documentar cuando sea spec (principio VII).
- Alternativa ligera intermedia: **exportar el doble subtítulo como `.srt`/`.ass`**
  (sidecar) para reusar fuera de la app, sin re-encodear video.

**Relación**: la parte 1 es prerequisito natural de la 2 (necesitas el proyecto
guardado). Posible spec próxima ("persistencia de proyecto").

## Widget de controles morfable + menús contextuales (2026-06-13)

**Origen**: feedback del usuario validando spec 002.

Evolución del actual `OffsetControl` (`src/screens/Player/`) hacia un único widget
que **cambia de función** según un menú contextual, manteniendo una sola posición
prominente en vertical y en overlay horizontal.

**1. Estado base**
- El widget arranca mostrando el **offset actual**.
- A la **izquierda**, un botón que transforma el widget en otro menú contextual.

**2. Menús contextuales** (el botón izquierdo cicla entre ellos; cada menú
redefine los botones laterales y el botón central):

- **A) Offset** — botones laterales: ajustan el offset atrás/adelante.
- **B) Velocidad** — botones laterales: retroceder/adelantar la reproducción
  (saltos); botón central: dropdown con velocidades predefinidas (`playbackRate`).
- **C) Subtítulos**
  - Tamaño: botones laterales ↑/↓ tamaño.
  - Estilo: botón central cicla estilos predefinidos.

**3. Flujo**: el usuario alterna entre Offset / Velocidad / Subtítulos con el
botón izquierdo; los demás controles se reinterpretan para el menú activo.

**Notas de encaje técnico** (sin tocar el core): el `<video>` ya es el reloj
maestro, así que velocidad (`video.playbackRate`) y saltos (`requestSeek` /
`findActiveSegmentIndex` para ir a segmento anterior/siguiente) encajan directo.
Tamaño/estilo de subtítulos son CSS sobre `TranscriptRow`/`SubtitleOverlay`.

**Relación**: amplía y reemplaza la idea previa "mover offset a Settings y poner
velocidad + saltos en su lugar" — aquí el offset NO se va a Settings sino que
convive como uno de los menús del widget. Posible spec futura ("controles de
estudio").
