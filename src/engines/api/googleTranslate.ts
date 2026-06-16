/**
 * Proveedor Google Translate (familia MT). API REST v2: la clave va en la URL, el
 * cuerpo lleva `q` (array de textos) y la respuesta `data.translations[].translatedText`
 * en el mismo orden. Permite llamadas directas desde el navegador (CORS). Reusa el flujo
 * de `mtAdapter` (D7). Spec: 003-translate-api-byok.
 */
import { createMtTranslator } from './mtAdapter'

export const googleTranslator = createMtTranslator({
  buildRequest: ({ key, source, target, texts }) => ({
    url: `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`,
    headers: {},
    body: { q: texts, source, target, format: 'text' },
  }),
  extractTexts: (data) => {
    const translations = (
      data as { data?: { translations?: { translatedText?: unknown }[] } }
    )?.data?.translations
    if (!Array.isArray(translations)) return undefined
    return translations.map((t) => (typeof t.translatedText === 'string' ? t.translatedText : ''))
  },
})
