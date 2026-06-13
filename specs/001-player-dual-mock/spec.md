# Feature Specification: Player dual con datos mock

**Feature Branch**: `001-player-dual-mock`

**Created**: 2026-06-12

**Status**: Draft

**Input**: Guía de trabajo §5 (spec 001) — "El corazón de la UX, sin tocar APIs.
Validas en tu teléfono la experiencia completa." Player dual con datos mock:
video local + DualSubDocument, overlay horizontal, lista vertical con
highlight/autoscroll, control de offset.

## Resumen

Primera pantalla viva de DualSub: reproduce un **video local** junto a un
**DualSubDocument mock** (par EN/ES) y demuestra la experiencia de estudio
completa sin tocar APIs, import real ni persistencia. Es la primera vez que el
usuario ve DualSub funcionando en su teléfono.

Dos modos de visualización sobre el mismo estado de reproducción:

1. **Overlay (horizontal):** subtítulos dobles (origen + destino) superpuestos
   sobre el video, legibles, respetando safe-areas (notch).
2. **Lista (vertical):** lista de diálogos con highlight del segmento activo y
   autoscroll suave; tocar un diálogo hace _seek_ al video.

Un **control de offset (±ms)** ajusta la sincronización en runtime. El player
consume las funciones puras del core (spec 000): `findActiveSegmentIndex` /
`findActiveSegment` para el segmento activo y `applyOffset` para el desfase, y
toma su documento desde `engines/mock` (constitución, principio IV: UI contra
mock).

## Decisiones de diseño (resueltas, no asumidas)

1. **El offset NO muta el documento.** El documento mock permanece intacto; el
   offset es estado de runtime. El segmento activo se calcula contra el tiempo
   efectivo (`t - offsetMs`) o, equivalentemente, contra `applyOffset(doc, offset)`.
   Coherente con la spec 000 (`applyOffset` devuelve copia sin mutar).
2. **Una sola fuente de verdad de reproducción.** El elemento de video es el reloj
   maestro; la UI lee su `currentTime` (convertido a ms enteros) y deriva de ahí
   el segmento activo. No hay temporizador paralelo que pueda desincronizarse.
3. **El modo (overlay/lista) lo decide la orientación**, con posibilidad de
   alternar manualmente. Vertical → lista + video arriba; horizontal → overlay
   sobre el video. El estado de reproducción (posición, play/pause, offset) se
   conserva al cambiar de modo.
4. **Video mock incluido para demo.** El usuario elige un archivo de su galería
   (`<input type="file" accept="video/*">` → object URL); el documento dual viene
   del mock, no del video. No hay relación real entre el audio del video y el
   texto: es una demo de UX de sincronización, no de contenido.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ver el diálogo activo resaltado mientras se reproduce (Priority: P1)

Como estudiante, mientras el video avanza quiero ver, en la lista vertical, qué
diálogo se está "diciendo" ahora resaltado y que la lista se desplace sola para
mantenerlo visible, de modo que pueda seguir el hilo sin tocar la pantalla.

**Why this priority**: Es el núcleo de la propuesta de DualSub y lo primero que
valida que todo (modelo, sync, reproducción) encaja. Sin esto no hay producto.

**Independent Test**: Cargar un video local, darle play y observar que el diálogo
correcto se resalta en cada momento y que la lista autoscrollea para mantenerlo a
la vista; al entrar en un silencio (hueco), ningún diálogo queda resaltado.

**Acceptance Scenarios**:

1. **Given** un proyecto con documento mock cargado y el video reproduciéndose,
   **When** el tiempo del video entra en `[startMs, endMs)` de un segmento,
   **Then** ese diálogo se resalta en la lista y los demás no.
2. **Given** la reproducción avanza a un hueco entre segmentos, **When** ningún
   segmento cubre el tiempo actual, **Then** ningún diálogo aparece resaltado
   (no se "pega" el anterior).
3. **Given** el diálogo activo cambia y queda fuera de la vista, **When** se
   convierte en activo, **Then** la lista hace autoscroll suave para mostrarlo
   sin saltos bruscos.
4. **Given** el video está pausado sobre un segmento, **When** no hay avance de
   tiempo, **Then** el mismo diálogo permanece resaltado de forma estable.

### User Story 2 — Saltar a un diálogo tocándolo (Priority: P1)

Como estudiante, quiero tocar cualquier diálogo de la lista para que el video
salte a ese momento, de modo que pueda repetir una frase que no entendí.

**Why this priority**: Convierte la lista de pasiva a interactiva; es la mecánica
de estudio central (repetir frases). Junto con la US1 forma el MVP demostrable.

