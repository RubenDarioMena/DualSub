/**
 * Ensambla un DualSubDocument (spec 000) desde una o dos pistas parseadas.
 * - buildSingle: una pista → documento solo-origen (destino pendiente, D7).
 * - mergeDual:   dos pistas → origen como master de timing + destino por solape (D6).
 * Puro: sin React/DOM/fetch. Spec: specs/002-import-sidecar-subs · contracts/parsers.md
 */
import {
  LANG_CODES,
  type DualSubDocument,
  type DualSubSource,
  type LangCode,
  type SegmentTexts,
  type SubtitleSegment,
} from '../models'
import { normalizeCues, type SubtitleTrack } from './subtitleCommon'

/** Idioma destino determinista cuando el usuario no elige uno (placeholder, D7). */
function defaultTarget(sourceLang: LangCode): LangCode {
  return LANG_CODES.find((l) => l !== sourceLang) as LangCode
}

function sourceTag(format: SubtitleTrack['format']): DualSubSource {
  return format === 'srt' ? 'import-srt' : 'import-vtt'
}

/**
 * Documento de una sola pista (origen presente, sin texto destino). `targetLang`
 * es opcional: si se omite (o coincide con el origen) se usa un placeholder
 * determinista; si se pasa, queda preparado para la traducción de spec 003.
 */
export function buildSingle(
  track: SubtitleTrack,
  sourceLang: LangCode,
  targetLang?: LangCode,
): DualSubDocument {
  const target =
    targetLang && targetLang !== sourceLang
      ? targetLang
      : defaultTarget(sourceLang)

  const segments: SubtitleSegment[] = normalizeCues(track.cues).map((c) => {
    const texts: SegmentTexts = {}
    texts[sourceLang] = c.text
    return { startMs: c.startMs, endMs: c.endMs, texts }
  })

  return {
    version: 1,
    sourceLang,
    targetLang: target,
    segments,
    meta: { source: sourceTag(track.format) },
  }
}

/**
 * Documento dual. El timing es el de la pista origen (master); a cada segmento
 * origen se le adjunta el texto de los cues destino que solapan su intervalo
 * `[startMs, endMs)` (todos los solapantes, concatenados en orden con `\n`). Los
 * segmentos sin solape quedan solo-origen. Recorrido O(n+m) con dos punteros.
 */
export function mergeDual(
  source: SubtitleTrack,
  sourceLang: LangCode,
  target: SubtitleTrack,
  targetLang: LangCode,
): DualSubDocument {
  const srcCues = normalizeCues(source.cues)
  const tgtCues = normalizeCues(target.cues)

  // Cada cue destino se asigna a UN solo segmento origen: el de mayor solape (en
  // empate, el más temprano). Así un destino que cruza dos segmentos no se duplica.
  const assigned: string[][] = srcCues.map(() => [])
  let i = 0 // primer segmento origen que aún podría solapar
  for (const t of tgtCues) {
    while (i < srcCues.length && srcCues[i].endMs <= t.startMs) i++
    let bestIdx = -1
    let bestOverlap = 0
    for (let k = i; k < srcCues.length && srcCues[k].startMs < t.endMs; k++) {
      const overlapMs =
        Math.min(srcCues[k].endMs, t.endMs) -
        Math.max(srcCues[k].startMs, t.startMs)
      if (overlapMs > bestOverlap) {
        bestOverlap = overlapMs
        bestIdx = k
      }
    }
    if (bestIdx >= 0) assigned[bestIdx].push(t.text)
  }

  const segments: SubtitleSegment[] = srcCues.map((s, idx) => {
    const texts: SegmentTexts = {}
    texts[sourceLang] = s.text
    if (assigned[idx].length > 0) texts[targetLang] = assigned[idx].join('\n')
    return { startMs: s.startMs, endMs: s.endMs, texts }
  })

  return {
    version: 1,
    sourceLang,
    targetLang,
    segments,
    meta: { source: sourceTag(source.format) },
  }
}
