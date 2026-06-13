import { describe, expect, it } from 'vitest'
import {
  DualSubParseError,
  parseDualSub,
  serializeDualSub,
} from '../../src/core/formats/dualsub'
import type { DualSubDocument } from '../../src/core/models'

function validDoc(): DualSubDocument {
  return {
    version: 1,
    sourceLang: 'en',
    targetLang: 'es',
    segments: [
      { startMs: 0, endMs: 1800, texts: { en: 'Hello there.', es: 'Hola.' } },
      { startMs: 1800, endMs: 4200, texts: { en: 'How are you?', es: '¿Cómo estás?' } },
    ],
    meta: { title: 'Demo', durationMs: 4200, source: 'mock' },
  }
}

describe('serializeDualSub / parseDualSub round-trip', () => {
  it('parse(serialize(doc)) es deep-equal al original', () => {
    const doc = validDoc()
    expect(parseDualSub(serializeDualSub(doc))).toEqual(doc)
  })

  it('acepta un documento sin meta y sin traducción de destino', () => {
    const doc: DualSubDocument = {
      version: 1,
      sourceLang: 'ja',
      targetLang: 'en',
      segments: [{ startMs: 0, endMs: 1000, texts: { ja: 'こんにちは' } }],
    }
    expect(parseDualSub(serializeDualSub(doc))).toEqual(doc)
  })
})

describe('parseDualSub validación', () => {
  function expectReject(mutate: (d: DualSubDocument) => unknown) {
    const bad = mutate(validDoc())
    expect(() => parseDualSub(JSON.stringify(bad))).toThrow(DualSubParseError)
  }

  it('rechaza JSON malformado', () => {
    expect(() => parseDualSub('{ not json')).toThrow(DualSubParseError)
  })

  it('rechaza version distinta de 1', () => {
    expectReject((d) => ({ ...d, version: 2 }))
  })

  it('rechaza idioma inválido', () => {
    expectReject((d) => ({ ...d, targetLang: 'fr' }))
  })

  it('rechaza sourceLang === targetLang', () => {
    expectReject((d) => ({ ...d, targetLang: 'en' }))
  })

  it('rechaza segments que no es array', () => {
    expectReject((d) => ({ ...d, segments: 'nope' }))
  })

  it('rechaza endMs <= startMs', () => {
    expectReject((d) => {
      d.segments[0].endMs = d.segments[0].startMs
      return d
    })
  })

  it('rechaza startMs negativo', () => {
    expectReject((d) => {
      d.segments[0].startMs = -10
      return d
    })
  })

  it('rechaza segmentos solapados o desordenados', () => {
    expectReject((d) => {
      d.segments[1].startMs = 1000 // solapa con [0, 1800)
      return d
    })
  })

  it('rechaza tiempos no enteros', () => {
    expectReject((d) => {
      d.segments[0].endMs = 1800.5
      return d
    })
  })

  it('rechaza segmento sin texto en el idioma origen', () => {
    expectReject((d) => {
      d.segments[0].texts = { es: 'Solo destino' }
      return d
    })
  })
})
