# Research — Player dual con datos mock (spec 001)

Decisiones técnicas resueltas antes de implementar. No hay `NEEDS CLARIFICATION`
pendientes: la spec quedó sin ambigüedades materiales y aquí se fijan los "cómo".

## D1 — Reloj de sincronización: `requestAnimationFrame`, no `timeupdate`

- **Decisión**: Un bucle `requestAnimationFrame` activo mientras el video
  reproduce lee `video.currentTime`, lo convierte a ms (`Math.round(t*1000)`) y
  recalcula el segmento activo. Se detiene en `pause`/`ended` y se reanuda en
  `play`.
- **Rationale**: El evento `timeupdate` dispara a ~4 Hz (cada ~250 ms): suficiente
  para una barra de progreso, pero el highlight de subtítulos se vería retrasado y
  a tirones. `rAF` da resolución de frame (~60 Hz) y se pausa solo cuando la
  pestaña no está visible (ahorro de batería).
- **Alternativas descartadas**: (a) `timeupdate` — demasiado grueso; (b)
  `setInterval(…, 100)` — desligado del refresco real, peor en gama baja; (c)
  `requestVideoFrameCallback` — más preciso pero soporte irregular en navegadores
  v0.1; se puede adoptar luego sin cambiar la arquitectura.

## D2 — Offset por sustracción, no copiando el array cada frame

- **Decisión**: El segmento activo se calcula con
  `findActiveSegmentIndex(doc.segments, tMs − offsetMs)`. El _seek_ al tocar un
  diálogo usa `Math.max(0, segment.startMs + offsetMs)` (en segundos para el video).
- **Rationale**: Es matemáticamente equivalente a `applyOffset` pero **sin asignar
  un array nuevo en cada frame** (clave para SC-005 con ≥200 segmentos). `applyOffset`
  (spec 000) permanece como el helper canónico para cualquier consumidor que
  necesite el array desplazado materializado; aquí no lo necesitamos por frame.
- **Nota de coherencia**: highlight y _seek_ usan el **mismo** signo de offset, de
  modo que tocar un diálogo lo deja activo (US2 escenario 2). Verificado en el
  contrato del store.
- **Alternativas descartadas**: recalcular `applyOffset(segments, offset)` por
  frame (GC y trabajo O(n) innecesarios); mutar el documento (viola la decisión de
  diseño D1 de la spec y el contrato puro de spec 000).

## D3 — Minimizar re-renders: el store guarda `activeIndex`, no `currentTimeMs`

- **Decisión**: El bucle rAF mantiene el tiempo en un `ref` (no estado React) y
  solo llama a `setActiveIndex(i)` cuando el índice **cambia** respecto al previo.
  La lista y el overlay se suscriben a `activeIndex` (y a `offsetMs`), no al tiempo.
- **Rationale**: Si el tiempo viviera en el store, los ~60 set/seg re-renderizarían
  toda la lista. Como `activeIndex` cambia solo en fronteras de segmento, la lista
  se re-renderiza unas pocas veces por minuto → cumple SC-005 sin virtualizar.
- **Alternativas descartadas**: estado de tiempo por frame (jank); Context API
  (mismo problema de propagación); virtualización con `react-virtuoso` — innecesaria
  a este volumen y añadiría dependencia (principio V). Queda como plan B si el QA en
  dispositivo lo exige, con su línea en `docs/DECISIONS.md`.

## D4 — Autoscroll: `scrollIntoView` sobre la fila activa

- **Decisión**: La `TranscriptRow` activa expone un `ref`; al cambiar `activeIndex`,
  un `useEffect` llama `row.scrollIntoView({ behavior: 'smooth', block: 'center' })`
  dentro del contenedor scrolleable de la lista.
- **Rationale**: API nativa, cero dependencias, suave por defecto. `block: 'center'`
  mantiene el diálogo activo en el centro, cómodo para lectura.
- **Riesgo conocido / mitigación v0.1**: si el usuario scrollea manualmente, el
  autoscroll puede "pelearle". En v0.1 se acepta (caso de estudio = mirar, no
  scrollear). Si molesta en QA, se añade una pausa de autoscroll tras scroll manual
  (no se implementa ahora para mantener el diff mínimo). Se anota como riesgo.
- **Alternativas descartadas**: cálculo manual de `scrollTop` (reinventa la rueda);
  librería de scroll (dependencia injustificada).

## D5 — Modo de vista: orientación con override manual, sin remontar el `<video>`

- **Decisión**: `PlayerScreen` detecta orientación con
  `matchMedia('(orientation: landscape)')` y elige layout: **vertical** → video
  arriba + `TranscriptList` debajo; **horizontal** → `<video>` a pantalla con
  `SubtitleOverlay` encima. Un botón permite forzar el modo. El `<video>` (en
  `VideoStage`) es el **mismo nodo** en ambos layouts (no se desmonta), por lo que
  posición, play/pause y offset se conservan (FR-009).
- **Rationale**: Remontar el `<video>` perdería el tiempo de reproducción y el
  buffer. Mantener un único `VideoStage` y recolocarlo con CSS evita ese reseteo.
- **Alternativas descartadas**: dos árboles de componentes con `<video>` distinto
  (rompe FR-009); fullscreen API nativa para overlay — útil pero opcional, no
  bloquea v0.1 (se puede añadir después).

## D6 — Safe-areas y legibilidad del overlay

- **Decisión**: El overlay se posiciona respetando `env(safe-area-inset-*)`
  (ya hay `viewport-fit=cover` en `index.html`). Texto con sombra/halo para
  contraste sobre cualquier fotograma; origen y destino en dos líneas
  diferenciadas (destino atenuado o de menor jerarquía). Padding inferior extra
  para no chocar con los controles nativos del `<video>`.
- **Rationale**: Cumple US3 (legible, no tapado por notch ni controles).
- **Japonés (nota a futuro)**: el mock es EN→ES, pero el estilo de texto ya incluye
  `word-break`/`overflow-wrap` y dejará el `font-family` con fallback `Noto Sans JP`
  preparado para cuando entren documentos JA (specs posteriores). No se carga
  ninguna fuente extra ahora (sin dependencia).

## D7 — Selección de video y ciclo de vida del object URL

- **Decisión**: `MediaPicker` usa `<input type="file" accept="video/*">` y crea el
  src con `URL.createObjectURL(file)`. Al sustituir el video o desmontar, se llama
  `URL.revokeObjectURL` sobre el anterior para evitar fugas de memoria.
- **Rationale**: Es el camino estándar para reproducir archivos locales sin subirlos
  a ningún sitio; coherente con "sin backend" y "sin red".
- **Alternativas descartadas**: Data URL (carga todo el video en memoria como
  base64, inviable en gama baja); File System Access API (soporte parcial,
  innecesaria).

## D8 — Sin dependencias nuevas, sin lógica de core nueva

- **Decisión**: Todo se construye con React + Zustand + Tailwind ya presentes y con
  las funciones puras de spec 000. Las conversiones `s↔ms` (`Math.round(t*1000)`,
  `ms/1000`) viven en el borde UI/video, no en `src/core` (son triviales y
  específicas del DOM).
- **Rationale**: Mantiene el principio V (diffs mínimos, sin deps) y el principio I
  (no inflar core con helpers triviales que igual exigirían tests). Resultado: esta
  spec **no toca `tests/`**.
- **Consecuencia**: La "evidencia" de cierre es `pnpm test` (24/24 de spec 000
  siguen verdes) + `pnpm build` (tsc estricto) + checklist de dispositivo (§8).
