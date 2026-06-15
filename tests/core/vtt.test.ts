import { describe, expect, it } from 'vitest'
import { parseVtt } from '../../src/core/formats/vtt'
import basicVtt from '../fixtures/basic.vtt?raw'
import notesVtt from '../fixtures/notes.vtt?raw'

describe('parseVtt', () => {
  it('parsea timestamps sin hora (MM:SS.mmm) ignorando la cabecera (US1 esc.3)', () => {
    const track = parseVtt(basicVtt)
    expect(track.format).toBe('vtt')
    expect(track.cues).toHaveLength(2)
    expect(track.cues[0]).toEqual({
      startMs: 1000,
      endMs: 3000,
      text: 'No hours here.',
    })
    expect(track.cues[1]).toEqual({
      startMs: 4000,
      endMs: 6000,
      text: 'Second cue.',
    })
  })

  it('ignora NOTE/STYLE y el identificador de cue; elimina <c>/posición', () => {
    const track = parseVtt(notesVtt)
    expect(track.cues).toHaveLength(2)
    expect(track.cues[0]).toEqual({
      startMs: 1000,
      endMs: 3000,
      text: 'Styled text.',
    })
    // El cue con settings de posición tras el timecode se parsea bien.
    expect(track.cues[1]).toEqual({
      startMs: 4000,
      endMs: 6000,
      text: 'Positioned cue.',
    })
  })
})
