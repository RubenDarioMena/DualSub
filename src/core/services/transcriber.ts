/**
 * Interfaz Transcriber (ASR) + tipos y catálogo de proveedores. Lógica PURA: la firma
 * NO usa `fetch`/DOM (la red vive en `src/engines/api`). Convierte el audio de un medio
 * en segmentos con tiempos, que luego se ensamblan a un DualSubDocument (000) para que
 * el resto del pipeline (traducir, reproducir, guardar) lo trate igual que un import.
 *
 * Reusa las claves BYOK de Settings: un proveedor de ASR comparte `id` con su par de
 * traducción (`groq`, `openai`), así que la clave que ya guardaste sirve para ambos.
 * Spec: specs/005-asr-pipeline.
 */
import type { LangCode } from '../models'

/** Proveedor de transcripción. `'mock'` es el modo demo sin clave. */
export type TranscriberId = 'mock' | 'groq' | 'openai'

export interface TranscriberInfo {
  id: TranscriberId
  /** Etiqueta para el selector (p. ej. "Groq (Whisper v3 turbo)"). */
  label: string
  /** `false` solo para `'mock'`. */
  needsKey: boolean
  /** Modelo de transcripción (informativo). */
  model: string
  /** `true` si hay adaptador real. */
  implemented: boolean
}

/**
 * Catálogo para el selector de Settings. Groq sirve `whisper-large-v3-turbo` por un
 * endpoint compatible con OpenAI y reusa la clave Groq de traducción; OpenAI usa
 * `whisper-1`. (OpenRouter, que figuraba en el roadmap, NO ofrece transcripción de
 * audio, así que se descartó — ver docs/DECISIONS.md.)
 */
export const TRANSCRIBERS: readonly TranscriberInfo[] = [
  { id: 'mock', label: 'Mock (demo)', needsKey: false, model: 'mock', implemented: true },
  { id: 'groq', label: 'Groq (Whisper v3 turbo)', needsKey: true, model: 'whisper-large-v3-turbo', implemented: true },
  { id: 'openai', label: 'OpenAI (Whisper)', needsKey: true, model: 'whisper-1', implemented: true },
]

/** Busca la info de un proveedor de ASR por id. */
export function getTranscriberInfo(id: TranscriberId): TranscriberInfo {
  const info = TRANSCRIBERS.find((p) => p.id === id)
  if (!info) throw new Error(`Proveedor de ASR desconocido: ${id}`)
  return info
}

export interface TranscriptionRequest {
  /** Archivo de medio (audio o video) a transcribir. El blob NO sale salvo al proveedor. */
  media: Blob
  /** Nombre del archivo (algunos proveedores lo exigen en el multipart). */
  filename: string
  /** Idioma hablado en el audio (mejora la precisión y fija `sourceLang`). */
  lang: LangCode
  /** Requerido por proveedores con `needsKey`. */
  apiKey?: string
}

/** Un fragmento transcrito con su intervalo temporal en ms enteros. */
export interface TranscriptSegment {
  startMs: number
  endMs: number
  text: string
}

export interface TranscriptionResult {
  lang: LangCode
  segments: TranscriptSegment[]
}

/** ASR es de una sola pasada (subir → transcribir); la UI muestra la etapa. */
export interface TranscriptionProgress {
  stage: 'uploading' | 'transcribing' | 'done'
}

export type TranscriptionErrorKind =
  | 'no-key'
  | 'auth'
  | 'rate-limit'
  | 'network'
  | 'bad-shape'
  | 'too-large'
  | 'provider-unavailable'

/** Error tipado para mapear cada fallo a un mensaje/acción en la UI. */
export class TranscriptionError extends Error {
  kind: TranscriptionErrorKind
  /** [diag] Contexto crudo para diagnóstico; no se muestra al usuario. */
  detail?: string
  constructor(kind: TranscriptionErrorKind, message?: string, detail?: string) {
    super(message ?? kind)
    this.name = 'TranscriptionError'
    this.kind = kind
    this.detail = detail
  }
}

export interface Transcriber {
  /**
   * Transcribe el audio de `req.media` y devuelve segmentos con tiempos en ms.
   * `onProgress` reporta la etapa. Lanza `TranscriptionError`; nunca cuelga.
   */
  transcribe(
    req: TranscriptionRequest,
    onProgress?: (p: TranscriptionProgress) => void,
  ): Promise<TranscriptionResult>
}
