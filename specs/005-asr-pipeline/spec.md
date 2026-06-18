# Spec 005 — Pipeline ASR (audio → texto con tiempos)

**Estado**: implementada (núcleo) · **Fecha**: 2026-06-18

> Nota de proceso: por una restricción de tiempo se implementó en una sola pasada
> (sin el flujo completo de Spec Kit). Esta spec documenta lo construido y lo pendiente
> de validar en dispositivo. Decisiones clave en `docs/DECISIONS.md` (2026-06-18).

## Problema

Hasta ahora DualSub necesita subtítulos (sidecar .srt/.vtt) o una traducción de un
origen existente. Falta el caso **"tengo el video pero NO tengo ningún subtítulo"**:
generar los subtítulos a partir del **audio** del propio video, con tiempos, para luego
traducirlos (003) y verlos en doble subtítulo (001) y guardarlos (004).

## Historias de usuario

- **US1 (P1)** — Con un video sin subtítulos, elijo el idioma hablado y genero la
  transcripción con tiempos; el resultado abre el Player como un documento solo-origen,
  listo para traducir. **MVP.**
- **US2 (P2)** — Elijo el proveedor de transcripción en Settings (BYOK) y reutilizo la
  misma API key que ya tengo para ese proveedor (Groq/OpenAI).
- **US3 (P3)** — Si algo falla (sin clave, clave inválida, archivo demasiado grande, red),
  recibo un mensaje en lenguaje llano con la acción correcta, sin que la app se cuelgue.

## Requisitos funcionales

- **FR-001** — Transcribir el audio de un medio local a segmentos `{startMs,endMs,text}`.
- **FR-002** — El idioma hablado lo elige el usuario (`en|es|ja`) y fija `sourceLang`.
- **FR-003** — El resultado se ensambla a **DualSub JSON v1** (000): normaliza orden y
  no-solape (reusa `normalizeCues` de 002), descarta segmentos vacíos, `meta.source =
  'api-pipeline'`, destino pendiente (placeholder o elegido) para la traducción (003).
- **FR-004** — BYOK: nunca se llama a la red sin clave. La clave se reutiliza del mismo
  proveedor de Settings (Groq comparte clave con su traducción).
- **FR-005** — Errores tipados (`no-key|auth|rate-limit|network|bad-shape|too-large|
  provider-unavailable`) → mensaje/acción accionable; `413` → `too-large`.
- **FR-006** — Sin red en el núcleo: el `fetch` vive solo en `src/engines/api`.

## Diseño / arquitectura

- **Core puro** (`src/core`):
  - `services/transcriber.ts` — interfaz `Transcriber` + tipos + catálogo `TRANSCRIBERS`
    (`mock|groq|openai`). Sin `fetch`/DOM (igual patrón que `translator.ts`).
  - `transcription/buildFromTranscript.ts` — conversión pura a `DualSubDocument`
    (tests en `tests/core/buildFromTranscript.test.ts`).
- **Engines**:
  - `mock/mockTranscriber.ts` — demo sin red (UI sin clave, constitución II).
  - `api/whisperAdapter.ts` — adaptador Whisper (multipart + `response_format=verbose_json`);
    `groqTranscriber` (`whisper-large-v3-turbo`) + `openaiTranscriber` (`whisper-1`);
    registro `getTranscriber` en `api/index.ts`.
- **UI**: `screens/Import/TranscribePanel.tsx` — se muestra cuando hay video pero **no**
  hay pistas de subtítulos; selector de idioma, etapas (subiendo/transcribiendo), errores
  accionables y aviso de tamaño. `settingsStore` añade `asrProvider`; selector en Settings.

## Decisiones (resumen; detalle en DECISIONS.md)

- **Proveedor**: Groq Whisper v3 turbo (reusa clave Groq) + OpenAI Whisper. OpenRouter
  descartado: **no** ofrece transcripción de audio.
- **Sin extracción de audio en el navegador**: se sube el video y el proveedor extrae el
  audio (evita ffmpeg.wasm). Limitación: archivos grandes (~25 MB) pueden rechazarse.

## Fuera de alcance (v0.1)

- Extracción/compresión de audio local (clip largo → recortar antes). Posible fase futura.
- Diarización (quién habla), puntuación avanzada, palabra a palabra.

## Pendiente de validación en dispositivo

- US1+US2 con clave real (Groq/OpenAI) y un clip corto: idioma correcto, tiempos
  razonables, abre el Player y luego traduce (003).
- US3: sin clave / clave inválida / archivo grande (413) → mensaje accionable sin colgarse.
- Settings a 360px (selector de ASR + nota de clave compartida).
