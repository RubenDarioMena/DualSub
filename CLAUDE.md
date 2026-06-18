# DualSub — Reglas del proyecto

Web-app móvil-first para ver video con doble subtítulo (EN/ES/JA) y estudiar
idiomas. v0.1 procesa vía APIs externas (BYOK); IA local queda para fases
futuras.

Fuente de verdad: la **constitución** en `.specify/memory/constitution.md`.
El framework de trabajo completo (cómo colaboramos, checklist de QA, decisiones
de la capa API) está en `guia-framework-trabajo.md`.

## Stack
React 19 + Vite + TypeScript estricto + Tailwind v4 + Zustand + Vitest. pnpm.
Deploy estático (Netlify). Sin backend en v0.1.

## Mapa rápido
- `src/core/`    → lógica pura (modelos, parsers, sync). SIN React/DOM/fetch.
- `src/engines/` → Transcriber/Translator (`api` | `mock`).
- `src/screens/` → Import, Processing, Player, TranscriptList.
- `specs/`       → una spec por feature (Spec Kit). Trabajar SIEMPRE contra una spec.
- `docs/PROGRESS.md`  → estado; leer al iniciar sesión, actualizar al cerrar.
- `docs/DECISIONS.md` → log de decisiones (1 línea + fecha).

## Reglas no negociables (resumen; detalle en la constitución)
1. Nada "completo" sin pegar la salida real de `pnpm test` y `pnpm build`.
2. Lógica nueva en `src/core` ⇒ test en `tests/` antes o junto al código.
3. Diffs mínimos: no reescribir archivos enteros ni reformatear código ajeno.
4. UI contra `engines/mock`; `engines/api` solo cuando la spec lo pida.
5. No añadir dependencias sin una línea en `docs/DECISIONS.md`.
6. Móvil-first: diseñar a 360px primero.
7. API keys SOLO en localStorage (BYOK). Nunca en el repo.
8. Spec ambigua ⇒ preguntar UNA cosa concreta, no asumir.
9. Explicar decisiones en lenguaje accesible: al pedir una decisión (sobre todo
   en audio/codecs/red), traducir el término técnico a su efecto práctico
   (qué cambia para el usuario, coste, complejidad). Vale gastar tokens en esa
   claridad: acelera decidir. Sin jerga cruda sin explicar.

## Comandos
pnpm dev / pnpm test / pnpm test:watch / pnpm build / pnpm preview

## Flujo Spec Kit
/speckit-constitution · /speckit-specify · /speckit-plan · /speckit-tasks · /speckit-implement
(opcionales: /speckit-clarify · /speckit-analyze · /speckit-checklist)

## Convenciones
- Tiempos en ms enteros (`startMs`/`endMs`), nunca segundos float en core.
- Idiomas ISO 639-1 (`"en" | "es" | "ja"`).
- Formato interno DualSub JSON v1; SRT/VTT solo import/export.

<!-- SPECKIT START -->
## Spec activa
- **004 — Persistencia local + biblioteca**: ✅ implementada (US1–US4). Puerto
  `ProjectStore` (interfaz pura en `src/core/services/`) con adaptadores en
  `src/engines/storage/` (`idbProjectStore` IndexedDB + `memoryProjectStore` fallback
  FR-012); lógica pura `combineByPivot`/`selectPair` en `src/core/project/` (tests en
  `tests/core/combine.test.ts`). Modo ligero por defecto + interruptor
  `saveVideoInBrowser` (degrada ante cuota). `libraryStore` + `LibraryScreen`. Pendiente:
  checklist en teléfono real (T023).
- **005 — Pipeline ASR (audio → texto con tiempos)**: ✅ núcleo. Interfaz pura
  `Transcriber` (`src/core/services/transcriber.ts`) + conversión `buildFromTranscript`
  (`src/core/transcription/`, tests). Engines `mockTranscriber` + `whisperAdapter`
  (Groq `whisper-large-v3-turbo` reusando la clave Groq + OpenAI `whisper-1`); UI
  `TranscribePanel` en Import. Sin dependencias nuevas. Pendiente: validar con clave real
  en teléfono. Siguiente roadmap: **006 — YouTube (Camino A)**.
<!-- SPECKIT END -->
