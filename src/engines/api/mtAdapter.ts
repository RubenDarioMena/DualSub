/**
 * Adaptador base de la familia MT (traductores dedicados: Google Translate, DeepL).
 * A diferencia de la familia LLM, estos reciben un array de textos y devuelven la
 * traducción 1:1 de forma nativa (sin prompt ni validación de longitud por modelo).
 * Concentra el flujo común: batching (puro, reusa `planBatches`) → `fetch` → array →
 * validar 1:1 → acumular por índice → progreso. Única capa con red (constitución I).
 * Cada proveedor MT concreto aporta solo cómo armar la petición y leer el array.
 * Spec: 003-translate-api-byok.
 */
import type { LangCode } from '../../core/models'
import {
  TranslationError,
  type Translator,
  type TranslationRequest,
  type TranslationResult,
  type TranslationProgress,
} from '../../core/services/translator'
import { planBatches } from '../../core/translation/batch'

/** Petición HTTP lista para un lote de textos. */
export interface MtRequest {
  url: string
  headers: Record<string, string>
  body: unknown
}

/** Configuración de un proveedor MT (traductor dedicado). */
export interface MtConfig {
  /** Arma la petición HTTP para un lote (clave BYOK + idiomas + textos). */
  buildRequest: (args: {
    key: string
    source: LangCode
    target: LangCode
    texts: string[]
  }) => MtRequest
  /** Extrae el array de traducciones (mismo orden que el lote). */
  extractTexts: (data: unknown) => string[] | undefined
}

/** Crea un `Translator` para un proveedor MT concreto a partir de su `MtConfig`. */
export function createMtTranslator(config: MtConfig): Translator {
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
          // `.trim()`: el pegado en móvil suele meter espacios/saltos que rompen la auth.
          const translated = await callMt(config, (req.apiKey as string).trim(), req, batch.texts)
          batch.indices.forEach((origIndex, i) => {
            result[origIndex] = translated[i]
          })
        } catch (e) {
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

/** Una llamada al traductor MT; mapea estado/excepción a `TranslationError`. */
async function callMt(
  config: MtConfig,
  key: string,
  req: TranslationRequest,
  texts: string[],
): Promise<string[]> {
  const { url, headers, body } = config.buildRequest({
    key,
    source: req.sourceLang,
    target: req.targetLang,
    texts,
  })

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
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

  const translated = config.extractTexts(data)
  // Garantía 1:1: el array debe tener la misma longitud que el lote enviado.
  if (!Array.isArray(translated) || translated.length !== texts.length) {
    throw new TranslationError('bad-shape', 'El proveedor devolvió un número de líneas distinto.')
  }
  return translated
}
