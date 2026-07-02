# Implementation Plan: ASR de videos grandes/largos (extracción de audio + troceo)

**Branch**: `main` (repo trabaja en main; sin rama por hook) | **Date**: 2026-07-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-asr-audio-chunking/spec.md` (amplía la spec 005 — ASR)

## Summary

Hoy se envía el **video entero** a Whisper y el proveedor rechaza a partir de ~25 MB. El plan introduce un pipeline que **siempre extrae el audio** del video en el cliente (ffmpeg.wasm monohilo → mono 16 kHz), y si el audio pesa más del margen seguro lo **trocea por tiempo** (N = techo(tamaño/20 MB), solape ~2 s), transcribe cada parte y **re-ensambla** los tiempos de forma continua (ms enteros, sin duplicar el solape). La extracción queda tras una interfaz `AudioExtractor` intercambiable (ffmpeg.wasm hoy; plugin nativo tras Capacitor; mock en dev). El cálculo de trozos y el re-ensamblado son **puros** en `src/core` (con tests Vitest); ffmpeg y la red viven en `src/engines`. La UI de `TranscribePanel` sustituye el aviso de tamaño por progreso (extrayendo / parte k de N / transcribiendo), reintento por parte sin perder lo hecho, y aviso+confirmación si hay muchas partes.

## Technical Context

**Language/Version**: TypeScript estricto sobre React 19 + Vite 6 (SPA estática).

**Primary Dependencies**: **NUEVA** — `@ffmpeg/ffmpeg` + `@ffmpeg/util` (v0.12.x) con **core monohilo** (`@ffmpeg/core`, no `-mt`) para NO requerir cabeceras COOP/COEP (funciona en Netlify estático y en el WebView de Capacitor). Existentes: Zustand, Tailwind v4, Vitest.

**Storage**: sin almacenamiento nuevo. El audio extraído **no se cachea** (FR-014): vive en memoria durante el proceso y se descarta. IndexedDB (spec 004) sin cambios.

**Testing**: Vitest para los helpers puros nuevos (`planChunks`, `mergeChunkTranscripts`) y el orquestador del pipeline (con `AudioExtractor`/`Transcriber` mock). UI: checklist en teléfono real (constitución §Calidad).

**Target Platform**: navegadores móviles (iOS Safari, Android Chrome) con WebAssembly; preparado para WebView de Capacitor.

**Project Type**: web app móvil-first (single project, sin backend).

**Performance Goals**: transcribir un video de 26 min sin intervención manual; progreso perceptible al menos cada pocos segundos; **memoria acotada** (extraer/cortar sin retener PCM de todo el video ni concatenar todos los trozos en RAM a la vez).

**Constraints**: sin dependencia de COOP/COEP (core monohilo); tiempos en ms enteros en core; BYOK (clave desde Settings/localStorage); todo cliente salvo la llamada al proveedor.

**Scale/Scope**: videos de hasta varias horas (sin tope duro; aviso+confirmación por encima de un umbral de partes). ~3-4 archivos nuevos en core/engines + 1 refactor de UI.

## Constitution Check

*GATE: pasa antes de Phase 0 y se re-evalúa tras Phase 1.*

| Principio | Cumplimiento en este plan |
|-----------|---------------------------|
| **I. Core puro y testeable** | `planChunks` y `mergeChunkTranscripts` (y sus tipos) son TS puro en `src/core/transcription/`, con tests Vitest antes/junto al código. El orquestador del pipeline consume **interfaces** (no importa `fetch`/DOM) → testeable con mocks. ffmpeg y red quedan fuera de core. ✅ |
| **II. UI contra interfaces** | Nueva interfaz `AudioExtractor` en `src/core/services/`. Implementaciones: `engines/api` (ffmpeg.wasm) y `engines/mock`. La UI y el pipeline consumen la interfaz; `getAudioExtractor()` (factory en engines) resuelve la concreta. ✅ |
| **III. Evidencia antes de "listo"** | Al implementar: `pnpm test` + `pnpm build` pegados. En fase de plan no se ejecutan. ✅ (diferido) |
| **IV. Spec-driven, iteraciones pequeñas** | Feature partida por user stories (US1 flujo feliz, US2 progreso, US3 reintento). US1 ya es demostrable en teléfono. Puede tomar 2-3 sesiones; se corta por US si hace falta. ✅ |
| **V. Diffs mínimos + deps justificadas** | Nueva dep ffmpeg.wasm ⇒ **línea en `docs/DECISIONS.md`** (tarea del plan). Cambios acotados; no se reescribe `whisperAdapter` (se reutiliza para transcribir cada parte). ✅ |
| **VI. Móvil-first + BYOK** | Progreso y confirmación diseñados a 360px. Claves siguen viniendo de Settings. ✅ |
| **VII. Decisiones explicadas** | Resueltas en `/speckit-clarify` (extraer siempre, corte por tiempo + solape 2 s, sin tope con aviso, sin caché). ✅ |

**Resultado del gate**: PASA. Sin violaciones → *Complexity Tracking* vacío.

## Project Structure

### Documentation (this feature)

```text
specs/008-asr-audio-chunking/
├── plan.md              # Este archivo
├── research.md          # Phase 0 (decisiones técnicas: ffmpeg.wasm monohilo, formato audio, umbrales)
├── data-model.md        # Phase 1 (entidades: ExtractedAudio, AudioChunk, ChunkResult, progreso)
├── quickstart.md        # Phase 1 (cómo validar end-to-end)
├── contracts/
│   ├── audio-extractor.md      # Interfaz AudioExtractor
│   └── transcription-pipeline.md  # Orquestador + planChunks + mergeChunkTranscripts
└── checklists/requirements.md   # (de /speckit-specify)
```

### Source Code (repository root)

```text
src/core/
├── services/
│   ├── transcriber.ts        # EXISTE (reutilizado; quizá + kind de error 'audio-extract')
│   └── audioExtractor.ts     # NUEVO — interfaz AudioExtractor + tipos + AudioExtractError
└── transcription/
    ├── buildFromTranscript.ts  # EXISTE
    ├── chunkPlan.ts            # NUEVO (PURO) — planChunks(durationMs, sizeBytes, opts) → AudioChunk[]
    ├── mergeChunks.ts          # NUEVO (PURO) — mergeChunkTranscripts(...) → TranscriptSegment[]
    └── pipeline.ts             # NUEVO — orquesta extraer→plan→(cortar+transcribir k/N)→merge; consume interfaces

src/engines/
├── api/
│   ├── ffmpegAudioExtractor.ts # NUEVO — extract() a mono 16 kHz + slice(rango) con ffmpeg.wasm monohilo
│   └── index.ts                # EXISTE — + getAudioExtractor(id)
└── mock/
    └── mockAudioExtractor.ts   # NUEVO — audio falso instantáneo para dev/tests de UI

src/screens/Import/
└── TranscribePanel.tsx         # REFACTOR — usa el pipeline; progreso k/N; reintento por parte; aviso+confirmación

tests/core/
├── chunkPlan.test.ts           # NUEVO
├── mergeChunks.test.ts         # NUEVO
└── pipeline.test.ts            # NUEVO (mocks de extractor/transcriber: retry, merge, sin caché)

docs/DECISIONS.md               # + 1 línea (ffmpeg.wasm)
```

**Structure Decision**: single project (constitución §Mapa). Se respeta el reparto core (puro) / engines (red+ffmpeg) / screens (UI). Se reutiliza `whisperAdapter` tal cual para transcribir cada parte (el pipeline le pasa el blob de audio del trozo en vez del video entero).

## Complexity Tracking

> Sin violaciones de la constitución. N/A.
