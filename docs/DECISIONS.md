# DECISIONS — DualSub

> Log de decisiones. Una línea por decisión, con fecha. Lo más reciente arriba.

- **2026-06-12** — Metodología: GitHub Spec Kit (integración Claude) con la guía
  de trabajo como constitución (`.specify/memory/constitution.md`). Specs
  gestionadas en `specs/` vía skills `/speckit-*`.
- **2026-06-12** — Stack v0.1: React 19 + Vite 6 + TS estricto + Tailwind v4
  (plugin `@tailwindcss/vite`, sin postcss.config) + Zustand 5 + Vitest 3.
  Gestor pnpm.
- **2026-06-12** — React 19 (no 18 como sugería la guía): es el estable más
  reciente y este es un proyecto de aprendizaje en 2026; sin coste de migración
  al partir de cero.
- **2026-06-12** — Subtítulos embebidos (mov_text/ASS dentro del MP4/MKV) fuera
  de v0.1; en su lugar sidecar .srt/.vtt. Extracción embebida = spec 002b
  opcional (framework §5).
- **2026-06-12** — Sin IA local en v0.1: procesamiento vía APIs. Engine local
  alternativo en fase futura, sin rehacer la arquitectura de interfaces
  (`core/services`).
