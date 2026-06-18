import { describe, expect, it } from 'vitest'
import { buildFromTranscript } from '../../src/core/transcription/buildFromTranscript'
import { validateDocument } from '../../src/core/formats/dualsub'
import type { TranscriptionResult } from '../../src/core/services/transcriber'

const base: TranscriptionResult = {
  lang: 'en',
  segments: [
    { startMs: 0, endMs: 1200, text: 'Hello there.' },
    { startMs: 1200, endMs: 2500, text: 'How are you?' },
    { startMs: 2500, endMs: 4000, text: 'Goodbye.' },
  ],
}

describe('buildFromTranscript (005)', () => {
  it('construye un documento solo-origen válido con tiempos intactos', () => {
    const doc = buildFromTranscript(base)
    expect(doc.sourceLang).toBe('en')
    expect(doc.segments).toHaveLength(3)
    expect(doc.segments[0]).toEqual({ startMs: 0, endMs: 1200, texts: { en: 'Hello there.' } })
    expect(doc.meta?.source).toBe('api-pipeline')
    expect(() => validateDocument(doc)).not.toThrow()
  })

  it('usa un targetLang placeholder distinto del origen cuando se omite', () => {
    expect(buildFromTranscript(base).targetLang).not.toBe('en')
  })

  it('respeta el targetLang elegido (preparado para traducir, 003)', () => {
    const doc = buildFromTranscript(base, 'es')
    expect(doc.targetLang).toBe('es')
    expect(doc.segments[0].texts.es).toBeUndefined()
  })

  it('descarta segmentos vacíos y recorta el texto', () => {
    const doc = buildFromTranscript({
      lang: 'ja',
      segments: [
        { startMs: 0, endMs: 1000, text: '  こんにちは  ' },
        { startMs: 1000, endMs: 2000, text: '   ' }, // vacío → fuera
      ],
    })
    expect(doc.segments).toHaveLength(1)
    expect(doc.segments[0].texts.ja).toBe('こんにちは')
  })

  it('normaliza segmentos desordenados/solapados a un documento válido', () => {
    const doc = buildFromTranscript({
      lang: 'en',
      segments: [
        { startMs: 2000, endMs: 4000, text: 'Second' },
        { startMs: 0, endMs: 2500, text: 'First (overlaps)' },
      ],
    })
    expect(() => validateDocument(doc)).not.toThrow()
    // El primero (por tiempo) se trunca al inicio del siguiente; orden ascendente.
    expect(doc.segments.map((s) => s.startMs)).toEqual([0, 2000])
    expect(doc.segments[0].endMs).toBe(2000)
  })
})
