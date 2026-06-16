/**
 * Proveedor DeepSeek (familia LLM). API compatible estilo OpenAI chat-completions;
 * reusa todo el flujo de `llmAdapter` (D7). Spec: 003-translate-api-byok.
 */
import { createLlmTranslator, type LlmConfig } from './llmAdapter'

const DEEPSEEK_CONFIG: LlmConfig = {
  endpoint: 'https://api.deepseek.com/chat/completions',
  model: 'deepseek-chat',
  authHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
}

export const deepseekTranslator = createLlmTranslator(DEEPSEEK_CONFIG)
