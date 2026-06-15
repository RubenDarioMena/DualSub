---

description: "Task list — Import sidecar .srt/.vtt + merge dual"
---

# Tasks: Import — video + sidecar .srt/.vtt + parsers + merge dual

**Input**: Design documents from `specs/002-import-sidecar-subs/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Incluidos para el **core** (parsers, normalización, merge) porque la
constitución exige TDD real en `src/core` (principio I + Calidad/tests) y la spec
los pide (SC-001/SC-003). La **UI NO** lleva tests automatizados en v0.1: se
valida con la checklist de dispositivo (framework §8, [quickstart.md](./quickstart.md) §3).

**Organization**: Tareas agrupadas por user story para implementarlas y validarlas
de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: A qué user story pertenece (US1, US2, US3)
- Rutas de archivo exactas en cada descripción

## Path Conventions

Single project (web app estática): `src/`, `tests/` en la raíz del repo, según
[plan.md](./plan.md) → "Source Code".

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Andamiaje compartido (tipos base y fixtures) antes de cualquier lógica.

- [X] T001 [P] Crear `src/core/formats/subtitleCommon.ts` con los tipos `SubtitleCue`, `SubtitleTrack` y la clase `SubtitleParseError` (sin lógica todavía), según [data-model.md](./data-model.md)
- [X] T002 [P] Crear `tests/fixtures/` con los archivos sucios compartidos: `clean.srt`, `dirty.srt` (BOM+CRLF+`<i>`+multilínea+coma), `unordered-overlap.srt` (desordenado, un par solapado, un `endMs<=startMs`), `basic.vtt` (`WEBVTT` + `MM:SS.mmm` sin hora), `notes.vtt` (`NOTE`/`STYLE`/identificador+`<c>`/posición), `empty.srt` (vacío/sin cues), según [quickstart.md](./quickstart.md) §2

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Primitivas puras compartidas por ambos parsers y por el build, más el
esqueleto de navegación Import↔Player. Sin esto ninguna user story puede avanzar.

**⚠️ CRITICAL**: Completar esta fase antes de empezar cualquier user story.

### Core compartido (TDD: test rojo → implementación → verde)

- [X] T003 Escribir tests que FALLAN para `parseTimecode`, `stripMarkup`, `normalizeCues` y `pickParser` en `tests/core/subtitleCommon.test.ts` (timecodes coma/punto y con/sin hora → ms enteros; strip de tags/ASS/entidades y multilínea con `\n`; normalize: orden, solape truncado D5, descarte `endMs<=startMs`, dedupe; pickParser por extensión), según [contracts/parsers.md](./contracts/parsers.md)
- [X] T004 Implementar `parseTimecode` en `src/core/formats/subtitleCommon.ts` (D3, `Math.round` a ms)
- [X] T005 Implementar `stripMarkup` en `src/core/formats/subtitleCommon.ts` (D4)
- [X] T006 Implementar `normalizeCues` en `src/core/formats/subtitleCommon.ts` (D5: descartar inválidos → ordenar → dedupe → truncar solapes)
- [X] T007 Implementar `pickParser` en `src/core/formats/subtitleCommon.ts` (extensión `.srt`/`.vtt` → parser, `null` si no)
- [X] T008 Ejecutar `pnpm test` y verificar que los tests de T003 pasan en verde

### Esqueleto UI (navegación, D10)

- [X] T009 [P] Ampliar `src/state/playerStore.ts`: añadir `screen: 'import' | 'player'` (inicial `'import'`) y la acción `loadProject({ doc, mediaUrl })` (fija doc/mediaUrl/screen, resetea offset/activeIndex/isPlaying, revoca el object URL previo), según [contracts/import-flow.md](./contracts/import-flow.md)
- [X] T010 [P] Crear esqueleto `src/screens/Import/ImportScreen.tsx` (layout móvil-first 360px, placeholder de los pasos selección→confirmación)
- [X] T011 Editar `src/App.tsx` para renderizar `<ImportScreen/>` o `<PlayerScreen/>` según `screen` del store (depende de T009, T010)

**Checkpoint**: Core de helpers verde y app arrancando en pantalla Import. Listo para user stories.

---

## Phase 3: User Story 1 - Ver mi video con su subtítulo (un idioma) (Priority: P1) 🎯 MVP

**Goal**: Importar un video + un `.srt`/`.vtt` real y abrir el Player con esos
diálogos sincronizados (origen presente, destino pendiente).

**Independent Test**: Con fixtures, `parseSrt`/`parseVtt` + `buildSingle` producen
un `DualSubDocument` válido (pasa `validateDocument`); en teléfono, elegir video +
un `.srt` abre el Player y el highlight sigue al video.

### Tests for User Story 1 (TDD — escribir primero, deben FALLAR)

- [X] T012 [P] [US1] Tests que FALLAN para `parseSrt` en `tests/core/srt.test.ts` contra fixtures: `clean.srt` (N cues en orden), `dirty.srt` (BOM/CRLF/`<i>`/multilínea/coma → texto plano con `\n` y ms correctos), `empty.srt` (lanza `SubtitleParseError`) — escenarios de aceptación US1 1/2/5
- [X] T013 [P] [US1] Tests que FALLAN para `parseVtt` en `tests/core/vtt.test.ts` contra fixtures: `basic.vtt` (`MM:SS.mmm` sin hora), `notes.vtt` (`NOTE`/`STYLE`/identificador ignorados, `<c>`/posición eliminados) — escenario US1 3
- [X] T014 [P] [US1] Tests que FALLAN para `buildSingle` en `tests/core/buildDocument.test.ts`: solo-origen; `targetLang` placeholder cuando se omite y explícito cuando se pasa (D7); `unordered-overlap.srt` → documento ordenado y sin solape que **pasa `validateDocument`** (escenario US1 4)

### Implementation for User Story 1

- [X] T015 [US1] Implementar `parseSrt(text)` en `src/core/formats/srt.ts` (BOM/CRLF, ignora índice de bloque, usa `parseTimecode`/`stripMarkup`, lanza `SubtitleParseError` si 0 cues), según [contracts/parsers.md](./contracts/parsers.md)
- [X] T016 [US1] Implementar `parseVtt(text)` en `src/core/formats/vtt.ts` (cabecera `WEBVTT`, ignora `NOTE`/`STYLE`/`REGION` e identificador de cue, tolera coma/punto)
- [X] T017 [US1] Implementar `buildSingle(track, sourceLang, targetLang?)` en `src/core/formats/buildDocument.ts` (normaliza, mapea a `texts[sourceLang]`, placeholder de destino D7, `meta.source` por formato)
- [X] T018 [US1] Ejecutar `pnpm test` y verificar verdes los tests T012/T013/T014
- [X] T019 [P] [US1] Crear `src/screens/Import/SidecarPicker.tsx`: inputs de video (`accept="video/*"` → object URL) y de un sidecar (`accept=".srt,.vtt"` → `File.text()`)
- [X] T020 [US1] Crear `src/screens/Import/TrackConfirm.tsx`: selector de idioma origen (`en/es/ja`) + selector **"Traducir a:"** con los otros dos idiomas + **"Ninguno por ahora"** (default), según [contracts/import-flow.md](./contracts/import-flow.md)
- [X] T021 [US1] Cablear el flujo de un sidecar en `src/screens/Import/ImportScreen.tsx`: elegir → `pickParser` → parsear → `buildSingle` → `loadProject({doc, mediaUrl})` (abre el Player) (depende de T015–T017, T019, T020)
- [X] T022 [US1] Manejo de errores en `src/screens/Import/ImportScreen.tsx`: `SubtitleParseError` o extensión no soportada → mensaje accionable, NO navegar al Player (FR-010, SC-004)

**Checkpoint**: US1 funcional — un video + un sidecar real abre el Player sincronizado.

---

## Phase 4: User Story 2 - Ver doble subtítulo desde dos archivos (Priority: P1)

**Goal**: Importar dos sidecars de idiomas distintos y ver ambos en dual (origen
como master de timing, destino alineado por solape).

**Independent Test**: `mergeDual` con dos pistas de timing distinto produce, por
cada segmento origen, el texto destino esperado por solape; en teléfono, importar
`.en.srt` + `.es.srt` muestra ambos idiomas alineados en lista y overlay.

### Tests for User Story 2 (TDD — escribir primero, deben FALLAR)

- [X] T023 [P] [US2] Crear fixtures de merge `tests/fixtures/movie.en.srt` (origen) y `tests/fixtures/movie.es.srt` (destino con timing ligeramente distinto)
- [X] T024 [US2] Tests que FALLAN para `mergeDual` en `tests/core/buildDocument.test.ts`: timing 1:1 (cada segmento con ambos textos); timing dispar (texto destino por solape); múltiples solapantes (concatenados con `\n`, D6); sin solape (solo-origen, sin error) — escenarios US2 1/2 + SC-003 (mismo archivo que T014 → secuencial)

### Implementation for User Story 2

- [X] T025 [US2] Implementar `mergeDual(source, sourceLang, target, targetLang)` en `src/core/formats/buildDocument.ts` (timing = origen, dos punteros O(n+m), concatena cues destino solapantes; sin solape → destino omitido)
- [X] T026 [US2] Ejecutar `pnpm test` y verificar verdes los tests T024
- [X] T027 [US2] Extender `src/screens/Import/SidecarPicker.tsx` para aceptar un **segundo** sidecar opcional
- [X] T028 [US2] Extender `src/screens/Import/TrackConfirm.tsx`: con 2 pistas, asignar rol origen/destino y **bloquear** `lang(origen) === lang(destino)` con aviso (FR-008, escenario US2 3)
- [X] T029 [US2] Cablear el flujo dual en `src/screens/Import/ImportScreen.tsx`: `mergeDual` → `loadProject` (depende de T025, T027, T028)

**Checkpoint**: US1 y US2 funcionan de forma independiente; el corazón "dual" sobre contenido real.

---

## Phase 5: User Story 3 - Confirmar el idioma de cada pista (Priority: P2)

**Goal**: Que la app proponga el idioma de cada archivo por su nombre y permita
corregirlo; si no puede inferirlo, pedir elegir antes de continuar.

**Independent Test**: `inferLang('video.en.srt') === 'en'`; `inferLang('subs.txt') === null`;
en la UI, un `*.en.srt` propone `en` (editable) y un archivo sin sufijo pide elegir idioma.

### Tests for User Story 3 (TDD — escribir primero, deben FALLAR)

- [X] T030 [US3] Tests que FALLAN para `inferLang` en `tests/core/subtitleCommon.test.ts`: `*.en.srt`/`*.es.vtt`/`*.ja.srt` → LangCode; sin sufijo reconocible → `null` (escenarios US3 1/2) (mismo archivo que T003 → secuencial)

### Implementation for User Story 3

- [X] T031 [US3] Implementar `inferLang(filename)` en `src/core/formats/subtitleCommon.ts` (regex `/\.(en|es|ja)\.(srt|vtt)$/i`)
- [X] T032 [US3] Ejecutar `pnpm test` y verificar verde T030
- [X] T033 [US3] Integrar `inferLang` en `src/screens/Import/ImportScreen.tsx` + `TrackConfirm.tsx`: pre-rellenar el idioma propuesto (editable) y, cuando `inferLang` devuelva `null`, exigir que el usuario elija idioma antes de habilitar "Abrir"

**Checkpoint**: Las tres user stories funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Evidencia, validación en dispositivo y cierre de documentación.

- [X] T034 [P] Ejecutar `pnpm test` y `pnpm build` completos y pegar la salida real en verde (principio III)
- [ ] T035 [P] Validación en teléfono con [quickstart.md](./quickstart.md) §3 (al menos US1+US2: highlight, hueco, dos idiomas alineados, error claro, layout 360px y horizontal)
- [X] T036 Actualizar `docs/PROGRESS.md` (marcar Spec 002 hecha con evidencia) y, si procede, una línea en `docs/DECISIONS.md` sobre la estrategia de merge (D5 truncado / D6 master+solape)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — puede empezar de inmediato.
- **Foundational (Phase 2)**: depende de Setup — **BLOQUEA** todas las user stories.
- **User Stories (Phase 3–5)**: dependen de Foundational. US1 y US2 son ambas P1
  (juntas forman el MVP "dual"); US3 (P2) las refina.
- **Polish (Phase 6)**: depende de las user stories deseadas completas.

### User Story Dependencies

- **US1 (P1)**: tras Foundational. Independiente (idioma origen se elige a mano).
- **US2 (P1)**: tras Foundational. El core (`mergeDual`) es independiente; su UI
  extiende la de US1, pero es validable por separado.
- **US3 (P2)**: tras Foundational. Mejora la confirmación de idioma de US1/US2
  (auto-propuesta + manejo de `null`); no las rompe.

### Within Each User Story

- Tests del core (rojo) ANTES de implementar; verificar verde tras implementar.
- Helpers/parsers (core) antes que el cableado de UI.
- `buildDocument.ts` y sus tests son un solo archivo c/u: `buildSingle` (US1) y
  `mergeDual` (US2) son secuenciales sobre el mismo archivo.

### Parallel Opportunities

- Setup: T001 y T002 en paralelo (archivos distintos).
- Foundational: T009 y T010 en paralelo; el bloque core (T004–T007) es secuencial
  (mismo archivo `subtitleCommon.ts`).
- US1: T012/T013/T014 en paralelo (archivos de test distintos); T019 (SidecarPicker)
  en paralelo con la implementación de parsers.
- Polish: T034 y T035 en paralelo.

---

## Parallel Example: User Story 1

```bash
# Tests del core de US1 juntos (archivos distintos):
Task: "parseSrt tests en tests/core/srt.test.ts"
Task: "parseVtt tests en tests/core/vtt.test.ts"
Task: "buildSingle tests en tests/core/buildDocument.test.ts"
```

---

## Implementation Strategy

### MVP First

- **MVP mínimo**: Setup + Foundational + **US1** → un sidecar visible en el Player.
- **MVP completo P1**: + **US2** → doble subtítulo desde dos archivos (el valor
  "dual" sobre contenido real). US1 y US2 son ambas P1.

### Incremental Delivery

1. Setup + Foundational → base lista (helpers verdes, app en Import).
2. + US1 → importar un sidecar y verlo sincronizado → validar en teléfono.
3. + US2 → merge dual de dos archivos → validar en teléfono.
4. + US3 → auto-propuesta de idioma y manejo de archivos sin sufijo.
5. Polish → evidencia `pnpm test`/`pnpm build` + checklist + docs.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- El parser recibe `string` (no `File`); la lectura (`File.text()`) y el object URL
  del video viven en la UI (constitución, principio I).
- Cualquier archivo real que rompa un parser se convierte primero en fixture+test
  (constitución, Calidad) antes de arreglarlo.
- Nada se declara "completo" sin la salida real de `pnpm test` y `pnpm build`
  (principio III).
