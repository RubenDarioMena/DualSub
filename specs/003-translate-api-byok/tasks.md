---
description: "Task list — Traducción vía API (BYOK)"
---

# Tasks: Traducción vía API (BYOK) — rellenar el idioma destino

**Input**: Design documents from `/specs/003-translate-api-byok/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Incluidos SOLO para la **lógica pura nueva de `src/core`** (`batch`,
`assemble`), obligatorio por la constitución (principio I) y el plan. Los
adaptadores de red (`engines/api`) NO llevan test automatizado en v0.1 (se validan
en dispositivo, §8); su parseo/validación es puro y queda cubierto por los tests de
`batch`.

**Organization**: Tareas agrupadas por historia de usuario para implementar y
probar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (otro archivo, sin dependencias pendientes).
- **[Story]**: Historia a la que pertenece (US1, US2, US3).
- Cada tarea incluye su ruta de archivo exacta.

## Path Conventions

Single project (web SPA): `src/`, `tests/` en la raíz del repo (ver plan.md §Project
Structure).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificar línea base y preparar las carpetas nuevas. El repo ya está
scaffolded (000/001/002); no hay deps nuevas.

- [X] T001 Verificar línea base verde (`pnpm test` + `pnpm build`) y crear las carpetas nuevas vacías: `src/core/services/`, `src/core/translation/`, `src/engines/api/`, `src/screens/Settings/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: La interfaz y los tipos compartidos que TODAS las historias consumen
(catálogo de proveedores, Request/Result/Progress/Error).

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase.

- [X] T002 Crear la interfaz `Translator` + tipos en `src/core/services/translator.ts`: `ProviderId`, `ProviderFamily`, `ProviderInfo`, catálogo `PROVIDERS` (mock + 7 reales, marcando `family`/`needsKey`/`implemented`), `TranslationRequest`, `TranslationProgress`, `TranslationResult`, `TranslationErrorKind`, clase `TranslationError` e interfaz `Translator` (firma pura, sin `fetch`/DOM) — según data-model.md

**Checkpoint**: Contrato compartido listo — las historias pueden comenzar.

---

## Phase 3: User Story 1 — Traducir mi subtítulo de un idioma a dual (Priority: P1) 🎯 MVP

**Goal**: Tomar un `DualSubDocument` que solo tiene origen y producir uno **dual**
(1:1, timing intacto, origen no mutado) que el Player ya muestra — demostrable
contra el engine **mock** sin gastar API.

**Independent Test**: Con el proveedor "Mock (demo)" (default, sin clave), abrir un
documento de un idioma, pulsar **Traducir** y verificar que el Player pasa a mostrar
origen+destino con el **mismo timing** y **mismo número** de segmentos; la lógica de
batching/validación/ensamblado 1:1 se prueba aislada en `tests/core/`.

### Tests for User Story 1 ⚠️

> Escribir estos tests ANTES de la implementación y verificar que FALLAN primero.

- [X] T003 [P] [US1] Tests de batching en `tests/core/batch.test.ts`: `planBatches` agrupa por `maxItems`/`maxChars`, omite textos vacíos/solo-espacios, texto gigante va solo en su lote, conserva orden e `indices`; `encodeBatch`/`decodeBatch` round-trip, tolera ```code fences```, y **lanza `TranslationError('bad-shape')`** si `length !== expected` (incluye caso multilínea con `\n`)
- [X] T004 [P] [US1] Tests de ensamblado en `tests/core/assemble.test.ts`: `assembleTranslated` produce doc **nuevo** (origen no mutado), mismo nº de segmentos y `startMs`/`endMs` intactos, añade `texts[targetLang]` solo donde hay traducción, segmento de origen vacío queda solo-origen, `meta.source='api-pipeline'`, y el resultado pasa `validateDocument`

### Implementation for User Story 1

- [X] T005 [P] [US1] Implementar `src/core/translation/batch.ts` (puro): `planBatches(texts, {maxItems=40, maxChars=4000})`, `encodeBatch(texts)` (array JSON), `decodeBatch(raw, expected)` (extrae primer array JSON tolerando fences; lanza `bad-shape` si no-array o `length!==expected`) — según contracts/translator.md
- [X] T006 [P] [US1] Implementar `src/core/translation/assemble.ts` (puro): `assembleTranslated(source, targetLang, byIndex)` → `DualSubDocument` nuevo, inmutable, 1:1, timing intacto, `meta.source='api-pipeline'`
- [X] T007 [US1] Implementar `src/engines/mock/mockTranslator.ts`: `Translator` falso instantáneo sin red ni clave, traducción 1:1 alineada (respeta `undefined` en vacíos), emite `onProgress` 1-2 veces
- [X] T008 [US1] Crear el registry `src/engines/api/index.ts`: `getTranslator(provider, key?) → Translator` que devuelve el mock para `'mock'` y un **stub** que lanza `TranslationError('provider-unavailable')` para el resto (Groq se conecta en US2)
- [X] T009 [US1] Crear `src/screens/Player/TranslatePanel.tsx` (versión base): arma `TranslationRequest` desde el doc (textos por índice del `sourceLang`), llama `getTranslator('mock')` → `planBatches`/`translate` → `assembleTranslated` → `loadProject({doc, mediaUrl})` conservando el `mediaUrl` actual
- [X] T010 [US1] Editar `src/screens/Player/PlayerScreen.tsx` (diff mínimo): montar `TranslatePanel` y mostrar la acción **Traducir** solo cuando el doc tiene origen, falta algún `texts[targetLang]` y `sourceLang !== targetLang`

