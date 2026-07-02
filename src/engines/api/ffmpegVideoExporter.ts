/**
 * Exportador de video con subtítulos (spec 009). Vive en engines (constitución I).
 * Dos modos sobre ffmpeg.wasm monohilo (compartido con el extractor de la 008):
 *  - 'track': incrusta el .srt como pista `mov_text` SIN recodificar (-c copy):
 *    segundos, sin pérdida. VLC/TVs/players la muestran; WhatsApp no.
 *  - 'burn'  (experimental): quema los subtítulos en la imagen (recodifica:
 *    lento). Depende de que el core wasm traiga el filtro `subtitles`; si no,
 *    fallamos con un mensaje honesto ('unsupported').
 */
import { fetchFile } from '@ffmpeg/util'
import { FFmpegLoadError, getFFmpeg } from './ffmpegRuntime'

export type ExportMode = 'track' | 'burn'
export type ExportErrorKind = 'load' | 'unsupported' | 'failed'

export class VideoExportError extends Error {
  constructor(
    public kind: ExportErrorKind,
    message: string,
    public detail?: string,
  ) {
    super(message)
    this.name = 'VideoExportError'
  }
}

const IN = 'export-in.mp4'
const SUBS = 'export-subs.srt'
const OUT = 'export-out.mp4'

/**
 * Devuelve un .mp4 con los subtítulos incrustados según `mode`. `onProgress`
 * recibe 0..1 (en 'track' es casi instantáneo; en 'burn', minutos).
 */
export async function exportVideoWithSubs(
  video: Blob,
  srt: string,
  mode: ExportMode,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  let ffmpeg
  try {
    ffmpeg = await getFFmpeg()
  } catch (e) {
    const detail = e instanceof FFmpegLoadError ? e.detail : String(e)
    throw new VideoExportError('load', 'No se pudo cargar el motor de video (ffmpeg).', detail)
  }

  const logs: string[] = []
  const onLog = ({ message }: { message: string }) => {
    logs.push(message)
    if (logs.length > 80) logs.shift()
  }
  const onProg = onProgress
    ? ({ progress }: { progress: number }) => onProgress(Math.min(1, Math.max(0, progress)))
    : null

  ffmpeg.on('log', onLog)
  if (onProg) ffmpeg.on('progress', onProg)
  try {
    await ffmpeg.writeFile(IN, await fetchFile(video))
    await ffmpeg.writeFile(SUBS, new TextEncoder().encode(srt))

    const args =
      mode === 'track'
        ? // Copia video+audio tal cual y añade la pista de subtítulos mov_text.
          ['-i', IN, '-i', SUBS, '-map', '0', '-map', '1:0', '-c', 'copy', '-c:s', 'mov_text', OUT]
        : // Quemado: recodifica el video con el filtro subtitles (si existe).
          ['-i', IN, '-vf', `subtitles=${SUBS}`, '-c:a', 'copy', '-preset', 'ultrafast', OUT]

    const code = await ffmpeg.exec(args)
    if (code !== 0) {
      const detail = logs.join('\n')
      if (mode === 'burn' && /No such filter|Unable to open|libass|Fontconfig/i.test(detail)) {
        throw new VideoExportError(
          'unsupported',
          'Este navegador/motor no soporta quemar subtítulos en la imagen. Usa el modo "pista incrustada".',
          detail,
        )
      }
      throw new VideoExportError(
        'failed',
        mode === 'track'
          ? 'No se pudo incrustar la pista. Suele pasar con formatos que no son .mp4 (p. ej. .webm/.mkv).'
          : 'No se pudo quemar los subtítulos en este video.',
        detail,
      )
    }

    const data = (await ffmpeg.readFile(OUT)) as Uint8Array
    if (!data || data.byteLength === 0) {
      throw new VideoExportError('failed', 'El export produjo un archivo vacío.')
    }
    onProgress?.(1)
    return new Blob([data as unknown as BlobPart], { type: 'video/mp4' })
  } catch (e) {
    if (e instanceof VideoExportError) throw e
    throw new VideoExportError('failed', 'Fallo inesperado durante el export.', String(e))
  } finally {
    ffmpeg.off('log', onLog)
    if (onProg) ffmpeg.off('progress', onProg)
    await ffmpeg.deleteFile(IN).catch(() => {})
    await ffmpeg.deleteFile(SUBS).catch(() => {})
    await ffmpeg.deleteFile(OUT).catch(() => {})
  }
}
