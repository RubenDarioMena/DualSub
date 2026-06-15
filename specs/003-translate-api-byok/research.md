# Research: Traducción vía API (BYOK)

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-06-14

Decisiones técnicas que habilitan la implementación y los tests. Sin marcadores
`NEEDS CLARIFICATION` (el proveedor MVP se fijó: **Groq**, familia LLM).

## D1 — `fetch` solo en engines; core 100% puro

**Decisión**: la interfaz `Translator` y toda la lógica de batching, codificación,
validación 1:1 y ensamblado del documento viven en `src/core` (puro, testeable). El
acceso de red (`fetch`) vive **exclusivamente** en `src/engines/api`. El engine
recibe del core funciones puras para construir el payload y para parsear/validar la
respuesta; solo añade HTTP + auth.

**Rationale**: constitución I. Así el ~80% del riesgo (alineamiento 1:1, parseo,
errores de formato) se cubre con tests de ms sin red ni navegador.

**Alternativas**: meter el armado del prompt en el engine → no testeable sin red.

## D2 — Protocolo de lote: **JSON array** (no conteo de líneas)

**Decisión**: para la familia **LLM**, cada lote se envía como un **array JSON** de
strings y se exige al modelo devolver **otro array JSON de la misma longitud y
orden**. El core parsea el array (tolerando ```code fences```), y **valida que
`length` coincide** con lo enviado; si no, el lote es error. Para la familia
**traductor dedicado** (DeepL/Google) la API ya recibe y devuelve un array → mismo
contrato de validación.

**Rationale**: los subtítulos pueden ser **multilínea** (un segmento con `\n`);
partir la respuesta por saltos de línea rompería esos segmentos. Un array JSON da un
1:1 robusto e idéntico para ambas familias. Cumple "validar el conteo" (FR-006) de
forma más fuerte que contar líneas.

> Nota de coherencia con la spec: la decisión de diseño 5/“conteo de líneas” del
> spec se concreta aquí como **conteo de elementos del array JSON** (estrictamente
> más robusto con texto multilínea). La validación 1:1 sigue siendo el invariante.

**Alternativas**: numerar líneas (`1. ...`) → frágil si el modelo reformatea;
separador centinela → puede aparecer en el texto. JSON array gana.

## D3 — Batching por items y caracteres

**Decisión**: `planBatches(texts, { maxItems, maxChars })` agrupa los textos de
origen **no vacíos** respetando un tope de items (p. ej. 40) y de caracteres por
lote (p. ej. ~4000), preservando el orden. Cada lote lleva los **índices** de los
segmentos que contiene para reensamblar.

**Rationale**: menos llamadas (costo/latencia) y contexto suficiente por lote, sin
pasarse del límite de tokens del proveedor. Los segmentos de origen **vacíos** no se
envían (no consumen tokens) y se reinsertan sin traducción al ensamblar (preserva el
1:1, edge case del spec).

## D4 — Ensamblado inmutable 1:1

**Decisión**: `assembleTranslated(sourceDoc, targetLang, byIndex)` devuelve un
`DualSubDocument` **nuevo**: copia cada segmento añadiendo `texts[targetLang]` cuando
hay traducción para ese índice; **no muta** el origen; conserva `startMs`/`endMs` y el
número de segmentos. `meta.source = 'api-pipeline'`.

**Rationale**: FR-001/FR-002; el Player ya muestra el dual resultante (001).

## D5 — Selección de engine por proveedor; "demo" = mock

**Decisión**: el catálogo de proveedores incluye, además de los 7 reales, una
entrada **"Mock (demo)"** que mapea al `mockTranslator` (instantáneo, sin clave). La
UI elige el engine **por el proveedor seleccionado** en Settings: "demo" → mock;
cualquier real → su adaptador en `engines/api` (Groq implementado; resto stub que
lanza un error claro "proveedor no disponible todavía").

**Rationale**: cumple constitución II (UI desarrollable contra mock) **y** da un
modo demo sin costo dentro del mismo flujo, sin un toggle aparte. Añadir un proveedor
real luego = rellenar su adaptador, sin tocar la UI.

## D6 — Settings BYOK: clave por proveedor en localStorage

**Decisión**: `settingsStore` (Zustand) mantiene `{ provider: ProviderId, keys:
Partial<Record<ProviderId, string>> }` y lo persiste en `localStorage` con
lectura/escritura **explícita** (no se usa middleware) para que la superficie de la
clave sea auditable. Cambiar de proveedor no borra la clave de otro (FR-004,
escenario US2-4). Borrar la clave la elimina del objeto y de `localStorage`.

**Rationale**: BYOK (constitución VI). `localStorage` directo deja claro que la clave
nunca sale salvo hacia el proveedor. Sin deps (zustand ya está). El input de clave es
`type="password"`; nunca se loguea.

**Alternativas**: `zustand/middleware/persist` (parte de zustand, sin dep nueva) —
válido, pero el wrapper manual es más transparente para una credencial.

## D7 — Adaptador base de familia LLM (anti-repetición)

**Decisión**: `llmAdapter.ts` implementa el flujo común LLM: tomar lotes (de `batch`
puro) → construir mensajes (system: "traduce de X a Y, devuelve SOLO un array JSON de
la misma longitud, sin texto extra"; user: el array JSON) → `fetch` con auth → extraer
el array de la respuesta (helper puro) → validar 1:1 → acumular por índice → emitir
progreso por lote. Cada proveedor LLM concreto (Groq, luego Anthropic/OpenAI/…) aporta
solo: **endpoint**, **headers de auth**, **modelo** y, si difiere, el **mapeo
request/response** (la mayoría son compatibles estilo OpenAI chat-completions).

**Rationale**: el usuario anticipó "mucho código repetido"; el base lo concentra.
Groq expone una API compatible con OpenAI chat-completions, así que el adaptador base
sirve casi tal cual para varios proveedores LLM.

## D8 — Errores accionables tipados

**Decisión**: un `TranslationError` con `kind`:
`'no-key' | 'auth' | 'rate-limit' | 'network' | 'bad-shape' | 'provider-unavailable'`.
El engine mapea el estado HTTP/excepción a un `kind`; la UI muestra un mensaje y
acción por `kind` (p. ej. `no-key`/`auth` → ir a Settings; `rate-limit`/`network` →
reintentar). Fallos a mitad conservan lo ya traducido y permiten reintentar lo
pendiente (FR-007/FR-008).

**Rationale**: SC-003 (nada cuelga) + US3.

## D9 — Navegación a Settings sin router

**Decisión**: ampliar `screen` del `playerStore` a `'import' | 'player' |
'settings'` con `setScreen`. Un botón engranaje en Player/Import abre Settings; un
"volver" regresa. Sin `react-router` (constitución V), coherente con D10 de la 002.

## Riesgos y mitigaciones

- **El LLM devuelve texto extra / no-array** → el parseo puro tolera code fences e
  intenta extraer el primer array JSON; si no hay array válido o el `length` no
  cuadra → `bad-shape` (lote reintentable), nunca desalinea el documento.
- **Costo/tokens** → batching por items+caracteres; el modo "demo" (mock) permite
  desarrollar y demostrar sin gastar.
- **CORS** → Groq permite llamadas directas con `Authorization: Bearer`; si algún
  proveedor del catálogo no permitiera CORS desde el navegador, se documenta como
  limitación de ese adaptador (no bloquea el MVP con Groq).
- **Seguridad de la clave** → solo `localStorage`, input `password`, nunca en logs ni
  en el bundle; se verifica en la checklist (SC-004).
