---
description: "Task list — Persistencia local de proyectos + biblioteca"
---

# Tasks: Persistencia local de proyectos + biblioteca

**Input**: Design documents from `/specs/004-local-persistence/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Incluidos SOLO para la **lógica pura nueva de `src/core`** (`combine`),
obligatorio por la constitución (principio I) y el plan. Los adaptadores de IndexedDB
(`engines/storage`) y la UI/estado NO llevan test automatizado en v0.1: se validan en
dispositivo (§8, ver `quickstart.md`).

**Organization**: Tareas agrupadas por historia de usuario para implementar y probar cada
una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (otro archivo, sin dependencias pendientes).
- **[Story]**: Historia a la que pertenece (US1–US4).
- Cada tarea incluye su ruta de archivo exacta.

## Path Conventions

Single project (web SPA): `src/`, `tests/` en la raíz del repo (ver plan.md §Project Structure).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificar línea base y preparar carpetas nuevas. El repo ya está scaffolded
(000–003); **sin dependencias nuevas** (IndexedDB nativo).

- [X] T001 Verificar línea base verde (`pnpm test` + `pnpm build`) y crear las carpetas nuevas: `src/core/project/`, `src/engines/storage/`, `src/screens/Library/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: El **puerto de persistencia** que TODAS las historias consumen: la interfaz
(pura) y sus dos adaptadores (IndexedDB real + memoria fallback).

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase.

- [X] T002 Crear la interfaz `ProjectStore` + tipos en `src/core/services/projectStore.ts`: `MediaRef`, `StorageMode`, `StoredProject`, `StoredProjectMeta`, `SaveResult`, e interfaz `ProjectStore` (`available`/`list`/`get`/`getMedia`/`save`/`remove`/`usage`) — pura, SIN `fetch`/DOM/IndexedDB, según data-model.md
- [X] T003 Implementar `idbProjectStore` en `src/engines/storage/idbProjectStore.ts`: mini-wrapper de promesas sobre IndexedDB; `onupgradeneeded` v1 con dos object stores `projects` (keyPath `id`) y `media` (keyPath `id`); `save` atómico con **reglas de cuota** (capturar `QuotaExceededError` → degradar a `light` + `SaveResult.degradedToLight`); `getMedia` bajo demanda; `usage()` vía `navigator.storage.estimate()` — según contracts/project-store.md
- [X] T004 [P] Implementar `memoryProjectStore` en `src/engines/storage/memoryProjectStore.ts`: adaptador en memoria (`Map`) que cumple la interfaz; usado como fallback (`available()=false`) y en validación manual
- [X] T005 Crear el selector `getProjectStore()` en `src/engines/storage/index.ts`: intenta abrir IndexedDB; si lanza/no existe → `memoryProjectStore` (la app sigue usable, marca no-disponible) — FR-012

**Checkpoint**: Backbone de persistencia listo — las historias pueden comenzar.

---

## Phase 3: User Story 1 — No perder el trabajo al recargar (Priority: P1) 🎯 MVP

**Goal**: El proyecto activo se **auto-guarda** y al recargar/reabrir se **restaura** (doc,
offset, posición); en modo ligero solo pide re-elegir el video.

**Independent Test**: Importar (002) + traducir (003), recargar la pestaña → el proyecto más
reciente reaparece con subtítulos y offset intactos; reproducir hasta el min ~2, recargar →
retoma cerca del min 2; en modo ligero pide solo re-elegir el archivo (no idiomas).

### Implementation for User Story 1

- [X] T006 [US1] Editar `src/state/playerStore.ts`: añadir `projectId: string | null`, `positionMs: number`, `setPosition(ms)`; extender `Screen` con `'library'`; `loadProject` acepta/asigna `projectId` (genera `crypto.randomUUID()` si es nuevo) — diff mínimo
- [X] T007 [US1] Crear `src/state/libraryStore.ts`: estado (`projects: StoredProjectMeta[]`, `available`) + `refresh()` (usa `getProjectStore().list()`/`available()`); helper puro-de-estado que mapea el estado del Player a `StoredProject` (título de `doc.meta`/nombre de archivo; reusa `serializeDualSub` de la 000); **auto-guardado debounced** suscrito a `playerStore` (cambios de `doc`/`offsetMs`/`positionMs` → `save()`, `storageMode:'light'` en US1); `open(id)` restaura un `StoredProject` en `playerStore`
- [X] T008 [US1] Editar `src/screens/Player/VideoStage.tsx`: reportar `positionMs` con throttle (~2 s en play, y en `pause`/`seeked`) vía `setPosition`; al restaurar, aplicar `requestSeek(positionMs)` cuando el video tenga metadatos (`loadedmetadata`)
- [X] T009 [US1] Editar `src/App.tsx` + `src/screens/Player/PlayerScreen.tsx`: al arrancar, `libraryStore.refresh()`; si hay ≥1 proyecto, **auto-restaurar el más reciente** (US2 lo cambiará a aterrizar en Library); en modo ligero (sin blob) el Player muestra "Elige el video" reusando `MediaPicker`, conservando subtítulos/offset/posición y SIN volver a preguntar idiomas

