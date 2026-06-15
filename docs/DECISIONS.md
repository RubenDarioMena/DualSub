# DECISIONS — DualSub

> Log de decisiones. Una línea por decisión, con fecha. Lo más reciente arriba.

- **2026-06-13** — Constitución v1.1.0: nuevo principio VII — explicar las
  decisiones en lenguaje accesible (traducir jerga de audio/codecs/red a efecto
  práctico para el usuario, coste y complejidad), aun a costa de más tokens.
- **2026-06-13** — Spec 002 implementada. Estrategia de merge: **solape truncado**
  para resolver cues que se pisan (D5: el cue previo termina donde empieza el
  siguiente, sin perder texto) y **origen como master de timing** con cada cue
  destino asignado a **un único** segmento origen (el de mayor solape; corregido el
  2026-06-14 — antes se duplicaba un destino que cruzaba dos segmentos). Un sidecar
  (D7): el usuario puede elegir idioma destino para
  la futura traducción (003) o "Ninguno" (placeholder determinista, invisible en el
  render). Navegación Import↔Player con un `screen` en el store, **sin react-router**.
  Tests leen fixtures con Vite `?raw` para **no añadir `@types/node`**.
- **2026-06-13** — Spec 002 reenfocada: el entregable de valor es el **core**
  (`parseSrt`/`parseVtt` + merge dual, testeados con fixtures), reutilizable por
  MKV-embed (002b), YouTube captions y render web (`<track>` usa VTT). El **Import
  por archivo sidecar** se mantiene **mínimo** (test harness + power-user), porque
  en móvil tener sidecars sueltos es poco común. No gold-plating del UI de import.
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
