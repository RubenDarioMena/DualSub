import { describe, expect, it } from 'vitest'
import { planBatches, encodeBatch, decodeBatch } from '../../src/core/translation/batch'
import { TranslationError } from '../../src/core/services/translator'

describe('planBatches (US1)', () => {
  it('agrupa preservando orden y guarda los índices originales', () => {
    const batches = planBatches(['a', 'b', 'c'], { maxItems: 2 })
    expect(batches).toHaveLength(2)
    expect(batches[0]).toEqual({ indices: [0, 1], texts: ['a', 'b'] })
    expect(batches[1]).toEqual({ indices: [2], texts: ['c'] })
  })

  it('omite textos vacíos o solo-espacios (no se envían)', () => {
    const batches = planBatches(['hola', '', '   ', 'mundo'], { maxItems: 10 })
    expect(batches).toHaveLength(1)
    expect(batches[0]).toEqual({ indices: [0, 3], texts: ['hola', 'mundo'] })
  })

  it('corta por maxChars sin partir un texto', () => {
    const texts = ['12345', '6789', 'abc']
    const batches = planBatches(texts, { maxItems: 10, maxChars: 9 })
    expect(batches).toHaveLength(2)
    expect(batches[0].texts).toEqual(['12345', '6789'])
    expect(batches[1].texts).toEqual(['abc'])
  })

  it('un texto que excede maxChars va solo en su lote', () => {
    const big = 'x'.repeat(50)
    const batches = planBatches(['ok', big, 'ok2'], { maxItems: 10, maxChars: 10 })
    expect(batches.map((b) => b.texts)).toEqual([['ok'], [big], ['ok2']])
  })

  it('devuelve vacío si no hay textos no-vacíos', () => {
    expect(planBatches(['', '  '])).toEqual([])
  })
})

describe('encodeBatch / decodeBatch (US1)', () => {
  it('round-trip: lo codificado se decodifica idéntico', () => {
    const texts = ['hola', 'línea\ncon salto', '日本語']
    const raw = encodeBatch(texts)
    expect(decodeBatch(raw, 3)).toEqual(texts)
  })

  it('encodeBatch produce un array JSON', () => {
    expect(JSON.parse(encodeBatch(['a', 'b']))).toEqual(['a', 'b'])
  })

  it('decodeBatch tolera code fences y texto alrededor', () => {
    const raw = 'Claro:\n```json\n["uno", "dos"]\n```\nListo.'
    expect(decodeBatch(raw, 2)).toEqual(['uno', 'dos'])
  })

  it('preserva textos multilínea sin partirlos', () => {
    const texts = ['una\nlínea', 'otra']
    expect(decodeBatch(encodeBatch(texts), 2)).toEqual(texts)
  })

  it('lanza bad-shape si el conteo no coincide (1:1)', () => {
    const raw = encodeBatch(['solo-uno'])
    expect(() => decodeBatch(raw, 2)).toThrow(TranslationError)
    try {
      decodeBatch(raw, 2)
    } catch (e) {
      expect((e as TranslationError).kind).toBe('bad-shape')
    }
  })

  it('lanza bad-shape si no hay array JSON válido', () => {
    expect(() => decodeBatch('lo siento, no puedo', 1)).toThrow(
      expect.objectContaining({ kind: 'bad-shape' }),
    )
  })
})
