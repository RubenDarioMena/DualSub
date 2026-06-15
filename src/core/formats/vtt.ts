/**
 * Parser WebVTT → SubtitleTrack (cues crudos, sin normalizar). Ignora la cabecera
 * `WEBVTT`, los bloques `NOTE`/`STYLE`/`REGION` y el identificador de cue; tolera
 * timestamps sin hora (`MM:SS.mmm`) y settings de posición. Puro: recibe string.
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

export function parseVtt(text: string): SubtitleTrack {
  const blocks = normalizeText(text).split(/\n{2,}/)
  const cues: SubtitleCue[] = []

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b].trim()
    if (block === '') continue
    if (b === 0 && /^WEBVTT/.test(block)) continue // cabecera
    if (/^(NOTE|STYLE|REGION)\b/.test(block)) continue // metadatos, no diálogo

    const lines = block.split('\n')
    const timingIdx = lines.findIndex((l) => l.includes(TIMING_ARROW))
    if (timingIdx === -1) continue // bloque sin timing (identificador suelto, basura)

    const [startRaw, endRaw] = splitTiming(lines[timingIdx])
    const startMs = parseTimecode(startRaw)
    const endMs = parseTimecode(endRaw)
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue

    const cueText = stripMarkup(lines.slice(timingIdx + 1).join('\n'))
    if (cueText === '') continue

    cues.push({ startMs, endMs, text: cueText })
  }

  if (cues.length === 0) {
    throw new SubtitleParseError(
      'No se encontró ningún subtítulo válido en el archivo .vtt.',
    )
  }
  return { format: 'vtt', cues }
}
