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

- **2026-06-14** — **Spec 003 — Traducción vía API (BYOK)**: rellenar el idioma
  destino de un `DualSubDocument` (salida del Import 002) vía API externa con clave del
  usuario. Core puro nuevo: interfaz `Translator` + tipos + catálogo `PROVIDERS`
  (`src/core/services/translator.ts`); `planBatches`/`encodeBatch`/`decodeBatch`
  (array JSON, validación 1:1, `src/core/translation/batch.ts`) y `assembleTranslated`
  (ensamblado inmutable 1:1, timing intacto, `src/core/translation/assemble.ts`).
  Engines: `mockTranslator` (demo sin clave) + `llmAdapter` base + `groq` (proveedor MVP
  real) + registry `getTranslator` (resto stubs `provider-unavailable`); `fetch` SOLO en
  `src/engines/api/`. Settings BYOK (`settingsStore` con clave por proveedor en
  localStorage + `SettingsScreen`), navegación `screen:'settings'` sin router, y
  `TranslatePanel` en el Player (progreso por lote + errores accionables por `kind` +
  reintento de lo pendiente, FR-008). Sin dependencias nuevas. **71/71 tests verdes,
  build OK** (tsc estricto). Spec en `specs/003-translate-api-byok/`.

## En curso
- (nada)

## Hecho (cont.)
- **2026-06-15** — **003 — resto de proveedores API conectados** (antes solo Groq +
  stubs). LLM: `openai`/`deepseek` (config sobre `llmAdapter` estilo OpenAI),
  `anthropic` (Messages API) y `gemini` (`generateContent`, clave en URL) con
  `buildBody`/`extractContent` propios. MT nuevo `mtAdapter` + `google` (Translate v2) y
  `deepl` (array 1:1 nativo). Catálogo `PROVIDERS` todo `implemented:true`. **71/71 tests
  + build OK**. Validado en navegador (preview): pipeline mock US1 1:1/timing-intacto/
  origen-no-mutado, guard `no-key` en los 6 proveedores nuevos (sin red), Settings a
  360px (input clave, persistencia por proveedor sin pisar). Seguridad (D): clave solo en
  localStorage, cero `console.*`, nunca en bundle. **Pendiente**: DeepL no funciona desde
  el navegador (sin CORS) hasta que haya proxy; probar Groq/OpenAI/Anthropic/Gemini con
  clave real en teléfono (US1+US2+US3).

- **2026-06-15** — **Modo diagnóstico in-app** (pedido por el usuario: no puede pasar
  logs desde el móvil). `diagnosticsStore` (log capado + persistido en localStorage, así
  sobrevive al descarte de pestaña) + `installDiagnostics` (captura `window.error`,
  `unhandledrejection`, `console.error/warn`, y "app iniciada" por carga). `TranslationError`
  ahora lleva `detail` con el **payload crudo**; `decodeBatch`/`llmAdapter` lo rellenan y
  `TranslatePanel` lo loguea. Pantalla `DiagnosticsScreen` (ruta `screen:'diagnostics'`,
  acceso desde Settings) con lista + botón **Copiar** + textarea de texto plano (respaldo
  para copiar a mano en http LAN, sin portapapeles). Verificado en navegador: un bad-shape
  de japonés captura el array crudo → **se ve que el modelo fusiona líneas (2→1)**, causa
  probable del bug. 71/71 + build OK. (Pendiente: endurecer parser JP con datos reales.)
- **2026-06-15** — **003 bugfix (clave con espacios)**: un **espacio inicial** en la
  API key (típico al pegar en el móvil) rompía el header `Authorization` y el proveedor
  devolvía 401 → mensaje "clave inválida". Diagnosticado con la API real de DeepSeek
  (la clave era válida; con espacio inicial daba 401, sin él 200). Fix: `.trim()` a la
  clave antes de enviar en `llmAdapter` y `mtAdapter` (un solo punto, cubre los 7). 71/71
  + build OK.

## Siguiente
- **Validación 003 en teléfono** (quickstart.md): US2 persistencia de clave (recargar,
  cambiar proveedor sin pisar, borrar); US1 "Mock (demo)" → dual instantáneo; US1+US2
  proveedor real (Groq/OpenAI/Anthropic/Gemini) + clave real → traducción real 1:1; US3
  sin clave/clave inválida/red → mensaje accionable sin colgarse; Settings y panel usables
  a 360px. **Nota CORS**: DeepL fallará desde el navegador (sin proxy).
- **Spec 004 — Pipeline ASR (audio → texto con timestamps)**: extracción de audio +
  transcripción (Whisper u otro) para cubrir el caso "no tengo ningún subtítulo".
  Reusa la interfaz de engines y el formato DualSub. (Antes era el resto de la 003;
  se acotó la 003 a solo traducción.)
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
- **000** — Formato DualSub JSON v1 + modelos + sync (tests) ✅
- **001** — Player dual con datos mock (overlay horizontal + lista vertical con
  highlight/autoscroll, offset) ✅ (pendiente menor: re-verificar overlay/offset y B2 en teléfono)
- **002** — Import: video + detección sidecar .srt/.vtt + parsers + merge dual ✅
- **003** — Traducción vía API (BYOK): rellenar destino 1:1 con clave del usuario ✅
  (validado en teléfono; 7 proveedores; auto-bisección 1:1; modo diagnóstico)
- **004** — Pipeline ASR (audio → texto con timestamps) para el caso "no tengo
  ningún subtítulo" (antes era el resto de la 003; se acotó la 003 a traducción).
