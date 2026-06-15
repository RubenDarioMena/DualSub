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

- **2026-06-13** — **Spec 002 — Import sidecar .srt/.vtt + merge dual**: core puro
  nuevo en `src/core/formats/` — `parseSrt`/`parseVtt` (BOM, CRLF, `<i>`, multilínea,
  coma/punto, `NOTE`/`STYLE`), `normalizeCues` (orden + solape truncado), `buildSingle`
  (D7: target elegible o placeholder) y `mergeDual` (origen master + destino por solape,
  concatena solapantes). Import UI mínima en `src/screens/Import/` (SidecarPicker +
  TrackConfirm + ImportScreen) con inferencia de idioma por nombre, selector "Traducir a"
  + "Ninguno", bloqueo origen===destino y errores accionables; `screen`+`loadProject` en
  el store (sin router). Tests con fixtures vía Vite `?raw` (sin `@types/node`).
  **54/54 tests verdes, build OK** (tsc estricto). Sin dependencias nuevas. Spec en
  `specs/002-import-sidecar-subs/`.

## En curso
- (nada)

## Siguiente
- **Spec 003 — Pipeline API (BYOK)**: audio → ASR con timestamps → traducción 1:1 →
  DualSub JSON. Reusa el `targetLang` que el usuario ya pudo elegir en Import (002, D7).
- **002 — validación en teléfono (ronda 1, 2026-06-13)**: US1/US2/US3 y errores
  mayormente OK. Bugs corregidos: selección de archivos poco fiable / "aparece y
  desaparece" (reset de `value` del input), archivo incompatible borraba lo ya
  elegido (selección no destructiva con `allSettled`, #14/A3), video se estiraba al
  girar (`object-contain`, B1). **Re-verificar en teléfono**: A1/A2 (selección),
  #14 (.txt), #6 (.vtt), #13 (archivo vacío/basura).
- **2026-06-14** — **002 bugfix (merge)**: un cue destino que cruzaba dos segmentos
  origen se duplicaba (el texto de abajo aparecía 2 veces). Corregido en `mergeDual`:
  cada destino se asigna a un único segmento (mayor solape). Test de regresión en
  `tests/core/buildDocument.test.ts`. **55/55 verde, build OK**.
- **001 — issue conocido (B2)**: el botón nativo de pantalla completa pone en
  fullscreen solo el `<video>`, así que el overlay de subtítulos (hermano en el DOM)
  desaparece. Fix futuro: fullscreen del contenedor (no del `<video>`) con botón
  propio / controles custom. Registrado para follow-up de spec 001.
- Pendiente menor de 001: validar overlay (US3) y offset (US4) en teléfono real
  (horizontal + rotación) con la checklist de `quickstart.md`.

## Roadmap de specs (framework §5)
- **000** — Formato DualSub JSON v1 + modelos + sync (tests)
- **001** — Player dual con datos mock (overlay horizontal + lista vertical con
  highlight/autoscroll, offset)
- **002** — Import: video + detección sidecar .srt/.vtt + parsers + merge dual
- **003** — Pipeline API (BYOK): audio → ASR con timestamps → traducción 1:1 →
  DualSub JSON
