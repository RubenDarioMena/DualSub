import { describe, it, expect, vi } from 'vitest'
import { translateWithBisect } from '../../src/core/translation/bisect'
import { TranslationError } from '../../src/core/services/translator'

/** Simula un proveedor que FUSIONA cuando el lote tiene más de `mergeAbove` textos. */
function mergingProvider(mergeAbove: number) {
  return vi.fn(async (batch: string[]) => {
    if (batch.length > mergeAbove) {
      // Devuelve una traducción de menos (longitud no coincide) → bad-shape.
      throw new TranslationError('bad-shape', `devolvió ${batch.length - 1}; se esperaban ${batch.length}`)
    }
    return batch.map((t) => `JA:${t}`)
  })
}

describe('translateWithBisect', () => {
  it('devuelve 1:1 directo cuando el proveedor no fusiona', async () => {
    const fn = vi.fn(async (b: string[]) => b.map((t) => `JA:${t}`))
    const out = await translateWithBisect(['a', 'b', 'c'], fn)
    expect(out).toEqual(['JA:a', 'JA:b', 'JA:c'])
    expect(fn).toHaveBeenCalledTimes(1) // sin reintentos
  })

  it('bisecta hasta lograr 1:1 cuando el proveedor fusiona en lotes grandes', async () => {
    const fn = mergingProvider(1) // fusiona cualquier lote de 2+
    const texts = ['l0', 'l1', 'l2', 'l3', 'l4']
    const out = await translateWithBisect(texts, fn)
    expect(out).toEqual(['JA:l0', 'JA:l1', 'JA:l2', 'JA:l3', 'JA:l4'])
    // Preserva orden y longitud aunque haya partido el lote varias veces.
    expect(out).toHaveLength(texts.length)
  })

  it('preserva el orden con un punto de fusión intermedio (40→39 como el bug real)', async () => {
    const fn = mergingProvider(20) // fusiona solo lotes de >20
    const texts = Array.from({ length: 40 }, (_, i) => `s${i}`)
    const out = await translateWithBisect(texts, fn)
    expect(out).toEqual(texts.map((t) => `JA:${t}`))
  })

  it('propaga errores que NO son bad-shape sin reintentar (auth/red)', async () => {
    const fn = vi.fn(async () => {
      throw new TranslationError('auth', 'clave inválida')
    })
    await expect(translateWithBisect(['a', 'b'], fn)).rejects.toMatchObject({ kind: 'auth' })
    expect(fn).toHaveBeenCalledTimes(1) // no bisecta en auth
  })

  it('si una sola línea sigue dando bad-shape, lo propaga (no puede dividir más)', async () => {
    const fn = vi.fn(async () => {
      throw new TranslationError('bad-shape', 'incluso 1 línea falló')
    })
    await expect(translateWithBisect(['solo'], fn)).rejects.toMatchObject({ kind: 'bad-shape' })
  })
})
