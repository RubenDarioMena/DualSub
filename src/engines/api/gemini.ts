/**
 * Proveedor Gemini (Google, familia LLM). Usa la API `generateContent`: la clave va
 * en la URL (query param), el sistema en `system_instruction` y la respuesta en
 * `candidates[0].content.parts[].text`. Permite llamadas directas desde el navegador
 * (CORS). Modelo barato y rápido para subtítulos. Reusa `llmAdapter` (D7). Spec: 003.
 */
import { createLlmTranslator, type LlmConfig } from './llmAdapter'

const MODEL = 'gemini-2.0-flash'

const GEMINI_CONFIG: LlmConfig = {
  endpoint: (key) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
  model: MODEL,
  // La clave viaja en la URL; no hay header de auth.
  authHeaders: () => ({}),
  buildBody: (_model, system, userContent) => ({
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: { temperature: 0 },
  }),
  extractContent: (data) => {
    const text = (
      data as {
        candidates?: { content?: { parts?: { text?: unknown }[] } }[]
      }
    )?.candidates?.[0]?.content?.parts?.[0]?.text
    return typeof text === 'string' ? text : undefined
  },
}

export const geminiTranslator = createLlmTranslator(GEMINI_CONFIG)
