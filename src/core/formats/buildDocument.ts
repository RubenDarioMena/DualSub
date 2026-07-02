/**
 * Ensambla un DualSubDocument v2 desde una o dos pistas parseadas.
 * - buildSingle: una pista → documento de una sola pista (maestra).
 * - mergeDual:   dos pistas → la principal fija el timing (maestra) + la otra
 *                se adjunta por solape (D6). Puede ser del MISMO idioma (dos
 *                versiones): el id de pista se desambigua ("es", "es-2").
 * Puro: sin React/DOM/fetch. Specs: 002-import-sidecar-subs · 007-multi-track.
 */
import {
  type DualSubDocument,
  type DualSubSource,
  type LangCode,
  type SegmentTexts,
  type SubtitleSegment,
  type TrackMeta,
} from '../models'
import { normalizeCues, type SubtitleTrack } from './subtitleCommon'

function sourceTag(format: SubtitleTrack['format']): DualSubSource {
  return format === 'srt' ? 'import-srt' : 'import-vtt'
}

/**
 * Documento de una sola pista (maestra). `label` (p. ej. el nombre del archivo)
 * distingue la pista si luego se añaden otras del mismo idioma.
 */
export function buildSingle(
  track: SubtitleTrack,
  lang: LangCode,
  label?: string,
): DualSubDocument {
  const master: TrackMeta = { id: lang, lang, origin: 'import' }
  if (label) master.label = label

  const segments: SubtitleSegment[] = normalizeCues(track.cues).map((c) => {
    const texts: SegmentTexts = {}
    texts[master.id] = c.text
    return { startMs: c.startMs, endMs: c.endMs, texts }
  })

  return {
    version: 2,
    masterId: master.id,
    tracks: [master],
    segments,
    meta: { source: sourceTag(track.format) },
  }
}

/**
 * Documento de dos pistas. El timing es el de la pista principal (maestra); a
 * cada segmento maestro se le adjunta el texto de los cues de la otra pista que
 * solapan su intervalo `[startMs, endMs)`. Los segmentos sin solape quedan
 * solo-maestra. Recorrido O(n+m) con dos punteros.
 */
export function mergeDual(
  source: SubtitleTrack,
  sourceLang: LangCode,
  target: SubtitleTrack,
  targetLang: LangCode,
  labels?: { source?: string; target?: string },
): DualSubDocument {
  const master: TrackMeta = { id: sourceLang, lang: sourceLang, origin: 'import' }
  if (labels?.source) master.label = labels.source
  // Mismo idioma en ambas pistas ⇒ la segunda se desambigua ("es-2").
  const secondId = targetLang === sourceLang ? `${targetLang}-2` : targetLang
  const second: TrackMeta = { id: secondId, lang: targetLang, origin: 'import' }
  if (labels?.target) second.label = labels.target

  const srcCues = normalizeCues(source.cues)
  const tgtCues = normalizeCues(target.cues)

  // Cada cue destino se asigna a UN solo segmento maestro: el de mayor solape
  // (en empate, el más temprano). Así un destino que cruza dos no se duplica.
  const assigned: string[][] = srcCues.map(() => [])
  let i = 0 // primer segmento maestro que aún podría solapar
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
    texts[master.id] = s.text
    if (assigned[idx].length > 0) texts[second.id] = assigned[idx].join('\n')
    return { startMs: s.startMs, endMs: s.endMs, texts }
  })

  return {
    version: 2,
    masterId: master.id,
    tracks: [master, second],
    segments,
    meta: { source: sourceTag(source.format) },
  }
}
