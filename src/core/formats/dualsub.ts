/**
 * Serialización/parseo del formato interno DualSub JSON v1, con validación de
 * invariantes. SRT/VTT y APIs se mapean a/desde este formato en otras specs.
 * Spec: specs/000-dualsub-json-format/spec.md
 */
import {
  LANG_CODES,
  type DualSubDocument,
  type DualSubMeta,
  type DualSubSource,
  type LangCode,
  type SegmentTexts,
  type SubtitleSegment,
} from '../models'

/** Error de validación al parsear un documento DualSub. */
export class DualSubParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DualSubParseError'
  }
}

const VALID_SOURCES: readonly DualSubSource[] = [
  'import-srt',
  'import-vtt',
  'api-pipeline',
  'mock',
]

/** Serializa un documento a JSON (indentado, estable). */
export function serializeDualSub(doc: DualSubDocument): string {
  return JSON.stringify(doc, null, 2)
}

/**
 * Parsea y valida un documento DualSub JSON v1.
 * @throws {DualSubParseError} si el JSON es inválido o viola alguna invariante.
 */
export function parseDualSub(json: string): DualSubDocument {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new DualSubParseError('JSON inválido: no se pudo parsear.')
  }
  return validateDocument(raw)
}

/** Valida una estructura ya deserializada (útil cuando el objeto no viene de string). */
export function validateDocument(raw: unknown): DualSubDocument {
  if (!isObject(raw)) {
    throw new DualSubParseError('El documento debe ser un objeto.')
  }

  if (raw.version !== 1) {
    throw new DualSubParseError(
      `version no soportada: se esperaba 1, se recibió ${JSON.stringify(raw.version)}.`,
    )
  }

  const sourceLang = validateLang(raw.sourceLang, 'sourceLang')
  const targetLang = validateLang(raw.targetLang, 'targetLang')
  if (sourceLang === targetLang) {
    throw new DualSubParseError(
      `sourceLang y targetLang no pueden ser iguales ("${sourceLang}").`,
    )
  }

  if (!Array.isArray(raw.segments)) {
    throw new DualSubParseError('segments debe ser un array.')
  }

  const segments = raw.segments.map((seg, i) =>
    validateSegment(seg, i, sourceLang),
  )
  assertOrderedNonOverlapping(segments)

  const doc: DualSubDocument = { version: 1, sourceLang, targetLang, segments }
  const meta = validateMeta(raw.meta)
  if (meta) doc.meta = meta
  return doc
}

function validateLang(value: unknown, field: string): LangCode {
  if (typeof value !== 'string' || !LANG_CODES.includes(value as LangCode)) {
    throw new DualSubParseError(
      `${field} inválido: "${String(value)}". Válidos: ${LANG_CODES.join(', ')}.`,
    )
  }
  return value as LangCode
}

function validateSegment(
  raw: unknown,
  index: number,
  sourceLang: LangCode,
): SubtitleSegment {
  const at = `segments[${index}]`
  if (!isObject(raw)) {
    throw new DualSubParseError(`${at} debe ser un objeto.`)
  }

  const startMs = validateMs(raw.startMs, `${at}.startMs`)
  const endMs = validateMs(raw.endMs, `${at}.endMs`)
  if (startMs < 0) {
    throw new DualSubParseError(`${at}.startMs no puede ser negativo (${startMs}).`)
  }
  if (endMs <= startMs) {
    throw new DualSubParseError(
      `${at}: endMs (${endMs}) debe ser mayor que startMs (${startMs}).`,
    )
  }

  if (!isObject(raw.texts)) {
    throw new DualSubParseError(`${at}.texts debe ser un objeto.`)
  }
  const texts: SegmentTexts = {}
  for (const lang of LANG_CODES) {
    const value = (raw.texts as Record<string, unknown>)[lang]
    if (value === undefined) continue
    if (typeof value !== 'string') {
      throw new DualSubParseError(`${at}.texts.${lang} debe ser un string.`)
    }
    texts[lang] = value
  }
  if (typeof texts[sourceLang] !== 'string') {
    throw new DualSubParseError(
      `${at}.texts debe incluir el idioma origen "${sourceLang}".`,
    )
  }

  return { startMs, endMs, texts }
}

function assertOrderedNonOverlapping(segments: SubtitleSegment[]): void {
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1]
    const cur = segments[i]
    if (cur.startMs < prev.endMs) {
      throw new DualSubParseError(
        `segments[${i}] solapa o desordena: startMs ${cur.startMs} < endMs previo ${prev.endMs}.`,
      )
    }
  }
}

function validateMeta(raw: unknown): DualSubMeta | undefined {
  if (raw === undefined) return undefined
  if (!isObject(raw)) {
    throw new DualSubParseError('meta debe ser un objeto si está presente.')
  }
  const meta: DualSubMeta = {}
  if (raw.title !== undefined) {
    if (typeof raw.title !== 'string') {
      throw new DualSubParseError('meta.title debe ser un string.')
    }
    meta.title = raw.title
  }
  if (raw.durationMs !== undefined) {
    meta.durationMs = validateMs(raw.durationMs, 'meta.durationMs')
  }
  if (raw.source !== undefined) {
    if (
      typeof raw.source !== 'string' ||
      !VALID_SOURCES.includes(raw.source as DualSubSource)
    ) {
      throw new DualSubParseError(
        `meta.source inválido: "${String(raw.source)}".`,
      )
    }
    meta.source = raw.source as DualSubSource
  }
  return meta
}

function validateMs(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new DualSubParseError(`${field} debe ser un entero en ms (recibido ${String(value)}).`)
  }
  return value
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
