import { describe, expect, it } from 'vitest'
import { mergeChunkTranscripts } from '../../src/core/transcription/mergeChunks'
import type { AudioChunk } from '../../src/core/transcription/chunkPlan'
import type { TranscriptSegment } from '../../src/core/services/transcriber'

describe('mergeChunkTranscripts', () => {
  it('identidad con un solo trozo', () => {
    const chunks: AudioChunk[] = [
      { index: 0, startMs: 0, endMs: 5000, fetchStartMs: 0, fetchEndMs: 5000 },
    ]
    const segs: TranscriptSegment[][] = [
      [
        { startMs: 0, endMs: 1000, text: 'A' },
        { startMs: 1000, endMs: 2000, text: 'B' },
      ],
    ]
    expect(mergeChunkTranscripts(chunks, segs)).toEqual(segs[0])
  })

  it('dos trozos con solape: no duplica la frontera y desplaza tiempos', () => {
    const chunks: AudioChunk[] = [
      { index: 0, startMs: 0, endMs: 1000, fetchStartMs: 0, fetchEndMs: 1200 },
      { index: 1, startMs: 1000, endMs: 2000, fetchStartMs: 800, fetchEndMs: 2000 },
    ]
    const perChunk: TranscriptSegment[][] = [
      // trozo 0 (rel a 0)
      [
        { startMs: 0, endMs: 400, text: 'A' },
        { startMs: 400, endMs: 950, text: 'B' },
        { startMs: 950, endMs: 1050, text: 'X' }, // abs 950 → dueño trozo 0
        { startMs: 1000, endMs: 1150, text: 'dup' }, // abs 1000 → NO es de trozo 0
      ],
      // trozo 1 (rel a 800)
      [
        { startMs: 150, endMs: 250, text: 'X' }, // abs 950 → NO es de trozo 1 (evita dup)
        { startMs: 200, endMs: 350, text: 'dup' }, // abs 1000 → dueño trozo 1
        { startMs: 400, endMs: 900, text: 'D' }, // abs 1200
        { startMs: 900, endMs: 1200, text: 'E' }, // abs 1700
      ],
    ]
    expect(mergeChunkTranscripts(chunks, perChunk)).toEqual([
      { startMs: 0, endMs: 400, text: 'A' },
      { startMs: 400, endMs: 950, text: 'B' },
      { startMs: 950, endMs: 1050, text: 'X' },
      { startMs: 1000, endMs: 1150, text: 'dup' },
      { startMs: 1200, endMs: 1700, text: 'D' },
      { startMs: 1700, endMs: 2000, text: 'E' },
    ])
  })

  it('tres trozos: continuidad total y orden por startMs', () => {
    const chunks: AudioChunk[] = [
      { index: 0, startMs: 0, endMs: 1000, fetchStartMs: 0, fetchEndMs: 1000 },
      { index: 1, startMs: 1000, endMs: 2000, fetchStartMs: 1000, fetchEndMs: 2000 },
      { index: 2, startMs: 2000, endMs: 3000, fetchStartMs: 2000, fetchEndMs: 3000 },
    ]
    const perChunk: TranscriptSegment[][] = [
      [{ startMs: 0, endMs: 500, text: 'a' }],
      [{ startMs: 0, endMs: 500, text: 'b' }], // abs 1000
      [{ startMs: 0, endMs: 500, text: 'c' }], // abs 2000
    ]
    expect(mergeChunkTranscripts(chunks, perChunk)).toEqual([
      { startMs: 0, endMs: 500, text: 'a' },
      { startMs: 1000, endMs: 1500, text: 'b' },
      { startMs: 2000, endMs: 2500, text: 'c' },
    ])
  })

  it('trozo sin segmentos no rompe el ensamblado', () => {
    const chunks: AudioChunk[] = [
      { index: 0, startMs: 0, endMs: 1000, fetchStartMs: 0, fetchEndMs: 1000 },
      { index: 1, startMs: 1000, endMs: 2000, fetchStartMs: 1000, fetchEndMs: 2000 },
    ]
    const perChunk: TranscriptSegment[][] = [
      [{ startMs: 0, endMs: 500, text: 'a' }],
      [],
    ]
    expect(mergeChunkTranscripts(chunks, perChunk)).toEqual([
      { startMs: 0, endMs: 500, text: 'a' },
    ])
  })
})
