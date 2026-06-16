/**
 * Ensamblado inmutable del documento traducido. Puro: sin `fetch`/DOM.
 * 1:1 estricto — mismo nº de segmentos y timing; el origen NO se muta (D4, FR-001/2).
 * Spec: 003-translate-api-byok.
 */
import type { DualSubDocument, LangCode } from '../models'

/**
 * Devuelve un `DualSubDocument` **nuevo** con `texts[targetLang]` relleno por índice.
 * Copia cada segmento (timing intacto) y añade el destino solo donde `byIndex` lo
 * define; los segmentos sin traducción quedan solo-origen. `meta.source = 'api-pipeline'`.
 */
export function assembleTranslated(
  source: DualSubDocument,
  targetLang: LangCode,
  byIndex: (string | undefined)[],
): DualSubDocument {
  const segments = source.segments.map((seg, i) => {
    const texts = { ...seg.texts }
    const translated = byIndex[i]
    if (translated !== undefined) texts[targetLang] = translated
    return { startMs: seg.startMs, endMs: seg.endMs, texts }
  })

  return {
    version: 1,
    sourceLang: source.sourceLang,
    targetLang,
    segments,
    meta: { ...source.meta, source: 'api-pipeline' },
  }
}
