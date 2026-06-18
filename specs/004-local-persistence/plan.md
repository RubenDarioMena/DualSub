# Implementation Plan: Persistencia local de proyectos + biblioteca

**Branch**: `004-local-persistence` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-local-persistence/spec.md`

## Summary

Que el trabajo sobreviva a recargas y cierres: hoy el video es un object URL efímero
(`MediaPicker`) y el `doc` vive en RAM (`playerStore`), así que cada recarga vuelve al
mock. Persistimos los proyectos en el **almacenamiento local del navegador** (IndexedDB)
**detrás de una interfaz/puerto `ProjectStore`** (mismo patrón que los `engines`), para
poder migrar a almacenamiento nativo (Capacitor/RN) sin tocar UI ni core.

**Por defecto modo ligero**: se guardan `doc` (subtítulos), `offsetMs`, `positionMs` y
metadatos; **NO el video**. Un **interruptor en Settings** permite optar a guardar también
el video; si no cabe, se avisa y se degrada a ligero sin perder el resto. **Biblioteca**
de varios proyectos (listar/abrir/borrar/espacio).

La lógica **pura** nueva vive en `src/core/project/`: **`combineByPivot`** (deriva un par
que comparte el inglés base, p. ej. ES/JA desde EN/ES + EN/JA, por *zip* índice a índice
cuando comparten rejilla de tiempos) y **`selectPair`** (proyecta el par a mostrar). La
**IO** (IndexedDB, blobs, cuota) vive **solo** en `src/engines/storage/` (constitución I).
Engancha en `loadProject` (guardar) y añade un `libraryStore` (listar/abrir/borrar).

Sin dependencias nuevas (IndexedDB nativo con un wrapper de promesas propio; reusa
`serializeDualSub`/`parseDualSub` de la 000 y `mergeDual` de la 002 para el caso
secundario). ASR (005), export y cambio de par "en caliente" quedan fuera.

## Technical Context

**Language/Version**: TypeScript estricto (ES2022), React 19.

**Primary Dependencies**: React 19 + Vite 6 + Tailwind v4 + Zustand 5 (ya en el repo).
**Ninguna dependencia nueva**: IndexedDB nativo envuelto en un mini-helper de promesas
propio (sin `idb`); `navigator.storage` para cuota/persistencia.

**Storage**: IndexedDB (datos estructurados + blobs de video) detrás del puerto
`ProjectStore`. `localStorage` solo para la preferencia "guardar video" (junto al resto de
Settings BYOK). El `doc` se (de)serializa con la 000.

**Testing**: Vitest. La lógica pura nueva (`combineByPivot`, `selectPair`,
`sharesPivotGrid`) ⇒ tests obligatorios en `tests/core/` (principio I). Los adaptadores de
IndexedDB (`engines/storage`) NO se testean automatizado en v0.1; se validan con la
checklist de dispositivo (§8).

**Target Platform**: Navegador móvil (Safari iOS / Chrome Android), móvil-first a 360px.

**Project Type**: Web app SPA estática (single project, sin backend).

**Performance Goals**: Guardado automático **no bloqueante** (async, con *debounce* para
posición/offset); la biblioteca lista metadatos sin cargar blobs de video; restaurar un
proyecto abre el Player en < 1 s (sin el video en modo ligero).

**Constraints**: core sin `fetch`/DOM/IndexedDB; todo en el dispositivo (sin red); un
guardado a medias no corrompe proyectos previos; degradación elegante ante cuota
(FR-008) y ante almacenamiento no disponible (FR-012).

**Scale/Scope**: 1 interfaz puerto + 2 adaptadores (IndexedDB + memoria-fallback) + ~2
módulos puros de core con tests; 1 `libraryStore`; ediciones mínimas a
`playerStore`/`settingsStore`/`App`/`PlayerScreen`/`SettingsScreen`; 1 pantalla Library.
Reusa 000/001/002/003.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento |
|---|---|
| **I. Core puro y testeable** | ✅ `combineByPivot`/`selectPair`/`sharesPivotGrid` **puros** en `src/core/project/` con tests. IndexedDB/blobs **solo** en `src/engines/storage/`. |
| **II. UI contra interfaces/mock** | ✅ UI y `libraryStore` consumen la **interfaz `ProjectStore`**; dos adaptadores intercambiables: `idbProjectStore` (real) y `memoryProjectStore` (fallback FR-012 / dev). Futuro adaptador nativo (Capacitor) sin tocar UI. |
| **III. Evidencia antes de "listo"** | ✅ Cierre con `pnpm test` + `pnpm build` pegados + checklist de dispositivo (recarga, biblioteca, cuota, modo ligero/con-video). |
| **IV. Spec-driven, iteración pequeña** | ✅ **US1 (P1) es MVP demostrable** por sí solo (persistir + restaurar 1 proyecto); biblioteca/video/derivación son capas encima. |
| **V. Diffs mínimos, deps justificadas** | ✅ **Sin dependencias nuevas** (IndexedDB nativo). Ediciones aditivas; reusa serialización (000) y `mergeDual` (002). |
| **VI. Móvil-first y BYOK** | ✅ Library/Settings a 360px. Todo local en el dispositivo (refuerza "sin backend"); preferencia en `localStorage`. |
| **VII. Decisiones en lenguaje llano** | ✅ Los avisos de cuota/evicción se redactan en efecto práctico (qué pasa, qué cuesta). 📎 Riesgo iOS (evicción ~7 días) en research. |

**Convenciones**: tiempos en ms enteros; idiomas `en/es/ja`; DualSub JSON v1 sin cambios
(la unificación multi-idioma usa `texts` que ya es `Partial<Record<LangCode,string>>`).
**Resultado del gate: PASA** (sin violaciones; Complexity Tracking vacío).

## Project Structure

### Documentation (this feature)

```text
specs/004-local-persistence/
├── plan.md              # Este archivo (/speckit-plan)
├── research.md          # Fase 0: IndexedDB (2 stores), cuota/evicción, puerto+fallback, combine
├── data-model.md        # Fase 1: StoredProject + ProjectStore + combineByPivot/selectPair
├── quickstart.md        # Fase 1: cómo testear (core) y validar persistencia en el teléfono
├── contracts/
│   ├── project-store.md # Contrato del puerto ProjectStore (list/get/save/remove/usage/available)
│   └── library-ui.md    # Contrato de Library + toggle de video + flujos guardar/restaurar
├── checklists/
│   └── requirements.md  # (de /speckit-specify)
└── tasks.md             # Fase 2 (/speckit-tasks — NO lo crea este comando)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── models.ts                     # SIN CAMBIOS (DualSubDocument/SegmentTexts ya soporta multi-idioma)
│   ├── formats/                      # SIN CAMBIOS (000/002; mergeDual se reusa)
│   ├── services/
│   │   ├── translator.ts             # SIN CAMBIOS
│   │   └── projectStore.ts           # NUEVO (puro): interfaz ProjectStore + tipos (StoredProject/Meta/SaveResult)
│   └── project/
│       └── combine.ts                # NUEVO (puro): combineByPivot + selectPair + sharesPivotGrid
├── engines/
│   ├── mock/                         # SIN CAMBIOS
│   └── storage/
│       ├── idbProjectStore.ts        # NUEVO: adaptador IndexedDB (2 object stores: projects, media) + mini-helper de promesas
│       ├── memoryProjectStore.ts     # NUEVO: adaptador en memoria (fallback FR-012 / tests / dev)
│       └── index.ts                  # NUEVO: getProjectStore() → idb si disponible, si no memory (+ flag available)
├── state/
│   ├── playerStore.ts                # EDITAR (mínimo): projectId + positionMs + setPosition; loadProject auto-guarda; screen 'library'
│   ├── libraryStore.ts               # NUEVO: list/open/remove/usage/available sobre el puerto; orquesta auto-guardado (debounced)
│   └── settingsStore.ts              # EDITAR: saveVideoInBrowser (bool, default false) + setter (localStorage)
├── screens/
│   ├── Library/
│   │   └── LibraryScreen.tsx         # NUEVO: lista (título/idiomas/fecha/tamaño) + abrir + borrar + espacio usado
│   ├── Player/
│   │   ├── PlayerScreen.tsx          # EDITAR: acceso a Library; en modo ligero al reabrir pide re-elegir video (reusa MediaPicker)
│   │   └── VideoStage.tsx            # EDITAR (mínimo): reporta positionMs (throttle) y aplica seek a positionMs al restaurar
│   └── Settings/
│       └── SettingsScreen.tsx        # EDITAR: interruptor "guardar el video en el navegador"
└── App.tsx                           # EDITAR: enrutar 'library'; al arrancar, si hay proyectos → Library en vez de mock

tests/
└── core/
    └── combine.test.ts               # NUEVO: combineByPivot (zip mismo grid), selectPair, sharesPivotGrid, casos borde
```

**Structure Decision**: Single project. Lo **puro** (derivación/proyección de pares) en
`src/core/project/` con tests; la **IO** (IndexedDB, blobs, cuota) **solo** en
`src/engines/storage/` detrás del puerto `ProjectStore` (interfaz en `core/services`,
sin DOM). El estado de biblioteca y el auto-guardado viven en `src/state`; la UI nueva es
`LibraryScreen` + un interruptor en `Settings`. Se reusan formato (000), Player (001),
merge (002) y el `loadProject` existente sin reescribirlos.

## Complexity Tracking

> Sin violaciones de la constitución. Tabla intencionalmente vacía.
