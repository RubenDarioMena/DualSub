/**
 * Sincronización: localizar el segmento activo y aplicar offset. Funciones puras.
 * Asumen segmentos ordenados por `startMs` y sin solapamientos (invariante del
 * formato, garantizada por `parseDualSub`). Spec: specs/000-dualsub-json-format.
 */
import type { SubtitleSegment } from './models'

/**
 * Índice del segmento activo en `tMs`, o `-1` si ninguno lo cubre.
 *
 * Activo ⇔ `startMs <= tMs < endMs` (fin excluido). En huecos, antes del primero,
 * después del último o con lista vacía → `-1`. Búsqueda binaria: `O(log n)`.
 */
export function findActiveSegmentIndex(
  segments: readonly SubtitleSegment[],
  tMs: number,
): number {
  let lo = 0
  let hi = segments.length - 1
  let candidate = -1

  // Último segmento cuyo startMs <= tMs.
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (segments[mid].startMs <= tMs) {
      candidate = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  if (candidate === -1) return -1
  // Está dentro del intervalo solo si aún no alcanzó el fin (excluido).
  return tMs < segments[candidate].endMs ? candidate : -1
}

/** Segmento activo en `tMs`, o `null` si ninguno lo cubre. Ver `findActiveSegmentIndex`. */
export function findActiveSegment(
  segments: readonly SubtitleSegment[],
  tMs: number,
): SubtitleSegment | null {
  const i = findActiveSegmentIndex(segments, tMs)
  return i === -1 ? null : segments[i]
}

/**
 * Copia de `segments` con el timing desplazado `offsetMs` (puede ser negativo).
 * No muta la entrada. Se permiten tiempos resultantes negativos: simplemente no
 * estarán activos para `tMs >= 0` hasta que el intervalo cruce 0.
 */
export function applyOffset(
  segments: readonly SubtitleSegment[],
  offsetMs: number,
): SubtitleSegment[] {
  if (offsetMs === 0) return segments.map((s) => ({ ...s }))
  return segments.map((s) => ({
    ...s,
    startMs: s.startMs + offsetMs,
    endMs: s.endMs + offsetMs,
  }))
}
