/**
 * Orquestador del pipeline ASR de videos grandes/largos (spec 008). Consume las
 * INTERFACES `AudioExtractor` y `Transcriber` (no importa `fetch`/DOM → testeable con
 * mocks): extraer audio → planificar trozos → (confirmar si son muchos) → transcribir
 * cada trozo → re-ensamblar tiempos continuos. Reanudable: un trabajo conserva su estado
 * por trozo, así un reintento sigue desde el primer trozo no-`ok` sin re-transcribir los
 * ya hechos (FR-007) ni re-extraer el audio (que vive en el propio trabajo, sin caché
 * persistente → FR-014). Contrato: contracts/transcription-pipeline.md
 */
import type { LangCode } from '../models'
import type { AudioExtractor, ExtractedAudio } from '../services/audioExtractor'
import type { Transcriber, TranscriptionResult, TranscriptSegment } from '../services/transcriber'
import { planChunks, WARN_CHUNKS, type AudioChunk, type ChunkPlanOptions } from './chunkPlan'
import { mergeChunkTranscripts } from './mergeChunks'

/** Fase actual para la UI (móvil-first). */
export interface PipelineProgress {
  stage: 'extracting' | 'planning' | 'awaiting-confirm' | 'uploading' | 'transcribing' | 'assembling' | 'done'
  /** Parte en curso (0-based) cuando aplica. */
  chunkIndex?: number
  /** N total de partes (para "parte k de N"). */
  chunkCount?: number
  /** Progreso 0..1 de la extracción, cuando `stage === 'extracting'`. */
  ratio01?: number
}

/** Estado por trozo; permite reintento sin perder lo hecho. */
export interface ChunkResult {
  index: number
  status: 'pending' | 'ok' | 'failed'
  segments?: TranscriptSegment[]
  error?: unknown
}

/** El usuario canceló en la confirmación de "muchas partes" (FR-013). */
export class PipelineAbort extends Error {
  constructor(message = 'Transcripción cancelada por el usuario.') {
    super(message)
    this.name = 'PipelineAbort'
  }
}

export interface TranscribeMediaDeps {
  extractor: AudioExtractor
  transcriber: Transcriber
  media: Blob
  filename: string
  lang: LangCode
  apiKey?: string
  onProgress?: (p: PipelineProgress) => void
  /** Se invoca si `N > warnChunks`; devolver `false` cancela (lanza `PipelineAbort`). */
  confirmChunks?: (n: number) => boolean | Promise<boolean>
  warnChunks?: number
  planOptions?: ChunkPlanOptions
}

/** Un trabajo de transcripción reanudable. */
export interface TranscriptionJob {
  /** Ejecuta (o reanuda) el pipeline. En éxito devuelve la transcripción completa. */
  run(): Promise<TranscriptionResult>
  /** Estado por trozo (para UI/diagnóstico). */
  readonly results: readonly ChunkResult[]
}

/**
 * Crea un trabajo reanudable. La extracción y el plan se calculan una sola vez; cada
 * `run()` reanuda desde el primer trozo no-`ok`. El audio extraído vive en el trabajo y
 * se libera cuando este se descarta (sin caché persistente).
 */
export function createTranscriptionJob(deps: TranscribeMediaDeps): TranscriptionJob {
  const warnChunks = deps.warnChunks ?? WARN_CHUNKS
  let audio: ExtractedAudio | undefined
  let chunks: AudioChunk[] | undefined
  let confirmed = false
  const results: ChunkResult[] = []

  const emit = (p: PipelineProgress) => deps.onProgress?.(p)

  const job: TranscriptionJob = {
    results,
    async run(): Promise<TranscriptionResult> {
      // 1. Extraer audio (una sola vez).
      if (!audio) {
        emit({ stage: 'extracting', ratio01: 0 })
        audio = await deps.extractor.extract(deps.media, (r) => emit({ stage: 'extracting', ratio01: r }))
      }

      // 2. Planificar (una sola vez).
      if (!chunks) {
        emit({ stage: 'planning' })
        chunks = planChunks(audio.durationMs, audio.sizeBytes, deps.planOptions)
        results.length = 0
        for (const c of chunks) results.push({ index: c.index, status: 'pending' })
      }

      // 3. Confirmar si son muchas partes (una sola vez).
      if (!confirmed && chunks.length > warnChunks) {
        emit({ stage: 'awaiting-confirm', chunkCount: chunks.length })
        const ok = (await deps.confirmChunks?.(chunks.length)) ?? true
        if (!ok) throw new PipelineAbort()
      }
      confirmed = true

      // 4. Transcribir cada trozo pendiente (reanuda desde el primer no-`ok`).
      const n = chunks.length
      for (let k = 0; k < n; k++) {
        if (results[k].status === 'ok') continue
        const chunk = chunks[k]
        try {
          const blob = await deps.extractor.slice(audio, chunk.fetchStartMs, chunk.fetchEndMs)
          emit({ stage: 'uploading', chunkIndex: k, chunkCount: n })
          const res = await deps.transcriber.transcribe(
            { media: blob, filename: `${deps.filename}.part${k + 1}.mp3`, lang: deps.lang, apiKey: deps.apiKey },
            (tp) => emit({ stage: tp.stage === 'uploading' ? 'uploading' : 'transcribing', chunkIndex: k, chunkCount: n }),
          )
          results[k] = { index: k, status: 'ok', segments: res.segments }
        } catch (e) {
          results[k] = { index: k, status: 'failed', error: e }
          throw e // detiene el bucle conservando los `ok` previos; un `run()` posterior reanuda aquí
        }
      }

      // 5. Re-ensamblar.
      emit({ stage: 'assembling' })
      const merged = mergeChunkTranscripts(
        chunks,
        results.map((r) => r.segments ?? []),
      )
      emit({ stage: 'done' })
      return { lang: deps.lang, segments: merged }
    },
  }
  return job
}

/** Conveniencia: crea y ejecuta un trabajo de una pasada (sin reintento manual). */
export function transcribeMedia(deps: TranscribeMediaDeps): Promise<TranscriptionResult> {
  return createTranscriptionJob(deps).run()
}
