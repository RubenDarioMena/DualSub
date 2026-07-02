import { describe, expect, it } from 'vitest'
import { assembleTranslated } from '../../src/core/translation/assemble'
import { validateDocument } from '../../src/core/formats/dualsub'
import type { DualSubDocument } from '../../src/core/models'

function sourceDoc(): DualSubDocument {
  return {
    version: 2,
    masterId: 'en',
    tracks: [{ id: 'en', lang: 'en', origin: 'asr' }],
    segments: [
      { startMs: 0, endMs: 1000, texts: { en: 'Hello' } },
      { startMs: 1000, endMs: 2000, texts: { en: '' } },
      { startMs: 2000, endMs: 3000, texts: { en: 'Bye' } },
    ],
    meta: { title: 'demo' },
  }
}

const esSpec = { id: 'es', lang: 'es' as const, label: 'Groq' }

describe('assembleTranslated (US1, multi-pista)', () => {
  it('añade la pista y rellena texts por índice, timing intacto', () => {
    const doc = assembleTranslated(sourceDoc(), esSpec, ['Hola', undefined, 'Adiós'])
    expect(doc.segments).toHaveLength(3)
    expect(doc.segments.map((s) => [s.startMs, s.endMs])).toEqual([
      [0, 1000],
      [1000, 2000],
      [2000, 3000],
    ])
    expect(doc.tracks).toEqual([
      { id: 'en', lang: 'en', origin: 'asr' },
      { id: 'es', lang: 'es', origin: 'translation', label: 'Groq' },
    ])
    expect(doc.segments[0].texts.es).toBe('Hola')
    expect(doc.segments[2].texts.es).toBe('Adiós')
  })

  it('NO muta el documento origen (produce uno nuevo)', () => {
    const src = sourceDoc()
    const before = JSON.stringify(src)
    const doc = assembleTranslated(src, esSpec, ['Hola', undefined, 'Adiós'])
    expect(JSON.stringify(src)).toBe(before)
    expect(doc).not.toBe(src)
    expect(doc.segments[0]).not.toBe(src.segments[0])
    expect(src.segments[0].texts.es).toBeUndefined()
  })

  it('un segmento sin traducción queda pendiente (no rompe el 1:1)', () => {
    const doc = assembleTranslated(sourceDoc(), esSpec, ['Hola', undefined, 'Adiós'])
    expect(doc.segments[1].texts.es).toBeUndefined()
    expect(doc.segments[1].texts.en).toBe('')
  })

  it('marca meta.source = "api-pipeline" y pasa validateDocument', () => {
    const doc = assembleTranslated(sourceDoc(), esSpec, ['Hola', undefined, 'Adiós'])
    expect(doc.meta?.source).toBe('api-pipeline')
    expect(() => validateDocument(doc)).not.toThrow()
  })

  it('completa una pista EXISTENTE sin duplicarla ni pisar lo ya traducido', () => {
    const half = assembleTranslated(sourceDoc(), esSpec, ['Hola', undefined, undefined])
    const done = assembleTranslated(half, esSpec, [undefined, undefined, 'Adiós'])
    expect(done.tracks.filter((t) => t.id === 'es')).toHaveLength(1)
    expect(done.segments[0].texts.es).toBe('Hola')
    expect(done.segments[2].texts.es).toBe('Adiós')
  })

  it('una SEGUNDA traducción del mismo idioma es otra pista (es-2)', () => {
    const first = assembleTranslated(sourceDoc(), esSpec, ['Hola', undefined, 'Adiós'])
    const second = assembleTranslated(
      first,
      { id: 'es-2', lang: 'es', label: 'DeepL' },
      ['Buenas', undefined, 'Hasta luego'],
    )
    expect(second.tracks.map((t) => t.id)).toEqual(['en', 'es', 'es-2'])
    expect(second.segments[0].texts.es).toBe('Hola')
    expect(second.segments[0].texts['es-2']).toBe('Buenas')
    expect(() => validateDocument(second)).not.toThrow()
  })
})
