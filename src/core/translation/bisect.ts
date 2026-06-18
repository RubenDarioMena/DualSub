/**
 * Auto-bisección para traducción por lotes. Puro: sin `fetch`/DOM (la función de
 * traducción se inyecta). Los LLM a veces **fusionan o dividen** líneas en el idioma
 * destino (típico en japonés: une cláusulas), rompiendo la garantía 1:1. En vez de
 * abortar el lote, lo partimos en mitades y reintentamos hasta lograr 1:1 o llegar a
 * una sola línea (donde ya no puede fusionar). Solo reintenta `bad-shape`; otros
 * errores (auth/red) se propagan tal cual. Spec: 003-translate-api-byok.
 */
import { TranslationError } from '../services/translator'

/**
 * Traduce `texts` con `fn` (un lote → array alineado 1:1). Si `fn` lanza `bad-shape`
 * y hay más de un texto, divide en mitades y reintenta cada una. Preserva el orden.
 */
export async function translateWithBisect(
  texts: string[],
  fn: (batch: string[]) => Promise<string[]>,
): Promise<string[]> {
  try {
    return await fn(texts)
  } catch (e) {
    const isBadShape = e instanceof TranslationError && e.kind === 'bad-shape'
    if (!isBadShape || texts.length <= 1) throw e
    // El lote fusionó/dividió líneas: reintenta en mitades (secuencial para no
    // disparar el rate-limit del proveedor).
    const mid = Math.ceil(texts.length / 2)
    const left = await translateWithBisect(texts.slice(0, mid), fn)
    const right = await translateWithBisect(texts.slice(mid), fn)
    return [...left, ...right]
  }
}
