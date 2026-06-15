/**
 * Parser SRT → SubtitleTrack (cues crudos, sin normalizar). Tolera BOM, CRLF/LF,
 * índice de bloque, etiquetas y timestamps con coma o punto. Puro: recibe string.
 * Spec: specs/002-import-sidecar-subs · contrato: contracts/parsers.md
 */
import {
  SubtitleParseError,
  TIMING_ARROW,
  normalizeText,
  parseTimecode,
  splitTiming,
  stripMarkup,
  type SubtitleCue,
  type SubtitleTrack,
} from './subtitleCommon'

export function parseSrt(text: string): SubtitleTrack {
  const blocks = normalizeText(text).split(/\n{2,}/)
  const cues: SubtitleCue[] = []

  for (const block of blocks) {
    const lines = block.split('\n')
    const timingIdx = lines.findIndex((l) => l.includes(TIMING_ARROW))
    if (timingIdx === -1) continue // bloque sin timing (índice suelto, basura)

    const [startRaw, endRaw] = splitTiming(lines[timingIdx])
    const startMs = parseTimecode(startRaw)
    const endMs = parseTimecode(endRaw)
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue

    const cueText = stripMarkup(lines.slice(timingIdx + 1).join('\n'))
    if (cueText === '') continue // cue sin texto real → no genera segmento

    cues.push({ startMs, endMs, text: cueText })
  }

  if (cues.length === 0) {
    throw new SubtitleParseError(
      'No se encontró ningún subtítulo válido en el archivo .srt.',
    )
  }
  return { format: 'srt', cues }
}
