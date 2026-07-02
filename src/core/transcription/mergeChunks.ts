/**
 * Re-ensamblado PURO de las transcripciones por trozo (spec 008). Sin fetch/DOM.
 * Desplaza los tiempos de cada trozo a coordenadas absolutas del video y de-duplica el
 * solape: cada segmento pertenece al trozo cuyo rango NOMINAL contiene su inicio. Como
 * los rangos nominales son contiguos y sin solape, un segmento presente en el audio de
 * dos trozos (por el solape) se conserva una sola vez, sin huecos. Tiempos ms enteros.
 * Tests: tests/core/mergeChunks.test.ts
 */
import type { TranscriptSegment } from '../services/transcriber'
import type { AudioChunk } from './chunkPlan'

/**
 * Une los segmentos de todos los trozos en una sola pista con tiempos continuos.
 * `perChunkSegments[k]` son los segmentos del trozo `k`, en ms RELATIVOS a su
 * `fetchStartMs`. El resultado va ordenado por `startMs`, en ms enteros.
 */
export function mergeChunkTranscripts(
  chunks: AudioChunk[],
  perChunkSegments: TranscriptSegment[][],
): TranscriptSegment[] {
  const out: TranscriptSegment[] = []
  for (let k = 0; k < chunks.length; k++) {
    const chunk = chunks[k]
    const segs = perChunkSegments[k] ?? []
    for (const seg of segs) {
      const absStart = Math.round(seg.startMs + chunk.fetchStartMs)
      // Dueño = el trozo cuyo rango nominal [startMs, endMs) contiene el inicio.
      // Para un único trozo el rango cubre todo → identidad.
      if (absStart < chunk.startMs || absStart >= chunk.endMs) continue
      out.push({
        startMs: absStart,
        endMs: Math.round(seg.endMs + chunk.fetchStartMs),
        text: seg.text,
      })
    }
  }
  out.sort((a, b) => a.startMs - b.startMs)
  return out
}
