/**
 * Carga compartida de ffmpeg.wasm (monohilo, sin COOP/COEP): una sola instancia
 * para el extractor de audio (spec 008) y el exportador de video (spec 009).
 * Core bajo demanda desde CDN vía `toBlobURL` (blob same-origin, evita CORS).
 * Sirve para Netlify estático y el WebView de Capacitor.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

const CORE_VERSION = '0.12.10'
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`

/** Falla la carga del motor (red/CDN). El mensaje ya es apto para UI. */
export class FFmpegLoadError extends Error {
  constructor(public detail?: string) {
    super('No se pudo cargar el motor de video (ffmpeg).')
    this.name = 'FFmpegLoadError'
  }
}

let ffmpegPromise: Promise<FFmpeg> | null = null

/** Carga (una sola vez) e inicializa ffmpeg.wasm monohilo. */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg()
      try {
        await ffmpeg.load({
          coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
        })
      } catch (e) {
        ffmpegPromise = null // permite reintentar una carga fallida
        throw new FFmpegLoadError(String(e))
      }
      return ffmpeg
    })()
  }
  return ffmpegPromise
}
