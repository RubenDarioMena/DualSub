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

## En curso
- (nada)

## Siguiente
- **Spec 001 — Player dual con datos mock**: video local + DualSub JSON, overlay
  horizontal, lista vertical con highlight/autoscroll, control de offset. Primera
  vez que se ve DualSub vivo en el teléfono. Crear con `/speckit-specify`.

## Roadmap de specs (framework §5)
- **000** — Formato DualSub JSON v1 + modelos + sync (tests)
- **001** — Player dual con datos mock (overlay horizontal + lista vertical con
  highlight/autoscroll, offset)
- **002** — Import: video + detección sidecar .srt/.vtt + parsers + merge dual
- **003** — Pipeline API (BYOK): audio → ASR con timestamps → traducción 1:1 →
  DualSub JSON
