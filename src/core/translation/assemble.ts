/**
 * Ensamblado inmutable de una traducción como PISTA del documento. Puro: sin
 * `fetch`/DOM. 1:1 estricto — mismo nº de segmentos y timing (el de la pista
 * maestra); el documento de entrada NO se muta (D4, FR-001/2). Permite varias
 * pistas del mismo idioma ("es", "es-2"…): cada traducción es una pista nueva
 * o completa una existente. Specs: 003-translate-api-byok · 007-multi-track.
 */
import type { DualSubDocument, LangCode, TrackMeta } from '../models'

/** Identidad de la pista destino de una traducción. */
export interface TranslationTrackSpec {
  id: string
  lang: LangCode
  /** Etiqueta legible (p. ej. el proveedor: "Groq", "DeepL"). */
  label?: string
}

/**
 * Devuelve un `DualSubDocument` **nuevo** con `texts[spec.id]` relleno por
 * índice. Si la pista no existe se añade (origin `'translation'`); si existe,
 * solo se rellenan los textos definidos en `byIndex` (completar pendientes).
 * Copia cada segmento (timing intacto). `meta.source = 'api-pipeline'`.
 */
export function assembleTranslated(
  doc: DualSubDocument,
  spec: TranslationTrackSpec,
  byIndex: (string | undefined)[],
): DualSubDocument {
  const exists = doc.tracks.some((t) => t.id === spec.id)
  const added: TrackMeta = { id: spec.id, lang: spec.lang, origin: 'translation' }
  if (spec.label) added.label = spec.label
  const tracks = exists ? doc.tracks.map((t) => ({ ...t })) : [...doc.tracks.map((t) => ({ ...t })), added]

  const segments = doc.segments.map((seg, i) => {
    const texts = { ...seg.texts }
    const translated = byIndex[i]
    if (translated !== undefined) texts[spec.id] = translated
    return { startMs: seg.startMs, endMs: seg.endMs, texts }
  })

  return {
    version: 2,
    masterId: doc.masterId,
    tracks,
    segments,
    meta: { ...doc.meta, source: 'api-pipeline' },
  }
}
