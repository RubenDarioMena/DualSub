import { describe, expect, it } from 'vitest'
import { planChunks, SINGLE_MAX_BYTES } from '../../src/core/transcription/chunkPlan'

const MB = 1024 * 1024

describe('planChunks', () => {
  it('envío único cuando el audio cabe (≤ límite)', () => {
    const plan = planChunks(90_000, 10 * MB)
    expect(plan).toEqual([
      { index: 0, startMs: 0, endMs: 90_000, fetchStartMs: 0, fetchEndMs: 90_000 },
    ])
  })

  it('en el borde exacto del límite sigue siendo envío único', () => {
    expect(planChunks(60_000, SINGLE_MAX_BYTES)).toHaveLength(1)
  })

  it('trocea en N = ceil(size/target) tramos por tiempo', () => {
    // 45 MB / 20 MB → 3 trozos; 90 s → 30 s cada uno.
    const plan = planChunks(90_000, 45 * MB, { targetChunkBytes: 20 * MB, overlapMs: 2000 })
    expect(plan).toHaveLength(3)
    expect(plan.map((c) => [c.startMs, c.endMs])).toEqual([
      [0, 30_000],
      [30_000, 60_000],
      [60_000, 90_000],
    ])
  })

  it('aplica solape clampeado en los bordes', () => {
    const plan = planChunks(90_000, 45 * MB, { targetChunkBytes: 20 * MB, overlapMs: 2000 })
    // primer trozo: fetchStart no baja de 0; último: fetchEnd no pasa de durationMs
    expect(plan[0].fetchStartMs).toBe(0)
    expect(plan[0].fetchEndMs).toBe(32_000)
    expect(plan[1].fetchStartMs).toBe(28_000)
    expect(plan[1].fetchEndMs).toBe(62_000)
    expect(plan[2].fetchStartMs).toBe(58_000)
    expect(plan[2].fetchEndMs).toBe(90_000)
  })

  it('los intervalos nominales cubren [0, durationMs) sin huecos ni solape', () => {
    const dur = 123_456
    const plan = planChunks(dur, 100 * MB, { targetChunkBytes: 20 * MB })
    expect(plan[0].startMs).toBe(0)
    expect(plan[plan.length - 1].endMs).toBe(dur)
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].startMs).toBe(plan[i - 1].endMs) // contiguo, sin hueco ni solape
    }
    // índices consecutivos desde 0
    expect(plan.map((c) => c.index)).toEqual(plan.map((_, i) => i))
  })

  it('duración no positiva → sin trozos', () => {
    expect(planChunks(0, 50 * MB)).toEqual([])
    expect(planChunks(-5, 50 * MB)).toEqual([])
  })
})
