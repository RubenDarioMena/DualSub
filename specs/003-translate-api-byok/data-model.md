# Data Model: Traducción vía API (BYOK)

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-06-14

No se modifican los modelos de spec 000. Se añaden la **interfaz Translator** y sus
tipos (core/services), tipos puros de **batching** (core/translation) y el estado de
**Settings** (BYOK). La salida final es un `DualSubDocument` dual estándar.

## Tipos nuevos (core/services/translator.ts)

### ProviderId / ProviderFamily / catálogo

```ts
export type ProviderId =
  | 'mock'        // demo instantáneo, sin clave
  | 'groq'        // LLM (MVP real)
  | 'anthropic' | 'openai' | 'gemini' | 'deepseek'  // LLM (stubs)
  | 'google' | 'deepl'                              // traductor dedicado (stubs)

export type ProviderFamily = 'llm' | 'mt' | 'mock'

export interface ProviderInfo {
  id: ProviderId
  label: string            // p. ej. "Groq", "DeepL"
  family: ProviderFamily
  needsKey: boolean        // false solo para 'mock'
  implemented: boolean     // true: groq, mock; false: el resto (stub)
}

export const PROVIDERS: readonly ProviderInfo[]   // catálogo para el selector
```

### Translator (interfaz) + Request/Result/Progress/Error

```ts
export interface TranslationRequest {
  sourceLang: LangCode
  targetLang: LangCode
  /** Textos de origen por índice de segmento (puede haber vacíos). */
  texts: string[]
  apiKey?: string          // requerido por proveedores con needsKey
}

export interface TranslationProgress {
  done: number             // segmentos (o items) traducidos
  total: number
}

export interface TranslationResult {
  /** Traducción por índice, alineada 1:1 con request.texts (undefined si vacío). */
  texts: (string | undefined)[]
}

export type TranslationErrorKind =
  | 'no-key' | 'auth' | 'rate-limit' | 'network' | 'bad-shape' | 'provider-unavailable'

export class TranslationError extends Error {
  kind: TranslationErrorKind
}

export interface Translator {
  translate(
    req: TranslationRequest,
    onProgress?: (p: TranslationProgress) => void,
  ): Promise<TranslationResult>
}
```

> La interfaz es **pura en su firma** (sin `fetch`/DOM). La implementación `api`
> usa `fetch` dentro de `engines/api`, no en core.

## Tipos puros de batching (core/translation/batch.ts)

```ts
export interface Batch { indices: number[]; texts: string[] }

export function planBatches(
  texts: string[],
  opts?: { maxItems?: number; maxChars?: number },
): Batch[]                                  // omite vacíos; agrupa por items+chars (D3)

export function encodeBatch(texts: string[]): string         // JSON array para el prompt
export function decodeBatch(raw: string, expected: number): string[]  // extrae array JSON (tolera fences); lanza si length != expected (D2)
```

## Ensamblado (core/translation/assemble.ts)

```ts
export function assembleTranslated(
  source: DualSubDocument,
  targetLang: LangCode,
  byIndex: (string | undefined)[],   // traducción por índice de segmento
): DualSubDocument                    // NUEVO doc inmutable, 1:1, timing intacto (D4)
```

## Estado de Settings (state/settingsStore.ts) — persistido

| Campo      | Tipo                                   | Notas |
|------------|----------------------------------------|-------|
| `provider` | `ProviderId`                           | Proveedor activo. Default `'mock'`. |
| `keys`     | `Partial<Record<ProviderId, string>>`  | Clave **por proveedor** (BYOK). Solo en `localStorage`. |

Acciones: `setProvider(id)`, `setKey(id, key)`, `clearKey(id)`. Persistencia
explícita a `localStorage` (D6). `keys` nunca se serializa al bundle ni se loguea.

## Pipeline (de doc-de-un-idioma a dual)

```text
DualSubDocument (solo origen)               settingsStore (provider + key)
        │  texts[] = segmentos.map(sourceLang)        │
        ▼                                             ▼
  planBatches (puro) ──► Batch[] ──► Translator.translate(req, onProgress)
                                          │   (mock | engines/api: llmAdapter→groq)
                                          │   por lote: encodeBatch → fetch → decodeBatch (valida 1:1)
                                          ▼
                              TranslationResult.texts[] (por índice)
                                          │
                                  assembleTranslated (puro)
                                          ▼
                              DualSubDocument DUAL  ──►  loadProject → Player (001)
```

## Validación y reglas (trazabilidad)

| Regla | Origen | Dónde se cumple |
|-------|--------|-----------------|
| 1:1 mismo nº segmentos + timing intacto | FR-002 | `assembleTranslated` (inmutable) |
| No mutar el documento origen | FR-001 | `assembleTranslated` (copia) |
| Validar conteo por lote | FR-006 | `decodeBatch` (length == expected) |
| Segmento de origen vacío no rompe 1:1 | edge case | `planBatches` omite, ensamblado reinserta |
| Clave solo en localStorage | FR-004, SC-004 | `settingsStore` (D6) |
| Sin clave (proveedor real) → no llama | FR-005 | engine `api` lanza `no-key` antes de `fetch` |
| `sourceLang !== targetLang` | FR-009 | precondición de la acción Traducir |
| Errores accionables, nada cuelga | FR-007, SC-003 | `TranslationError.kind` + UI |
| Proveedor no implementado | FR-011 | stub lanza `provider-unavailable` |
