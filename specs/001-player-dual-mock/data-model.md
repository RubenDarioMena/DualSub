# Data Model — Player dual con datos mock (spec 001)

Esta spec **no modifica** el formato DualSub JSON v1 (spec 000). Reutiliza
`DualSubDocument`, `SubtitleSegment`, `SegmentTexts`, `LangCode` y `MediaProject`
de `src/core/models.ts`. Aquí se define únicamente el **estado de runtime** del
player (no persistido) y la **forma del documento mock**.

## Entidades reutilizadas (spec 000, sin cambios)

- **DualSubDocument** — `{ version: 1, sourceLang, targetLang, segments[], meta? }`.
- **SubtitleSegment** — `{ startMs, endMs, texts }`, `[startMs, endMs)` fin excluido.
- **MediaProject** — `{ id, mediaUrl, doc, offsetMs }`. Contenedor que el player lee.

## Nueva entidad de runtime: `PlaybackState` (en el store Zustand)

No se persiste; se reconstruye al cargar la pantalla.

| Campo | Tipo | Descripción | Origen / actualización |
|---|---|---|---|
| `mediaUrl` | `string \| null` | Object URL del video local elegido; `null` antes de elegir. | `setMedia(url)` desde `MediaPicker`. |
| `doc` | `DualSubDocument` | Documento dual **mock** (EN→ES). | Constante del mock; cargado al iniciar. |
| `offsetMs` | `number` | Desfase de sincronización (puede ser negativo). | `setOffset` / `nudgeOffset` desde `OffsetControl`. |
| `isPlaying` | `boolean` | Si el video está reproduciendo. | Eventos `play`/`pause` del `<video>`. |
| `activeIndex` | `number` | Índice del segmento activo o `-1` (hueco/fuera de rango). | `setActiveIndex` desde el bucle rAF, **solo al cambiar**. |
| `viewMode` | `'list' \| 'overlay'` | Layout actual. | Derivado de orientación + override manual (`setViewMode`). |
| `seekRequestMs` | `number \| null` | Petición de _seek_ pendiente (ms de video) que `VideoStage` aplica y limpia. | `requestSeek(ms)` desde `TranscriptRow`; `VideoStage` la consume. |

### Reglas / invariantes de estado

- **R1 — `activeIndex` derivado, nunca tecleado a mano**:
  `activeIndex = findActiveSegmentIndex(doc.segments, currentTimeMs − offsetMs)`.
  El `currentTimeMs` vive en un `ref` del bucle rAF, **no** en el store (D3).
- **R2 — `activeIndex` solo se escribe cuando cambia** respecto al valor previo
  (evita re-render por frame).
- **R3 — Seek coherente con highlight**: `requestSeek` para el segmento `i` usa
  `Math.max(0, doc.segments[i].startMs + offsetMs)` convertido a segundos. Tras el
  seek, el rAF recalcula y `activeIndex` debe quedar en `i` (salvo que `i` caiga en
  un hueco por offset extremo, caso aceptado).
- **R4 — Offset no muta `doc`**: `offsetMs` es un escalar; `doc.segments` permanece
  intacto (coherente con `applyOffset` puro de spec 000).
- **R5 — `viewMode`**: por defecto sigue la orientación (`landscape→overlay`,
  `portrait→list`); el override manual gana hasta el próximo cambio de orientación.

### Acciones del store (resumen; contrato completo en `contracts/player-store.md`)

- `setMedia(url: string | null)` — fija/revoca el object URL.
- `setOffset(ms: number)` / `nudgeOffset(deltaMs: number)` — ajusta el desfase.
- `setActiveIndex(i: number)` — escrito por el rAF solo en cambios.
- `setPlaying(playing: boolean)`.
- `setViewMode(mode: 'list' | 'overlay')`.
- `requestSeek(videoMs: number)` / `clearSeek()` — canal de seek hacia `VideoStage`.

## Forma del documento mock (`engines/mock/mockDocument.ts`)

Genera un `DualSubDocument` que ejercita todos los caminos de la UI:

- `version: 1`, `sourceLang: 'en'`, `targetLang: 'es'`,
  `meta: { title: 'Demo dual (mock)', source: 'mock' }`.
- **≥ 200 segmentos** ordenados y sin solaparse (para validar SC-005 / fluidez).
- Cada segmento ~`2000 ms` de duración con **huecos** de `~600 ms` entre algunos
  (ejercita `activeIndex = -1`, edge case "sin segmento activo").
- **Al menos un segmento sin traducción** (`texts` solo con `en`) para validar
  FR-007 (mostrar solo origen sin romper layout) en lista y overlay.
- Al menos un par de líneas largas para validar `word-break`/wrap del overlay.
- Pasa `parseDualSub` sin lanzar (cumple las invariantes del formato): el mock se
  construye respetando orden, no-solape y `endMs > startMs`. Útil como
  auto-verificación en dev.

> El contenido textual es ilustrativo (frases de ejemplo EN + su "traducción" ES);
> **no** se corresponde con ningún audio real. Es una demo de UX de sincronización.
