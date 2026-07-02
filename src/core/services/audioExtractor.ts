/**
 * Interfaz AudioExtractor (spec 008): separa/comprime el audio de un video del lado
 * cliente para no subir el video entero al proveedor de transcripción. Es la interfaz
 * `AudioExtractor` anticipada por la constitución (Principio II). PURA: la firma NO usa
 * `fetch` (la implementación real con ffmpeg.wasm vive en `src/engines/api`); usa `Blob`
 * como los tipos de `Transcriber`. Intercambiable: ffmpeg.wasm hoy, plugin nativo tras
 * migrar a Capacitor, `mock` en desarrollo/tests de UI.
 */

/** Audio extraído del video, listo para transcribir. No se persiste (FR-014). */
export interface ExtractedAudio {
  /** mp3 mono 16 kHz. Vive en memoria mientras dure el trabajo. */
  blob: Blob
  /** Duración total del audio en ms enteros. */
  durationMs: number
  /** Tamaño del blob; decide envío único vs troceo. */
  sizeBytes: number
}

export type AudioExtractErrorKind =
  | 'load' // no se pudo cargar/inicializar el extractor (ffmpeg.wasm)
  | 'no-audio' // el video no trae pista de audio utilizable
  | 'decode' // formato/contenedor no decodificable en el cliente
  | 'oom' // memoria insuficiente durante la extracción

/** Error tipado del extractor (paralelo a `TranscriptionError`). */
export class AudioExtractError extends Error {
  kind: AudioExtractErrorKind
  /** [diag] Contexto crudo para diagnóstico; no se muestra al usuario. */
  detail?: string
  constructor(kind: AudioExtractErrorKind, message?: string, detail?: string) {
    super(message ?? kind)
    this.name = 'AudioExtractError'
    this.kind = kind
    this.detail = detail
  }
}

export interface AudioExtractor {
  /**
   * Extrae y comprime el audio de `media` a mono 16 kHz (mp3). No cachea: el blob
   * resultante vive hasta que quien llama lo suelte. `onProgress` reporta 0..1.
   * Lanza `AudioExtractError`; nunca cuelga.
   */
  extract(media: Blob, onProgress?: (ratio01: number) => void): Promise<ExtractedAudio>

  /**
   * Recorta el tramo `[startMs, endMs)` del audio ya extraído y devuelve un blob
   * transcribible por sí mismo (mismo formato). Lo usa el pipeline para cada parte
   * (con solape). Clampa a `[0, durationMs]`.
   */
  slice(audio: ExtractedAudio, startMs: number, endMs: number): Promise<Blob>
}
