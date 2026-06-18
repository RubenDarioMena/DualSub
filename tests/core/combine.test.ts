import { describe, expect, it } from 'vitest'
import {
  sharesPivotGrid,
  combineByPivot,
  selectPair,
  PivotMismatchError,
} from '../../src/core/project/combine'
import { validateDocument } from '../../src/core/formats/dualsub'
import type { DualSubDocument } from '../../src/core/models'

/** EN/ES: mismo inglés base, español completo. */
const enEs: DualSubDocument = {
  version: 1,
  sourceLang: 'en',
  targetLang: 'es',
  segments: [
    { startMs: 0, endMs: 1000, texts: { en: 'Hello', es: 'Hola' } },
    { startMs: 1000, endMs: 2000, texts: { en: 'World', es: 'Mundo' } },
    { startMs: 2000, endMs: 3000, texts: { en: 'Bye', es: 'Adiós' } },
  ],
  meta: { title: 'Demo', source: 'import-srt' },
}

/** EN/JA: misma rejilla y mismo inglés base, japonés parcial (falta el último). */
const enJa: DualSubDocument = {
  version: 1,
  sourceLang: 'en',
  targetLang: 'ja',
  segments: [
    { startMs: 0, endMs: 1000, texts: { en: 'Hello', ja: 'こんにちは' } },
    { startMs: 1000, endMs: 2000, texts: { en: 'World', ja: '世界' } },
    { startMs: 2000, endMs: 3000, texts: { en: 'Bye' } }, // sin japonés
  ],
  meta: { title: 'Demo', source: 'import-srt' },
}

describe('sharesPivotGrid', () => {
  it('true cuando comparten pivote y la misma rejilla de tiempos', () => {
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

  it('false si difiere el idioma pivote (sourceLang)', () => {
    const esJa: DualSubDocument = { ...enJa, sourceLang: 'es', targetLang: 'ja' }
    expect(sharesPivotGrid(enEs, esJa)).toBe(false)
  })
})

describe('combineByPivot', () => {
  it('fusiona texts por índice (en+es+ja) sin tocar el timing', () => {
    const out = combineByPivot(enEs, enJa)
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

  it('el resultado pasa validateDocument (pivote presente en todos)', () => {
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

describe('selectPair', () => {
  it('fija sourceLang/targetLang y deja ambos textos legibles', () => {
    const combined = combineByPivot(enEs, enJa)
    const esJa = selectPair(combined, 'es', 'ja')
    expect(esJa.sourceLang).toBe('es')
    expect(esJa.targetLang).toBe('ja')
    expect(esJa.segments[0].texts.es).toBe('Hola')
    expect(esJa.segments[0].texts.ja).toBe('こんにちは')
  })

  it('descarta los segmentos sin el idioma origen (resultado válido y persistible)', () => {
    const combined = combineByPivot(enEs, enJa)
    // Quitamos el español del primero para forzar un hueco en el origen 'es'.
    combined.segments[0].texts = { en: 'Hello', ja: 'こんにちは' }
    const esJa = selectPair(combined, 'es', 'ja')
    expect(esJa.segments).toHaveLength(2) // el primero (sin 'es') se descarta
    expect(() => validateDocument(esJa)).not.toThrow()
  })

  it('NO muta el documento de entrada', () => {
    const combined = combineByPivot(enEs, enJa)
    const copy = structuredClone(combined)
    selectPair(combined, 'es', 'ja')
    expect(combined).toEqual(copy)
  })

  it('lanza si source === target', () => {
    const combined = combineByPivot(enEs, enJa)
    expect(() => selectPair(combined, 'es', 'es')).toThrow()
  })
})
