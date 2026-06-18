/**
 * Registry de engines: resuelve un `ProviderId` a su `Translator`. La red vive en
 * este directorio (constitución I). MVP: `mock` (demo) + stubs incrementales; los
 * proveedores reales se conectan aquí (Groq en US2). Spec: 003-translate-api-byok.
 */
import {
  TranslationError,
  type ProviderId,
  type Translator,
} from '../../core/services/translator'
import {
  TranscriptionError,
  type Transcriber,
  type TranscriberId,
} from '../../core/services/transcriber'
import { mockTranslator } from '../mock/mockTranslator'
import { mockTranscriber } from '../mock/mockTranscriber'
import { groqTranscriber, openaiTranscriber } from './whisperAdapter'
import { groqTranslator } from './groq'
import { openaiTranslator } from './openai'
import { deepseekTranslator } from './deepseek'
import { anthropicTranslator } from './anthropic'
import { geminiTranslator } from './gemini'
import { googleTranslator } from './googleTranslate'
import { deeplTranslator } from './deepl'

/** Stub para proveedores aún no implementados: falla claro antes de cualquier `fetch`. */
const unavailable: Translator = {
  async translate() {
    throw new TranslationError(
      'provider-unavailable',
      'Este proveedor todavía no está disponible. Elige otro en Settings.',
    )
  },
}

/**
 * Devuelve el `Translator` del proveedor. La clave BYOK viaja en
 * `TranslationRequest.apiKey` (no aquí). Proveedores sin adaptador devuelven el stub.
 */
export function getTranslator(provider: ProviderId): Translator {
  switch (provider) {
    case 'mock':
      return mockTranslator
    case 'groq':
      return groqTranslator
    case 'openai':
      return openaiTranslator
    case 'deepseek':
      return deepseekTranslator
    case 'anthropic':
      return anthropicTranslator
    case 'gemini':
      return geminiTranslator
    case 'google':
      return googleTranslator
    case 'deepl':
      return deeplTranslator
    default:
      return unavailable
  }
}

/** Stub de transcripción para proveedores aún no disponibles. */
const unavailableTranscriber: Transcriber = {
  async transcribe() {
    throw new TranscriptionError(
      'provider-unavailable',
      'Este proveedor de transcripción todavía no está disponible. Elige otro en Settings.',
    )
  },
}

/**
 * Devuelve el `Transcriber` del proveedor de ASR. La clave BYOK viaja en
 * `TranscriptionRequest.apiKey` (reusa la misma clave que la traducción del mismo id).
 */
export function getTranscriber(provider: TranscriberId): Transcriber {
  switch (provider) {
    case 'mock':
      return mockTranscriber
    case 'groq':
      return groqTranscriber
    case 'openai':
      return openaiTranscriber
    default:
      return unavailableTranscriber
  }
}
