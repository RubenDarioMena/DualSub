import { describe, expect, it } from 'vitest'
import {
  DualSubParseError,
  parseDualSub,
  serializeDualSub,
  validateDocument,
} from '../../src/core/formats/dualsub'
import type { DualSubDocument } from '../../src/core/models'

function validDoc(): DualSubDocument {
  return {
    version: 2,
    masterId: 'en',
    tracks: [
      { id: 'en', lang: 'en', origin: 'original' },
      { id: 'es', lang: 'es', origin: 'translation', label: 'Groq' },
    ],
    segments: [
      { startMs: 0, endMs: 1800, texts: { en: 'Hello there.', es: 'Hola.' } },
      { startMs: 1800, endMs: 4200, texts: { en: 'How are you?', es: '¿Cómo estás?' } },
    ],
    meta: { title: 'Demo', durationMs: 4200, source: 'mock' },
  }
}

describe('serializeDualSub / parseDualSub round-trip (v2)', () => {
  it('parse(serialize(doc)) es deep-equal al original', () => {
    const doc = validDoc()
    expect(parseDualSub(serializeDualSub(doc))).toEqual(doc)
  })

  it('acepta un documento de una sola pista y sin meta', () => {
    const doc: DualSubDocument = {
      version: 2,
      masterId: 'ja',
      tracks: [{ id: 'ja', lang: 'ja' }],
      segments: [{ startMs: 0, endMs: 1000, texts: { ja: 'こんにちは' } }],
    }
    expect(parseDualSub(serializeDualSub(doc))).toEqual(doc)
  })

  it('acepta varias pistas del MISMO idioma (es, es-2)', () => {
    const doc: DualSubDocument = {
      version: 2,
      masterId: 'en',
      tracks: [
        { id: 'en', lang: 'en' },
        { id: 'es', lang: 'es', label: 'Groq' },
        { id: 'es-2', lang: 'es', label: 'DeepL' },
      ],
      segments: [
        { startMs: 0, endMs: 1000, texts: { en: 'Hi', es: 'Hola', 'es-2': 'Buenas' } },
      ],
    }
    expect(parseDualSub(serializeDualSub(doc))).toEqual(doc)
  })
})

describe('migración v1 → v2', () => {
  it('migra el par origen/destino a pistas y masterId (sin pérdida)', () => {
    const v1 = {
      version: 1,
      sourceLang: 'en',
      targetLang: 'es',
      segments: [
        { startMs: 0, endMs: 1000, texts: { en: 'Hello', es: 'Hola' } },
        { startMs: 1000, endMs: 2000, texts: { en: 'Bye' } },
      ],
      meta: { title: 'Viejo' },
    }
    const doc = validateDocument(v1)
    expect(doc.version).toBe(2)
    expect(doc.masterId).toBe('en')
    expect(doc.tracks).toEqual([
      { id: 'en', lang: 'en', origin: 'original' },
      { id: 'es', lang: 'es', origin: 'translation' },
    ])
    expect(doc.segments[0].texts).toEqual({ en: 'Hello', es: 'Hola' })
    expect(doc.segments[1].texts).toEqual({ en: 'Bye' })
    expect(doc.meta?.title).toBe('Viejo')
  })

  it('un destino v1 sin ningún texto NO crea pista (traducción pendiente)', () => {
    const v1 = {
      version: 1,
      sourceLang: 'en',
      targetLang: 'es',
      segments: [{ startMs: 0, endMs: 1000, texts: { en: 'Hello' } }],
    }
    const doc = validateDocument(v1)
    expect(doc.tracks).toHaveLength(1)
    expect(doc.tracks[0].id).toBe('en')
  })

  it('rechaza v1 con sourceLang === targetLang', () => {
    const v1 = {
      version: 1,
      sourceLang: 'en',
      targetLang: 'en',
      segments: [],
    }
    expect(() => validateDocument(v1)).toThrow(DualSubParseError)
  })
})

describe('parseDualSub validación (v2)', () => {
  function expectReject(mutate: (d: DualSubDocument) => unknown) {
    const bad = mutate(validDoc())
    expect(() => parseDualSub(JSON.stringify(bad))).toThrow(DualSubParseError)
  }

  it('rechaza JSON malformado', () => {
    expect(() => parseDualSub('{ not json')).toThrow(DualSubParseError)
  })

  it('rechaza version distinta de 1 o 2', () => {
    expectReject((d) => ({ ...d, version: 3 }))
  })

  it('rechaza tracks vacío o ausente', () => {
    expectReject((d) => ({ ...d, tracks: [] }))
  })

  it('rechaza ids de pista duplicados', () => {
    expectReject((d) => ({
      ...d,
      tracks: [
        { id: 'en', lang: 'en' },
        { id: 'en', lang: 'es' },
      ],
    }))
  })

  it('rechaza masterId que no es una pista', () => {
    expectReject((d) => ({ ...d, masterId: 'ja' }))
  })

  it('rechaza idioma de pista inválido', () => {
    expectReject((d) => ({
      ...d,
      tracks: [{ id: 'fr', lang: 'fr' }],
      masterId: 'fr',
    }))
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

  it('rechaza segmento sin texto en la pista maestra', () => {
    expectReject((d) => {
      d.segments[0].texts = { es: 'Solo traducción' }
      return d
    })
  })

  it('ignora claves de texts que no son pistas del documento', () => {
    const raw = validDoc() as unknown as { segments: { texts: Record<string, string> }[] }
    raw.segments[0].texts['ja'] = 'fantasma'
    const doc = parseDualSub(JSON.stringify(raw))
    expect(doc.segments[0].texts['ja']).toBeUndefined()
  })
})
