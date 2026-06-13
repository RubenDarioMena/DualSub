---
description: "Task list for spec 001 — Player dual con datos mock"
---

# Tasks: Player dual con datos mock

**Input**: Design documents from `specs/001-player-dual-mock/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: NO se generan tareas de test. La constitución (Calidad y tests) reserva
TDD para `src/core`; esta spec **no añade lógica pura nueva** (reusa
`findActiveSegmentIndex`/`applyOffset` de spec 000). La UI se valida con la
**checklist de dispositivo** (framework §8, en `quickstart.md`). Evidencia de
cierre: `pnpm test` (24/24 de spec 000 siguen verdes) + `pnpm build` + checklist.

**Organization**: tareas agrupadas por user story para entrega incremental.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: a qué user story pertenece (US1–US4).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: estructura mínima y enganche de la pantalla.

- [ ] T001 Crear carpetas de la feature: `src/engines/mock/`, `src/state/`, `src/screens/Player/`
- [ ] T002 Enganchar `src/App.tsx` para renderizar `<PlayerScreen />` (shell temporal) y retirar el placeholder actual

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: el "motor" del player que TODAS las stories necesitan: datos mock,
store, video como reloj maestro y cálculo del segmento activo.

**⚠️ CRITICAL**: ninguna user story puede empezar hasta completar esta fase.

- [ ] T003 [P] Implementar `src/engines/mock/mockDocument.ts` (`getMockDualSubDocument`, `createMockProject`) cumpliendo `contracts/mock-engine.md` (EN→ES, ≥200 segmentos ordenados sin solape, ≥1 hueco, ≥1 segmento sin traducción, ≥1 con líneas largas; round-trip `parseDualSub` válido)
- [ ] T004 [P] Implementar `src/state/playerStore.ts` (Zustand) según `contracts/player-store.md`: estado `PlaybackState` + acciones `setMedia`/`setOffset`/`nudgeOffset`/`setPlaying`/`setActiveIndex`/`setViewMode`/`requestSeek`/`clearSeek`; `setMedia` revoca el object URL previo (C3); `requestSeek` clampa a `>= 0` (C2)
- [ ] T005 Implementar `src/screens/Player/MediaPicker.tsx`: `<input type="file" accept="video/*">` → `URL.createObjectURL` → `setMedia` (FR-001, D7)
- [ ] T006 Implementar `src/screens/Player/VideoStage.tsx`: dueño del `<video>` (reloj maestro); eventos `play`/`pause` → `setPlaying`; bucle `requestAnimationFrame` mientras reproduce que calcula `findActiveSegmentIndex(doc.segments, Math.round(currentTime*1000) − offsetMs)` y llama `setActiveIndex` **solo al cambiar** (D1, D3, R1, R2, FR-003, FR-011); consume `seekRequestMs` (aplica `video.currentTime = ms/1000`) y llama `clearSeek` (R3); `revokeObjectURL` al desmontar
- [ ] T007 Implementar `src/screens/Player/PlayerScreen.tsx` (shell): contenedor móvil-first (360px), detección de orientación con `matchMedia('(orientation: landscape)')` → `viewMode` por defecto con override manual (D5, R5, FR-009); monta `MediaPicker` + un único `VideoStage` (no se remonta entre modos) y deja slots para lista/overlay/offset

**Checkpoint**: se elige un video, reproduce, y `activeIndex` se calcula en vivo (aún sin UI visible de subtítulos).

---

## Phase 3: User Story 1 — Ver el diálogo activo resaltado (Priority: P1) 🎯 MVP

**Goal**: lista vertical que resalta el diálogo activo y hace autoscroll suave;
ningún resaltado en huecos.

**Independent Test**: cargar un video, reproducir y verificar que el diálogo
correcto se resalta en cada instante y que la lista autoscrollea; en un hueco
ningún diálogo queda resaltado (quickstart, ítems "Vertical — highlight/autoscroll").

- [ ] T008 [P] [US1] Implementar `src/screens/Player/TranscriptRow.tsx`: muestra origen y destino del segmento (solo origen si falta traducción, FR-007); estilo de resaltado cuando es el activo; `forwardRef` para autoscroll (`React.memo` para no re-renderizar filas inactivas, SC-005)
- [ ] T009 [US1] Implementar `src/screens/Player/TranscriptList.tsx`: renderiza `doc.segments` como `TranscriptRow`; se suscribe a `activeIndex` (no al tiempo, D3); `useEffect` que hace `scrollIntoView({ behavior:'smooth', block:'center' })` sobre la fila activa al cambiar `activeIndex` (D4, FR-004)
- [ ] T010 [US1] Montar `TranscriptList` en el layout vertical de `PlayerScreen` (video arriba, lista debajo)

**Checkpoint**: MVP demostrable en el teléfono — se ve DualSub vivo (highlight + autoscroll). US1 entregable de forma independiente.

---

## Phase 4: User Story 2 — Saltar a un diálogo tocándolo (Priority: P1)

**Goal**: tocar un diálogo hace seek del video a ese momento (ajustado por offset)
y lo resalta.

**Independent Test**: tocar un diálogo y verificar que el video salta a su inicio
(±100 ms) y queda resaltado (quickstart, ítem "Tap-to-seek"; SC-002).

- [ ] T011 [US2] Añadir handler de toque en `TranscriptRow`/`TranscriptList` que llama `requestSeek(Math.max(0, segment.startMs + offsetMs))` (R3, FR-005); el seek ya lo aplica `VideoStage` (T006), de modo que tras el salto el rAF recalcula y el diálogo tocado queda activo (US2 escenario 2: coherencia highlight↔seek)

**Checkpoint**: US1 + US2 funcionan; la lista pasa de pasiva a interactiva (repetir frases).

---

## Phase 5: User Story 3 — Overlay dual sobre el video (Priority: P2)

**Goal**: en horizontal, origen+destino del segmento activo superpuestos sobre el
video, legibles y respetando safe-areas; vacío en huecos.

**Independent Test**: en modo overlay, reproducir y ver ambos idiomas legibles del
segmento activo; en hueco el overlay desaparece; segmento sin traducción muestra
solo origen (quickstart, ítems "Overlay" y "Segmento sin traducción"; US3).

- [ ] T012 [P] [US3] Implementar `src/screens/Player/SubtitleOverlay.tsx`: lee `activeIndex`+`doc`; muestra origen y destino en dos líneas diferenciadas con halo/sombra para contraste; respeta `env(safe-area-inset-*)` y deja padding inferior para no chocar con los controles nativos (D6, FR-006); no renderiza nada si `activeIndex === -1`; solo origen si falta traducción (FR-007)
- [ ] T013 [US3] Layout overlay en `PlayerScreen`: en `viewMode === 'overlay'` posiciona `SubtitleOverlay` encima del mismo `VideoStage` (sin remontarlo, FR-009); botón para alternar modo manualmente (D5)

**Checkpoint**: mitad "ver" de la propuesta dual completa; US1–US3 independientes.

---

## Phase 6: User Story 4 — Corregir desfase con offset (Priority: P2)

**Goal**: control ±ms que reubica highlight/overlay en runtime sin mutar el documento.

**Independent Test**: aplicar ±500 ms y ver el resaltado recolocarse coherentemente
para un mismo instante; volver a 0 restaura el estado; el documento no cambia
(quickstart, ítem "Offset ±"; SC-003, FR-008).

- [ ] T014 [P] [US4] Implementar `src/screens/Player/OffsetControl.tsx`: muestra `offsetMs`; botones `−500/−100/+100/+500` (→ `nudgeOffset`) y reset a 0 (→ `setOffset(0)`); no toca `doc` (C1, R4)
- [ ] T015 [US4] Montar `OffsetControl` en `PlayerScreen` (visible en ambos modos); verificar que el cambio de offset reubica highlight (T006) y overlay (T012) sin lag perceptible

**Checkpoint**: las 4 user stories funcionan; experiencia completa de estudio.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: pulido transversal y evidencia de cierre.

- [ ] T016 Pasada de estilo móvil-first a 360px y legibilidad a distancia de brazo (FR-010, SC-004); texto preparado para JA futuro con `word-break`/`overflow-wrap` y `font-family` con fallback `Noto Sans JP` (D6), sin cargar fuentes nuevas
- [ ] T017 [P] Actualizar `docs/PROGRESS.md` (mover 001 a Hecho con resumen) y, si surgió alguna decisión (p. ej. virtualización), añadir 1 línea a `docs/DECISIONS.md`
- [ ] T018 Ejecutar la checklist de dispositivo de `quickstart.md` en un teléfono real y pegar evidencia: `pnpm test` + `pnpm build` en verde (principio III)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; **bloquea** todas las user stories.
- **User Stories (Phase 3–6)**: dependen de Foundational. US1 es el MVP. US2
  depende de la lista de US1 (añade el toque). US3 y US4 son independientes entre
  sí y de US2 (solo necesitan Foundational).
- **Polish (Phase 7)**: depende de las stories que se quieran entregar.

### User Story Dependencies

- **US1 (P1)**: tras Foundational. Base de la UI de lista.
- **US2 (P1)**: tras US1 (reusa `TranscriptRow`/`List`); seek ya está en Foundational (T006).
- **US3 (P2)**: tras Foundational. Independiente de US1/US2 (overlay aparte).
- **US4 (P2)**: tras Foundational. Afecta highlight (US1) y overlay (US3) si ya existen.

### Parallel Opportunities

- T003 y T004 en paralelo (mock y store, archivos distintos).
- T008 (`TranscriptRow`) en paralelo con avances de US3/US4 una vez hecho Foundational.
- T012 (`SubtitleOverlay`) y T014 (`OffsetControl`) en paralelo (componentes aislados).

```bash
# Tras Setup, arrancar el núcleo en paralelo:
Task: "T003 mockDocument.ts en src/engines/mock/"
Task: "T004 playerStore.ts en src/state/"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 (Setup) → 2. Phase 2 (Foundational) → 3. Phase 3 (US1).
4. **PARAR y VALIDAR**: highlight + autoscroll en el teléfono. Es la primera vez
   que se ve DualSub vivo. Demo lista.

### Incremental Delivery

Foundational → US1 (MVP: ver el diálogo activo) → US2 (repetir frases) →
US3 (overlay para mirar) → US4 (corregir desfase) → Polish (evidencia + docs).
Cada story añade valor sin romper las anteriores.

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes.
- El `<video>` vive en un único `VideoStage` que no se remonta entre modos (FR-009).
- El store guarda `activeIndex`, no el tiempo por frame (clave de rendimiento, D3/SC-005).
- Commit por tarea o grupo lógico, referenciando la spec (`feat(player): … — spec 001`).
