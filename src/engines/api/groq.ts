/**
 * Proveedor Groq (familia LLM, primer proveedor real del MVP). Solo define endpoint,
 * modelo y headers de auth; reusa todo el flujo de `llmAdapter` (D7). Groq expone una
 * API compatible estilo OpenAI chat-completions. Spec: 003-translate-api-byok.
 */
import { createLlmTranslator, type LlmConfig } from './llmAdapter'

const GROQ_CONFIG: LlmConfig = {
  endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  model: 'llama-3.3-70b-versatile',
  authHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
}

export const groqTranslator = createLlmTranslator(GROQ_CONFIG)
