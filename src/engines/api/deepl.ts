/**
 * Proveedor DeepL (familia MT). La clave va en el header `Authorization: DeepL-Auth-Key`,
 * el cuerpo lleva `text` (array) y la respuesta `translations[].text` en el mismo orden.
 * Las claves gratuitas terminan en `:fx` y usan el host `api-free`; las de pago, `api`.
 *
 * ⚠️ CORS: la API de DeepL NO envía cabeceras CORS, así que una llamada directa desde
 * el navegador (sin backend) fallará con error de red. Queda implementado para cuando
 * exista un proxy; en la web v0.1 se mostrará como fallo de red accionable. Reusa el
 * flujo de `mtAdapter` (D7). Spec: 003-translate-api-byok.
 */
import type { LangCode } from '../../core/models'
import { createMtTranslator } from './mtAdapter'

/** DeepL usa códigos en mayúscula (`EN`, `ES`, `JA`). */
function deeplLang(lang: LangCode): string {
  return lang.toUpperCase()
}

/** Las claves free terminan en `:fx` → host `api-free`. */
function deeplEndpoint(key: string): string {
  const host = key.trim().endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com'
  return `https://${host}/v2/translate`
}

export const deeplTranslator = createMtTranslator({
  buildRequest: ({ key, source, target, texts }) => ({
    url: deeplEndpoint(key),
    headers: { Authorization: `DeepL-Auth-Key ${key}` },
    body: { text: texts, source_lang: deeplLang(source), target_lang: deeplLang(target) },
  }),
  extractTexts: (data) => {
    const translations = (data as { translations?: { text?: unknown }[] })?.translations
    if (!Array.isArray(translations)) return undefined
    return translations.map((t) => (typeof t.text === 'string' ? t.text : ''))
  },
})
