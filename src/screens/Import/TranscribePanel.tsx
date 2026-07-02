/**
 * Panel de transcripción (ASR) en el Import: para el caso "tengo el video pero NO tengo
 * subtítulos". Elige el idioma hablado y ejecuta el PIPELINE (spec 008): extraer el audio
 * en el cliente (ffmpeg.wasm; mock en demo) → trocear si excede el límite del proveedor →
 * transcribir cada parte → re-ensamblar. Muestra progreso k/N, pide confirmación si son
 * muchas partes (FR-013) y permite reintentar una parte fallida sin perder lo hecho
 * (FR-007). La red/ffmpeg viven en `engines`; aquí solo orquestamos la UI.
 */
import { useRef, useState } from 'react'
import type { MediaRef } from '../../core/services/projectStore'
import { LANG_CODES, type LangCode } from '../../core/models'
import { getTranscriberInfo, TranscriptionError } from '../../core/services/transcriber'
import { AudioExtractError } from '../../core/services/audioExtractor'
import {
  createTranscriptionJob,
  PipelineAbort,
  type PipelineProgress,
  type TranscriptionJob,
} from '../../core/transcription/pipeline'
import { getAudioExtractor, getTranscriber } from '../../engines/api'
import { buildFromTranscript } from '../../core/transcription/buildFromTranscript'
import { usePlayerStore } from '../../state/playerStore'
import { useSettingsStore } from '../../state/settingsStore'
import { diag } from '../../state/diagnosticsStore'
import { LANG_LABEL } from '../shared/langLabels'

type Status = 'idle' | 'running' | 'error'
type ErrorAction = 'retry' | 'settings' | 'none'

