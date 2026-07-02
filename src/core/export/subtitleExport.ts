/**
 * Export de subtítulos (spec 009-export-mp4). PURO: sin React/DOM/fetch.
 * Genera un .srt del par visible (Arriba/Abajo) con el offset del usuario ya
 * aplicado: la línea de arriba y la de abajo van en el MISMO cue (el dual cabe
 * en una sola pista, que es lo que entienden TVs y players). ffmpeg (engines)
 * lo incrusta luego en el .mp4 como pista `mov_text` o quemado en la imagen.
 */
import type { DualSubDocument } from '../models'
import type { TrackView } from '../tracks'

/** `3661234` → `"01:01:01,234"` (formato de tiempo SRT). */
export function formatSrtTime(ms: number): string {
  const t = Math.max(0, Math.round(ms))
  const h = Math.floor(t / 3_600_000)
  const m = Math.floor((t % 3_600_000) / 60_000)
  const s = Math.floor((t % 60_000) / 1000)
  const mmm = t % 1000
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(mmm, 3)}`
}

/**
 * SRT del par visible. Cada segmento con texto arriba y/o abajo produce un cue
 * "arriba\nabajo"; los segmentos sin nada visible se omiten. `offsetMs` desplaza
 * los tiempos (clampados a >= 0) igual que en el player, así el export queda
 * sincronizado tal y como el usuario lo ve.
 */
export function buildDualSrt(
  doc: DualSubDocument,
  view: TrackView,
  offsetMs = 0,
): string {
  const cues: string[] = []
  let n = 0
  for (const seg of doc.segments) {
    const top = seg.texts[view.top]?.trim()
    const bottom = view.bottom !== null ? seg.texts[view.bottom]?.trim() : undefined
    const lines = [top, bottom].filter((t): t is string => !!t)
    if (lines.length === 0) continue
    const startMs = seg.startMs + offsetMs
    const endMs = seg.endMs + offsetMs
    if (endMs <= 0) continue // desplazado por completo antes del inicio
    n++
    cues.push(
      `${n}\n${formatSrtTime(startMs)} --> ${formatSrtTime(endMs)}\n${lines.join('\n')}`,
    )
  }
  return cues.join('\n\n') + (cues.length > 0 ? '\n' : '')
}
