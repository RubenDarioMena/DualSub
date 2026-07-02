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
  it('construye un documento de una sola pista válido con tiempos intactos', () => {
    const doc = buildFromTranscript(base)
    expect(doc.masterId).toBe('en')
    expect(doc.tracks).toEqual([{ id: 'en', lang: 'en', origin: 'asr' }])
    expect(doc.segments).toHaveLength(3)
    expect(doc.segments[0]).toEqual({ startMs: 0, endMs: 1200, texts: { en: 'Hello there.' } })
    expect(doc.meta?.source).toBe('api-pipeline')
    expect(() => validateDocument(doc)).not.toThrow()
  })

  it('la transcripción es la pista MAESTRA y lleva la etiqueta del proveedor', () => {
    const doc = buildFromTranscript(base, 'Whisper · Groq')
    expect(doc.masterId).toBe('en')
    expect(doc.tracks[0].label).toBe('Whisper · Groq')
    expect(doc.tracks[0].origin).toBe('asr')
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