export default function TranscribePanel({
  videoUrl,
  videoBlob,
  videoRef,
}: {
  videoUrl: string
  videoBlob: Blob | null
  videoRef: MediaRef | null
}) {
  const loadProject = usePlayerStore((s) => s.loadProject)
  const setScreen = usePlayerStore((s) => s.setScreen)
  const asrProvider = useSettingsStore((s) => s.asrProvider)
  const keys = useSettingsStore((s) => s.keys)

  const [lang, setLang] = useState<LangCode>('en')
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<PipelineProgress | null>(null)
  const [error, setError] = useState<{ message: string; action: ErrorAction } | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<{ n: number; resolve: (ok: boolean) => void } | null>(null)
  const jobRef = useRef<TranscriptionJob | null>(null)

  const info = getTranscriberInfo(asrProvider)
  const sizeMb = videoBlob ? videoBlob.size / (1024 * 1024) : 0

  // Ejecuta (o reanuda) el trabajo y aterriza en el Player si tiene éxito.
  const execute = async (job: TranscriptionJob) => {
    try {
      const result = await job.run()
      const doc = buildFromTranscript(result, info.label)
      loadProject({ doc, mediaUrl: videoUrl, mediaRef: videoRef, mediaBlob: videoBlob })
      diag('info', `ASR OK: ${result.segments.length} segmentos (${asrProvider})`)
    } catch (e) {
      if (e instanceof PipelineAbort) {
        setStatus('idle')
        setProgress(null)
        return
      }
      const { message, action } = describeError(e)
      setError({ message, action })
      setStatus('error')
      diag('error', `ASR pipeline (${asrProvider}): ${message}`, e instanceof Error ? e.stack : String(e))
    }
  }

  const run = async () => {
    if (!videoBlob) {
      setError({ message: 'No se encontró el archivo de video.', action: 'none' })
      setStatus('error')
      return
    }
    setStatus('running')
    setError(null)
    setProgress(null)
    const mode = asrProvider === 'mock' ? 'mock' : 'ffmpeg'
    diag('info', `ASR pipeline: ${asrProvider} (${info.model}) · ${lang} · ${sizeMb.toFixed(1)} MB · extractor ${mode}`)
    const job = createTranscriptionJob({
      extractor: getAudioExtractor(mode),
      transcriber: getTranscriber(asrProvider),
      media: videoBlob,
      filename: videoRef?.name ?? 'video',
      lang,
      apiKey: keys[asrProvider],
      onProgress: setProgress,
      confirmChunks: (n) => new Promise<boolean>((resolve) => setPendingConfirm({ n, resolve })),
    })
    jobRef.current = job
    await execute(job)
  }

  // Reintenta reanudando el trabajo en curso (no re-extrae ni re-transcribe lo ok).
  const retry = async () => {
    if (!jobRef.current) return run()
    setStatus('running')
    setError(null)
    await execute(jobRef.current)
  }

  const onConfirm = (ok: boolean) => {
    pendingConfirm?.resolve(ok)
    setPendingConfirm(null)
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-3">
      <div>
        <h2 className="text-sm font-medium text-neutral-200">¿No tienes subtítulos?</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Genera los subtítulos a partir del audio del video con {info.label}. Extraemos solo el
          audio en tu dispositivo, así que también funciona con videos largos.
        </p>
      </div>

      <label className="flex items-center justify-between gap-2 text-xs text-neutral-400">
        Idioma hablado en el audio
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as LangCode)}
          disabled={status === 'running'}
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-100 disabled:opacity-50"
        >
          {LANG_CODES.map((l) => (
            <option key={l} value={l}>
              {LANG_LABEL[l]}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={run}
        disabled={status === 'running'}
        className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white active:bg-violet-700 disabled:bg-neutral-800 disabled:text-neutral-500"
      >
        {status === 'running' ? progressText(progress) : 'Transcribir audio'}
      </button>

      {/* Confirmación cuando el audio se envía en muchas partes (FR-013). */}
      {pendingConfirm && (
        <div className="flex flex-col gap-2 rounded-md bg-amber-950/50 px-3 py-2 text-xs text-amber-200">
          <span>
            Este audio se enviará en {pendingConfirm.n} partes: puede tardar y consumir tu cuota del
            proveedor. ¿Continuar?
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onConfirm(true)}
              className="rounded-md bg-amber-700/70 px-3 py-1.5 font-medium text-amber-50 active:bg-amber-700"
            >
              Continuar
            </button>
            <button
              type="button"
              onClick={() => onConfirm(false)}
              className="rounded-md border border-amber-700/60 px-3 py-1.5 text-amber-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {status === 'error' && error && (
        <div className="flex flex-col gap-2 rounded-md bg-rose-950/50 px-3 py-2 text-xs text-rose-200">
          <span>{error.message}</span>
          {error.action !== 'none' && (
            <div className="flex gap-2">
              {error.action === 'settings' ? (
                <button
                  type="button"
                  onClick={() => setScreen('settings')}
                  className="rounded-md bg-rose-800/60 px-3 py-1.5 font-medium text-rose-100 active:bg-rose-800"
                >
                  Ir a Settings
                </button>
              ) : (
                <button
                  type="button"
                  onClick={retry}
                  className="rounded-md bg-rose-800/60 px-3 py-1.5 font-medium text-rose-100 active:bg-rose-800"
                >
                  Reintentar
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** Texto de la fase actual para el botón (móvil-first). */
function progressText(p: PipelineProgress | null): string {
  if (!p) return 'Procesando…'
  const kOfN = p.chunkCount && p.chunkCount > 1 ? `Parte ${(p.chunkIndex ?? 0) + 1} de ${p.chunkCount}: ` : ''
  switch (p.stage) {
    case 'extracting':
      return p.ratio01 != null ? `Extrayendo audio… ${Math.round(p.ratio01 * 100)}%` : 'Extrayendo audio…'
    case 'planning':
      return 'Preparando…'
    case 'awaiting-confirm':
      return 'Esperando confirmación…'
    case 'uploading':
      return `${kOfN}subiendo…`
    case 'transcribing':
      return `${kOfN}transcribiendo…`
    case 'assembling':
      return 'Uniendo subtítulos…'
    case 'done':
      return 'Listo'
  }
}

/** Traduce el error a mensaje accionable + qué botón ofrecer. */
function describeError(e: unknown): { message: string; action: ErrorAction } {
  if (e instanceof AudioExtractError) {
    switch (e.kind) {
      case 'load':
        return { message: 'No se pudo cargar el motor de audio. Revisa tu conexión y reintenta.', action: 'retry' }
      case 'no-audio':
        return { message: 'El video no tiene una pista de audio utilizable.', action: 'none' }
      case 'decode':
        return { message: 'No se pudo procesar el audio de este video (formato no soportado).', action: 'retry' }
      case 'oom':
        return { message: 'El dispositivo se quedó sin memoria procesando el audio. Prueba un video más corto.', action: 'none' }
    }
  }
  if (e instanceof TranscriptionError) {
    switch (e.kind) {
      case 'no-key':
        return { message: 'Configura la API key del proveedor de transcripción en Settings.', action: 'settings' }
      case 'auth':
        return { message: 'La API key es inválida o no tiene permisos. Revísala en Settings.', action: 'settings' }
      case 'provider-unavailable':
        return { message: 'Ese proveedor de transcripción no está disponible. Elige otro en Settings.', action: 'settings' }
      case 'rate-limit':
        return { message: 'Alcanzaste el límite de uso del proveedor. Espera y reintenta.', action: 'retry' }
      case 'too-large':
        return { message: 'Una parte resultó demasiado grande para el proveedor. Reintenta.', action: 'retry' }
      case 'network':
        return { message: e.message || 'Fallo de red al transcribir. Reintenta.', action: 'retry' }
      case 'bad-shape':
        return { message: e.message || 'El proveedor devolvió un formato inesperado. Reintenta.', action: 'retry' }
    }
  }
  return { message: 'Error inesperado durante la transcripción. Reintenta.', action: 'retry' }
}
