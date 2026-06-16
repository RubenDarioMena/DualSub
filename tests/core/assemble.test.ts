import { describe, expect, it } from 'vitest'
import { assembleTranslated } from '../../src/core/translation/assemble'
import { validateDocument } from '../../src/core/formats/dualsub'
import type { DualSubDocument } from '../../src/core/models'

function sourceDoc(): DualSubDocument {
  return {
    version: 1,
    sourceLang: 'en',
    targetLang: 'es',
    segments: [
      { startMs: 0, endMs: 1000, texts: { en: 'Hello' } },
      { startMs: 1000, endMs: 2000, texts: { en: '' } },
      { startMs: 2000, endMs: 3000, texts: { en: 'Bye' } },
    ],
    meta: { title: 'demo' },
  }
}

describe('assembleTranslated (US1)', () => {
  it('rellena texts[targetLang] por índice y conserva timing y nº de segmentos', () => {
    const doc = assembleTranslated(sourceDoc(), 'es', ['Hola', undefined, 'Adiós'])
    expect(doc.segments).toHaveLength(3)
    expect(doc.segments.map((s) => [s.startMs, s.endMs])).toEqual([
      [0, 1000],
      [1000, 2000],
      [2000, 3000],
    ])
    expect(doc.segments[0].texts.es).toBe('Hola')
    expect(doc.segments[2].texts.es).toBe('Adiós')
  })

  it('NO muta el documento origen (produce uno nuevo)', () => {
    const src = sourceDoc()
    const before = JSON.stringify(src)
    const doc = assembleTranslated(src, 'es', ['Hola', undefined, 'Adiós'])
    expect(JSON.stringify(src)).toBe(before)
    expect(doc).not.toBe(src)
    expect(doc.segments[0]).not.toBe(src.segments[0])
    expect(src.segments[0].texts.es).toBeUndefined()
  })

  it('un segmento sin traducción queda solo-origen (no rompe el 1:1)', () => {
    const doc = assembleTranslated(sourceDoc(), 'es', ['Hola', undefined, 'Adiós'])
    expect(doc.segments[1].texts.es).toBeUndefined()
    expect(doc.segments[1].texts.en).toBe('')
  })

  it('marca meta.source = "api-pipeline" y pasa validateDocument', () => {
    const doc = assembleTranslated(sourceDoc(), 'es', ['Hola', undefined, 'Adiós'])
    expect(doc.meta?.source).toBe('api-pipeline')
    expect(() => validateDocument(doc)).not.toThrow()
  })

  it('fija targetLang en el documento resultante', () => {
    const src: DualSubDocument = { ...sourceDoc(), targetLang: 'ja' }
    const doc = assembleTranslated(src, 'ja', ['こんにちは', undefined, 'さようなら'])
    expect(doc.targetLang).toBe('ja')
    expect(doc.segments[0].texts.ja).toBe('こんにちは')
  })
})
