/**
 * Modelos y formato interno DualSub JSON v1. TS puro: sin React, DOM ni fetch.
 * Spec: specs/000-dualsub-json-format/spec.md
 */

/** Códigos de idioma soportados en v0.1 (ISO 639-1). */
export type LangCode = 'en' | 'es' | 'ja'

/** Conjunto de idiomas válidos, para validación en runtime. */
export const LANG_CODES: readonly LangCode[] = ['en', 'es', 'ja']

/**
 * Texto del segmento por idioma. El idioma origen siempre está presente; el
 * destino puede faltar mientras la traducción está pendiente.
 */
export type SegmentTexts = Partial<Record<LangCode, string>>

/**
 * Un diálogo: intervalo temporal `[startMs, endMs)` (fin excluido) y su texto en
 * cada idioma. El timing es compartido entre idiomas (modelo 1:1).
 */
export interface SubtitleSegment {
  /** Inicio en ms enteros (incluido). `>= 0` en documentos almacenados. */
  startMs: number
  /** Fin en ms enteros (excluido). Debe cumplir `endMs > startMs`. */
  endMs: number
  /** Texto por idioma. */
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
 * Documento DualSub v1: un par de idiomas (origen + destino) y sus segmentos
 * ordenados por `startMs` y sin solapamientos (invariante del formato).
 */
export interface DualSubDocument {
  /** Versión del formato. */
  version: 1
  sourceLang: LangCode
  targetLang: LangCode
  segments: SubtitleSegment[]
  meta?: DualSubMeta
}

/**
 * Proyecto en runtime: un medio + su documento dual + ajuste de sincronización.
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