**Checkpoint**: US1 funcional — el trabajo sobrevive a recargas (MVP demostrable en teléfono).

---

## Phase 4: User Story 2 — Biblioteca de varios proyectos (Priority: P2)

**Goal**: Lista de proyectos guardados: abrir, borrar, ver espacio usado; importar uno nuevo
no pisa los anteriores.

**Independent Test**: Guardar 2+ proyectos → aparecen en Library (título/idiomas/fecha/
tamaño); importar uno nuevo no borra los previos; borrar uno → desaparece y baja el espacio.

### Implementation for User Story 2

- [X] T010 [US2] Ampliar `src/state/libraryStore.ts`: `remove(id)` (`store.remove` + `refresh`), `usage()` (`store.usage` → `usedBytes`/`quotaBytes`), orden `updatedAt` desc; estado de espacio para la UI
- [X] T011 [US2] Crear `src/screens/Library/LibraryScreen.tsx` (móvil-first 360px): lista de `StoredProjectMeta` (título, par `EN → ES`, fecha relativa, tamaño aprox., icono si tiene video), abrir, borrar (con confirmación), indicador de **espacio usado**, botón "Nuevo proyecto" (→ Import), y banner si `available=false` (FR-012)
- [X] T012 [US2] Editar `src/App.tsx` + `src/screens/Player/PlayerScreen.tsx`: enrutar `screen:'library'`; al arrancar con ≥1 proyecto **aterrizar en Library** (en vez del auto-load de US1) y añadir control "← Biblioteca" en el Player

**Checkpoint**: US1 + US2 funcionan; varios proyectos gestionables de forma independiente.

---

## Phase 5: User Story 3 — Guardar también el video (opt-in en Settings) (Priority: P3)

**Goal**: Interruptor en Settings (apagado por defecto) para guardar el video en el navegador;
reabrir reproduce sin re-elegir; si no cabe, aviso + degradación a ligero.

**Independent Test**: Toggle apagado → guarda ligero; encendido + espacio → reabrir reproduce
sin pedir archivo; video que no cabe → aviso en llano + degradación a ligero sin perder subs.

### Implementation for User Story 3

- [X] T013 [US3] Editar `src/state/settingsStore.ts`: añadir `saveVideoInBrowser: boolean` (default `false`) + setter, persistido en `localStorage` junto al resto de Settings
- [X] T014 [US3] Editar `src/screens/Settings/SettingsScreen.tsx`: interruptor "Guardar el video en el navegador" + texto de ayuda en **llano** (efecto práctico: ocupa mucho, el navegador puede borrarlo; si no cabe, solo subtítulos) — constitución VII
- [X] T015 [US3] Conservar el **Blob** del video en el estado del Player: editar `src/screens/Player/MediaPicker.tsx` + `src/state/playerStore.ts` para retener el `File`/`Blob` seleccionado (hoy solo se guarda el object URL y se descarta), necesario para poder persistirlo
- [X] T016 [US3] Persistir el video cuando el toggle está activo: en `libraryStore`, el auto-guardado pasa el `Blob` a `save()` con `storageMode:'with-video'`; manejar `SaveResult.degradedToLight` con un aviso único en llano; ruta de restauración con-video: `getMedia(id)` → object URL → `requestSeek(positionMs)` (revocando el object URL previo, C3)

**Checkpoint**: US1–US3 funcionan; el video es opcional y degrada con elegancia.

---

## Phase 6: User Story 4 — Reusar idiomas por el inglés base (Priority: P3)

**Goal**: Derivar un par (p. ej. ES/JA) a partir de dos proyectos que comparten pivote y
rejilla (EN/ES + EN/JA), **sin traducir** y con tiempos intactos.

**Independent Test**: Con EN/ES y EN/JA del mismo video, "Combinar idiomas" → par ES/JA al
instante, cero llamadas de traducción, tiempos intactos; la lógica pura se prueba aislada en
`tests/core/`.

### Tests for User Story 4 ⚠️

> Escribir estos tests ANTES de la implementación y verificar que FALLAN primero.

