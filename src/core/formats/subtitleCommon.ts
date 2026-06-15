/**
 * Primitivas puras compartidas por los parsers SRT/VTT y el ensamblado a
 * DualSubDocument: tipos intermedios, limpieza de texto, timecodes y
 * normalización a las invariantes del formato (spec 000). SIN React/DOM/fetch.
 * Spec: specs/002-import-sidecar-subs · contrato: contracts/parsers.md
 */
import { LANG_CODES, type LangCode } from '../models'

/** Resultado crudo del parser para un cue: una sola pista, texto ya sin markup. */
export interface SubtitleCue {
  /** Inicio en ms (puede venir desordenado/solapado antes de normalizar). */
  startMs: number
  /** Fin en ms. El parser NO garantiza `endMs > startMs`; lo hace normalizeCues. */
  endMs: number
  /** Texto plano; multilínea unida con `\n`. */
  text: string
}

/** Una pista completa parseada de un archivo (un idioma). */
export interface SubtitleTrack {
  format: 'srt' | 'vtt'
  cues: SubtitleCue[]
}

/** Se lanza solo cuando un archivo no produce ningún cue válido (FR-010). */
export class SubtitleParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SubtitleParseError'
  }
}

/** Separador de timing en SRT y VTT. */
export const TIMING_ARROW = '-->'

/** Descarta el BOM inicial y normaliza CRLF/CR a LF. */
export function normalizeText(raw: string): string {
  return raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
}

const TIMECODE_RE = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/

/**
 * Convierte un timecode `HH:MM:SS,mmm` / `HH:MM:SS.mmm` / `MM:SS.mmm` (coma o
 * punto, horas opcionales) a ms enteros. Devuelve `NaN` si no matchea (el caller
 * descarta ese cue).
 */
export function parseTimecode(raw: string): number {
  const m = TIMECODE_RE.exec(raw.trim())
  if (!m) return NaN
  const hours = m[1] ? Number.parseInt(m[1], 10) : 0
  const minutes = Number.parseInt(m[2], 10)
  const seconds = Number.parseInt(m[3], 10)
  // `.5` → 500 ms, `.50` → 500 ms, `.500` → 500 ms (relleno a la derecha).
  const millis = Number.parseInt(m[4].padEnd(3, '0'), 10)
  return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000 + millis)
}

/**
 * Separa la línea de timing en `[inicio, fin]` crudos. Ignora coordenadas (SRT)
 * o settings de posición (VTT) que sigan al segundo timecode.
 */
export function splitTiming(line: string): [string, string] {
  const idx = line.indexOf(TIMING_ARROW)
  if (idx === -1) return ['', '']
  const start = line.slice(0, idx).trim()
  const rest = line.slice(idx + TIMING_ARROW.length).trim()
  const end = rest.split(/\s+/)[0] ?? ''
  return [start, end]
}

/**
 * Elimina el markup (tags `<...>`, overrides ASS `{\...}`) y decodifica entidades
 * básicas, conservando los saltos de línea internos. Recorta cada línea y descarta
 * las vacías.
 */
export function stripMarkup(raw: string): string {
  const noMarkup = raw.replace(/<[^>]*>/g, '').replace(/\{\\[^}]*\}/g, '')
  const decoded = noMarkup
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
  return decoded
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
}

/**
 * Normaliza cues a las invariantes de spec 000 (orden + no-solape):
 * 1) descarta inválidos (`endMs<=startMs`, `startMs<0`, no finitos);
 * 2) ordena por `startMs` (desempate `endMs`);
 * 3) colapsa duplicados exactos;
 * 4) resuelve solapes truncando el cue previo (`prev.endMs = cur.startMs`).
 */
export function normalizeCues(cues: SubtitleCue[]): SubtitleCue[] {
  const valid = cues.filter(
    (c) =>
      Number.isFinite(c.startMs) &&
      Number.isFinite(c.endMs) &&
      c.startMs >= 0 &&
      c.endMs > c.startMs,
  )
  valid.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)

  const result: SubtitleCue[] = []
  for (const cue of valid) {
    const prev = result[result.length - 1]
    if (
      prev &&
      prev.startMs === cue.startMs &&
      prev.endMs === cue.endMs &&
      prev.text === cue.text
    ) {
      continue // duplicado exacto
    }
    if (prev && cue.startMs < prev.endMs) {
      prev.endMs = cue.startMs // trunca el previo
      if (prev.endMs <= prev.startMs) result.pop() // quedó vacío → descartar
    }
    result.push({ ...cue })
  }
  return result
}

/** Elige el parser por la extensión del archivo. `null` si no es .srt/.vtt. */
export function pickParser(filename: string): 'srt' | 'vtt' | null {
  if (/\.srt$/i.test(filename)) return 'srt'
  if (/\.vtt$/i.test(filename)) return 'vtt'
  return null
}

const LANG_SUFFIX_RE = /\.(en|es|ja)\.(?:srt|vtt)$/i

/** Infiere el idioma por el sufijo del nombre (`pelicula.en.srt`). `null` si no. */
export function inferLang(filename: string): LangCode | null {
  const m = LANG_SUFFIX_RE.exec(filename)
  if (!m) return null
  const lang = m[1].toLowerCase() as LangCode
  return LANG_CODES.includes(lang) ? lang : null
}
