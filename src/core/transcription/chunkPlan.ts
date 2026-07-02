/**
 * Cálculo PURO del plan de troceo del audio (spec 008). Sin fetch/DOM. Decide si el
 * audio va en un solo envío o se parte en tramos por TIEMPO bajo el límite del proveedor,
 * con solape para no cortar palabras. Los tiempos son ms enteros. Tests: tests/core/chunkPlan.test.ts
 */

/** Un tramo temporal del audio a transcribir por separado. */
export interface AudioChunk {
  /** 0..N-1, en orden. */
  index: number
  /** Inicio NOMINAL en el video (sin solape). */
  startMs: number
  /** Fin NOMINAL (excluido); `endMs > startMs`. */
  endMs: number
  /** Desde dónde se extrae el audio (con solape): `max(0, startMs - overlap)`. */
  fetchStartMs: number
  /** Hasta dónde se extrae (con solape): `min(durationMs, endMs + overlap)`. */
  fetchEndMs: number
}

export interface ChunkPlanOptions {
  /** `sizeBytes <= singleMaxBytes` ⇒ un solo envío. */
  singleMaxBytes?: number
  /** Tamaño objetivo por trozo → `N = ceil(sizeBytes / targetChunkBytes)`. */
  targetChunkBytes?: number
  /** Solape entre trozos vecinos, en ms. */
  overlapMs?: number
}

/** Margen bajo el límite real de ~25 MB del proveedor: ≤ esto → envío único. */
export const SINGLE_MAX_BYTES = 24 * 1024 * 1024
/** Tamaño objetivo por trozo cuando hay que partir. */
export const TARGET_CHUNK_BYTES = 20 * 1024 * 1024
/** Solape por defecto entre trozos vecinos (ms). */
export const OVERLAP_MS = 2000
/** `N >` esto ⇒ la UI avisa y pide confirmación (FR-013). */
export const WARN_CHUNKS = 3

/**
 * Devuelve el plan de trozos. Envío único si el audio cabe (≤ `singleMaxBytes`);
 * si no, `N = ceil(sizeBytes/targetChunkBytes)` tramos de duración igual con solape.
 * Los intervalos NOMINALES cubren `[0, durationMs)` sin huecos ni solape.
 */
export function planChunks(
  durationMs: number,
  sizeBytes: number,
  opts?: ChunkPlanOptions,
): AudioChunk[] {
  const singleMaxBytes = opts?.singleMaxBytes ?? SINGLE_MAX_BYTES
  const targetChunkBytes = opts?.targetChunkBytes ?? TARGET_CHUNK_BYTES
  const overlapMs = opts?.overlapMs ?? OVERLAP_MS

  const dur = Math.floor(durationMs)
  if (!Number.isFinite(dur) || dur <= 0) return []

  if (sizeBytes <= singleMaxBytes) {
    return [{ index: 0, startMs: 0, endMs: dur, fetchStartMs: 0, fetchEndMs: dur }]
  }

  const n = Math.max(2, Math.ceil(sizeBytes / targetChunkBytes))
  const chunkMs = Math.ceil(dur / n)
  const chunks: AudioChunk[] = []
  for (let i = 0; i < n; i++) {
    const startMs = i * chunkMs
    if (startMs >= dur) break // el redondeo de chunkMs puede sobrar el último tramo
    const endMs = Math.min((i + 1) * chunkMs, dur)
    chunks.push({
      index: chunks.length,
      startMs,
      endMs,
      fetchStartMs: Math.max(0, startMs - overlapMs),
      fetchEndMs: Math.min(dur, endMs + overlapMs),
    })
  }
  return chunks
}