- [X] T017 [P] [US4] Tests en `tests/core/combine.test.ts`: `sharesPivotGrid` (true misma rejilla; false si difiere `startMs`/`endMs`, nº de segmentos o `sourceLang`); `combineByPivot` (fusiona `texts` por índice en+es+ja, **no muta** inputs, timing intacto, resultado pasa `validateDocument`, segmento con texto ausente conserva solo claves disponibles); `selectPair` (fija `sourceLang`/`targetLang`, no muta); borde pivote/grid distinto sin corromper originales

### Implementation for User Story 4

- [X] T018 [US4] Implementar `src/core/project/combine.ts` (puro): `sharesPivotGrid`, `combineByPivot`, `selectPair` según data-model.md — hasta que T017 pase en verde
- [X] T019 [US4] Añadir `derivePair(idA, idB, source, target)` a `src/state/libraryStore.ts`: `selectPair(combineByPivot(get(idA).doc, get(idB).doc), source, target)` → guardar como nuevo `StoredProject` (sin traducir; SC-005)
- [X] T020 [US4] Editar `src/screens/Library/LibraryScreen.tsx`: ofrecer "Combinar idiomas" cuando dos proyectos comparten pivote/rejilla (`sharesPivotGrid`) → `derivePair`; informar sin tocar originales si no comparten esqueleto (depende de US2)

**Checkpoint**: Las cuatro historias funcionan de forma independiente.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cierre, documentación y evidencia.

- [X] T021 [P] Añadir línea a `docs/DECISIONS.md`: persistencia local = IndexedDB tras puerto `ProjectStore` (interfaz en core, adaptadores en `engines/storage`, fallback memoria); **modo ligero por defecto** + video opt-in; **sin dependencias nuevas** (IndexedDB nativo, sin `idb`)
- [X] T022 [P] Verificar revocación de object URLs al cambiar de proyecto/restaurar (C3 ya existe en `setMedia`/`loadProject`; comprobar que la ruta con-video no fuga)
- [ ] T023 Ejecutar la checklist de dispositivo de `quickstart.md` §2 (US1–US4 + bordes: cierre a mitad de guardado, modo privado) en un teléfono real
- [X] T024 Actualizar `docs/PROGRESS.md` (cerrar 004) y pegar evidencia real de `pnpm test` (N/N) + `pnpm build` (OK) — constitución III

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; **BLOQUEA** todas las historias.
- **US1 (Phase 3)**: depende de Foundational. MVP.
- **US2 (Phase 4)**: depende de Foundational; reusa el `libraryStore` de US1.
- **US3 (Phase 5)**: depende de Foundational; ortogonal a US2.
- **US4 (Phase 6)**: el **core** (`combine.ts`+tests) es independiente; la **UI** de derivar
  (T020) depende de US2 (LibraryScreen).
- **Polish (Phase 7)**: depende de las historias deseadas completas.

### Within Each User Story

- US4: el test (T017) se escribe y **falla** antes de implementar (T018).
- Estado antes que UI; el puerto (Phase 2) antes que cualquier consumidor.

### Parallel Opportunities

- T004 [P] (memory adapter) en paralelo a T003 (idb adapter), tras T002.
- T017 [P] (tests de combine) puede escribirse en paralelo, no depende del store.
- T021 [P] / T022 [P] (docs/verificación) en paralelo en el cierre.
- US3 y US4-core pueden avanzar en paralelo a US2 si hay capacidad.

---

## Parallel Example: Foundational

```bash
# Tras T002 (interfaz), los dos adaptadores en paralelo:
Task: "Implementar idbProjectStore en src/engines/storage/idbProjectStore.ts"
Task: "Implementar memoryProjectStore en src/engines/storage/memoryProjectStore.ts"
```

---

## Implementation Strategy

### MVP First (solo US1)

1. Phase 1 (Setup) → 2. Phase 2 (Foundational: puerto + adaptadores) → 3. Phase 3 (US1).
4. **PARAR y VALIDAR**: el trabajo sobrevive a recargas en un teléfono real.
5. Desplegar/demostrar (ya usable por testers Android).

### Incremental Delivery

1. Setup + Foundational → backbone listo.
2. US1 → recarga no pierde el trabajo → demo (MVP).
3. US2 → biblioteca de varios → demo.
4. US3 → video opt-in → demo.
5. US4 → derivar pares por el inglés → demo.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- Solo `combine` (core puro) lleva test automatizado (constitución I); IO/UI van por checklist
  de dispositivo (§8).
- Diffs mínimos: `playerStore`/`VideoStage`/`Settings`/`App`/`MediaPicker` se **editan**, no se
  reescriben. Reusa formato (000), Player (001), merge (002) y `loadProject` (002/003).
- Commit por tarea o grupo lógico; parar en cualquier checkpoint para validar la historia.
