# Contract: pipeline de transcripción + helpers puros

## 1. Helpers PUROS (`src/core/transcription/`) — con tests Vitest

### `planChunks`

```ts
export function planChunks(
  durationMs: number,
  sizeBytes: number,
  opts?: { singleMaxBytes?: number; targetChunkBytes?: number; overlapMs?: number },
): AudioChunk[]
```

| Caso | Salida esperada |
|------|-----------------|
| `sizeBytes ≤ singleMaxBytes` | 1 chunk: `{index:0, startMs:0, endMs:durationMs, fetchStartMs:0, fetchEndMs:durationMs}`. |
| `sizeBytes > singleMaxBytes` | `N = ceil(sizeBytes/targetChunkBytes)` chunks de duración `ceil(durationMs/N)`; el último llega a `durationMs`. `fetchStart/End` aplican solape clampeado. |
| `durationMs ≤ 0` | `[]` (o error tipado — decidir en impl; test lo fija). |

**Invariantes verificables**: los `[startMs,endMs)` nominales cubren `[0,durationMs)` sin huecos ni solape; `fetchStart ≤ startMs`, `fetchEnd ≥ endMs`; solape ≤ `overlapMs`.

### `mergeChunkTranscripts`

```ts
export function mergeChunkTranscripts(
  chunks: AudioChunk[],
  perChunkSegments: TranscriptSegment[][], // relativos a fetchStartMs de cada chunk
  opts?: { overlapMs?: number },
): TranscriptSegment[]
```

- Desplaza cada segmento del chunk `k` por `chunks[k].fetchStartMs` → tiempos absolutos.
- De-duplica el solape en la frontera entre `k` y `k+1` cortando en el **punto medio** del solape: conserva del previo lo que empieza `≤ midpoint`, del siguiente lo que empieza `> midpoint`.
- Devuelve segmentos ordenados por `startMs`, ms enteros, sin solape de intervalos.

**Tests clave**: 1 chunk (identidad); 2 chunks con solape (sin duplicar frase de frontera); 3+ chunks (continuidad total); segmentos vacíos en un chunk; tiempos siempre enteros/crecientes.

## 2. Orquestador (`src/core/transcription/pipeline.ts`) — consume interfaces

```ts
export async function transcribeMedia(deps: {
  extractor: AudioExtractor
  transcriber: Transcriber
  media: Blob
  filename: string
  lang: LangCode
  apiKey?: string
  onProgress?: (p: PipelineProgress) => void
  confirmChunks?: (n: number) => Promise<boolean> // FR-013; si N>WARN_CHUNKS
}): Promise<TranscriptionResult>
```

**Flujo**:
1. `stage:'extracting'` → `audio = extractor.extract(media)`.
2. `stage:'planning'` → `chunks = planChunks(audio.durationMs, audio.sizeBytes)`.
3. Si `chunks.length > WARN_CHUNKS`: `stage:'awaiting-confirm'` → `await confirmChunks(n)`; si `false` → abortar limpio.
4. Por cada chunk `k` (reanudable): `blob = extractor.slice(audio, fetchStartMs, fetchEndMs)`; `stage:'uploading'/'transcribing'` con `chunkIndex=k, chunkCount=N`; `seg = transcriber.transcribe({media:blob,...})`; guardar `ChunkResult`. Un chunk que falla **detiene** el bucle conservando los `ok` (FR-007).
5. `stage:'assembling'` → `mergeChunkTranscripts(chunks, results.segments)`.
6. Soltar `audio`/blobs (sin caché, FR-014). `stage:'done'` → `TranscriptionResult`.

**Reintento (FR-007)**: exponer un modo que reanude desde el primer chunk no-`ok` reutilizando los `ChunkResult` previos (misma `audio` en memoria si el trabajo sigue vivo; si el trabajo se recreó, re-extrae).

## 3. Tests del orquestador (mocks de extractor + transcriber)

| Test | Verifica |
|------|----------|
| Envío único (audio pequeño) | 1 llamada a `transcribe`, resultado = identidad del merge. |
| Troceo feliz (N>1) | N llamadas; progreso reporta k/N; merge continuo. |
| Fallo en chunk k | Se conservan `ok` de 0..k-1; se detiene en k; reintento completa sin re-transcribir los ok. |
| Confirmación N>WARN | `confirmChunks` invocado; `false` aborta sin transcribir. |
| Sin caché | Tras `done`, no se retiene el audio (no hay estado global). |

## 4. UI (`TranscribePanel`) — contrato de pantalla

- Sustituye el bloque de aviso por tamaño (`SIZE_WARN_MB`) por: botón que lanza `transcribeMedia`.
- Muestra `PipelineProgress` legible: "Extrayendo audio…", "Parte k de N — subiendo/transcribiendo…", "Uniendo…".
- `confirmChunks`: diálogo móvil-first ("Este audio se enviará en N partes; puede tardar y consumir tu cuota. ¿Continuar?").
- Error por parte: mensaje + "Reintentar" que reanuda sin perder lo hecho.
- Éxito: `buildFromTranscript(result)` → `loadProject(...)` **igual que hoy**.
- En dev/Settings mock: usar `getAudioExtractor('mock')` para no cargar wasm.
