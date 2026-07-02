/**
 * Nombres de idioma para la UI (antes duplicados en TrackConfirm y
 * TranscribePanel) y etiquetas legibles de pista (spec 007).
 */
import type { LangCode, TrackMeta } from '../../core/models'

export const LANG_LABEL: Record<LangCode, string> = {
  en: 'Inglés',
  es: 'Español',
  ja: 'Japonés',
}

/**
 * Etiqueta de una pista para menús: "Español · Groq", "Inglés · transcripción"…
 * Con varias pistas del mismo idioma sin label, añade el nº ("Español (2)").
 */
export function trackOptionLabel(track: TrackMeta, all: TrackMeta[]): string {
  const base = LANG_LABEL[track.lang]
  if (track.label) return `${base} · ${track.label}`
  if (track.origin === 'asr') return `${base} · transcripción`
  const sameLang = all.filter((t) => t.lang === track.lang && !t.label)
  if (sameLang.length > 1) {
    const n = sameLang.findIndex((t) => t.id === track.id) + 1
    return `${base} (${n})`
  }
  return base
}
