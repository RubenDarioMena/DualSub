/**
 * Adaptador de la familia Whisper (ASR). Única capa con red para transcripción
 * (constitución I). Sube el medio como multipart/form-data al endpoint compatible con
 * OpenAI `audio/transcriptions` con `response_format=verbose_json` (trae segmentos con
 * tiempos), y mapea la respuesta a `TranscriptionResult`. Cada proveedor concreto solo
 * aporta endpoint, modelo y auth. Spec: specs/005-asr-pipeline.
 *
 * Nota v0.1: se envía el archivo de video tal cual (el proveedor extrae el audio). No
 * hacemos extracción de audio en el navegador (evitaríamos subir mucho), porque exigiría
 * una dependencia pesada (ffmpeg.wasm). Por eso vigilamos el tamaño y avisamos.
 */
import type { LangCode } from '../../core/models'
import {
  TranscriptionError,
  type Transcriber,
  type TranscriptionProgress,
  type TranscriptionRequest,
  type TranscriptionResult,
  type TranscriptSegment,
} from '../../core/services/transcriber'

export interface WhisperConfig {
  endpoint: string
  model: string
  authHeaders: (key: string) => Record<string, string>
}

/** Código que Whisper entiende para el idioma (ISO 639-1 vale). */
const WHISPER_LANG: Record<LangCode, string> = { en: 'en', es: 'es', ja: 'ja' }

interface VerboseJson {
  text?: string
  duration?: number
  segments?: { start: number; end: number; text: string }[]
}

/** Convierte la respuesta verbose_json en segmentos con tiempos en ms enteros. */
function toSegments(data: VerboseJson): TranscriptSegment[] {
  if (Array.isArray(data.segments) && data.segments.length > 0) {
    return data.segments.map((s) => ({
      startMs: Math.max(0, Math.round(s.start * 1000)),
      endMs: Math.round(s.end * 1000),
      text: s.text.trim(),
    }))
  }
  // Sin segmentos pero con texto: un único bloque que cubre toda la duración.
  if (typeof data.text === 'string' && data.text.trim() !== '') {
    const endMs = data.duration ? Math.round(data.duration * 1000) : 1000
    return [{ startMs: 0, endMs: Math.max(endMs, 1), text: data.text.trim() }]
  }
  return []
}

/** Crea un `Transcriber` para un proveedor Whisper concreto. */
export function createWhisperTranscriber(config: WhisperConfig): Transcriber {
  return {
    async transcribe(
      req: TranscriptionRequest,
      onProgress?: (p: TranscriptionProgress) => void,
    ): Promise<TranscriptionResult> {
      // Guard BYOK: nunca llamamos a la red sin clave.
      const key = req.apiKey?.trim()
      if (!key) throw new TranscriptionError('no-key', 'Falta la API key del proveedor.')

      const form = new FormData()
      form.append('file', req.media, req.filename)
      form.append('model', config.model)
      form.append('response_format', 'verbose_json')
      form.append('language', WHISPER_LANG[req.lang])

      onProgress?.({ stage: 'uploading' })
      let res: Response
      try {
        res = await fetch(config.endpoint, {
          method: 'POST',
          headers: { ...config.authHeaders(key) }, // sin Content-Type: lo pone FormData
          body: form,
        })
      } catch {
        throw new TranscriptionError('network', 'Fallo de red al contactar al proveedor.')
      }
      onProgress?.({ stage: 'transcribing' })

      if (res.status === 401 || res.status === 403) {
        throw new TranscriptionError('auth', 'API key inválida o sin permisos.')
      }
      if (res.status === 429) {
        throw new TranscriptionError('rate-limit', 'Límite de uso alcanzado. Reintenta más tarde.')
      }
      if (res.status === 413) {
        throw new TranscriptionError(
          'too-large',
          'El archivo es demasiado grande para el proveedor. Usa un clip más corto.',
        )
      }
      if (!res.ok) {
        throw new TranscriptionError('network', `El proveedor respondió ${res.status}.`)
      }

      let data: VerboseJson
      try {
        data = (await res.json()) as VerboseJson
      } catch {
        throw new TranscriptionError('bad-shape', 'La respuesta del proveedor no es JSON.')
      }
      const segments = toSegments(data)
      if (segments.length === 0) {
        throw new TranscriptionError(
          'bad-shape',
          'La transcripción llegó vacía.',
          JSON.stringify(data)?.slice(0, 2000), // [diag] contexto crudo
        )
      }
      onProgress?.({ stage: 'done' })
      return { lang: req.lang, segments }
    },
  }
}

/** Groq: `whisper-large-v3-turbo` por su endpoint compatible con OpenAI. */
export const groqTranscriber = createWhisperTranscriber({
  endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
  model: 'whisper-large-v3-turbo',
  authHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
})

/** OpenAI: `whisper-1`. */
export const openaiTranscriber = createWhisperTranscriber({
  endpoint: 'https://api.openai.com/v1/audio/transcriptions',
  model: 'whisper-1',
  authHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
})
