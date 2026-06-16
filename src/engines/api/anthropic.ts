/**
 * Proveedor Anthropic (Claude, familia LLM). Usa la Messages API (no es estilo
 * OpenAI): `system` separado, `max_tokens` obligatorio y respuesta en `content[].text`.
 * Para llamar directo desde el navegador hace falta el header
 * `anthropic-dangerous-direct-browser-access` (opt-in CORS oficial). Modelo barato y
 * rápido para subtítulos. Reusa el flujo de `llmAdapter` (D7). Spec: 003.
 */
import { createLlmTranslator, type LlmConfig } from './llmAdapter'

const ANTHROPIC_CONFIG: LlmConfig = {
  endpoint: 'https://api.anthropic.com/v1/messages',
  model: 'claude-haiku-4-5',
  authHeaders: (key) => ({ 'x-api-key': key }),
  extraHeaders: {
    'anthropic-version': '2023-06-01',
    // Habilita BYOK directo desde el navegador (sin backend).
    'anthropic-dangerous-direct-browser-access': 'true',
  },
  buildBody: (model, system, userContent) => ({
    model,
    max_tokens: 8192,
    system,
    messages: [{ role: 'user', content: userContent }],
  }),
  extractContent: (data) => {
    const text = (data as { content?: { type?: string; text?: unknown }[] })
      ?.content?.find((b) => b.type === 'text')?.text
    return typeof text === 'string' ? text : undefined
  },
}

export const anthropicTranslator = createLlmTranslator(ANTHROPIC_CONFIG)
