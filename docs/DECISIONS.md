# DECISIONS — DualSub

> Log de decisiones. Una línea por decisión, con fecha. Lo más reciente arriba.

- **2026-07-02** — **Dep `@ffmpeg/ffmpeg` + `@ffmpeg/util` (ffmpeg.wasm) — spec 008**.
  Revierte el "sin extracción de audio" de la 005: ahora se extrae SIEMPRE el audio del
  video en el cliente (mono 16 kHz mp3) y se trocea por tiempo bajo el límite del proveedor,
  para transcribir videos largos (26 min+) que antes se rechazaban. Se usa el **core monohilo**
  (sin `SharedArrayBuffer` → sin cabeceras COOP/COEP en Netlify ni en el WebView de Capacitor).
  Detrás de la interfaz `AudioExtractor` (core/services) intercambiable (ffmpeg | mock | nativo
  futuro). Coste: ~10-15 MB de wasm descargados la 1.ª vez (lazy, cacheable).
- **2026-06-18** — **Spec 005 (ASR) — proveedor Whisper y "sin extracción de audio"**.
  El roadmap decía "Whisper vía OpenRouter", pero **OpenRouter NO ofrece transcripción de
  audio** (es un router de LLM/multimodal de texto), así que se descartó. Se usa **Groq
  `whisper-large-v3-turbo`** (rápido, barato, endpoint compatible con OpenAI
  `audio/transcriptions`, **reusa la clave Groq** que ya existe para traducción) + **OpenAI
  `whisper-1`** como alternativa, sobre un único `whisperAdapter` (multipart + `verbose_json`
  → segmentos con tiempos). **Sin extracción de audio en el navegador**: se sube el video
  tal cual y el proveedor extrae el audio; evita una dependencia pesada (ffmpeg.wasm). Coste
  práctico: archivos grandes pueden ser rechazados (~25 MB) → la UI avisa y mapea `413` a
  `too-large`. Interfaz pura `Transcriber` (core) + conversión testeada `buildFromTranscript`;
  red solo en `engines/api`. Sin dependencias nuevas.
- **2026-06-18** — **Spec 004 implementada (persistencia local + biblioteca)**. Almacenamiento
  = **IndexedDB nativo** (sin `idb`) tras un puerto `ProjectStore` (interfaz pura en
  `core/services`, adaptadores `idbProjectStore` + `memoryProjectStore` fallback FR-012), para
  migrar a nativo (Capacitor/RN) sin tocar UI/core. **Modo ligero por defecto** (doc + offset +
  posición, sin video) + interruptor **opt-in** "guardar el video en el navegador" en Settings;
  ante cuota se **degrada a ligero** sin perder subtítulos (`SaveResult.degradedToLight`).
  Auto-guardado **debounced** suscrito al Player. **Derivar pares por el inglés base**
  (`combineByPivot`/`selectPair`, core puro testeado): de EN/ES + EN/JA → ES/JA al instante,
  sin traducir y con tiempos intactos. Sin dependencias nuevas.
- **2026-06-15** — **Auto-bisección 1:1** ante `bad-shape` por fusión de líneas del LLM
  (diagnosticado con log real: japonés devolvía 39/40 porque el modelo une cláusulas).
  Helper puro `translateWithBisect` (core, testeado) parte el lote en mitades y reintenta
  hasta lograr 1:1 o llegar a 1 línea; solo reintenta `bad-shape` (auth/red se propagan).
  Prompt reforzado ("EXACTAMENTE N, sin combinar ni dividir"). Solo en `llmAdapter` (la
  familia MT ya devuelve 1:1 nativo).
- **2026-06-15** — **Modo diagnóstico in-app** (el usuario no puede pasar logs del móvil):
  log capado + persistido en localStorage (sobrevive al descarte de pestaña), captura de
  errores globales/console + payload crudo de fallos de traducción, pantalla copiable.
  Convención: la instrumentación de logging incrustada en código de producto se marca con
  la etiqueta **`[diag]`** (grep para encontrarla y optimizarla/quitarla); los archivos
  del feature también la llevan en su cabecera.
- **2026-06-15** — Conectados los 7 proveedores reales (antes solo Groq + stubs):
  **LLM** — OpenAI y DeepSeek reusan el `llmAdapter` estilo OpenAI tal cual; **Anthropic**
  (Messages API: `system` aparte, `max_tokens`, `content[].text`) y **Gemini**
  (`generateContent`, clave en la URL) aportan `buildBody`/`extractContent` propios sobre
  el mismo adaptador (D7). **MT** — Google Translate y DeepL sobre un `mtAdapter` nuevo
  (reciben array y devuelven 1:1 nativo, sin prompt; validación de longitud 1:1). Modelos
  baratos por defecto (gpt-4o-mini, claude-haiku-4-5, gemini-2.0-flash, deepseek-chat).
  **CORS**: como la app es solo-navegador (sin backend), cada API debe permitir llamadas
  directas — Anthropic lo habilita con `anthropic-dangerous-direct-browser-access`;
  **DeepL NO envía CORS**, así que en la web v0.1 fallará con error de red hasta que haya
  un proxy (queda implementado y anotado). Sin dependencias nuevas.
- **2026-06-14** — Spec 003 implementada (traducción BYOK). Protocolo de lote =
  **array JSON** (no conteo de líneas): robusto con subtítulos multilínea; `decodeBatch`
  valida `length` 1:1 (D2). Proveedor MVP real = **Groq** (familia LLM, API compatible
  OpenAI chat-completions) sobre un `llmAdapter` base reutilizable (D7); resto del
  catálogo son stubs incrementales. Clave **por proveedor** solo en `localStorage`
  (escritura explícita, sin middleware; D6). `fetch` solo en `src/engines/api`. Sin
  dependencias nuevas (fetch nativo).
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
- **2026-07-01** — Formato DualSub v2 multi-pista (spec 007): pistas con id/idioma/
  etiqueta + pista maestra que fija el timing (la transcripción manda); varias
  traducciones por idioma; migración v1→v2 al parsear (sin migración de datos en
  IDB). La vista Arriba/Abajo es estado de proyecto, no del documento.
- **2026-07-01** — La traducción parte SIEMPRE de la pista maestra (no de otra
  traducción) y el destino se elige al traducir (dropdown en el Player), no al
  importar: muere el `targetLang` placeholder de la 002.
- **2026-07-02** — **Capacitor Android** (deps nuevas: `@capacitor/core`,
  `@capacitor/android`, `@capacitor/cli`): APK cáscara con `server.url` → Netlify
  (`dualsub-rdm.netlify.app`); se actualiza con cada push sin recompilar. React
  Native descartado por ahora (reescribir la UI no compensa; se reevalúa si
  PiP/Chromecast se vuelven centrales). Instrucciones: `docs/ANDROID.md`.
- **2026-07-02** — **Export .mp4** (spec 009, sin deps nuevas: reusa ffmpeg.wasm de
  la 008): modo «pista» = mov_text con `-c copy` (segundos, sin pérdida, lo muestran
  VLC/TVs) por defecto; modo «quemado» experimental (recodifica; si el core wasm no
  trae el filtro `subtitles`, error honesto). El .srt exporta el par visible con el
  offset aplicado.
- **2026-07-02** — **YouTube experimental** (pre-006): pantalla con el IFrame Player
  API oficial como reloj (rAF + `getCurrentTime`) y los subtítulos del proyecto
  abierto bajo el iframe (overlay táctil sobre iframe no es fiable). Sin proxy de
  captions aún; no se descarga nada de YouTube.
