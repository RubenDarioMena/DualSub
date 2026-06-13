# PROGRESS — DualSub

> Estado vivo del proyecto. Leer al iniciar sesión, actualizar al cerrar.

## Hecho
- **2026-06-12** — Fundación del repo: GitHub Spec Kit (integración Claude) +
  constitución derivada del framework de trabajo. Scaffold Vite + React 19 + TS
  estricto + Tailwind v4 + Zustand + Vitest. `pnpm test` y `pnpm build` verdes.
- **2026-06-12** — **Spec 000 — Formato DualSub JSON v1**: modelos
  (`DualSubDocument`, `SubtitleSegment`, `MediaProject`), `findActiveSegment`/
  `findActiveSegmentIndex` (fin exclusivo, null en huecos, búsqueda binaria),
  `applyOffset`, y `serializeDualSub`/`parseDualSub` con validación de invariantes.
  24/24 tests verdes, build OK. Spec en `specs/000-dualsub-json-format/`.
- **2026-06-13** — **Spec 001 — Player dual con datos mock**: pantalla Player
  móvil-first sobre datos mock (EN→ES, 220 segs con huecos y 1 sin traducción).
  `<video>` como reloj maestro (bucle rAF) + `findActiveSegmentIndex` derivando el
  segmento activo; el store guarda solo `activeIndex` (re-render solo en cambio de
  segmento). US1 lista con highlight + autoscroll, US2 tap-to-seek, US3 overlay
  horizontal con safe-areas, US4 control de offset ±ms (sin mutar el doc). Sin deps
  nuevas, sin tocar `src/core`. MVP (US1+US2) validado en teléfono real (highlight,
  hueco, autoscroll, tap-to-seek, sin traducción, líneas largas, fluidez: pass).
  24/24 tests verdes, build OK. Spec en `specs/001-player-dual-mock/`.

## En curso
- (nada)

## Siguiente
- **Spec 002 — Import: video + detección sidecar .srt/.vtt + parsers + merge dual**
  (framework §5). Habilita el caso "el video ya trae subtítulos". Crear con
  `/speckit-specify`. Pendiente menor de 001: validar overlay (US3) y offset (US4)
  en teléfono real (horizontal + rotación) con la checklist de `quickstart.md`.

## Roadmap de specs (framework §5)
- **000** — Formato DualSub JSON v1 + modelos + sync (tests)
- **001** — Player dual con datos mock (overlay horizontal + lista vertical con
  highlight/autoscroll, offset)
- **002** — Import: video + detección sidecar .srt/.vtt + parsers + merge dual
- **003** — Pipeline API (BYOK): audio → ASR con timestamps → traducción 1:1 →
  DualSub JSON
