# PROGRESS — DualSub

> Estado vivo del proyecto. Leer al iniciar sesión, actualizar al cerrar.

## Hecho
- **2026-06-12** — Fundación del repo: GitHub Spec Kit (integración Claude) +
  constitución derivada del framework de trabajo. Scaffold Vite + React 19 + TS
  estricto + Tailwind v4 + Zustand + Vitest. `pnpm test` y `pnpm build` verdes.

## En curso
- (nada)

## Siguiente
- **Spec 000 — Formato DualSub JSON v1**: modelos (`MediaProject`,
  `SubtitleSegment`, …) + `findActiveSegment` + `applyOffset` con tests. Pura
  lógica, cero riesgo. Crear con `/speckit-specify`.

## Roadmap de specs (framework §5)
- **000** — Formato DualSub JSON v1 + modelos + sync (tests)
- **001** — Player dual con datos mock (overlay horizontal + lista vertical con
  highlight/autoscroll, offset)
- **002** — Import: video + detección sidecar .srt/.vtt + parsers + merge dual
- **003** — Pipeline API (BYOK): audio → ASR con timestamps → traducción 1:1 →
  DualSub JSON
