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
- Formato interno DualSub JSON v2 (multi-pista, spec 007; v1 se migra al
  parsear); SRT/VTT solo import/export.

<!-- SPECKIT START -->
## Spec activa
- **007 — Multi-pista (DualSub v2) + UX**: ✅ implementada 2026-07-01. Formato v2:
  `masterId` + `tracks[]` ({id, lang, label?, origin?}), `texts` por id de pista
  (`"es"`, `"es-2"`…). La transcripción/pista principal es la MAESTRA del timing y
  la traducción SIEMPRE parte de ella; varias traducciones por idioma; dropdowns
  Arriba/Abajo (`TrackSelector`; vista persistida en `StoredProject.view`).
  Migración v1→v2 automática en `validateDocument`. Helpers puros en
  `src/core/tracks.ts`. Fixes UX: traducir no resetea posición/offset
  (`updateDoc`), lo parcial se conserva en la pista, Import sobrevive a Settings
  (`returnScreen`), reset del input de video, fullscreen del contenedor (B2).
  102/102 tests, build OK. Pendiente: validar 004/005/007 en teléfono real.
- **004 — Persistencia local + biblioteca**: ✅ (US1–US4). Con la 007,
  `StoredProjectMeta.langs[]` y `combineProjects` (multi-pista, sin `selectPair`).
  Pendiente: checklist en teléfono real (T023).
- **005 — Pipeline ASR**: ✅ núcleo (Groq `whisper-large-v3-turbo` + OpenAI
  `whisper-1`; `TranscribePanel` en Import). Pendiente: validar con clave real en
  teléfono. Siguiente roadmap: **006 — YouTube (Camino A)**.
<!-- SPECKIT END -->
