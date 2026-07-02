# Tasks: ASR de videos grandes/largos (extracción de audio + troceo)

**Feature**: spec 008 (amplía 005) · **Plan**: [plan.md](./plan.md) · **Contratos**: [contracts/](./contracts/)

Convenciones: TDD para lo puro (test antes que impl). `[P]` = paralelizable (archivos distintos, sin dependencia pendiente). Diffs mínimos; se **reutiliza** `whisperAdapter` para transcribir cada parte.

---

## Phase 1: Setup

- [x] T001 Añadir dependencia ffmpeg.wasm: `pnpm add @ffmpeg/ffmpeg @ffmpeg/util` (actualiza `package.json`/lockfile).
- [x] T002 [P] Registrar la dependencia en `docs/DECISIONS.md` (1 línea con fecha: ffmpeg.wasm monohilo para extraer/comprimir audio del lado cliente, spec 008).

## Phase 2: Foundational (bloquea todas las user stories)

- [x] T003 Definir la interfaz `AudioExtractor` + `ExtractedAudio` + `AudioExtractError` (kinds: load/no-audio/decode/oom) en `src/core/services/audioExtractor.ts` (TS puro; `extract(media,onProgress)` y `slice(audio,startMs,endMs)`, ver contrato audio-extractor.md).
- [x] T004 [P] Crear `src/core/transcription/chunkPlan.ts` con el tipo `AudioChunk` y las constantes (`SINGLE_MAX_BYTES=24MB`, `TARGET_CHUNK_BYTES=20MB`, `OVERLAP_MS=2000`, `WARN_CHUNKS=3`) + firma de `planChunks` (stub que se rellena en T007).

---

## Phase 3: User Story 1 — Transcribir un video largo que hoy se rechaza (P1) 🎯 MVP

**Meta**: extraer siempre el audio, trocear si excede el margen, transcribir cada parte y re-ensamblar tiempos continuos → pista maestra como hoy.

**Test independiente**: video ≥26 min sin subtítulos → Transcribir → subtítulos completos de inicio a fin con tiempos correctos (SC-001/002/003).

- [x] T005 [P] [US1] Tests de `planChunks` en `tests/core/chunkPlan.test.ts`: envío único (≤24 MB → 1 chunk), troceo `N=ceil(size/20MB)`, cobertura `[0,durationMs)` sin huecos/solape nominal, `fetchStart/End` con solape clampeado en bordes, `durationMs<=0`.
- [x] T006 [P] [US1] Tests de `mergeChunkTranscripts` en `tests/core/mergeChunks.test.ts`: identidad con 1 chunk; 2 y 3+ chunks con solape sin duplicar la frontera (corte en punto medio); tiempos enteros, crecientes y sin solape de intervalos; chunk con segmentos vacíos.
- [x] T007 [US1] Implementar `planChunks` en `src/core/transcription/chunkPlan.ts` hasta que T005 pase.
- [x] T008 [P] [US1] Implementar `mergeChunkTranscripts` en `src/core/transcription/mergeChunks.ts` hasta que T006 pase.
- [x] T009 [US1] Tests del orquestador en `tests/core/pipeline.test.ts` con `AudioExtractor`/`Transcriber` mock: envío único (1 transcribe), troceo feliz (N transcribe, merge continuo), y que no retiene audio al terminar (sin caché).
- [x] T010 [US1] Implementar `transcribeMedia` + tipos `PipelineProgress`/`ChunkResult` en `src/core/transcription/pipeline.ts` (extraer→plan→[cortar+transcribir k/N]→merge, consumiendo interfaces; `confirmChunks` si N>WARN) hasta que T009 pase.
- [x] T011 [P] [US1] Implementar `mockAudioExtractor` en `src/engines/mock/mockAudioExtractor.ts` (audio falso instantáneo; `slice` recorta trivial) para dev/tests de UI.
- [x] T012 [US1] Implementar `ffmpegAudioExtractor` en `src/engines/api/ffmpegAudioExtractor.ts`: carga lazy de `@ffmpeg/ffmpeg` core **monohilo** (assets del propio origen vía `toBlobURL`), `extract` → mp3 mono 16 kHz (`-vn -ac 1 -ar 16000 -b:a 64k`), `slice` por rango; mapear fallos a `AudioExtractError`.
- [x] T013 [US1] Añadir `getAudioExtractor(mode)` (`'ffmpeg' | 'mock'`) en `src/engines/api/index.ts` (patrón de `getTranscriber`).
- [x] T014 [US1] Refactor de `src/screens/Import/TranscribePanel.tsx`: sustituir el bloque de aviso por tamaño (`SIZE_WARN_MB`) por una llamada a `transcribeMedia` (extractor según Settings: `mock` en modo demo, `ffmpeg` en real); éxito → `buildFromTranscript` → `loadProject` igual que hoy. (Progreso detallado y reintento llegan en US2/US3.)

