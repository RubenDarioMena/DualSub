/**
 * Combinación de proyectos por la pista maestra (spec 004 US4, reformulada para
 * multi-pista en la 007). PURO: sin React/DOM/fetch.
 *
 * Caso de uso: tengo EN/ES y EN/JA del MISMO video (mismo idioma maestro y misma
 * rejilla de tiempos). `combineByPivot` los unifica en UN documento multi-pista
 * {en, es, ja} por *zip* índice a índice (sin traducir, tiempos intactos). Las
 * pistas de B que colisionan por id se renombran ("es" → "es-2"); la maestra de
 * B se descarta (la de A manda). Reusa el formato 000/007.
 */
import { masterTrack, nextTrackId } from '../tracks'
import {
  type DualSubDocument,
  type SegmentTexts,
  type SubtitleSegment,
  type TrackMeta,
} from '../models'

/** Se lanza si se intenta combinar dos documentos que no comparten pivote/rejilla. */
export class PivotMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PivotMismatchError'
  }
}

/**
 * ¿Comparten idioma maestro y la MISMA rejilla de tiempos índice a índice
 * (mismo nº de segmentos y mismos `startMs`/`endMs`)? Es la precondición para
 * combinar sin re-alinear nada.
 */
export function sharesPivotGrid(a: DualSubDocument, b: DualSubDocument): boolean {
  if (masterTrack(a).lang !== masterTrack(b).lang) return false
  if (a.segments.length !== b.segments.length) return false
  return a.segments.every((s, i) => {
    const t = b.segments[i]
    return s.startMs === t.startMs && s.endMs === t.endMs
  })
}

/**
 * Unifica dos documentos que comparten pivote + rejilla en uno multi-pista: las
 * pistas de A + las no-maestras de B (renombradas si su id colisiona). No muta
 * las entradas. El texto maestro es el de A.
 * @throws {PivotMismatchError} si no se cumple `sharesPivotGrid(a, b)`.
 */
export function combineByPivot(a: DualSubDocument, b: DualSubDocument): DualSubDocument {
  if (!sharesPivotGrid(a, b)) {
    throw new PivotMismatchError(
      'Los proyectos no comparten el mismo idioma base ni la misma rejilla de tiempos.',
    )
  }

  const tracks: TrackMeta[] = a.tracks.map((t) => ({ ...t }))
  const result: DualSubDocument = {
    version: 2,
    masterId: a.masterId,
    tracks,
    segments: [],
    ...(a.meta ? { meta: { ...a.meta } } : {}),
  }
  // id de B → id en el combinado (renombra colisiones; omite la maestra de B).
  const idMap = new Map<string, string>()
  for (const t of b.tracks) {
    if (t.id === b.masterId) continue
    const newId = tracks.some((x) => x.id === t.id) ? nextTrackId(result, t.lang) : t.id
    idMap.set(t.id, newId)
    tracks.push({ ...t, id: newId })
  }

  const segments: SubtitleSegment[] = a.segments.map((s, i) => {
    const texts: SegmentTexts = { ...s.texts }
    const bTexts = b.segments[i].texts
    for (const [bId, newId] of idMap) {
      const value = bTexts[bId]
      if (value !== undefined) texts[newId] = value
    }
    return { startMs: s.startMs, endMs: s.endMs, texts }
  })
  result.segments = segments
  return result
}
