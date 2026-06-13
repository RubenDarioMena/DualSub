import { describe, expect, it } from 'vitest'
import {
  applyOffset,
  findActiveSegment,
  findActiveSegmentIndex,
} from '../../src/core/sync'
import type { SubtitleSegment } from '../../src/core/models'

// Dos diálogos con un hueco entre 1800 y 2100.
const segs: SubtitleSegment[] = [
  { startMs: 0, endMs: 1800, texts: { en: 'Hello there.', es: 'Hola.' } },
  { startMs: 2100, endMs: 4200, texts: { en: 'How are you?', es: '¿Cómo estás?' } },
]

describe('findActiveSegment', () => {
  it('incluye el inicio del intervalo (t = startMs)', () => {
    expect(findActiveSegment(segs, 0)).toBe(segs[0])
    expect(findActiveSegmentIndex(segs, 0)).toBe(0)
  })

  it('mantiene activo justo antes del fin', () => {
    expect(findActiveSegmentIndex(segs, 1799)).toBe(0)
  })

  it('excluye el fin del intervalo (t = endMs)', () => {
    expect(findActiveSegment(segs, 1800)).toBeNull()
    expect(findActiveSegmentIndex(segs, 1800)).toBe(-1)
  })

  it('devuelve null en un hueco entre segmentos', () => {
    expect(findActiveSegment(segs, 1900)).toBeNull()
  })

  it('encuentra el segundo segmento y respeta su fin exclusivo', () => {
    expect(findActiveSegmentIndex(segs, 2100)).toBe(1)
    expect(findActiveSegmentIndex(segs, 4199)).toBe(1)
    expect(findActiveSegmentIndex(segs, 4200)).toBe(-1)
  })

  it('devuelve null antes del primero y después del último', () => {
    expect(findActiveSegment(segs, -100)).toBeNull()
    expect(findActiveSegment(segs, 99999)).toBeNull()
  })

  it('maneja la lista vacía sin error', () => {
    expect(findActiveSegment([], 1000)).toBeNull()
    expect(findActiveSegmentIndex([], 1000)).toBe(-1)
  })
})

describe('applyOffset', () => {
  it('desplaza todos los tiempos con offset positivo', () => {
    const input: SubtitleSegment[] = [{ startMs: 1000, endMs: 2000, texts: { en: 'x' } }]
    const out = applyOffset(input, 500)
    expect(out).toEqual([{ startMs: 1500, endMs: 2500, texts: { en: 'x' } }])
  })

  it('admite offset negativo y tiempos resultantes negativos', () => {
    const input: SubtitleSegment[] = [{ startMs: 200, endMs: 800, texts: { en: 'x' } }]
    const out = applyOffset(input, -500)
    expect(out[0].startMs).toBe(-300)
    expect(out[0].endMs).toBe(300)
  })

  it('no muta la entrada', () => {
    const input: SubtitleSegment[] = [{ startMs: 1000, endMs: 2000, texts: { en: 'x' } }]
    applyOffset(input, 500)
    expect(input[0]).toEqual({ startMs: 1000, endMs: 2000, texts: { en: 'x' } })
  })

  it('offset 0 devuelve una copia, no la misma referencia', () => {
    const out = applyOffset(segs, 0)
    expect(out).toEqual(segs)
    expect(out).not.toBe(segs)
    expect(out[0]).not.toBe(segs[0])
  })

  it('el resultado sigue siendo consultable por findActiveSegment', () => {
    const shifted = applyOffset(segs, 1000)
    // El primer segmento ahora es [1000, 2800): t=500 ya no está activo, t=1000 sí.
    expect(findActiveSegmentIndex(shifted, 500)).toBe(-1)
    expect(findActiveSegmentIndex(shifted, 1000)).toBe(0)
  })
})
