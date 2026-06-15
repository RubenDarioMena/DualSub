# Implementation Plan: Import — video + sidecar .srt/.vtt + parsers + merge dual

**Branch**: `002-import-sidecar-subs` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-import-sidecar-subs/spec.md`

## Summary

Primer contenido **real** en DualSub: el usuario elige un video local y 1-2
archivos **sidecar** `.srt`/`.vtt`; la app los **parsea** a segmentos del formato
DualSub JSON v1 (spec 000) y abre el Player (spec 001) con ese documento en lugar
del mock.

El valor está en el **core puro**: `parseSrt(text)` y `parseVtt(text)` reciben
**string** (no `File`), descartan markup, toleran archivos "sucios" (BOM, CRLF,
`<i>`, multilínea, coma/punto, `NOTE`/`STYLE`) y devuelven **cues** crudos.
Una capa de **normalización** (ordenar por `startMs`, descartar `endMs<=startMs`,
truncar solapes, dedupe) garantiza las invariantes de spec 000. Con **un**
sidecar se construye un documento solo-origen; con **dos** de idiomas distintos
se hace **merge dual** usando la pista origen como **master de timing** y
adjuntando el texto destino por **mayor solape temporal**. Todo esto se blinda
con tests Vitest contra **fixtures feos** en `tests/fixtures/`.

La **UI de Import es deliberadamente mínima** (DECISIONS 2026-06-13): elegir
archivos, inferir el idioma por el nombre (confirmable), designar origen/destino,
y abrir el Player. El video se maneja como **object URL** local (sin red). Sin
dependencias nuevas; `src/core` existente (`models`, `sync`, `formats/dualsub`)
se reutiliza sin cambios.

## Technical Context

**Language/Version**: TypeScript estricto (ES2022), React 19

**Primary Dependencies**: React 19 + Vite 6 + Tailwind v4 + Zustand 5 (ya en el
repo). **Ninguna dependencia nueva** (parsers escritos a mano, sin librería de
subtítulos — alinea con principio V y el énfasis "core fuerte").

**Storage**: N/A — sin persistencia. El object URL del video y el documento
importado son estado de runtime; al recargar se vuelve a importar (Assumptions).

**Testing**: Vitest. Esta spec **sí añade lógica pura nueva** a `src/core`
(parsers, normalización, merge) ⇒ tests obligatorios en `tests/core/` contra
**fixtures** en `tests/fixtures/`, escritos antes o junto al código (principio I).
La UI de Import se verifica con la checklist de dispositivo (framework §8).

**Target Platform**: Navegador móvil (Chrome/Safari iOS y Android), móvil-first a
360px. La lectura de archivos usa `File.text()` (UI); el parsing no toca el DOM.

**Project Type**: Web app SPA estática (single project, sin backend).

**Performance Goals**: Parsing instantáneo a escala real (archivos de hasta unos
miles de cues parsean en <100 ms, una sola pasada O(n)); merge O(n+m) con dos
punteros sobre pistas ya ordenadas.

**Constraints**: Parsers 100% puros (sin React/DOM/fetch); tiempos en **ms
enteros**; idiomas restringidos a `en/es/ja`; ningún archivo de entrada
—incluidos los inválidos— puede crashear la app (o importa, o muestra error
claro); el video nunca se sube (object URL local).

**Scale/Scope**: ~4 módulos nuevos de core + sus tests + fixtures; 1 pantalla
Import (~2-3 componentes) + ampliación mínima del store. Reutiliza la pantalla
Player de spec 001 sin cambios funcionales.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento |
|---|---|
| **I. Core puro y testeable** | ✅ Parsers/normalización/merge viven en `src/core/formats/`, sin React/DOM/fetch (reciben `string`, no `File`). Tests Vitest contra fixtures **antes o junto** al código. Reutiliza `models`/`formats/dualsub` (validación de invariantes) sin cambios. |
| **II. UI contra interfaces/mock** | ✅ No se toca `engines/api` ni `fetch`. El Import sustituye el mock como **fuente del documento**, pero la pantalla Player sigue consumiendo un `DualSubDocument` igual que con el mock. |
| **III. Evidencia antes de "listo"** | ✅ Cierre con `pnpm test` + `pnpm build` en verde pegados + checklist de dispositivo (§8) para la UI de Import y la apertura del Player. |
| **IV. Spec-driven, iteración pequeña** | ✅ Alcance acotado por la spec; demostrable en teléfono en 1-3 sesiones (importar un .srt real y verlo sincronizado). |
| **V. Diffs mínimos, deps justificadas** | ✅ **Sin dependencias nuevas**. Archivos nuevos acotados; al store y a `App.tsx` se les hacen ediciones mínimas (un screen toggle + un `loadProject`). |
| **VI. Móvil-first y BYOK** | ✅ Import diseñado a 360px primero. Sin API keys en esta spec (BYOK llega en 003). |

**Convenciones**: tiempos en ms enteros (`Math.round` al convertir timecodes);
idiomas ISO 639-1; SRT/VTT son **solo import**, el formato interno sigue siendo
DualSub JSON v1. **Resultado del gate: PASA** (sin violaciones; Complexity
Tracking vacío).

## Project Structure

### Documentation (this feature)

```text
specs/002-import-sidecar-subs/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones técnicas (grano de cue, normalización, merge, target placeholder…)
├── data-model.md        # Fase 1: SubtitleCue/SubtitleTrack + pipeline a DualSubDocument
├── quickstart.md        # Fase 1: cómo correr tests y validar import en el teléfono
├── contracts/
│   ├── parsers.md       # Contrato de parseSrt/parseVtt/normalizeCues/buildSingle/mergeDual
│   └── import-flow.md   # Contrato de la UI de Import + ampliación del store
├── checklists/
│   └── requirements.md  # (de /speckit-specify)
└── tasks.md             # Fase 2 (/speckit-tasks — NO lo crea este comando)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── models.ts                  # SIN CAMBIOS (reusa LangCode/SubtitleSegment/DualSubDocument)
│   ├── sync.ts                    # SIN CAMBIOS
│   └── formats/
│       ├── dualsub.ts             # SIN CAMBIOS (validateDocument como red de seguridad)
│       ├── subtitleCommon.ts      # NUEVO: SubtitleCue/SubtitleTrack, parseTimecode, stripMarkup, normalizeCues, SubtitleParseError
│       ├── srt.ts                 # NUEVO: parseSrt(text) → SubtitleTrack
│       ├── vtt.ts                 # NUEVO: parseVtt(text) → SubtitleTrack
│       └── buildDocument.ts       # NUEVO: buildSingle(track) y mergeDual(source, target) → DualSubDocument
├── state/
│   └── playerStore.ts             # EDITAR (mínimo): screen 'import'|'player' + loadProject({doc, mediaUrl})
├── screens/
│   ├── Player/                    # SIN CAMBIOS funcionales (reusa todo spec 001)
│   └── Import/
│       ├── ImportScreen.tsx       # NUEVO: orquesta selección → confirmación de idioma/rol → abrir Player
│       ├── SidecarPicker.tsx      # NUEVO: <input type=file accept=.srt,.vtt> (1-2) + lectura File.text()
│       └── TrackConfirm.tsx       # NUEVO: idioma inferido (editable) + designar origen/destino + errores
├── App.tsx                        # EDITAR: render Import o Player según screen del store
├── main.tsx                       # SIN CAMBIOS
└── index.css                      # SIN CAMBIOS

tests/
├── core/
│   ├── srt.test.ts                # NUEVO: parseSrt contra fixtures sucias
│   ├── vtt.test.ts                # NUEVO: parseVtt contra fixtures sucias
│   └── buildDocument.test.ts      # NUEVO: normalización + buildSingle + mergeDual
└── fixtures/                      # NUEVO: archivos .srt/.vtt reales/feos (BOM, CRLF, tags, multilínea, coma/punto, NOTE/STYLE, desordenado, solapado, vacío)
```

**Structure Decision**: Single project (web app estática), respetando el mapa de
la constitución. La lógica pura nueva se agrupa en `src/core/formats/` junto a
`dualsub.ts` (mismo dominio: formatos de subtítulo). El video y la lectura de
archivos viven en la capa UI (`src/screens/Import/`); el parsing recibe `string`
para que el 100% se teste sin navegador. El cambio Import↔Player se modela como
un `screen` en el store ya existente (no se añade router) para mantener el diff
mínimo.

## Complexity Tracking

> Sin violaciones de la constitución. Tabla intencionalmente vacía.