**Checkpoint**: US1 funcional — traducir-a-dual con "Mock (demo)" al instante; tests de core verdes.

---

## Phase 4: User Story 2 — Elegir proveedor y usar mi propia API key (BYOK) (Priority: P1)

**Goal**: Pantalla **Settings** con selector de proveedor y clave **por proveedor**
en `localStorage`, más el **primer proveedor real (Groq)** detrás de la misma
interfaz. Integra con el `TranslatePanel` de US1.

**Independent Test**: Elegir un proveedor y guardar su clave en Settings, recargar y
verificar persistencia en `localStorage`; cambiar de proveedor no pisa la clave del
otro; borrar la elimina. Con Groq + clave real, una traducción rellena el destino
1:1; sin clave (proveedor real), Traducir avisa "configura tu API key" sin llamar.

### Implementation for User Story 2

- [X] T011 [US2] Crear `src/state/settingsStore.ts` (Zustand): estado `{ provider: ProviderId (default 'mock'); keys: Partial<Record<ProviderId,string>> }` + acciones `setProvider`/`setKey`/`clearKey`; persistencia **explícita** a `localStorage` (clave `dualsub.settings`), lectura al iniciar y escritura por cambio; la clave nunca se loguea (D6)
- [X] T012 [US2] Editar `src/state/playerStore.ts` (diff mínimo): ampliar `screen` a `'import' | 'player' | 'settings'` y añadir la acción `setScreen(s)`
- [X] T013 [P] [US2] Crear `src/screens/Settings/SettingsScreen.tsx` (móvil-first 360px): selector de proveedor desde `PROVIDERS` (muestra familia y si está implementado; "Mock (demo)" no pide clave), input de clave `type="password"` para el proveedor activo si `needsKey`, botones **Guardar**/**Borrar**, aviso si el proveedor es stub, y botón **volver** → `setScreen('player'|'import')`
- [X] T014 [US2] Editar `src/App.tsx` (diff mínimo): enrutar `screen === 'settings' → <SettingsScreen />` además de import/player
- [X] T015 [US2] Editar `src/screens/Player/PlayerScreen.tsx` (diff mínimo): botón engranaje → `setScreen('settings')`
- [X] T016 [P] [US2] Crear `src/engines/api/llmAdapter.ts`: adaptador base familia LLM — recorre `planBatches`, por lote `encodeBatch` → `fetch` (POST chat-completions, `Authorization: Bearer <key>`, system="traduce de X a Y y devuelve SOLO un array JSON de la misma longitud y orden") → `decodeBatch` → acumula por índice → `onProgress`; guard `no-key` **antes** de cualquier `fetch`; mapeo de error 401/403→`auth`, 429→`rate-limit`, fallo fetch→`network`, respuesta inválida→`bad-shape` (D7/D8)
- [X] T017 [P] [US2] Crear `src/engines/api/groq.ts`: config concreta de Groq (endpoint + modelo + headers) sobre `llmAdapter` (compatible estilo OpenAI chat-completions)
- [X] T018 [US2] Editar `src/engines/api/index.ts`: conectar Groq real en `getTranslator` para `'groq'`; el resto de proveedores reales siguen como stub `provider-unavailable` (incremental, FR-011)
- [X] T019 [US2] Editar `src/screens/Player/TranslatePanel.tsx`: leer `provider` + `key` desde `settingsStore` y llamar `getTranslator(provider, key)` (en lugar del mock fijo); si falta clave de un proveedor con `needsKey`, mostrar aviso accionable con enlace a Settings sin invocar la API

**Checkpoint**: US1 + US2 funcionan de forma independiente; traducción real con Groq disponible.

---

## Phase 5: User Story 3 — Ver progreso y recuperarme de errores (Priority: P2)

**Goal**: Progreso por lote y mensajes de error accionables diferenciados, sin
colgar la app y sin perder lo ya traducido.

**Independent Test**: Simular respuestas de error (clave inválida, rate limit, red,
conteo distinto) y verificar mensajes accionables distintos por caso; con un
documento de N segmentos verificar el indicador de progreso por lotes.

### Implementation for User Story 3

- [X] T020 [US3] Editar `src/screens/Player/TranslatePanel.tsx`: indicador de **progreso** por lote (barra/contador "traduciendo N/total") alimentado por `onProgress({done,total})` (FR-007)
- [X] T021 [US3] Editar `src/screens/Player/TranslatePanel.tsx`: manejo de error por `TranslationError.kind` — `no-key`/`auth` → "Configura tu API key" (enlace a Settings); `rate-limit`/`network` → "Reintentar"; `bad-shape` → reintentar lote; `provider-unavailable` → elegir otro proveedor; conservar lo ya traducido y reintentar solo lo pendiente (FR-008), sin colgar (SC-003)

**Checkpoint**: Las tres historias funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T022 [P] Actualizar `docs/PROGRESS.md` (mover 003 a "Hecho" con resumen) y añadir línea en `docs/DECISIONS.md` (protocolo array JSON, proveedor MVP Groq, BYOK localStorage)
- [ ] T023 Cierre: pegar salida real de `pnpm test` + `pnpm build` verdes y correr la checklist de dispositivo de `quickstart.md` (US2 persistencia, US1 mock instantáneo, US1+US2 Groq real, US3 errores) a 360px

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; **bloquea** todas las historias.
- **US1 (Phase 3)**: depende de Foundational. Es el MVP, no depende de US2/US3.
- **US2 (Phase 4)**: depende de Foundational; **integra** con el `TranslatePanel` de
  US1 (T019 lo edita), así que en la práctica corre tras US1.
- **US3 (Phase 5)**: depende de Foundational; edita el `TranslatePanel` (US1) y se
  apoya en los errores del engine real (US2) → corre tras US1/US2.
- **Polish (Phase 6)**: tras las historias deseadas.

### User Story Dependencies

- **US1 (P1)**: independiente — testeable end-to-end con el mock.
- **US2 (P1)**: independiente en su core (Settings/registry/Groq); su integración con
  el panel reusa US1 pero Settings se prueba por sí sola (persistencia de clave).
- **US3 (P2)**: capa de progreso/errores sobre el panel; se prueba simulando errores.

### Within Each User Story

- US1: tests (T003, T004) escritos y en rojo **antes** de `batch.ts`/`assemble.ts`.
- Core puro (batch/assemble) antes que mock; mock + registry antes que el panel.
- US2: store antes que pantallas; adaptador base antes que Groq; Groq antes de
  conectarlo al registry.

### Parallel Opportunities

- **Setup**: T001 único.
- **US1**: T003 y T004 (tests) en paralelo; luego T005 y T006 (archivos distintos) en
  paralelo. T007→T008→T009→T010 secuenciales (registry y panel dependen de lo previo).
- **US2**: T013 (Settings UI), T016 (llmAdapter) y T017 (groq config) son [P] entre
  sí (archivos distintos). T011/T012 antes de las pantallas que los usan; T018 tras
  T016/T017; T019 tras T011 y T018.
- **US3**: T020 y T021 tocan el mismo archivo → secuenciales.

---

## Parallel Example: User Story 1

```bash
# Tests primero (en paralelo, deben fallar):
Task: "Tests de batching en tests/core/batch.test.ts"
Task: "Tests de ensamblado en tests/core/assemble.test.ts"

# Luego los dos módulos puros (archivos distintos, en paralelo):
Task: "Implementar src/core/translation/batch.ts"
Task: "Implementar src/core/translation/assemble.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 (Setup) → 2. Phase 2 (Foundational) → 3. Phase 3 (US1).
4. **PARAR Y VALIDAR**: traducir-a-dual con "Mock (demo)", tests de core verdes.
5. Demo del MVP sin gastar API.

### Incremental Delivery

1. Setup + Foundational → contrato listo.
2. + US1 → dual con mock (MVP, demostrable).
3. + US2 → Settings BYOK + Groq real → traducción real 1:1.
4. + US3 → progreso y errores accionables → uso confiable en documentos largos.
5. Cada historia añade valor sin romper las anteriores.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- Tiempos en ms enteros; la traducción **no** toca `startMs`/`endMs` ni el nº de
  segmentos (1:1 inmutable).
- `fetch` **solo** en `src/engines/api/`; `src/core` permanece puro y testeado.
- La clave BYOK vive **solo** en `localStorage`; nunca en repo, logs ni bundle (SC-004).
- Sin dependencias nuevas (fetch nativo, zustand ya está).
- Commit tras cada tarea o grupo lógico; parar en cualquier checkpoint para validar.
