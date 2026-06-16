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
import { mockTranslator } from '../mock/mockTranslator'
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
