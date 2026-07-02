# Spec 009 — Export .mp4 + app Android (Capacitor) + YouTube beta

> Escrita a posteriori del núcleo implementado el 2026-07-02 (sesión autónoma
> acordada con el usuario). Recoge decisiones y alcance; el detalle fino de QA
> queda para la validación en teléfono real.

## Por qué
- **Compartir**: el valor del doble subtítulo hoy muere en el navegador. Un
  .mp4 con los subtítulos dentro se manda a familia/amigos o se ve en la TV
  sin explicar nada (motivación del usuario, 2026-07-02).
- **Móvil de verdad**: la vista horizontal en el navegador es mala (barra del
  navegador + el fullscreen nativo del `<video>` oculta el overlay). Una app
  Android (WebView sin barra + fullscreen del contenedor, fix B2) lo resuelve.
- **YouTube**: primer paso tangible del Camino A (006) sin backend todavía.

## Alcance (US)
- **US1 — Export**: desde el Player, descargar (a) `.mp4` con el par visible
  (Arriba/Abajo + offset aplicado) como pista `mov_text` sin recodificar
  (rápido, sin pérdida; VLC/TV); (b) `.mp4` con subtítulos QUEMADOS
  (experimental: recodifica; puede no estar soportado por el core wasm → error
  honesto); (c) solo el `.srt` dual.
- **US2 — Android**: APK Capacitor cáscara que carga `https://dualsub-rdm.netlify.app`
  (`server.url`): un push a main = app actualizada, sin recompilar. Build local
  documentado en `docs/ANDROID.md` (OpenJDK 21 + SDK en `~/Library/Android/sdk`).
- **US3 — YouTube (beta)**: pantalla que reproduce una URL de YouTube con el
  IFrame Player API oficial y muestra el doble subtítulo del proyecto ABIERTO
  bajo el video (rAF + `getCurrentTime` como reloj, offset reutilizado). Sin
  proxy de captions (se decidirá aparte); no se descarga nada de YouTube.
- **US4 — Lista completa**: toggle en el Player que oculta el video (sin
  desmontarlo: el audio sigue) para leer/scrollear todo el diálogo.

## Arquitectura
- Core puro: `core/export/subtitleExport.ts` (`buildDualSrt`, `formatSrtTime`)
  con tests (`tests/core/subtitleExport.test.ts`).
- Engines: `engines/api/ffmpegRuntime.ts` (carga única de ffmpeg.wasm,
  compartida con el extractor de la 008) + `engines/api/ffmpegVideoExporter.ts`
  (`exportVideoWithSubs(video, srt, 'track'|'burn')`, errores tipados
  `load|unsupported|failed`).
- UI: `screens/Player/ExportPanel.tsx` (plegado por defecto),
  `screens/YouTube/YouTubeScreen.tsx` (+ `screen: 'youtube'`), toggle en
  `PlayerScreen`.
- Nativo: `capacitor.config.ts` + `android/` versionado (`local.properties` no).

## No-objetivos (por ahora)
- Proxy de captions de YouTube (spec 006), overlay táctil sobre el iframe,
  firma/release del APK, plugin nativo de descargas, quemado con estilos.

## Validación pendiente (teléfono real)
- Instalar `app-debug.apk`, flujo completo (import → ASR 008 → traducir →
  export), descarga del .mp4 desde el WebView, YouTube beta con un proyecto
  del mismo video.
