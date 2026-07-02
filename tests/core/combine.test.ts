import { describe, expect, it } from 'vitest'
import {
  sharesPivotGrid,
  combineByPivot,
  PivotMismatchError,
} from '../../src/core/project/combine'
import { validateDocument } from '../../src/core/formats/dualsub'
import type { DualSubDocument } from '../../src/core/models'

/** EN/ES: mismo inglés base, español completo. */
const enEs: DualSubDocument = {
  version: 2,
  masterId: 'en',
  tracks: [
    { id: 'en', lang: 'en', origin: 'import' },
    { id: 'es', lang: 'es', origin: 'translation', label: 'Groq' },
  ],
  segments: [
    { startMs: 0, endMs: 1000, texts: { en: 'Hello', es: 'Hola' } },
    { startMs: 1000, endMs: 2000, texts: { en: 'World', es: 'Mundo' } },
    { startMs: 2000, endMs: 3000, texts: { en: 'Bye', es: 'Adiós' } },
  ],
  meta: { title: 'Demo', source: 'import-srt' },
}

/** EN/JA: misma rejilla y mismo inglés base, japonés parcial (falta el último). */
const enJa: DualSubDocument = {
  version: 2,
  masterId: 'en',
  tracks: [
    { id: 'en', lang: 'en', origin: 'import' },
    { id: 'ja', lang: 'ja', origin: 'translation' },
  ],
  segments: [
    { startMs: 0, endMs: 1000, texts: { en: 'Hello', ja: 'こんにちは' } },
    { startMs: 1000, endMs: 2000, texts: { en: 'World', ja: '世界' } },
    { startMs: 2000, endMs: 3000, texts: { en: 'Bye' } }, // sin japonés
  ],
  meta: { title: 'Demo', source: 'import-srt' },
}

describe('sharesPivotGrid', () => {
  it('true cuando comparten idioma maestro y la misma rejilla de tiempos', () => {
    expect(sharesPivotGrid(enEs, enJa)).toBe(true)
  })

  it('false si difiere el número de segmentos', () => {
    const shorter: DualSubDocument = { ...enJa, segments: enJa.segments.slice(0, 2) }
    expect(sharesPivotGrid(enEs, shorter)).toBe(false)
  })

  it('false si difiere algún startMs/endMs', () => {
    const shifted: DualSubDocument = {
      ...enJa,
      segments: enJa.segments.map((s, i) => (i === 1 ? { ...s, startMs: 1001 } : s)),
    }
    expect(sharesPivotGrid(enEs, shifted)).toBe(false)
  })

  it('false si difiere el idioma de la pista maestra', () => {
    const jaMaster: DualSubDocument = { ...enJa, masterId: 'ja' }
    expect(sharesPivotGrid(enEs, jaMaster)).toBe(false)
  })
})

describe('combineByPivot', () => {
  it('une las pistas de ambos (en+es+ja) sin tocar el timing', () => {
    const out = combineByPivot(enEs, enJa)
    expect(out.masterId).toBe('en')
    expect(out.tracks.map((t) => t.id)).toEqual(['en', 'es', 'ja'])
    expect(out.segments[0].texts).toEqual({ en: 'Hello', es: 'Hola', ja: 'こんにちは' })
    expect(out.segments[1].texts).toEqual({ en: 'World', es: 'Mundo', ja: '世界' })
    expect(out.segments.map((s) => [s.startMs, s.endMs])).toEqual([
      [0, 1000],
      [1000, 2000],
      [2000, 3000],
    ])
  })

  it('un segmento sin texto en un input conserva solo las claves disponibles', () => {
    const out = combineByPivot(enEs, enJa)
    expect(out.segments[2].texts).toEqual({ en: 'Bye', es: 'Adiós' }) // sin ja
  })

  it('renombra las pistas de B que colisionan por id (es → es-2)', () => {
    const enEs2: DualSubDocument = {
      ...enEs,
      tracks: [
        { id: 'en', lang: 'en', origin: 'import' },
        { id: 'es', lang: 'es', origin: 'translation', label: 'DeepL' },
      ],
      segments: enEs.segments.map((s) => ({
        ...s,
        texts: { en: s.texts.en, es: `${s.texts.es} (v2)` },
      })),
    }
    const out = combineByPivot(enEs, enEs2)
    expect(out.tracks.map((t) => t.id)).toEqual(['en', 'es', 'es-2'])
    expect(out.tracks[2].label).toBe('DeepL')
    expect(out.segments[0].texts.es).toBe('Hola')
    expect(out.segments[0].texts['es-2']).toBe('Hola (v2)')
    expect(() => validateDocument(out)).not.toThrow()
  })

  it('el resultado pasa validateDocument (maestra presente en todos)', () => {
    const out = combineByPivot(enEs, enJa)
    expect(() => validateDocument(out)).not.toThrow()
  })

  it('NO muta los documentos de entrada', () => {
    const enEsCopy = structuredClone(enEs)
    const enJaCopy = structuredClone(enJa)
    combineByPivot(enEs, enJa)
    expect(enEs).toEqual(enEsCopy)
    expect(enJa).toEqual(enJaCopy)
  })

  it('lanza PivotMismatchError si no comparten pivote/rejilla', () => {
    const shorter: DualSubDocument = { ...enJa, segments: enJa.segments.slice(0, 2) }
    expect(() => combineByPivot(enEs, shorter)).toThrow(PivotMismatchError)
  })
})
