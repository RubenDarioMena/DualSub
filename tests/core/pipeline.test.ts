import { describe, expect, it } from 'vitest'
import {
  createTranscriptionJob,
  transcribeMedia,
  PipelineAbort,
  type PipelineProgress,
} from '../../src/core/transcription/pipeline'
import type { AudioExtractor } from '../../src/core/services/audioExtractor'
import { TranscriptionError, type Transcriber } from '../../src/core/services/transcriber'

const MB = 1024 * 1024

function makeExtractor(durationMs: number, sizeBytes: number) {
  const state = { extractCalls: 0, sliceCalls: 0 }
  const extractor: AudioExtractor = {
    async extract() {
      state.extractCalls++
      return { blob: new Blob(['audio']), durationMs, sizeBytes }
    },
    async slice() {
      state.sliceCalls++
      return new Blob(['chunk'])
    },
  }
  return { extractor, state }
}

/** El mock deduce el índice de trozo desde el filename `*.part{k}.mp3` y devuelve
 * un segmento situado dentro del rango nominal de ese trozo (rel = overlap+10). */
function makeTranscriber(failChunkOnce?: number) {
  const state = { calls: 0 }
  const failsLeft = new Map<number, number>()
  if (failChunkOnce !== undefined) failsLeft.set(failChunkOnce, 1)
  const transcriber: Transcriber = {
    async transcribe(req) {
      state.calls++
      const m = /\.part(\d+)\.mp3$/.exec(req.filename)
      const k = m ? Number(m[1]) - 1 : 0
      const left = failsLeft.get(k) ?? 0
      if (left > 0) {
        failsLeft.set(k, left - 1)
        throw new TranscriptionError('network', 'falla simulada')
      }
      return { lang: req.lang, segments: [{ startMs: 2010, endMs: 2060, text: `c${k}` }] }
    },
  }
  return { transcriber, state }
}

const base = { filename: 'video', lang: 'en' as const, apiKey: 'k', media: new Blob(['video']) }

describe('transcribeMedia (envío único)', () => {
  it('audio pequeño → 1 transcripción, resultado = identidad', async () => {
    const ex = makeExtractor(5000, 1 * MB)
    const tr = makeTranscriber()
    const res = await transcribeMedia({ ...base, extractor: ex.extractor, transcriber: tr.transcriber })
    expect(tr.state.calls).toBe(1)
    expect(res.lang).toBe('en')
    expect(res.segments).toEqual([{ startMs: 2010, endMs: 2060, text: 'c0' }])
  })
})

describe('transcribeMedia (troceo feliz)', () => {
  it('audio grande → N transcripciones, progreso k/N y merge continuo', async () => {
    const ex = makeExtractor(90_000, 45 * MB) // → 3 trozos
    const tr = makeTranscriber()
    const progress: PipelineProgress[] = []
    const res = await transcribeMedia({
      ...base,
      extractor: ex.extractor,
      transcriber: tr.transcriber,
      onProgress: (p) => progress.push(p),
    })
    expect(tr.state.calls).toBe(3)
    expect(res.segments.map((s) => s.text)).toEqual(['c0', 'c1', 'c2'])
    expect(res.segments.map((s) => s.startMs)).toEqual([2010, 30_010, 60_010]) // continuo, sin dup
    // progreso: fases y N total presentes
    expect(progress.some((p) => p.stage === 'extracting')).toBe(true)
    // el pipeline garantiza "parte k de N" al menos en la fase 'uploading'
    expect(progress.some((p) => p.stage === 'uploading' && p.chunkCount === 3)).toBe(true)
    expect(progress.at(-1)?.stage).toBe('done')
    expect(new Set(progress.filter((p) => p.chunkIndex != null).map((p) => p.chunkIndex))).toEqual(
      new Set([0, 1, 2]),
    )
  })
})

describe('reintento por parte (FR-007)', () => {
  it('un trozo falla → conserva los ok y reanuda sin re-transcribir ni re-extraer', async () => {
    const ex = makeExtractor(90_000, 45 * MB) // 3 trozos
    const tr = makeTranscriber(1) // el trozo índice 1 falla una vez
    const job = createTranscriptionJob({ ...base, extractor: ex.extractor, transcriber: tr.transcriber })

    await expect(job.run()).rejects.toBeInstanceOf(TranscriptionError)
    expect(job.results[0].status).toBe('ok')
    expect(job.results[1].status).toBe('failed')
    expect(tr.state.calls).toBe(2) // c0 ok, c1 falla

    const res = await job.run() // reanuda desde el trozo 1
    expect(res.segments.map((s) => s.text)).toEqual(['c0', 'c1', 'c2'])
    expect(tr.state.calls).toBe(4) // + c1 (reintento) + c2; NO re-transcribe c0
    expect(ex.state.extractCalls).toBe(1) // NO re-extrae el audio
  })
})

describe('confirmación de muchas partes (FR-013)', () => {
  it('confirmChunks=false → aborta sin transcribir', async () => {
    const ex = makeExtractor(120_000, 70 * MB) // → 4 trozos (> WARN_CHUNKS=3)
    const tr = makeTranscriber()
    await expect(
      transcribeMedia({
        ...base,
        extractor: ex.extractor,
        transcriber: tr.transcriber,
        confirmChunks: () => false,
      }),
    ).rejects.toBeInstanceOf(PipelineAbort)
    expect(tr.state.calls).toBe(0)
  })

  it('confirmChunks=true → procede con las N partes', async () => {
    const ex = makeExtractor(120_000, 70 * MB)
    const tr = makeTranscriber()
    const res = await transcribeMedia({
      ...base,
      extractor: ex.extractor,
      transcriber: tr.transcriber,
      confirmChunks: () => true,
    })
    expect(tr.state.calls).toBe(4)
    expect(res.segments).toHaveLength(4)
  })
})
