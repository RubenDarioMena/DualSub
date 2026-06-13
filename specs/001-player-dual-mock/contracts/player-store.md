# Contract — `playerStore` (Zustand)

Estado de runtime del Player. UI-only: vive en `src/state/playerStore.ts`, importa
tipos de `src/core/models.ts` y funciones de `src/core/sync.ts`. **No** persiste.

## Estado

```ts
interface PlayerState {
  mediaUrl: string | null      // object URL del video local; null antes de elegir
  doc: DualSubDocument         // documento mock (EN→ES), inmutable en runtime
  offsetMs: number             // desfase ± (no muta doc)
  isPlaying: boolean
  activeIndex: number          // -1 si hueco / fuera de rango
  viewMode: 'list' | 'overlay'
  seekRequestMs: number | null // ms de video pendientes de aplicar; null = sin petición
}
```

## Acciones

| Acción | Firma | Efecto / contrato |
|---|---|---|
| `setMedia` | `(url: string \| null) => void` | Revoca el `mediaUrl` anterior (`URL.revokeObjectURL`) si existía y lo reemplaza. Resetea `isPlaying=false`, `activeIndex=-1`. |
| `setOffset` | `(ms: number) => void` | Fija `offsetMs` (entero). No toca `doc`. |
| `nudgeOffset` | `(deltaMs: number) => void` | `offsetMs += deltaMs`. Para botones ±100/±500 ms. |
| `setPlaying` | `(playing: boolean) => void` | Refleja eventos `play`/`pause` del `<video>`. |
| `setActiveIndex` | `(i: number) => void` | **Solo** debe llamarse cuando `i !== activeIndex` (lo garantiza el llamador rAF). No-op si igual. |
| `setViewMode` | `(mode: 'list' \| 'overlay') => void` | Override manual del layout. |
| `requestSeek` | `(videoMs: number) => void` | Coloca `seekRequestMs = Math.max(0, videoMs)`. |
| `clearSeek` | `() => void` | `seekRequestMs = null`. Lo llama `VideoStage` tras aplicar el seek. |

## Invariantes verificables

- **C1**: `setOffset`/`nudgeOffset` nunca mutan `doc.segments` (referencia estable).
- **C2**: `requestSeek` jamás deja `seekRequestMs < 0` (clamp a 0).
- **C3**: `setMedia(null)` o reemplazo revoca el object URL previo exactamente una
  vez (sin fugas, sin doble-revoke).
- **C4**: El cálculo de `activeIndex` se hace **fuera** del store (en el bucle rAF de
  `VideoStage`) vía `findActiveSegmentIndex(doc.segments, tMs − offsetMs)`; el store
  solo almacena el resultado. Mantiene el store libre de DOM/tiempo por frame.

## Consumidores

- `VideoStage` — escribe `isPlaying`, `activeIndex`; lee/limpia `seekRequestMs`.
- `TranscriptList` / `TranscriptRow` — leen `activeIndex`, `doc`; llaman `requestSeek`.
- `SubtitleOverlay` — lee `activeIndex`, `doc`.
- `OffsetControl` — lee `offsetMs`; llama `setOffset`/`nudgeOffset`.
- `PlayerScreen` — lee/escribe `viewMode`; lee `mediaUrl`.
- `MediaPicker` — llama `setMedia`.
