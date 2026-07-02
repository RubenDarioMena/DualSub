/**
 * AudioExtractor real con ffmpeg.wasm (spec 008). Vive en engines (constitución I):
 * separa el audio del video a mp3 mono 16 kHz y recorta tramos por tiempo. Usa el core
 * MONOHILO (sin SharedArrayBuffer → sin cabeceras COOP/COEP), cargado bajo demanda desde
 * CDN vía `toBlobURL` (blob same-origin, evita problemas de CORS). No cachea el audio:
 * el blob devuelto vive en el trabajo que lo pide (FR-014).
 */
import { fetchFile } from '@ffmpeg/util'
import {
  AudioExtractError,
  type AudioExtractor,
  type ExtractedAudio,
} from '../../core/services/audioExtractor'
import { FFmpegLoadError, getFFmpeg as getSharedFFmpeg } from './ffmpegRuntime'

/** ffmpeg compartido (ffmpegRuntime), con el error tipado de este puerto. */
async function getFFmpeg() {
  try {
    return await getSharedFFmpeg()
  } catch (e) {
    const detail = e instanceof FFmpegLoadError ? e.detail : String(e)
    throw new AudioExtractError('load', 'No se pudo cargar el motor de audio (ffmpeg).', detail)
  }
}

/** Lee la duración del audio con un elemento <audio> (metadata). */
function readDurationMs(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const audio = new Audio()
    audio.preload = 'metadata'
    const done = (ms: number) => {
      URL.revokeObjectURL(url)
      resolve(ms)
    }
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0)
    audio.onerror = () => done(0)
    audio.src = url
  })
}

const IN = 'input.bin'
const OUT = 'audio.mp3'

export const ffmpegAudioExtractor: AudioExtractor = {
  async extract(media, onProgress) {
    const ffmpeg = await getFFmpeg()
    const onLog = onProgress ? ({ progress }: { progress: number }) => onProgress(Math.min(1, Math.max(0, progress))) : null
    if (onLog) ffmpeg.on('progress', onLog)
    try {
      await ffmpeg.writeFile(IN, await fetchFile(media))
      // -vn: sin video · -ac 1: mono · -ar 16000: 16 kHz · mp3 ~64 kbps
      const code = await ffmpeg.exec(['-i', IN, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', OUT])
      if (code !== 0) throw new AudioExtractError('decode', 'ffmpeg no pudo extraer el audio.', `exit ${code}`)
      const data = (await ffmpeg.readFile(OUT)) as Uint8Array
      if (!data || data.byteLength === 0) throw new AudioExtractError('no-audio', 'El video no tiene audio utilizable.')
      const blob = new Blob([data as unknown as BlobPart], { type: 'audio/mpeg' })
      const durationMs = await readDurationMs(blob)
      onProgress?.(1)
      return { blob, durationMs, sizeBytes: blob.size } satisfies ExtractedAudio
    } catch (e) {
      if (e instanceof AudioExtractError) throw e
      throw new AudioExtractError('decode', 'Fallo al procesar el audio del video.', String(e))
    } finally {
      if (onLog) ffmpeg.off('progress', onLog)
      await ffmpeg.deleteFile(IN).catch(() => {})
      await ffmpeg.deleteFile(OUT).catch(() => {})
    }
  },

  async slice(audio, startMs, endMs) {
    const ffmpeg = await getFFmpeg()
    const start = Math.max(0, startMs) / 1000
    const end = Math.min(audio.durationMs, endMs) / 1000
    const src = 'slice-src.mp3'
    const dst = `slice-${Math.round(start * 1000)}-${Math.round(end * 1000)}.mp3`
    try {
      await ffmpeg.writeFile(src, await fetchFile(audio.blob))
      // -ss/-to en segundos; -c copy: corte rápido sin recodificar.
      const code = await ffmpeg.exec(['-ss', `${start}`, '-to', `${end}`, '-i', src, '-c', 'copy', dst])
      if (code !== 0) throw new AudioExtractError('decode', 'ffmpeg no pudo recortar el audio.', `exit ${code}`)
      const data = (await ffmpeg.readFile(dst)) as Uint8Array
      return new Blob([data as unknown as BlobPart], { type: 'audio/mpeg' })
    } catch (e) {
      if (e instanceof AudioExtractError) throw e
      throw new AudioExtractError('decode', 'Fallo al recortar el audio.', String(e))
    } finally {
      await ffmpeg.deleteFile(src).catch(() => {})
      await ffmpeg.deleteFile(dst).catch(() => {})
    }
  },
}
