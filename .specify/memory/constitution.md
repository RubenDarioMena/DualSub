# DualSub Constitution

DualSub es una web-app móvil-first para ver video con doble subtítulo (EN/ES/JA)
y estudiar idiomas. Esta constitución gobierna el desarrollo de v0.1. Se deriva
de `guia-framework-trabajo.md` y es la fuente de verdad para cualquier spec,
plan o implementación.

## Core Principles

### I. Core puro y testeable (NON-NEGOTIABLE)
`src/core/` contiene solo TypeScript puro: modelos, parsers, sincronización.
NUNCA importa React, DOM ni `fetch`. Si una función toca red o UI, no vive en
core. Esto permite cazar el ~80% de los bugs de lógica con tests de
milisegundos sin abrir el navegador. Toda lógica nueva en `src/core` exige test
en `tests/` escrito antes o junto al código.

### II. UI contra interfaces, no contra implementaciones
Las pantallas consumen las interfaces de `core/services` (Transcriber,
Translator, AudioExtractor). En desarrollo se inyecta `engines/mock`
(respuestas falsas instantáneas, cero costo de API); en producción
`engines/api`. La UI se desarrolla completa contra mocks. `engines/api` solo se
toca cuando una spec lo pide explícitamente.

### III. Evidencia antes de "listo" (NON-NEGOTIABLE)
Ninguna tarea se declara completa sin pegar la salida real de `pnpm test` y
`pnpm build`. Si fallan, la tarea no está completa. No se dice "debería
funcionar": se dice "N/N tests pasan, build OK, aquí el output" o "falla X por
Y, decidamos".

### IV. Spec-driven, iteraciones pequeñas
Cada feature empieza con una spec (vía `/speckit-specify`) con criterios de
aceptación verificables, qué queda fuera y riesgos. Nada de "vibe coding": cada
sesión arranca de una spec o un bug concreto, nunca de "mejora la app". Una
iteración = algo demostrable en un teléfono real en 1-3 sesiones; si no cabe, se
parte.

### V. Diffs mínimos y dependencias justificadas
Editar lo necesario, archivo por archivo; no reescribir archivos enteros ni
reformatear código ajeno al cambio. No se añade ninguna dependencia sin
justificarla en una línea en `docs/DECISIONS.md`.

### VI. Móvil-first y BYOK
Todo componente se diseña primero para 360px de ancho. Las API keys viven SOLO
en localStorage vía la pantalla Settings (BYOK): jamás hardcodeadas, jamás en el
repo, jamás en variables de build.

## Convenciones técnicas

- Stack: React 19 + Vite + TypeScript estricto + Tailwind + Zustand + Vitest.
  Gestor: pnpm. Deploy: Netlify (estático). Sin backend propio en v0.1.
- Tiempos siempre en milisegundos enteros (`startMs`/`endMs`), nunca segundos
  float en core.
- Idiomas: códigos ISO 639-1 (`"en" | "es" | "ja"`).
- Formato interno: DualSub JSON v1. SRT/VTT son solo import/export.
- Japonés: fuente con fallback `Noto Sans JP` y `word-break` para líneas sin
  espacios.

## Mapa del repositorio

- `src/core/`    → lógica pura (modelos, parsers, sync). SIN React/DOM/fetch.
- `src/engines/` → implementaciones de Transcriber/Translator (`api` | `mock`).
- `src/screens/` → Import, Processing, Player, TranscriptList.
- `specs/`       → una spec por feature (gestionadas por Spec Kit).
- `docs/DECISIONS.md` → log de decisiones (1 línea c/u, con fecha).
- `docs/PROGRESS.md`  → estado actual; leer al iniciar sesión, actualizar al cerrar.

## Calidad y tests

TDD real para el core (parsers, sync, merge de subtítulos, validación 1:1 de
traducciones). La UI NO se testea automatizado en v0.1: se verifica con la
checklist de dispositivo real (framework §8). Playwright entra en v0.2 si las
regresiones de UI empiezan a doler. Todo bug de lógica se convierte primero en
un test que falla y luego se arregla, para que quede vacunado.

## Governance

Esta constitución supersede cualquier otra práctica. Cualquier spec, plan o
implementación que la contradiga debe corregirse o justificar la excepción en
`docs/DECISIONS.md`. Las enmiendas se documentan ahí con fecha. Si una spec es
ambigua, se pregunta UNA cosa concreta, no se asume en silencio una decisión de
producto (idiomas, costos, UX).

**Version**: 1.0.0 | **Ratified**: 2026-06-12 | **Last Amended**: 2026-06-12
