import { describe, expect, it } from 'vitest'
import { parseSrt } from '../../src/core/formats/srt'
import { SubtitleParseError } from '../../src/core/formats/subtitleCommon'
import cleanSrt from '../fixtures/clean.srt?raw'
import dirtySrt from '../fixtures/dirty.srt?raw'
import emptySrt from '../fixtures/empty.srt?raw'

describe('parseSrt', () => {
  it('parsea un .srt limpio en orden con ms correctos (US1 esc.1)', () => {
    const track = parseSrt(cleanSrt)
    expect(track.format).toBe('srt')
    expect(track.cues).toHaveLength(3)
    expect(track.cues[0]).toEqual({
      startMs: 1000,
      endMs: 3000,
      text: 'Hello there.',
    })
    expect(track.cues[1].endMs).toBe(6500)
  })

  it('tolera BOM, CRLF, <i> y multilínea; texto plano con \\n (US1 esc.2)', () => {
    // El fixture conserva el BOM y los CRLF reales del archivo.
    expect(dirtySrt.charCodeAt(0)).toBe(0xfeff)
    expect(dirtySrt).toContain('\r\n')
    const track = parseSrt(dirtySrt)
    expect(track.cues).toHaveLength(2)
    expect(track.cues[0]).toEqual({
      startMs: 1000,
      endMs: 2000,
      text: 'Hello there.\nSecond line.',
    })
    expect(track.cues[1].startMs).toBe(3500)
  })

  it('lanza SubtitleParseError si no hay cues válidos (US1 esc.5)', () => {
    expect(() => parseSrt(emptySrt)).toThrow(SubtitleParseError)
  })
})
