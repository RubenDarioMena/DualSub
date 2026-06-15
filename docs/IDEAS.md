# IDEAS — DualSub (backlog post-v0.1)

> Ideas de producto aún NO planificadas como spec. No son compromisos; se
> convierten en spec (`/speckit-specify`) cuando toque. Lo más reciente arriba.

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