**Independent Test**: Tocar un diálogo de la lista y verificar que el video salta
al inicio de ese segmento (ajustado por el offset vigente) y que ese diálogo pasa
a estar resaltado.

**Acceptance Scenarios**:

1. **Given** la lista de diálogos visible, **When** el usuario toca un diálogo,
   **Then** el video hace _seek_ al inicio de ese segmento y ese diálogo queda
   resaltado.
2. **Given** hay un offset activo de ±N ms, **When** el usuario toca un diálogo,
   **Then** el _seek_ apunta a la posición de video equivalente al inicio visible
   de ese diálogo (consistente con cómo se resalta).

### User Story 3 — Leer ambos idiomas superpuestos al video (Priority: P2)

Como estudiante en horizontal/pantalla completa, quiero ver el subtítulo en el
idioma origen y su traducción superpuestos sobre el video, legibles y sin que los
tape el notch ni los controles, para estudiar mirando la imagen.

**Why this priority**: Es la mitad "ver" de la propuesta dual; depende de que la
US1 (segmento activo) ya funcione. Importante pero posterior al núcleo de sync.

**Independent Test**: En modo overlay, reproducir y verificar que el segmento
activo muestra ambos idiomas legibles, y que en un hueco el overlay desaparece.

**Acceptance Scenarios**:

1. **Given** modo overlay y un segmento activo, **When** se reproduce, **Then**
   se muestran origen y destino del segmento en dos líneas diferenciadas y
   legibles a distancia de brazo.
2. **Given** un segmento sin traducción (`texts[targetLang]` ausente), **When**
   está activo, **Then** se muestra solo el origen sin romper el layout.
3. **Given** un dispositivo con notch/safe-areas, **When** el overlay se muestra,
   **Then** no queda tapado por el notch ni por los controles nativos del video.

### User Story 4 — Corregir el desfase de subtítulos con un offset (Priority: P2)

Como usuario, si los subtítulos van adelantados o atrasados respecto al video,
quiero ajustar un offset en ms (±) y ver el resaltado/overlay recolocarse al
instante, para corregir la sincronización sin reprocesar nada.

**Why this priority**: Hace usable cualquier desfase y ejercita `applyOffset` en
vivo; secundario al núcleo de visualización.

**Independent Test**: Mover el control de offset y verificar que el diálogo
resaltado cambia coherentemente con el desfase aplicado, sin mutar el documento.

**Acceptance Scenarios**:

1. **Given** un offset de 0, **When** el usuario aplica `+500 ms`, **Then** el
   diálogo activo para un mismo instante del video se desplaza de forma coherente
   con el desfase y el documento mock no se modifica.
2. **Given** un offset aplicado, **When** el usuario lo devuelve a 0, **Then** el
   resaltado vuelve exactamente al estado sin offset.

### Edge Cases

- **Sin segmento activo** (antes del primero, en un hueco, después del último):
  lista sin resaltado y overlay vacío, sin "pegarse" el último diálogo mostrado.
- **Toque en un diálogo cuyo `startMs + offset < 0`**: el _seek_ se _clampa_ a 0
  (no se busca tiempo negativo en el video).
- **Documento sin traducción en algunos segmentos**: la lista y el overlay
  muestran solo el origen sin romper el layout.
- **Cambio de orientación a mitad de reproducción**: posición, play/pause y offset
  se conservan; el modo cambia sin reiniciar el video.
- **Lista larga (cientos de segmentos)**: el scroll y el autoscroll se mantienen
  fluidos (sin jank perceptible).
- **Segmento activo justo en la frontera** (`t = endMs`): deja de estar activo
  (fin excluido), coherente con `findActiveSegment` de la spec 000.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir al usuario seleccionar un video local desde
  su dispositivo y reproducirlo (play/pause y _seek_) dentro de la pantalla Player.
- **FR-002**: El sistema MUST cargar un `DualSubDocument` mock (par EN/ES, con al
  menos un hueco y al menos un segmento sin traducción) desde `engines/mock`, sin
  llamadas de red.
- **FR-003**: El sistema MUST resaltar en la lista vertical el segmento activo
  según el tiempo actual del video, usando `findActiveSegmentIndex` del core, y
  no resaltar ninguno cuando el tiempo cae en un hueco o fuera de rango.
- **FR-004**: La lista MUST hacer autoscroll suave para mantener visible el
  diálogo activo cuando éste cambia y queda fuera de la vista.
- **FR-005**: Los usuarios MUST poder tocar un diálogo de la lista para hacer
  _seek_ del video al inicio (visible, ajustado por offset) de ese segmento; el
  tiempo de _seek_ MUST _clamparse_ a `>= 0`.
