/**
 * Interfaz Translator + tipos y catálogo de proveedores. Lógica pura: la firma NO
 * usa `fetch`/DOM (la red vive en `src/engines/api`). Spec: 003-translate-api-byok.
 */
import type { LangCode } from '../models'

/** Proveedor de traducción. `'mock'` es el modo demo sin clave. */
export type ProviderId =
  | 'mock'
  | 'groq'
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'deepseek'
  | 'google'
  | 'deepl'

/**
 * Familia del proveedor: determina cómo se arma la petición y se valida el 1:1.
 *  - `'llm'`:  traduce un lote vía prompt; valida la longitud del array devuelto.
 *  - `'mt'`:   traductor dedicado (array 1:1 natural).
 *  - `'mock'`: demo local sin red.
 */
export type ProviderFamily = 'llm' | 'mt' | 'mock'

export interface ProviderInfo {
  id: ProviderId
  /** Etiqueta para el selector (p. ej. "Groq", "DeepL"). */
  label: string
  family: ProviderFamily
  /** `false` solo para `'mock'`. */
  needsKey: boolean
  /** `true` si hay adaptador real; `false` si es stub incremental. */
  implemented: boolean
}

/**
 * Catálogo para el selector de Settings. Todos los proveedores tienen adaptador real
 * (FR-011). DeepL queda implementado pero su API no permite llamadas directas desde el
 * navegador (sin CORS), así que en la web v0.1 fallará con error de red hasta que haya
 * un proxy.
 */
export const PROVIDERS: readonly ProviderInfo[] = [
  { id: 'mock', label: 'Mock (demo)', family: 'mock', needsKey: false, implemented: true },
  { id: 'groq', label: 'Groq', family: 'llm', needsKey: true, implemented: true },
  { id: 'anthropic', label: 'Anthropic (Claude)', family: 'llm', needsKey: true, implemented: true },
  { id: 'openai', label: 'OpenAI (ChatGPT)', family: 'llm', needsKey: true, implemented: true },
  { id: 'gemini', label: 'Gemini', family: 'llm', needsKey: true, implemented: true },
  { id: 'deepseek', label: 'DeepSeek', family: 'llm', needsKey: true, implemented: true },
  { id: 'google', label: 'Google Translate', family: 'mt', needsKey: true, implemented: true },
  { id: 'deepl', label: 'DeepL', family: 'mt', needsKey: true, implemented: true },
]

/** Busca la info de un proveedor por id. */
export function getProviderInfo(id: ProviderId): ProviderInfo {
  const info = PROVIDERS.find((p) => p.id === id)
  if (!info) throw new Error(`Proveedor desconocido: ${id}`)
  return info
}

export interface TranslationRequest {
  sourceLang: LangCode
  targetLang: LangCode
  /** Textos de origen por índice de segmento (puede haber vacíos). */
  texts: string[]
  /** Requerido por proveedores con `needsKey`. */
  apiKey?: string
}

export interface TranslationProgress {
  /** Segmentos (o items) traducidos. */
  done: number
  total: number
}

export interface TranslationResult {
  /** Traducción por índice, alineada 1:1 con `request.texts` (`undefined` si vacío). */
  texts: (string | undefined)[]
}

export type TranslationErrorKind =
  | 'no-key'
  | 'auth'
  | 'rate-limit'
  | 'network'
  | 'bad-shape'
  | 'provider-unavailable'

/** Error tipado para mapear cada fallo a un mensaje/acción en la UI (D8). */
export class TranslationError extends Error {
  kind: TranslationErrorKind
  /**
   * Traducción acumulada antes del fallo, por índice (FR-008): permite conservar lo
   * ya traducido y reintentar solo lo pendiente. La UI la fusiona y reintenta.
   */
  partial?: (string | undefined)[]
  constructor(kind: TranslationErrorKind, message?: string) {
    super(message ?? kind)
    this.name = 'TranslationError'
    this.kind = kind
  }
}

export interface Translator {
  /**
   * Traduce los textos de `req` y devuelve la traducción alineada 1:1 por índice.
   * `onProgress` se invoca al cerrar cada lote. Lanza `TranslationError`; nunca cuelga.
   */
  translate(
    req: TranslationRequest,
    onProgress?: (p: TranslationProgress) => void,
  ): Promise<TranslationResult>
}
