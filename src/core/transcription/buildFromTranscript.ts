/**
 * Ensambla un DualSubDocument v2 a partir de los segmentos de una transcripción
 * (ASR, spec 005). PURO: sin React/DOM/fetch. La transcripción es la pista
 * MAESTRA del documento: su rejilla de tiempos manda para todas las
 * traducciones posteriores (spec 007). Normaliza a las invariantes del formato
 * (orden + no-solape) reusando `normalizeCues` de la 002.
 * Specs: specs/005-asr-pipeline · specs/007-multi-track-subtitles.
 */
import {
  type DualSubDocument,
  type LangCode,
  type SegmentTexts,
  type SubtitleSegment,
  type TrackMeta,
} from '../models'
import { normalizeCues, type SubtitleCue } from '../formats/subtitleCommon'
import type { TranscriptionResult } from '../services/transcriber'

/**
 * Documento de una sola pista (la transcripción, maestra) desde un resultado
 * ASR. `label` identifica el proveedor (p. ej. "Whisper · Groq"). Descarta
 * segmentos vacíos y normaliza tiempos. Listo para traducir (003) y guardar (004).
 */
export function buildFromTranscript(
  result: TranscriptionResult,
  label?: string,
): DualSubDocument {
  const lang: LangCode = result.lang
  const master: TrackMeta = { id: lang, lang, origin: 'asr' }
  if (label) master.label = label

  const cues: SubtitleCue[] = result.segments
    .map((s) => ({ startMs: s.startMs, endMs: s.endMs, text: s.text.trim() }))
    .filter((c) => c.text !== '')

  const segments: SubtitleSegment[] = normalizeCues(cues).map((c) => {
    const texts: SegmentTexts = {}
    texts[master.id] = c.text
    return { startMs: c.startMs, endMs: c.endMs, texts }
  })

  return {
    version: 2,
    masterId: master.id,
    tracks: [master],
    segments,
    meta: { source: 'api-pipeline' },
  }
}
