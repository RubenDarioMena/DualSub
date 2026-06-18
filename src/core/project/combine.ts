/**
 * Derivación de pares por el idioma pivote (spec 004, US4). PURO: sin React/DOM/fetch.
 *
 * Caso de uso: tengo EN/ES y EN/JA del MISMO video (mismo inglés base y misma rejilla
 * de tiempos). `combineByPivot` los unifica en un documento multi-idioma `{en,es,ja}`
 * por *zip* índice a índice (sin traducir, tiempos intactos); `selectPair` proyecta el
 * par a mostrar (p. ej. ES→JA) listo para el Player. Reusa el formato 000.
 * Spec: specs/004-local-persistence · data-model.md §"Lógica pura de derivación".
 */
import {
  type DualSubDocument,
  type LangCode,
  type SegmentTexts,
  type SubtitleSegment,
} from '../models'

/** Se lanza si se intenta combinar dos documentos que no comparten pivote/rejilla. */
export class PivotMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PivotMismatchError'
  }
}

/**
 * ¿Comparten idioma pivote (`sourceLang`) y la MISMA rejilla de tiempos índice a
 * índice (mismo nº de segmentos y mismos `startMs`/`endMs`)? Es la precondición para
 * combinar sin re-alinear nada.
 */
export function sharesPivotGrid(a: DualSubDocument, b: DualSubDocument): boolean {
  if (a.sourceLang !== b.sourceLang) return false
  if (a.segments.length !== b.segments.length) return false
  return a.segments.every((s, i) => {
    const t = b.segments[i]
    return s.startMs === t.startMs && s.endMs === t.endMs
  })
}

/**
 * Unifica dos documentos que comparten pivote + rejilla en uno multi-idioma: por cada
 * segmento, `texts = { ...a.texts_i, ...b.texts_i }` (no muta entradas). El pivote
 * (`sourceLang`) está presente en todos, así que el resultado pasa `validateDocument`.
 * @throws {PivotMismatchError} si no se cumple `sharesPivotGrid(a, b)`.
 */
export function combineByPivot(a: DualSubDocument, b: DualSubDocument): DualSubDocument {
  if (!sharesPivotGrid(a, b)) {
    throw new PivotMismatchError(
      'Los proyectos no comparten el mismo idioma base ni la misma rejilla de tiempos.',
    )
  }
  const segments: SubtitleSegment[] = a.segments.map((s, i) => ({
    startMs: s.startMs,
    endMs: s.endMs,
    texts: { ...s.texts, ...b.segments[i].texts },
  }))
  return {
    version: 1,
    sourceLang: a.sourceLang,
    targetLang: a.targetLang,
    segments,
    ...(a.meta ? { meta: { ...a.meta } } : {}),
  }
}

/**
 * Proyecta un par a mostrar desde un documento (posiblemente multi-idioma): fija
 * `sourceLang`/`targetLang` y descarta los segmentos que no tengan el idioma origen
 * (un segmento sin origen no forma parte de ese par). Así el resultado es siempre un
 * documento VÁLIDO y persistible. No muta la entrada ni recalcula tiempos.
 * @throws {Error} si `source === target`.
 */
export function selectPair(
  doc: DualSubDocument,
  sourceLang: LangCode,
  targetLang: LangCode,
): DualSubDocument {
  if (sourceLang === targetLang) {
    throw new Error('El idioma origen y el destino del par no pueden ser el mismo.')
  }
  const segments: SubtitleSegment[] = doc.segments
    .filter((s) => typeof s.texts[sourceLang] === 'string')
    .map((s) => ({ startMs: s.startMs, endMs: s.endMs, texts: { ...s.texts } as SegmentTexts }))
  return {
    version: 1,
    sourceLang,
    targetLang,
    segments,
    ...(doc.meta ? { meta: { ...doc.meta } } : {}),
  }
}
