/**
 * Adaptador base de la familia LLM (anti-repetición, D7). Concentra el flujo común:
 * batching (puro) → prompt → `fetch` chat-completions → parseo/validación 1:1 (puro)
 * → acumular por índice → progreso. Cada proveedor LLM concreto aporta solo endpoint,
 * modelo y headers de auth. Única capa con red (constitución I). Spec: 003.
 */
import type { LangCode } from '../../core/models'
import {
  TranslationError,
  type Translator,
  type TranslationRequest,
  type TranslationResult,
  type TranslationProgress,
} from '../../core/services/translator'
import { planBatches, encodeBatch, decodeBatch } from '../../core/translation/batch'
import { translateWithBisect } from '../../core/translation/bisect'

/**
 * Configuración de un proveedor de familia LLM. Por defecto asume el formato
 * OpenAI chat-completions (Groq, OpenAI, DeepSeek); Anthropic y Gemini hablan otro
 * dialecto, así que aportan su propio `buildBody`/`extractContent` (y `endpoint` puede
 * depender de la clave, p.ej. Gemini la lleva en la URL).
 */
export interface LlmConfig {
  /** URL del endpoint, o función que la arma a partir de la clave (Gemini). */
  endpoint: string | ((key: string) => string)
  /** Modelo a usar. */
  model: string
  /** Headers de autenticación a partir de la clave BYOK. */
  authHeaders: (key: string) => Record<string, string>
  /** Headers fijos extra (versión de API, opt-in CORS, etc.). */
  extraHeaders?: Record<string, string>
  /** Arma el cuerpo de la petición. Default: chat-completions estilo OpenAI. */
  buildBody?: (model: string, system: string, userContent: string) => unknown
  /** Extrae el texto de la respuesta. Default: `choices[0].message.content`. */
  extractContent?: (data: unknown) => string | undefined
}

/** Cuerpo por defecto: chat-completions estilo OpenAI (Groq/OpenAI/DeepSeek). */
function openAiBody(model: string, system: string, userContent: string): unknown {
  return {
    model,
    temperature: 0,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
  }
}

/** Extracción por defecto: `choices[0].message.content` (estilo OpenAI). */
function openAiContent(data: unknown): string | undefined {
  const content = (data as { choices?: { message?: { content?: unknown } }[] })
    ?.choices?.[0]?.message?.content
  return typeof content === 'string' ? content : undefined
}

const LANG_NAMES: Record<LangCode, string> = {
  en: 'inglés',
  es: 'español',
  ja: 'japonés',
}

function systemPrompt(source: LangCode, target: LangCode): string {
  return (
    `Eres un traductor profesional de subtítulos. Recibirás un array JSON de strings ` +
    `en ${LANG_NAMES[source]}. Traduce cada elemento al ${LANG_NAMES[target]}. ` +
    `Devuelve SOLO un array JSON de strings con EXACTAMENTE la misma cantidad de ` +
    `elementos y el MISMO orden: traduce cada entrada por separado, una por una. ` +
    `NUNCA combines dos entradas en una ni dividas una entrada en varias, aunque en ` +
    `${LANG_NAMES[target]} parezca más natural unirlas; mantén la correspondencia 1:1. ` +
    `Sin numeración, sin comentarios ni texto adicional. Conserva los saltos de línea.`
  )
}

/** Crea un `Translator` para un proveedor LLM concreto a partir de su `LlmConfig`. */
export function createLlmTranslator(config: LlmConfig): Translator {
  return {
    async translate(
      req: TranslationRequest,
      onProgress?: (p: TranslationProgress) => void,
    ): Promise<TranslationResult> {
      // Guard BYOK: nunca llamamos a la red sin clave (FR-005).
      if (!req.apiKey || req.apiKey.trim() === '') {
        throw new TranslationError('no-key', 'Falta la API key del proveedor.')
      }

      const batches = planBatches(req.texts)
      const total = batches.reduce((n, b) => n + b.texts.length, 0)
      const result: (string | undefined)[] = new Array(req.texts.length).fill(undefined)
      let done = 0

      for (const batch of batches) {
        try {
          // Auto-bisección: si el LLM fusiona/divide líneas (bad-shape), reintenta en
          // mitades hasta lograr 1:1 (típico en japonés). Solo afecta al lote fallido.
          const translated = await translateWithBisect(batch.texts, async (sub) => {
            const content = await callChat(config, req, sub)
            return decodeBatch(content, sub.length) // valida 1:1 (bad-shape)
          })
          batch.indices.forEach((origIndex, i) => {
            result[origIndex] = translated[i]
          })
        } catch (e) {
          // Conserva lo ya traducido para reintentar solo lo pendiente (FR-008).
          if (e instanceof TranslationError) e.partial = result
          throw e
        }
        done += batch.texts.length
        onProgress?.({ done, total })
      }

      return { texts: result }
    },
  }
}

/** Una llamada chat-completions; mapea estado/excepción a `TranslationError`. */
async function callChat(
  config: LlmConfig,
  req: TranslationRequest,
  texts: string[],
): Promise<string> {
  // `.trim()`: el pegado en móvil suele meter espacios/saltos; un espacio inicial
  // rompe el header `Authorization` y el proveedor responde 401 (auth).
  const key = (req.apiKey as string).trim()
  const url = typeof config.endpoint === 'function' ? config.endpoint(key) : config.endpoint
  const buildBody = config.buildBody ?? openAiBody
  const body = buildBody(config.model, systemPrompt(req.sourceLang, req.targetLang), encodeBatch(texts))

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.extraHeaders,
        ...config.authHeaders(key),
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new TranslationError('network', 'Fallo de red al contactar al proveedor.')
  }

  if (res.status === 401 || res.status === 403) {
    throw new TranslationError('auth', 'API key inválida o sin permisos.')
  }
  if (res.status === 429) {
    throw new TranslationError('rate-limit', 'Límite de uso alcanzado. Reintenta más tarde.')
  }
  if (!res.ok) {
    throw new TranslationError('network', `El proveedor respondió ${res.status}.`)
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new TranslationError('bad-shape', 'La respuesta del proveedor no es JSON.')
  }
  const extract = config.extractContent ?? openAiContent
  const content = extract(data)
  if (typeof content !== 'string') {
    throw new TranslationError(
      'bad-shape',
      'La respuesta no trae contenido de texto.',
      JSON.stringify(data)?.slice(0, 2000), // [diag] contexto crudo para diagnóstico
    )
  }
  return content
}
