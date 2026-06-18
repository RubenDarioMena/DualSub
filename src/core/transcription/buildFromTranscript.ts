/**
 * Ensambla un DualSubDocument (spec 000) a partir de los segmentos de una
 * transcripción (ASR, spec 005). PURO: sin React/DOM/fetch. Normaliza a las
 * invariantes del formato (orden + no-solape) reusando `normalizeCues` de la 002 y
 * deja el documento listo para el resto del pipeline (traducir, reproducir, guardar),
 * exactamente igual que un import de sidecar.
 * Spec: specs/005-asr-pipeline.
 */
import {
  LANG_CODES,
  type DualSubDocument,
  type LangCode,
  type SegmentTexts,
  type SubtitleSegment,
} from '../models'
import { normalizeCues, type SubtitleCue } from '../formats/subtitleCommon'
import type { TranscriptionResult } from '../services/transcriber'

/** Idioma destino determinista cuando no se elige uno (placeholder, igual que 002 D7). */
function defaultTarget(sourceLang: LangCode): LangCode {
  return LANG_CODES.find((l) => l !== sourceLang) as LangCode
}

/**
 * Documento solo-origen desde una transcripción. El idioma origen es el del audio
 * (`result.lang`); el destino queda pendiente (placeholder o el elegido) para que la
 * traducción de la spec 003 lo rellene. Descarta segmentos vacíos y normaliza tiempos.
 */
export function buildFromTranscript(
  result: TranscriptionResult,
  targetLang?: LangCode,
): DualSubDocument {
  const sourceLang = result.lang
  const target =
    targetLang && targetLang !== sourceLang ? targetLang : defaultTarget(sourceLang)

  const cues: SubtitleCue[] = result.segments
    .map((s) => ({ startMs: s.startMs, endMs: s.endMs, text: s.text.trim() }))
    .filter((c) => c.text !== '')

  const segments: SubtitleSegment[] = normalizeCues(cues).map((c) => {
    const texts: SegmentTexts = {}
    texts[sourceLang] = c.text
    return { startMs: c.startMs, endMs: c.endMs, texts }
  })

  return {
    version: 1,
    sourceLang,
    targetLang: target,
    segments,
    meta: { source: 'api-pipeline' },
  }
}
