# Spec 007 — Subtítulos multi-pista (DualSub JSON v2) + mejoras de UX

> Estado: ✅ implementada (2026-07-01). Origen: pedido directo del usuario tras
> las specs 004/005 — "que el idioma de la transcripción siempre sea el maestro
> que marque el timing, que en un mismo idioma puedas generar más de una
> traducción, y que puedas seleccionar los idiomas con menús dropdown".

## Problema

El formato v1 (spec 000) modelaba un PAR fijo `sourceLang`/`targetLang` con un
texto por idioma. Eso impedía:

- Tener **más de una traducción del mismo idioma** (p. ej. comparar Groq vs
  DeepL, o regenerar sin perder la anterior).
- Cambiar qué par se ve sin "derivar" un proyecto nuevo (004 US4 creaba
  proyectos duplicados solo para ver otro par).
- Expresar que la **transcripción (ASR) es la dueña del timing**: al derivar
  pares, el "origen" pasaba a ser una traducción cualquiera.

Además había bugs de UX detectados en la revisión: traducir reseteaba posición
y offset (`loadProject` ponía todo a 0); ir a Settings a mitad del Import
descartaba los archivos elegidos; re-elegir el mismo video en el Player no
disparaba `change` en móvil; y el fullscreen nativo ocultaba el overlay (B2).

## Decisiones

- **D1 — Formato v2 multi-pista.** `DualSubDocument` pasa a
  `{ version: 2, masterId, tracks: TrackMeta[], segments }`.
  `TrackMeta = { id, lang, label?, origin? }` (`origin ∈ original | import |
  asr | translation | mock`). `segments[i].texts` se indexa por **id de pista**
  (por convención `"es"`, `"es-2"`, `"es-3"`…), no por idioma.
- **D2 — Pista maestra = timing.** `masterId` señala la pista cuya rejilla de
  tiempos manda (la transcripción ASR o la pista principal del import). La
  traducción SIEMPRE parte de la maestra, nunca de otra traducción.
- **D3 — Migración v1→v2 al parsear, sin pérdida.** `parseDualSub`/
  `validateDocument` aceptan v1 y lo migran (origen → pista maestra; destino →
  pista `translation` SOLO si tiene algún texto). Los ids de pista de la
  migración son los códigos de idioma, así `texts` no cambia de claves. Los
  proyectos guardados en IndexedDB (004) se leen tal cual.
- **D4 — La vista no es documento.** Qué pista va Arriba/Abajo
  (`TrackView = { top, bottom|null }`) vive en `playerStore` y se persiste en
  `StoredProject.view` (campo aditivo, `schemaVersion` sigue en 1;
  `StoredProjectMeta` pasa de par a `langs[]` con tolerancia a registros
  legacy).
- **D5 — El destino se elige al traducir, no al importar.** Desaparece el
  `targetLang` "placeholder" (D7 de la 002): Import ya no pregunta "Traducir
  a"; el dropdown vive en `TranslatePanel`. Una pista incompleta del idioma
  elegido se COMPLETA; si ya está completa, se crea OTRA pista
  (`nextTrackId`).
- **D6 — Lo parcial se ensambla.** Ante fallo a mitad de traducción, lo ya
  traducido se escribe en la pista (y se auto-guarda) en vez de vivir en un
  acumulador de React. Reintentar = completar pendientes.
- **D7 — `updateDoc` para cambios de documento en caliente.** Traducir usa
  `updateDoc` (solo cambia `doc` + re-valida vista), no `loadProject`:
  posición, offset y reproducción quedan intactos.
- **D8 — Combinar ≠ derivar.** `combineByPivot` une pistas de dos proyectos
  con el mismo idioma maestro + rejilla (renombrando colisiones de id);
  `selectPair` desaparece — el par visible se elige con los dropdowns.
- **D9 — Fullscreen del contenedor.** Botón propio en modo overlay que pide
  fullscreen del contenedor del video (no del `<video>`), así el overlay dual
  sigue visible (fix B2). Se oculta si la API no existe (iPhone).
- **D10 — Import sobrevive a Settings.** `ImportScreen` queda montada (oculta)
  al visitar Settings/Diagnóstico, y `setScreen` registra el origen para que
  «Volver» regrese a la pantalla desde la que se entró.

## Cambios

- `core/models.ts` (v2), `core/tracks.ts` (nuevo: `masterTrack`, `nextTrackId`,
  `defaultView`, `resolveView`, `pendingCount`…), `core/formats/dualsub.ts`
  (validación v2 + migración v1), `core/formats/buildDocument.ts`,
  `core/transcription/buildFromTranscript.ts`, `core/translation/assemble.ts`
  (pista destino), `core/project/combine.ts`.
- `engines/storage/*` (langs/view + lectura legacy), `engines/mock/mockDocument`.
- `state/playerStore` (`topId`/`bottomId`/`setView`/`updateDoc`/`returnScreen`),
  `state/libraryStore` (`combineProjects`, persistencia de vista).
- UI: `TrackSelector` (nuevo), `TranslatePanel` (rework), `TranscriptRow/List`,
  `SubtitleOverlay`, `PlayerScreen` (header + fullscreen), `TrackConfirm` e
  `ImportScreen` (sin "Traducir a"; dos sidecars del mismo idioma permitidos),
  `LibraryScreen`, `MediaPicker` (reset de `value`), `App.tsx` (D10),
  `screens/shared/langLabels.ts` (nuevo, dedupe).
- Tests: `tracks.test.ts` (nuevo) + reescritura de `dualsub/assemble/combine/
  buildDocument/buildFromTranscript`. **102/102 verdes, build OK.**

## Fuera de alcance (futuro)

- Renombrar/borrar pistas desde la UI.
- Export SRT/VTT de una pista concreta.
- Selector de pistas dentro del modo overlay (hoy se cambia en modo lista).
