# Phase 1 — Data Model: ASR de videos grandes/largos

Tipos nuevos (todos en `src/core`; TS puro). Tiempos en **ms enteros**.

## ExtractedAudio

Audio derivado del video, listo para transcribir. No se persiste (FR-014).

| Campo | Tipo | Notas |
|-------|------|-------|
| `blob` | `Blob` | mp3 mono 16 kHz (R2). Vive en memoria durante el proceso. |
| `durationMs` | `number` | Duración total del audio (ms enteros). |
| `sizeBytes` | `number` | Tamaño del blob; decide envío único vs troceo. |

## AudioChunk

Un tramo temporal a transcribir por separado. Producido por `planChunks` (PURO).

| Campo | Tipo | Notas |
|-------|------|-------|
| `index` | `number` | 0..N-1, en orden. |
| `startMs` | `number` | Inicio **nominal** del trozo en el video (sin solape). |
| `endMs` | `number` | Fin nominal (excluido); `endMs > startMs`. |
| `fetchStartMs` | `number` | `max(0, startMs - overlapMs)` — desde dónde se extrae el audio (con solape). |
| `fetchEndMs` | `number` | `min(durationMs, endMs + overlapMs)`. |

**Invariantes**: los `[startMs, endMs)` nominales cubren `[0, durationMs)` sin huecos ni solape; unión ordenada por `index`. Para envío único → un solo chunk con `start=0`, `end=durationMs`, sin solape.

## ChunkResult

Estado y resultado por trozo (lo mantiene el orquestador para reintento; FR-007).

| Campo | Tipo | Notas |
|-------|------|-------|
| `index` | `number` | Corresponde a `AudioChunk.index`. |
| `status` | `'pending' \| 'ok' \| 'failed'` | Reintento reanuda desde el primer no-`ok`. |
| `segments?` | `TranscriptSegment[]` | Segmentos **en ms relativos al inicio del audio del trozo** (`fetchStartMs`). Presente si `ok`. |
| `error?` | `TranscriptionError \| AudioExtractError` | Si `failed`. |

## TranscriptSegment (EXISTE)

Reutilizado de `core/services/transcriber.ts`: `{ startMs, endMs, text }`. El resultado final (`TranscriptionResult`) es el mismo tipo que hoy → el resto del pipeline (buildFromTranscript → traducir → guardar) no cambia.

## PipelineProgress

Estado para la UI (móvil-first). Reemplaza el `TranscriptionProgress` de una sola pasada cuando se usa el pipeline grande.

| Campo | Tipo | Notas |
|-------|------|-------|
| `stage` | `'extracting' \| 'planning' \| 'awaiting-confirm' \| 'uploading' \| 'transcribing' \| 'assembling' \| 'done'` | Fase actual. |
| `chunkIndex?` | `number` | Parte en curso (0-based). |
| `chunkCount?` | `number` | N total (para "parte k de N"). |

## AudioExtractError

Error tipado (paralelo a `TranscriptionError`).

| `kind` | Cuándo |
|--------|--------|
| `'load'` | No se pudo cargar/inicializar ffmpeg.wasm. |
| `'no-audio'` | El video no tiene pista de audio utilizable. |
| `'decode'` | Formato/contenedor no decodificable en cliente. |
| `'oom'` | Memoria insuficiente durante la extracción. |

## Constantes (afinables; R3/R4)

| Nombre | Valor inicial | Uso |
|--------|---------------|-----|
| `SINGLE_MAX_BYTES` | `24 * 1024 * 1024` | ≤ esto → envío único. |
| `TARGET_CHUNK_BYTES` | `20 * 1024 * 1024` | Tamaño objetivo por trozo → N. |
| `OVERLAP_MS` | `2000` | Solape entre trozos vecinos. |
| `WARN_CHUNKS` | `3` | `N >` esto → aviso + confirmación (FR-013). |
