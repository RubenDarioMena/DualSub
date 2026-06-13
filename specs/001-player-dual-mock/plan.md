# Implementation Plan: Player dual con datos mock

**Branch**: `001-player-dual-mock` | **Date**: 2026-06-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-player-dual-mock/spec.md`

## Summary

Primera pantalla viva de DualSub: una `PlayerScreen` que reproduce un **video
local** (object URL) junto a un **DualSubDocument mock** (EN→ES) servido desde
`engines/mock`. El elemento `<video>` es el **reloj maestro**: un bucle
`requestAnimationFrame` lee `video.currentTime`, calcula el segmento activo con
`findActiveSegmentIndex(segments, t − offset)` (composición de funciones puras de
spec 000, sin lógica nueva en core) y solo escribe en el store cuando el índice
**cambia**, para no re-renderizar la lista en cada frame. Dos layouts sobre el
mismo estado: **lista vertical** (highlight + autoscroll + tap-to-seek) y
**overlay horizontal** (origen+destino sobre el video, safe-areas). Un control de
**offset ±ms** reubica el highlight en runtime sin mutar el documento. Sin APIs,
sin import real, sin persistencia, sin dependencias nuevas.

## Technical Context

**Language/Version**: TypeScript estricto (ES2022), React 19

**Primary Dependencies**: React 19 + Vite 6 + Tailwind v4 + Zustand 5 (todas ya
en el repo). **Ninguna dependencia nueva.**

**Storage**: N/A — sin persistencia en esta spec (object URL del video y offset
son estado de runtime; se pierden al recargar).

**Testing**: Vitest (solo para core, ya cubierto por spec 000). UI se verifica
con la **checklist de dispositivo** (framework §8). Esta spec **no añade lógica
pura nueva** a `src/core`, por lo que no requiere tests nuevos de core.

**Target Platform**: Navegador móvil (Chrome/Safari iOS y Android), móvil-first a
360px; horizontal/pantalla completa para overlay.

**Project Type**: Web app SPA estática (single project, sin backend).

**Performance Goals**: Highlight a ~60 fps sin jank con ≥200 segmentos
(SC-005); re-render de la lista **solo** cuando cambia el segmento activo.

**Constraints**: Object URL revocado al cambiar de video (evitar fugas); _seek_
_clampado_ a `≥ 0`; safe-areas vía `env(safe-area-inset-*)` (ya hay
`viewport-fit=cover` en `index.html`); estado de reproducción conservado al rotar
o alternar modo (no remontar el `<video>`).

**Scale/Scope**: 1 pantalla (Player), ~7 componentes, 1 store Zustand, 1 módulo
mock. Documento de prueba con ≥200 segmentos para validar fluidez.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento |
|---|---|
| **I. Core puro y testeable** | ✅ No se añade lógica a `src/core`. Se **reutilizan** `findActiveSegmentIndex`/`applyOffset` (spec 000). Cero React/DOM en core. Al no haber lógica pura nueva, no hay deuda de tests de core. |
| **II. UI contra interfaces/mock** | ✅ El documento dual viene de `src/engines/mock/`; cero `fetch`, cero `engines/api`. |
| **III. Evidencia antes de "listo"** | ✅ Cierre con `pnpm test` + `pnpm build` en verde pegados + checklist de dispositivo (§8). |
| **IV. Spec-driven, iteración pequeña** | ✅ Una pantalla demostrable en el teléfono en 1-3 sesiones; alcance acotado por la spec. |
| **V. Diffs mínimos, deps justificadas** | ✅ **Sin dependencias nuevas**. Archivos nuevos acotados; no se reescribe código ajeno. Si el QA exige virtualizar, `react-virtuoso` requeriría una línea en `docs/DECISIONS.md` (no se asume). |
| **VI. Móvil-first y BYOK** | ✅ Diseño a 360px primero. No hay API keys en esta spec (BYOK llega en 003). |

**Convenciones**: tiempos en ms enteros (conversión `s↔ms` con `Math.round` en el
límite UI/video); par de idiomas EN→ES; formato DualSub JSON v1 sin cambios.
**Resultado del gate: PASA** (sin violaciones; Complexity Tracking vacío).

## Project Structure

### Documentation (this feature)

```text
specs/001-player-dual-mock/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones técnicas (reloj rAF, offset, autoscroll…)
├── data-model.md        # Fase 1: PlaybackState + forma del mock
├── quickstart.md        # Fase 1: cómo correr y validar en el teléfono
├── contracts/
│   ├── player-store.md  # Contrato del store Zustand (estado + acciones)
│   └── mock-engine.md   # Contrato del proveedor de documento mock
├── checklists/
│   └── requirements.md  # (de /speckit-specify)
└── tasks.md             # Fase 2 (/speckit-tasks — NO lo crea este comando)
```

### Source Code (repository root)

```text
src/
├── core/                      # SIN CAMBIOS (reusa sync.ts y models.ts de spec 000)
│   ├── models.ts
│   └── sync.ts
├── engines/
│   └── mock/
│       └── mockDocument.ts    # NUEVO: DualSubDocument EN→ES (≥200 segs, 1 hueco, 1 sin traducción)
├── state/
│   └── playerStore.ts         # NUEVO: store Zustand (PlaybackState + acciones)
├── screens/
│   └── Player/
│       ├── PlayerScreen.tsx   # NUEVO: orquesta layout por orientación/modo, dueño del <video>
│       ├── VideoStage.tsx     # NUEVO: <video> + bucle rAF (reloj maestro)
│       ├── MediaPicker.tsx    # NUEVO: <input type=file accept=video/*> → object URL
│       ├── SubtitleOverlay.tsx# NUEVO: overlay dual del segmento activo (modo horizontal)
│       ├── TranscriptList.tsx # NUEVO: lista vertical + autoscroll
│       ├── TranscriptRow.tsx  # NUEVO: fila de diálogo (origen+destino, highlight, tap)
│       └── OffsetControl.tsx  # NUEVO: control ±ms
├── App.tsx                    # EDITAR: renderizar <PlayerScreen/> en vez del placeholder
├── main.tsx                   # SIN CAMBIOS
└── index.css                  # EDITAR (mínimo): utilidades safe-area si hacen falta

tests/                          # SIN CAMBIOS (no hay lógica pura nueva)
```

**Structure Decision**: Single project (web app estática), respetando el mapa de
la constitución: lógica pura en `src/core` (intacta), datos falsos en
`src/engines/mock`, estado en `src/state`, UI en `src/screens/Player`. El
`<video>` vive en un único componente persistente (`VideoStage`) que **no se
remonta** al cambiar de modo/orientación, garantizando FR-009.

## Complexity Tracking

> Sin violaciones de la constitución. Tabla intencionalmente vacía.
