import { describe, expect, it } from 'vitest'
import { buildSingle, mergeDual } from '../../src/core/formats/buildDocument'
import { parseSrt } from '../../src/core/formats/srt'
import { validateDocument } from '../../src/core/formats/dualsub'
import cleanSrt from '../fixtures/clean.srt?raw'
import unorderedSrt from '../fixtures/unordered-overlap.srt?raw'
import movieEn from '../fixtures/movie.en.srt?raw'
import movieEs from '../fixtures/movie.es.srt?raw'

describe('buildSingle (US1)', () => {
  it('construye un documento de una sola pista (maestra) válido', () => {
    const doc = buildSingle(parseSrt(cleanSrt), 'en', 'clean.srt')
    expect(doc.masterId).toBe('en')
    expect(doc.tracks).toEqual([
      { id: 'en', lang: 'en', origin: 'import', label: 'clean.srt' },
    ])
    expect(doc.segments).toHaveLength(3)
    expect(doc.segments[0].texts.en).toBe('Hello there.')
    expect(doc.segments[0].texts.es).toBeUndefined()
    expect(doc.meta?.source).toBe('import-srt')
    // Red de seguridad: cumple las invariantes de spec 000/007.
    expect(() => validateDocument(doc)).not.toThrow()
  })

  it('normaliza cues desordenados/solapados a un documento válido (US1 esc.4)', () => {
    const doc = buildSingle(parseSrt(unorderedSrt), 'en')
    expect(() => validateDocument(doc)).not.toThrow()
    expect(doc.segments).toEqual([
      { startMs: 1000, endMs: 3000, texts: { en: 'First in time.' } },
      { startMs: 3000, endMs: 5000, texts: { en: 'Overlaps first and third.' } },
      { startMs: 5000, endMs: 7000, texts: { en: 'Third in time.' } },
    ])
  })
})

describe('mergeDual (US2)', () => {
  it('alinea texto destino por solape con el origen como master (SC-003)', () => {
    const doc = mergeDual(
      parseSrt(movieEn),
      'en',
      parseSrt(movieEs),
      'es',
    )
    expect(() => validateDocument(doc)).not.toThrow()
    expect(doc.masterId).toBe('en')
    expect(doc.tracks.map((t) => [t.id, t.lang])).toEqual([
      ['en', 'en'],
      ['es', 'es'],
    ])
    // El timing es el del origen (2 segmentos EN).
    expect(doc.segments).toHaveLength(2)
    // Dos cues ES solapan el primer segmento EN → concatenados con \n.
    expect(doc.segments[0]).toEqual({
      startMs: 1000,
      endMs: 5000,
      texts: { en: 'Hello world.', es: 'Hola mundo.\nOtra vez.' },
    })
    expect(doc.segments[1].texts.es).toBe('Adiós mundo.')
  })

  it('NO duplica un cue destino que cruza dos segmentos origen (max solape)', () => {
    const en = parseSrt(
      [
        '1',
        '00:00:00,000 --> 00:00:04,000',
        'A',
        '',
        '2',
        '00:00:04,000 --> 00:00:08,000',
        'B',
        '',
      ].join('\n'),
    )
    // Un cue ES (3500–6000) cruza ambos: solapa seg1 500ms y seg2 2000ms.
    const es = parseSrt(
      ['1', '00:00:03,500 --> 00:00:06,000', 'Cruza', ''].join('\n'),
    )
    const doc = mergeDual(en, 'en', es, 'es')
    // Aparece UNA sola vez, en el de mayor solape (seg2); no en ambos.
    expect(doc.segments[0].texts.es).toBeUndefined()
    expect(doc.segments[1].texts.es).toBe('Cruza')
    const veces = doc.segments.filter((s) => s.texts.es === 'Cruza').length
    expect(veces).toBe(1)
  })

  it('deja solo-origen los segmentos sin solape (sin error)', () => {
    const en = parseSrt(movieEn)
    // Pista destino que solo solapa el segundo segmento EN.
    const es = parseSrt(
      ['1', '00:00:07,000 --> 00:00:09,000', 'Solo el segundo.', ''].join('\n'),
    )
    const doc = mergeDual(en, 'en', es, 'es')
    expect(doc.segments[0].texts.es).toBeUndefined()
    expect(doc.segments[1].texts.es).toBe('Solo el segundo.')
    expect(() => validateDocument(doc)).not.toThrow()
  })

  it('dos pistas del MISMO idioma se desambiguan (es, es-2) — spec 007', () => {
    const es1 = parseSrt(movieEs)
    const es2 = parseSrt(movieEs)
    const doc = mergeDual(es1, 'es', es2, 'es', { source: 'a.srt', target: 'b.srt' })
    expect(doc.tracks.map((t) => t.id)).toEqual(['es', 'es-2'])
    expect(doc.masterId).toBe('es')
    expect(doc.segments[0].texts['es-2']).toBeDefined()
    expect(() => validateDocument(doc)).not.toThrow()
  })
})
