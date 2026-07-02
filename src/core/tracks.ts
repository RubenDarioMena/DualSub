/**
 * Helpers puros sobre las pistas de un DualSubDocument v2 (sin React/DOM/fetch).
 * Centraliza: pista maestra, ids únicos por idioma ("es", "es-2"…), la vista
 * Arriba/Abajo por defecto y el conteo de pendientes de una traducción.
 * Spec: specs/007-multi-track-subtitles
 */
import type { DualSubDocument, LangCode, TrackMeta } from './models'

/** Vista del player: qué pista va arriba y cuál abajo (o ninguna). */
export interface TrackView {
  top: string
  bottom: string | null
}

/** Pista por id, o `null` si no existe. */
export function getTrack(doc: DualSubDocument, id: string): TrackMeta | null {
  return doc.tracks.find((t) => t.id === id) ?? null
}

/**
 * Pista maestra (la que fija el timing). Por invariante del formato siempre
 * existe; si el documento viniera corrupto, cae a la primera pista.
 */
export function masterTrack(doc: DualSubDocument): TrackMeta {
  return getTrack(doc, doc.masterId) ?? doc.tracks[0]
}

/** Pistas de un idioma, en el orden del documento. */
export function tracksForLang(doc: DualSubDocument, lang: LangCode): TrackMeta[] {
  return doc.tracks.filter((t) => t.lang === lang)
}

/**
 * Siguiente id libre para una pista de `lang`: `"es"`, y si está ocupado
 * `"es-2"`, `"es-3"`… Nunca colisiona con ids existentes.
 */
export function nextTrackId(doc: DualSubDocument, lang: LangCode): string {
  const used = new Set(doc.tracks.map((t) => t.id))
  if (!used.has(lang)) return lang
  for (let n = 2; ; n++) {
    const id = `${lang}-${n}`
    if (!used.has(id)) return id
  }
}

/**
 * Vista por defecto: la maestra arriba y la primera pista no-maestra abajo
 * (o nada si el documento solo tiene una pista).
 */
export function defaultView(doc: DualSubDocument): TrackView {
  const master = masterTrack(doc)
  const bottom = doc.tracks.find((t) => t.id !== master.id) ?? null
  return { top: master.id, bottom: bottom ? bottom.id : null }
}

/**
 * Ajusta una vista (posiblemente guardada con otro documento) a las pistas que
 * existen AHORA: ids colgantes caen al valor por defecto. Idempotente.
 */
export function resolveView(doc: DualSubDocument, view?: TrackView | null): TrackView {
  const fallback = defaultView(doc)
  if (!view) return fallback
  const top = getTrack(doc, view.top) ? view.top : fallback.top
  const bottom = view.bottom !== null && getTrack(doc, view.bottom) ? view.bottom : null
  // Arriba y abajo nunca son la misma pista.
  return bottom === top ? { top, bottom: fallback.bottom === top ? null : fallback.bottom } : { top, bottom }
}

/**
 * Nº de segmentos PENDIENTES de una pista: aquellos cuyo texto maestro no está
 * vacío y aún no tienen texto en `trackId`. 0 ⇒ pista completa.
 */
export function pendingCount(doc: DualSubDocument, trackId: string): number {
  let pending = 0
  for (const seg of doc.segments) {
    const master = seg.texts[doc.masterId]
    if (master !== undefined && master.trim() !== '' && seg.texts[trackId] === undefined) {
      pending++
    }
  }
  return pending
}