- **FR-006**: El sistema MUST ofrecer un modo overlay que superponga origen y
  destino del segmento activo sobre el video, legible y respetando safe-areas, y
  que no muestre nada cuando no hay segmento activo.
- **FR-007**: El sistema MUST mostrar solo el idioma origen cuando un segmento
  carece de traducción, sin romper el layout (ni en lista ni en overlay).
- **FR-008**: Los usuarios MUST poder ajustar un offset en ms (positivo y
  negativo) que reubique el resaltado/overlay en runtime, calculado vía
  `applyOffset` (o equivalente `t - offsetMs`) SIN mutar el documento mock.
- **FR-009**: El estado de reproducción (posición, play/pause, offset) MUST
  conservarse al alternar entre modo lista y modo overlay y al cambiar la
  orientación del dispositivo.
- **FR-010**: La pantalla Player MUST diseñarse móvil-first a 360px de ancho y
  ser legible a distancia de brazo (constitución, principio V).
- **FR-011**: El sistema MUST tratar el elemento de video como reloj maestro: el
  segmento activo se deriva de su tiempo actual, sin temporizador paralelo.
- **FR-012**: Toda la lógica de cálculo de segmento activo y offset MUST apoyarse
  en funciones puras de `src/core` (spec 000); los componentes no reimplementan
  esa lógica.

### Key Entities

- **MediaProject** (de spec 000): contenedor de runtime con `mediaUrl` (object URL
  del video local), `doc` (DualSubDocument mock) y `offsetMs`. Es el estado que el
  Player manipula.
- **DualSubDocument / SubtitleSegment** (de spec 000): el documento mock y sus
  segmentos; el Player solo los lee.
- **PlaybackState** (runtime, nuevo): tiempo actual (ms), play/pause, índice del
  segmento activo derivado, modo de vista (lista/overlay) y offset. No se persiste.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con un video local cargado y reproduciendo, el diálogo correcto está
  resaltado en el 100% de los instantes de prueba (inicio, mitad, frontera y hueco
  de cada segmento del mock).
- **SC-002**: Tocar cualquier diálogo de la lista lleva el video al inicio de ese
  segmento con una desviación ≤ 100 ms respecto al `startMs` ajustado por offset.
- **SC-003**: Tras aplicar un offset de ±500 ms, el resaltado para un mismo
  instante del video se corresponde con el segmento esperado en el 100% de los
  casos de prueba, y el documento mock permanece sin cambios.
- **SC-004**: El usuario completa el flujo demo (elegir video → ver dual →
  resaltado/autoscroll → tocar para repetir → ajustar offset) sin instrucciones,
  en menos de 2 minutos, en un teléfono real a 360px.
- **SC-005**: El scroll de la lista y el autoscroll se perciben fluidos (sin jank
  perceptible) con un documento de al menos 200 segmentos.
- **SC-006**: `pnpm build` (incluye `tsc --noEmit` estricto) verde y los tests del
  core que el Player consume (`pnpm test`) en verde.

## Assumptions

- El documento dual de esta spec proviene exclusivamente del **mock**; no hay
  relación real entre el audio del video y los subtítulos. Es una demo de la UX de
  sincronización, no de contenido traducido fiel.
- El par de idiomas del mock es **EN→ES** (cubre origen + destino y un caso sin
  traducción); JA y otras combinaciones se ejercitan en specs posteriores, aunque
  el layout no debe romperse con textos largos.
- La verificación de la UI es **manual en dispositivo** (checklist de la guía §8);
  no se añaden tests automatizados de componentes React en v0.1 (constitución:
  TDD solo para el core). La lógica pura nueva, si la hubiera, sí lleva test.
- El video y el offset **no se persisten** entre sesiones; al recargar se vuelve a
  elegir el video. La persistencia llega en specs posteriores.
- Se reutilizan las funciones de `src/core` (spec 000) tal cual; esta spec no
  modifica el formato ni la lógica de sync.

## Out of scope

- Import real de archivos de subtítulos y detección de sidecar `.srt`/`.vtt` (spec 002).
- Pipeline API / BYOK (transcripción y traducción reales) (spec 003).
- Persistencia de proyectos, offset o posición; exportación.
- Soporte de >2 idiomas simultáneos o cambio de par de idiomas en caliente.
- Virtualización avanzada de la lista salvo que el QA en dispositivo la exija
  (`react-virtuoso` está pre-aprobada en la guía si hiciera falta; requeriría una
  línea en `docs/DECISIONS.md`).
