/**
 * Modelos y formato interno DualSub JSON v2 (multi-pista). TS puro: sin React,
 * DOM ni fetch. v2 sustituye el par fijo origen/destino de v1 por una lista de
 * PISTAS: cada pista es una versión del texto en un idioma (transcripción,
 * import, o una de VARIAS traducciones del mismo idioma). Una pista maestra
 * (normalmente la transcripción / el idioma original) fija la rejilla de
 * tiempos; las demás comparten sus intervalos (modelo 1:1).
 * Specs: specs/000-dualsub-json-format · specs/007-multi-track-subtitles
 */

/** Códigos de idioma soportados en v0.1 (ISO 639-1). */
export type LangCode = 'en' | 'es' | 'ja'

/** Conjunto de idiomas válidos, para validación en runtime. */
export const LANG_CODES: readonly LangCode[] = ['en', 'es', 'ja']

/** Procedencia de una pista. */
export type TrackOrigin = 'original' | 'import' | 'asr' | 'translation' | 'mock'

export const TRACK_ORIGINS: readonly TrackOrigin[] = [
  'original',
  'import',
  'asr',
  'translation',
  'mock',
]

/**
 * Una pista de subtítulos: una versión del texto en un idioma. Puede haber
 * varias pistas del mismo idioma (p. ej. dos traducciones de proveedores
 * distintos); `label` las distingue ante el usuario.
 */
export interface TrackMeta {
  /** Único dentro del documento. Por convención `"es"`, `"es-2"`, `"es-3"`… */
  id: string
  lang: LangCode
  /** Etiqueta legible: proveedor, nombre de archivo… */
  label?: string
  origin?: TrackOrigin
}

/**
 * Texto del segmento por pista (clave = `TrackMeta.id`). La pista maestra
 * siempre está presente; las demás pueden faltar mientras estén pendientes.
 */
export type SegmentTexts = Partial<Record<string, string>>

/**
 * Un diálogo: intervalo temporal `[startMs, endMs)` (fin excluido) y su texto
 * por pista. El timing lo fija la pista maestra y es compartido (modelo 1:1).
 */
export interface SubtitleSegment {
  /** Inicio en ms enteros (incluido). `>= 0` en documentos almacenados. */
  startMs: number
  /** Fin en ms enteros (excluido). Debe cumplir `endMs > startMs`. */
  endMs: number
  /** Texto por pista. */
  texts: SegmentTexts
}

/** Procedencia de un documento, para depuración y caché. */
export type DualSubSource = 'import-srt' | 'import-vtt' | 'api-pipeline' | 'mock'

/** Metadatos opcionales del documento. */
export interface DualSubMeta {
  title?: string
  /** Duración del medio en ms, si se conoce. */
  durationMs?: number
  source?: DualSubSource
}

/**
 * Documento DualSub v2: pistas + segmentos ordenados por `startMs` y sin
 * solapamientos (invariante del formato). `masterId` señala la pista cuya
 * rejilla de tiempos manda (la transcripción / el idioma original).
 */
export interface DualSubDocument {
  /** Versión del formato. v1 (par fijo) se migra al parsear. */
  version: 2
  masterId: string
  tracks: TrackMeta[]
  segments: SubtitleSegment[]
  meta?: DualSubMeta
}

/**
 * Proyecto en runtime: un medio + su documento + ajuste de sincronización.
 * `mediaUrl` es solo una cadena (p. ej. un object URL), así que el modelo sigue
 * siendo puro. La UI lo manipulará en specs posteriores.
 */
export interface MediaProject {
  id: string
  mediaUrl: string
  doc: DualSubDocument
  /** Offset manual del usuario, en ms (puede ser negativo). */
  offsetMs: number
}
