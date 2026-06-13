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
- **001 — Player dual con datos mock**: plan en
  `specs/001-player-dual-mock/plan.md` (spec, research, data-model, contracts,
  quickstart). UI nueva en `src/screens/Player/` + store `src/state/playerStore.ts`
  + mock `src/engines/mock/mockDocument.ts`. Reusa `src/core/sync.ts` sin cambios;
  sin dependencias nuevas. Siguiente: `/speckit-tasks`.
<!-- SPECKIT END -->
