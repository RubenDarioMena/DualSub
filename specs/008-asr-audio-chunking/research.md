# Phase 0 — Research: ASR de videos grandes/largos

Todas las incógnitas técnicas del Technical Context resueltas. Formato: Decisión / Razón / Alternativas.

## R1. Motor de extracción de audio en el cliente

- **Decisión**: `@ffmpeg/ffmpeg` v0.12.x con **core monohilo** (`@ffmpeg/core`), cargado bajo demanda (lazy) solo al transcribir. Comando tipo `-i input -vn -ac 1 -ar 16000 -c:a libmp3lame -b:a 64k out.mp3` (mono, 16 kHz, mp3 ~64 kbps).
- **Razón**: el core monohilo **no requiere** `SharedArrayBuffer` ni cabeceras COOP/COEP → funciona en Netlify estático y en el WebView de Capacitor sin tocar el hosting. mp3 mono 16 kHz a 64 kbps ≈ **8 KB/s** → 26 min ≈ **12,5 MB** (por debajo del límite; muchos videos irán en un solo envío). ffmpeg procesa por streaming interno → RAM acotada.
- **Alternativas**:
  - *Core multihilo (`@ffmpeg/core-mt`)*: más rápido, pero exige COOP/COEP (romper embeds, config de hosting, incompatibilidad con algunos WebViews). Rechazado por fricción y portabilidad a Capacitor.
  - *WebAudio (`decodeAudioData`/`OfflineAudioContext`) + WAV*: sin dependencia pesada, pero mete todo el PCM en RAM (cientos de MB en videos largos → cuelga en móvil) y WAV no comprime (26 min ≈ 50 MB → trocear siempre). Rechazado (frágil en móvil).
  - *`MediaRecorder` sobre `captureStream`*: graba en tiempo real (26 min = 26 min de espera). Rechazado.

📎 Detalle: el `@ffmpeg/core` se sirve como assets (wasm+js); se cargan con `toBlobURL` desde el propio origen para evitar CORS. Tamaño ~10-15 MB descargados la 1.ª vez (cacheables por el navegador).

## R2. Formato/códec de salida del audio

- **Decisión**: **mp3 mono 16 kHz ~64 kbps** (por trozo o completo).
- **Razón**: Whisper (Groq/OpenAI) acepta mp3; mono 16 kHz es el formato nativo del modelo (misma o mejor precisión, mínimo tamaño). libmp3lame viene en los builds de ffmpeg.wasm.
- **Alternativas**: *opus/webm* (más eficiente aún) — soportado por OpenAI pero con más matices de contenedor; mp3 es el más universal y simple. *WAV 16 kHz* — sin compresión, descartado por tamaño.

## R3. Umbrales de troceo y solape

- **Decisión**: `SINGLE_MAX_BYTES ≈ 24 MB` (si el audio cabe → un envío). Si no, `TARGET_CHUNK_BYTES ≈ 20 MB`, `N = ceil(sizeBytes / TARGET_CHUNK_BYTES)`, trozos de **duración igual** `chunkMs = ceil(durationMs / N)`, con **solape `OVERLAP_MS = 2000`** (cada trozo se extrae desde `start-overlap` hasta `end+overlap`, clampeado a [0, durationMs]).
- **Razón**: margen bajo el límite real de 25 MB del proveedor para cubrir variación de bitrate y overhead del multipart. Trocear por **tiempo** (no por bytes) es lo único que produce audio reproducible/transcribible; como el bitrate es fijo tras R2, los MB por trozo son ≈ proporcionales al tiempo → predecible. Solape de 2 s evita cortar palabras en la frontera.
- **Alternativas**: *cortar en silencios* (mejor calidad, más complejo y variable) — descartado en clarify. *Solape 5 s* — más seguro pero más recomputo y más de-duplicación; 2 s basta.
- **Constantes afinables** en implementación; el límite es del proveedor y puede cambiar.

## R4. Umbral de aviso para videos largos (FR-013)

- **Decisión**: sin tope duro. Si `N > WARN_CHUNKS` (p. ej. **> 3 partes**), la UI muestra "esto son N envíos, puede tardar y consumir tu cuota" y **pide confirmación** antes de arrancar el bucle de transcripción.
- **Razón**: protege de sorpresas de tiempo/gasto sin bloquear casos válidos; N≤3 (≈ hasta ~1 h de audio) arranca directo.
- **Alternativas**: *tope duro por duración* (corta casos válidos) — descartado. *Sin aviso* — riesgo de gasto sorpresa — descartado.

## R5. Re-ensamblado y de-duplicación del solape

- **Decisión**: `mergeChunkTranscripts` (PURO): para cada trozo `k`, desplazar los tiempos de sus segmentos por `chunkStartMs[k]` (offset absoluto en el video). Al unir trozos vecinos, **descartar** los segmentos del trozo siguiente cuyo inicio caiga dentro de la zona de solape ya cubierta por el trozo anterior (regla: cortar en el punto medio del solape; conservar del trozo previo lo ≤ midpoint y del siguiente lo > midpoint). Resultado ordenado por `startMs`, ms enteros, sin solapes de intervalos.
- **Razón**: elimina duplicados manteniendo continuidad; el punto medio reparte el riesgo de palabra cortada. Determinista y testeable con fixtures.
- **Alternativas**: *fuzzy text-match del solape* (más preciso, mucho más complejo) — sobreingeniería para v1; se puede iterar si aparecen duplicados.

## R6. Reintento por parte sin perder lo hecho (FR-007)

- **Decisión**: el orquestador mantiene un array `results[k]` con el estado por trozo (`pending|ok|failed`). Ante fallo de un trozo lanza señalando el índice y **conserva** los `ok`. La UI ofrece "reintentar", que reanuda **desde el primer trozo no-ok** (no re-extrae ni re-transcribe los ok). El audio extraído se mantiene en memoria durante el trabajo en curso (no es caché persistente; se descarta al terminar/cancelar → FR-014).
- **Razón**: evita reprocesar (tiempo/datos/cuota) y cumple "sin perder lo ya transcrito". Al cancelar/salir se libera.
- **Alternativas**: *reiniciar todo ante cualquier fallo* — caro en videos largos — descartado.

## R7. Sin caché del audio (FR-014)

- **Decisión**: el `ExtractedAudio` (y los blobs de trozo) viven solo mientras corre el pipeline; no se persisten en memoria entre trabajos ni en IndexedDB. Un reintento del trabajo **completo** re-extrae.
- **Razón**: minimiza RAM/almacenamiento en el teléfono; simplicidad. Re-extraer cuesta segundos.
- **Alternativas**: caché en memoria/IndexedDB — descartadas en clarify.

## R8. Manejo de "sin audio" / formato no soportado (FR-008)

- **Decisión**: si ffmpeg no encuentra pista de audio o falla la decodificación, el extractor lanza `AudioExtractError('no-audio' | 'decode' | 'load')`; la UI lo traduce a mensaje accionable.
- **Razón**: errores tipados como el `TranscriptionError` existente → mensajes claros, sin fallos opacos.
