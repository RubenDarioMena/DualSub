/**
 * Serialización/parseo del formato interno DualSub JSON v2 (multi-pista), con
 * validación de invariantes y MIGRACIÓN automática de v1 (par origen/destino):
 * los documentos v1 guardados (IndexedDB, spec 004) se leen sin pérdida — el
 * origen pasa a pista maestra y el destino a pista de traducción (solo si tiene
 * algún texto). SRT/VTT y APIs se mapean a/desde este formato en otras specs.
 * Specs: specs/000-dualsub-json-format · specs/007-multi-track-subtitles
 */
import {
  LANG_CODES,
  TRACK_ORIGINS,
  type DualSubDocument,
  type DualSubMeta,
  type DualSubSource,
  type LangCode,
  type SegmentTexts,
  type SubtitleSegment,
  type TrackMeta,
  type TrackOrigin,
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
 * Parsea y valida un documento DualSub JSON (v1 se migra a v2 al vuelo).
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

/**
 * Valida una estructura ya deserializada (útil cuando el objeto no viene de
 * string). Acepta v1 (par fijo) y lo migra a v2 sin pérdida.
 */
export function validateDocument(raw: unknown): DualSubDocument {
  if (!isObject(raw)) {
    throw new DualSubParseError('El documento debe ser un objeto.')
  }
  if (raw.version === 1) return validateV2(migrateV1(raw))
  if (raw.version === 2) return validateV2(raw)
  throw new DualSubParseError(
    `version no soportada: se esperaba 1 o 2, se recibió ${JSON.stringify(raw.version)}.`,
  )
}

/**
 * v1 → v2: el `sourceLang` pasa a pista maestra (id = código de idioma) y el
 * `targetLang` a pista de traducción SOLO si algún segmento tiene su texto (un
 * destino vacío era "traducción pendiente": en v2 ya no se declara por adelantado).
 * Las claves de `texts` no cambian (los ids de pista son los códigos de idioma).
 */
function migrateV1(raw: Record<string, unknown>): Record<string, unknown> {
  const sourceLang = validateLang(raw.sourceLang, 'sourceLang')
  const targetLang = validateLang(raw.targetLang, 'targetLang')
  if (sourceLang === targetLang) {
    throw new DualSubParseError(
      `sourceLang y targetLang no pueden ser iguales ("${sourceLang}") en v1.`,
    )
  }
  const segments = Array.isArray(raw.segments) ? raw.segments : []
  const hasTargetText = segments.some(
    (s) =>
      isObject(s) &&
      isObject(s.texts) &&
      typeof (s.texts as Record<string, unknown>)[targetLang] === 'string',
  )
  const tracks: TrackMeta[] = [{ id: sourceLang, lang: sourceLang, origin: 'original' }]
  if (hasTargetText) {
    tracks.push({ id: targetLang, lang: targetLang, origin: 'translation' })
  }
  return {
    version: 2,
    masterId: sourceLang,
    tracks,
    segments: raw.segments,
    ...(raw.meta !== undefined ? { meta: raw.meta } : {}),
  }
}

function validateV2(raw: Record<string, unknown>): DualSubDocument {
  if (!Array.isArray(raw.tracks) || raw.tracks.length === 0) {
    throw new DualSubParseError('tracks debe ser un array con al menos una pista.')
  }
  const tracks = raw.tracks.map(validateTrack)
  const ids = new Set<string>()
  for (const t of tracks) {
    if (ids.has(t.id)) {
      throw new DualSubParseError(`tracks: id duplicado "${t.id}".`)
    }
    ids.add(t.id)
  }

  if (typeof raw.masterId !== 'string' || !ids.has(raw.masterId)) {
    throw new DualSubParseError(
      `masterId inválido: "${String(raw.masterId)}" no es una pista del documento.`,
    )
  }
  const masterId = raw.masterId

  if (!Array.isArray(raw.segments)) {
    throw new DualSubParseError('segments debe ser un array.')
  }
  const segments = raw.segments.map((seg, i) => validateSegment(seg, i, ids, masterId))
  assertOrderedNonOverlapping(segments)

  const doc: DualSubDocument = { version: 2, masterId, tracks, segments }
  const meta = validateMeta(raw.meta)
  if (meta) doc.meta = meta
  return doc
}

function validateTrack(raw: unknown, index: number): TrackMeta {
  const at = `tracks[${index}]`
  if (!isObject(raw)) {
    throw new DualSubParseError(`${at} debe ser un objeto.`)
  }
  if (typeof raw.id !== 'string' || raw.id === '') {
    throw new DualSubParseError(`${at}.id debe ser un string no vacío.`)
  }
  const lang = validateLang(raw.lang, `${at}.lang`)
  const track: TrackMeta = { id: raw.id, lang }
  if (raw.label !== undefined) {
    if (typeof raw.label !== 'string') {
      throw new DualSubParseError(`${at}.label debe ser un string.`)
    }
    track.label = raw.label
  }
  if (raw.origin !== undefined) {
    if (
      typeof raw.origin !== 'string' ||
      !TRACK_ORIGINS.includes(raw.origin as TrackOrigin)
    ) {
      throw new DualSubParseError(`${at}.origin inválido: "${String(raw.origin)}".`)
    }
    track.origin = raw.origin as TrackOrigin
  }
  return track
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
  trackIds: Set<string>,
  masterId: string,
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
  for (const id of trackIds) {
    const value = (raw.texts as Record<string, unknown>)[id]
    if (value === undefined) continue
    if (typeof value !== 'string') {
      throw new DualSubParseError(`${at}.texts.${id} debe ser un string.`)
    }
    texts[id] = value
  }
  if (typeof texts[masterId] !== 'string') {
    throw new DualSubParseError(
      `${at}.texts debe incluir la pista maestra "${masterId}".`,
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