**Checkpoint**: la transcripción de un video grande funciona end-to-end (flujo feliz), verificable con mock y con clave real.

---

## Phase 4: User Story 2 — Ver el progreso (P2)

**Meta**: progreso móvil-first legible y aviso+confirmación en videos con muchas partes.

**Test independiente**: transcribir un video que requiere varias partes y ver fases + "parte k de N" cambiando; si N>3, aviso previo.

- [x] T015 [US2] Mostrar `PipelineProgress` en `src/screens/Import/TranscribePanel.tsx`: "Extrayendo audio… / Parte k de N — subiendo/transcribiendo… / Uniendo…" (a 360px).
- [x] T016 [US2] Implementar `confirmChunks` en `TranscribePanel` (`src/screens/Import/TranscribePanel.tsx`): diálogo de confirmación cuando `N>WARN_CHUNKS` ("Se enviará en N partes; puede tardar y consumir tu cuota. ¿Continuar?") antes de arrancar el bucle (FR-013).

**Checkpoint**: el usuario nunca ve pantalla congelada y controla los trabajos grandes.

---

## Phase 5: User Story 3 — Reintentar una parte sin perder lo hecho (P3)

**Meta**: ante fallo de una parte, conservar las `ok` y reanudar solo desde la fallida.

**Test independiente**: cortar la red a mitad → error en la parte en curso + "Reintentar" que completa sin repetir lo transcrito (FR-007).

- [x] T017 [US3] Añadir reanudación por parte a `transcribeMedia` (`src/core/transcription/pipeline.ts`): conservar `ChunkResult[]` y reanudar desde el primer no-`ok`; ampliar `tests/core/pipeline.test.ts` (fallo en chunk k conserva 0..k-1; el reintento completa sin re-transcribir los `ok`; `confirmChunks=false` aborta sin transcribir).
- [x] T018 [US3] UI de reintento en `src/screens/Import/TranscribePanel.tsx`: mensaje de error por parte + botón "Reintentar" que reanuda el trabajo en curso (sin re-extraer si el audio sigue vivo).

**Checkpoint**: robusto ante red inestable / límites de cuota.

---

## Phase 6: Polish & Cross-Cutting

- [x] T019 [P] Mensajes accionables para `AudioExtractError` (no-audio/decode/load/oom) en `src/screens/Import/TranscribePanel.tsx` (FR-008), en la línea de `ErrorNotice` existente.
- [x] T020 Verificación (constitución III): `pnpm test` (N/N) + `pnpm build` (OK) pegados; actualizar `docs/PROGRESS.md`.
- [ ] T021 Checklist en teléfono real según [quickstart.md](./quickstart.md) (SC-001..005, FR-007/008/013). — PENDIENTE (requiere teléfono + clave real).

---

## Dependencias y orden

- **Setup (T001-T002)** → **Foundational (T003-T004)** → **US1 (T005-T014)** → US2 (T015-T016) → US3 (T017-T018) → Polish.
- TDD: T005/T006 antes de T007/T008; T009 antes de T010.
- T012 (ffmpeg real) puede ir en paralelo a la lógica pura, pero T014 (UI) necesita T010 + T011/T013.
- US2 y US3 dependen de US1 (comparten `TranscribePanel` y el pipeline); NO son paralelas entre sí porque tocan el mismo archivo de UI.

## Ejecución paralela (ejemplos)

- Arranque: T002 [P] mientras se instala T001.
- Foundational: T004 [P] en paralelo a T003.
- US1: T005 [P] + T006 [P] (tests) juntos; luego T008 [P] junto a T007; T011 [P] (mock) en paralelo a T012.

## MVP

**Phase 1 + 2 + 3 (US1)** = producto mínimo demostrable: videos largos se transcriben completos. US2 (progreso/confirmación) y US3 (reintento) son incrementos de robustez/UX.

**Totales**: 21 tareas — Setup 2, Foundational 2, US1 10, US2 2, US3 2, Polish 3.
