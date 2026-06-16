/**
 * Proveedor OpenAI (familia LLM). Endpoint chat-completions nativo; reusa todo el
 * flujo de `llmAdapter` (D7). La API de OpenAI permite llamadas directas desde el
 * navegador (CORS). Modelo barato y rápido para subtítulos. Spec: 003.
 */
import { createLlmTranslator, type LlmConfig } from './llmAdapter'

const OPENAI_CONFIG: LlmConfig = {
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini',
  authHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
}

export const openaiTranslator = createLlmTranslator(OPENAI_CONFIG)
