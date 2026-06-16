/**
 * Batching y codificación 1:1 para la traducción. Puro: sin `fetch`/DOM.
 * Protocolo de lote = array JSON (D2). Spec: 003-translate-api-byok.
 */
import { TranslationError } from '../services/translator'

/** Un lote de textos de origen + la posición original de cada uno. */
export interface Batch {
  indices: number[]
  texts: string[]
}

export interface BatchOptions {
  /** Máximo de textos por lote (default 40). */
  maxItems?: number
  /** Máximo de caracteres por lote (default ~4000). Un texto mayor va solo. */
  maxChars?: number
}

const DEFAULT_MAX_ITEMS = 40
const DEFAULT_MAX_CHARS = 4000

/**
 * Agrupa los textos **no vacíos** en lotes, preservando el orden y guardando los
 * índices originales para reensamblar. Omite textos vacíos/solo-espacios (D3).
 */
export function planBatches(texts: string[], opts: BatchOptions = {}): Batch[] {
  const maxItems = opts.maxItems ?? DEFAULT_MAX_ITEMS
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS

  const batches: Batch[] = []
  let cur: Batch = { indices: [], texts: [] }
  let curChars = 0

  const flush = () => {
    if (cur.texts.length > 0) {
      batches.push(cur)
      cur = { indices: [], texts: [] }
      curChars = 0
    }
  }

  texts.forEach((text, index) => {
    if (text.trim() === '') return // vacío: no se envía, se reinserta al ensamblar
    const len = text.length
    const wouldOverflow =
      cur.texts.length >= maxItems || (cur.texts.length > 0 && curChars + len > maxChars)
    if (wouldOverflow) flush()
    cur.indices.push(index)
    cur.texts.push(text)
    curChars += len
  })
  flush()

  return batches
}

/** Serializa los textos de un lote como array JSON (lo que se manda al LLM). */
export function encodeBatch(texts: string[]): string {
  return JSON.stringify(texts)
}

/**
 * Extrae el primer array JSON de strings de `raw` (tolera ```code fences``` y texto
 * alrededor) y valida que su longitud sea `expected` (1:1, D2).
 * @throws {TranslationError} `kind: 'bad-shape'` si no hay array válido o el conteo difiere.
 */
export function decodeBatch(raw: string, expected: number): string[] {
  const arr = extractJsonArray(raw)
  if (arr === null) {
    throw new TranslationError('bad-shape', 'La respuesta no contiene un array JSON.')
  }
  if (arr.length !== expected) {
    throw new TranslationError(
      'bad-shape',
      `El lote devolvió ${arr.length} traducciones; se esperaban ${expected}.`,
    )
  }
  return arr
}

/** Intenta parsear el primer array JSON de strings presente en `raw`. */
function extractJsonArray(raw: string): string[] | null {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start === -1 || end <= start) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
    return null
  }
  return parsed as string[]
}
