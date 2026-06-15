import { describe, expect, it } from 'vitest'
import {
  inferLang,
  normalizeCues,
  parseTimecode,
  pickParser,
  stripMarkup,
  type SubtitleCue,
} from '../../src/core/formats/subtitleCommon'

describe('parseTimecode', () => {
  it('acepta HH:MM:SS,mmm (coma, SRT) → ms enteros', () => {
    expect(parseTimecode('00:00:01,500')).toBe(1500)
    expect(parseTimecode('01:02:03,004')).toBe(3723004)
  })

  it('acepta HH:MM:SS.mmm (punto, VTT)', () => {
    expect(parseTimecode('00:00:01.500')).toBe(1500)
  })

  it('acepta MM:SS.mmm sin hora', () => {
    expect(parseTimecode('01:30.500')).toBe(90500)
    expect(parseTimecode('00:03,000')).toBe(3000)
  })

  it('rellena milisegundos cortos a la derecha (.5 → 500)', () => {
    expect(parseTimecode('00:00:00.5')).toBe(500)
    expect(parseTimecode('00:00:00.05')).toBe(50)
  })

  it('devuelve NaN ante un timecode inválido', () => {
    expect(parseTimecode('not a time')).toBeNaN()
    expect(parseTimecode('')).toBeNaN()
  })
})

describe('stripMarkup', () => {
  it('elimina etiquetas <i>/<b>/<font> y conserva el texto', () => {
    expect(stripMarkup('<i>Hola</i> <b>mundo</b>')).toBe('Hola mundo')
    expect(stripMarkup('<font color="red">Rojo</font>')).toBe('Rojo')
  })

  it('elimina overrides ASS {\\anX} y tags de posición VTT <c>', () => {
    expect(stripMarkup('{\\an8}Arriba')).toBe('Arriba')
    expect(stripMarkup('<c.yellow>Styled</c> text.')).toBe('Styled text.')
  })

  it('conserva multilínea uniendo con \\n y recorta líneas', () => {
    expect(stripMarkup('  Hello \nthere.  ')).toBe('Hello\nthere.')
  })

  it('descarta líneas vacías sobrantes', () => {
    expect(stripMarkup('A\n\n\nB')).toBe('A\nB')
  })

  it('decodifica entidades básicas', () => {
    expect(stripMarkup('Tom &amp; Jerry &lt;3')).toBe('Tom & Jerry <3')
  })
})

describe('normalizeCues', () => {
  const cue = (startMs: number, endMs: number, text = 't'): SubtitleCue => ({
    startMs,
    endMs,
    text,
  })

  it('ordena por startMs', () => {
    const out = normalizeCues([cue(5000, 6000), cue(1000, 2000)])
    expect(out.map((c) => c.startMs)).toEqual([1000, 5000])
  })

  it('descarta cues con endMs <= startMs y startMs negativo', () => {
    const out = normalizeCues([cue(1000, 1000), cue(2000, 1000), cue(-100, 50)])
    expect(out).toHaveLength(0)
  })

  it('colapsa duplicados exactos', () => {
    const out = normalizeCues([cue(1000, 2000, 'x'), cue(1000, 2000, 'x')])
    expect(out).toHaveLength(1)
  })

  it('resuelve solapes truncando el cue previo (D5)', () => {
    const out = normalizeCues([cue(1000, 4000, 'a'), cue(3000, 6000, 'b')])
    expect(out).toEqual([
      { startMs: 1000, endMs: 3000, text: 'a' },
      { startMs: 3000, endMs: 6000, text: 'b' },
    ])
  })

  it('descarta el previo si truncarlo lo deja vacío', () => {
    const out = normalizeCues([cue(1000, 4000, 'a'), cue(1000, 6000, 'b')])
    expect(out).toEqual([{ startMs: 1000, endMs: 6000, text: 'b' }])
  })
})

describe('pickParser', () => {
  it('elige por extensión (case-insensitive)', () => {
    expect(pickParser('movie.srt')).toBe('srt')
    expect(pickParser('movie.VTT')).toBe('vtt')
  })

  it('devuelve null para extensiones no soportadas', () => {
    expect(pickParser('subs.txt')).toBeNull()
    expect(pickParser('noext')).toBeNull()
  })
})

describe('inferLang', () => {
  it('infiere el idioma del sufijo del nombre', () => {
    expect(inferLang('pelicula.en.srt')).toBe('en')
    expect(inferLang('pelicula.es.vtt')).toBe('es')
    expect(inferLang('movie.JA.srt')).toBe('ja')
  })

  it('devuelve null sin sufijo reconocible', () => {
    expect(inferLang('subs.txt')).toBeNull()
    expect(inferLang('movie.srt')).toBeNull()
    expect(inferLang('movie.fr.srt')).toBeNull()
  })
})
