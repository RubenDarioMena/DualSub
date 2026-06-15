# Contract: Translator + helpers puros + engines

**Módulos**: `src/core/services/translator.ts`, `src/core/translation/*`,
`src/engines/{mock,api}/*` · **Spec**: [../spec.md](../spec.md) · **Probado por**:
`tests/core/batch.test.ts`, `tests/core/assemble.test.ts`.

Core (interfaz + `batch` + `assemble`) es **puro** (sin `fetch`/DOM). La red vive
**solo** en `engines/api`.

## `planBatches(texts, opts?)` → `Batch[]`  (puro)

- Omite textos **vacíos / solo-espacios** (no se envían).
- Agrupa preservando orden hasta `maxItems` (default 40) o `maxChars` (default ~4000)
  por lote; un texto que exceda `maxChars` va solo en su lote.
- Cada `Batch` lleva `indices` (posición original de cada texto) y `texts`.

## `encodeBatch(texts)` / `decodeBatch(raw, expected)`  (puro)

- `encodeBatch`: serializa `texts` como **array JSON** (lo que se manda al LLM).
- `decodeBatch`: extrae el **primer array JSON** de `raw` (tolera ```code fences``` y
  texto alrededor); si no hay array válido **o** `length !== expected` → lanza
  `TranslationError('bad-shape')`. Garantiza el 1:1 del lote (D2).

## `assembleTranslated(source, targetLang, byIndex)` → `DualSubDocument`  (puro)

- Devuelve un documento **nuevo** (no muta `source`).
- Por cada segmento `i`: copia `startMs`/`endMs`/`texts` y añade
  `texts[targetLang] = byIndex[i]` si está definido (los vacíos quedan solo-origen).
- Mantiene **mismo nº de segmentos y timing**. `meta.source = 'api-pipeline'`.
- El resultado pasa `validateDocument` (red de seguridad recomendada en tests).

## Interfaz `Translator`

`translate(req, onProgress?) => Promise<TranslationResult>`:

- `req.texts` está alineado por índice de segmento; `result.texts` devuelve la
  traducción por el **mismo índice** (`undefined` para los vacíos).
- `onProgress({done,total})` se llama al cerrar cada lote.
- Lanza `TranslationError` con `kind` adecuado; nunca cuelga.

### Engine `mock` (`engines/mock/mockTranslator.ts`)

- No usa red ni clave. Devuelve una traducción falsa **instantánea** alineada 1:1
  (p. ej. `«es» ⟨texto⟩` o marca de idioma), respetando `undefined` en vacíos.
- Emite progreso 1-2 veces para ejercitar la UI.

### Engine `api` familia LLM (`engines/api/llmAdapter.ts` + `groq.ts`)

- Recorre los `planBatches`; por lote: `encodeBatch` → `fetch` (POST chat-completions,
  `Authorization: Bearer <key>`, modelo del proveedor, system="traduce de X a Y y
  devuelve SOLO un array JSON de la misma longitud y orden") → `decodeBatch` → acumula
  por índice → `onProgress`.
- Antes de cualquier `fetch`, si falta la clave → `TranslationError('no-key')`.
- Mapeo de error: 401/403→`auth`, 429→`rate-limit`, fallo de fetch→`network`,
  respuesta no-array/length≠→`bad-shape`.
- `groq.ts` solo define **endpoint + modelo + headers**; reusa todo el flujo del
  adaptador base (D7). Compatible estilo OpenAI chat-completions.

### Registry (`engines/api/index.ts`)

- `getTranslator(provider, key?) → Translator`: `'mock'`→mock; `'groq'`→Groq real;
  resto de `ProviderId` → stub cuyo `translate` lanza
  `TranslationError('provider-unavailable')` (FR-011, incremental).

## Cubierto por tests (core, con mock)

- `planBatches`: agrupa por items/chars; omite vacíos; texto gigante en su lote.
- `encodeBatch`/`decodeBatch`: round-trip; tolera fences; **lanza** si length≠ (1:1).
- `assembleTranslated`: timing intacto, **origen no mutado**, segmento vacío solo-origen,
  resultado pasa `validateDocument`.
