# Implementation Plan: Traducción vía API (BYOK) — rellenar el idioma destino

**Branch**: `003-translate-api-byok` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-translate-api-byok/spec.md`

## Summary

Primer uso real de una API externa en DualSub: traducir un `DualSubDocument` que
solo tiene origen (la salida del Import 002) para rellenar el idioma destino y
obtener un documento **dual** que el Player ya muestra (001), **sin mutar** el
origen y con mapeo **1:1** (mismo timing, mismo número de segmentos).

La lógica vive detrás de una interfaz **`Translator`** (pura, en
`src/core/services`): el **batching**, la **codificación/validación 1:1** y el
**ensamblado del documento** son funciones **puras** en `src/core` (testeadas con
Vitest); la **red vive solo en `src/engines/api`** (constitución I). Dos
implementaciones del engine: **`mock`** (traducciones falsas instantáneas, también
seleccionable como proveedor "demo" sin clave) y **`api`** con un **adaptador base
de familia LLM** y el **adaptador Groq** concreto como primer proveedor real; el
resto del catálogo (Anthropic, OpenAI, Google, Gemini, DeepSeek, DeepL) quedan como
**stubs** detrás de la misma interfaz, a rellenar incrementalmente.

**BYOK**: una pantalla **Settings** con **selector de proveedor** + **clave por
proveedor** guardada **solo en `localStorage`** (nunca en repo/build). Una acción
**Traducir** en el Player lanza la traducción con **progreso por lotes** y
**errores accionables**; al terminar, reemplaza el documento por el dual.

Sin dependencias nuevas (fetch nativo, sin SDKs; `zustand` ya está). ASR/Whisper,
export y persistencia del documento quedan fuera.

## Technical Context

**Language/Version**: TypeScript estricto (ES2022), React 19

**Primary Dependencies**: React 19 + Vite 6 + Tailwind v4 + Zustand 5 (ya en el
repo). **Ninguna dependencia nueva**: el adaptador HTTP usa **`fetch` nativo** (sin
SDKs de proveedor); persistencia de Settings con `localStorage` directo.

**Storage**: `localStorage` para BYOK (proveedor seleccionado + clave **por
proveedor**). El documento traducido NO se persiste (runtime). (FR-004, FR-010.)

**Testing**: Vitest. Esta spec añade **lógica pura nueva** a `src/core`
(batching, codificación/validación 1:1, ensamblado del documento) ⇒ tests
obligatorios en `tests/core/` (principio I), usando el engine `mock`. Los
adaptadores de red (`engines/api`) NO se testean automatizado en v0.1; el
**parseo/validación** que usan es puro y sí se testea. UI con checklist de
dispositivo (§8).

**Target Platform**: Navegador móvil (Chrome/Safari iOS y Android), móvil-first a
360px. Llamadas HTTPS directas del navegador al proveedor (BYOK).

**Project Type**: Web app SPA estática (single project, sin backend).

**Performance Goals**: Cientos de segmentos traducidos en pocas llamadas por
**lotes** (tope por nº de items y por caracteres); progreso visible por lote;
sin bloquear el hilo (async).

**Constraints**: core sin `fetch`/DOM; **1:1 inmutable** (mismo nº de segmentos y
timing; documento nuevo); clave **solo** en `localStorage`; ningún flujo de error
cuelga la app; preferir `fetch` nativo (sin SDK ⇒ sin deps).

**Scale/Scope**: 1 interfaz + ~3 módulos puros de core + tests; engine `mock` +
adaptador base LLM + 1 proveedor real (Groq) + stubs del catálogo; 1 pantalla
Settings + acción Traducir (progreso/errores) en el Player. Reusa 000/001/002.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento |
|---|---|
| **I. Core puro y testeable** | ✅ Interfaz `Translator` + batching/validación 1:1 + ensamblado son **puros** en `src/core` con tests. `fetch` **solo** en `src/engines/api`. |
| **II. UI contra interfaces/mock** | ✅ La UI consume la interfaz `Translator`; se desarrolla contra `engines/mock` (proveedor "demo" sin clave). `engines/api` (Groq) es el camino real que pide esta spec. |
| **III. Evidencia antes de "listo"** | ✅ Cierre con `pnpm test` + `pnpm build` verdes pegados + checklist de dispositivo para Settings/Traducir. |
| **IV. Spec-driven, iteración pequeña** | ✅ MVP acotado: mock + **un** proveedor real (Groq); el resto del catálogo son stubs incrementales. |
| **V. Diffs mínimos, deps justificadas** | ✅ **Sin dependencias nuevas** (fetch nativo, sin SDKs; localStorage directo). Diffs acotados; reusa Player/formato/Import. |
| **VI. Móvil-first y BYOK** | ✅ Settings a 360px. Clave **solo** en `localStorage`, nunca en repo ni en variables de build. |

**Convenciones**: tiempos en ms enteros (no se tocan en traducción); idiomas
`en/es/ja`; formato DualSub JSON v1 sin cambios (solo se rellena `texts[targetLang]`).
**Resultado del gate: PASA** (sin violaciones; Complexity Tracking vacío).

## Project Structure

### Documentation (this feature)

```text
specs/003-translate-api-byok/
├── plan.md              # Este archivo
├── research.md          # Fase 0: protocolo de lote (JSON array), familias, Settings, selección de engine
├── data-model.md        # Fase 1: Translator + TranslationRequest/Result + ProviderSettings + pipeline
├── quickstart.md        # Fase 1: cómo testear (mock) y validar Groq real en el teléfono
├── contracts/
│   ├── translator.md    # Contrato de la interfaz Translator + helpers puros (batch/validate/assemble)
│   └── settings-ui.md   # Contrato de Settings (BYOK) + acción Traducir (progreso/errores) + store
├── checklists/
│   └── requirements.md  # (de /speckit-specify)
└── tasks.md             # Fase 2 (/speckit-tasks — NO lo crea este comando)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── models.ts                     # SIN CAMBIOS (DualSubDocument/SubtitleSegment/LangCode)
│   ├── formats/                      # SIN CAMBIOS (000/002)
│   ├── services/
│   │   └── translator.ts             # NUEVO: interfaz Translator + tipos (Request/Result/Progress/Error) + catálogo de proveedores
│   └── translation/
│       ├── batch.ts                  # NUEVO (puro): planBatches + encode/decode JSON 1:1 + validación de conteo
│       └── assemble.ts               # NUEVO (puro): construye el DualSubDocument traducido (inmutable, 1:1)
├── engines/
│   ├── mock/
│   │   ├── mockDocument.ts           # SIN CAMBIOS
│   │   └── mockTranslator.ts         # NUEVO: Translator falso instantáneo (proveedor "demo", sin clave)
│   └── api/
│       ├── llmAdapter.ts             # NUEVO: adaptador base familia LLM (prompt vía batch puro + fetch + parseo puro)
│       ├── groq.ts                   # NUEVO: config concreta de Groq (endpoint/auth/modelo) sobre llmAdapter
│       └── index.ts                  # NUEVO: registry ProviderId→Translator (Groq real; resto stubs que lanzan "no implementado")
├── state/
│   ├── playerStore.ts                # EDITAR (mínimo): screen 'settings' + setScreen (la traducción reemplaza doc vía loadProject)
│   └── settingsStore.ts              # NUEVO: proveedor seleccionado + claves por proveedor (localStorage)
├── screens/
│   ├── Player/
│   │   ├── PlayerScreen.tsx          # EDITAR: botón Settings (engranaje) + botón Traducir cuando falta destino
│   │   └── TranslatePanel.tsx        # NUEVO: dispara la traducción, muestra progreso por lote y errores accionables
│   ├── Import/                       # SIN CAMBIOS funcionales
│   └── Settings/
│       └── SettingsScreen.tsx        # NUEVO: selector de proveedor + input de clave (BYOK) + guardar/borrar
└── App.tsx                           # EDITAR: enrutar 'settings' además de import/player

tests/
└── core/
    ├── batch.test.ts                 # NUEVO: planBatches + encode/decode + validación 1:1 (incl. multilínea y conteo erróneo)
    └── assemble.test.ts              # NUEVO: ensamblado inmutable 1:1 (timing intacto, origen no mutado, segmento vacío)
```

**Structure Decision**: Single project. La lógica pura (interfaz + batching +
validación 1:1 + ensamblado) vive en `src/core` (testeada); la **red** vive
exclusivamente en `src/engines/api` (constitución I). El selector de proveedor +
clave BYOK son estado en `src/state/settingsStore.ts` (localStorage); la UI nueva
es `Settings` + un panel de traducción en el Player. Se reusa el formato (000), el
Player (001) y la salida del Import (002) sin cambiarlos.

## Complexity Tracking

> Sin violaciones de la constitución. Tabla intencionalmente vacía.
