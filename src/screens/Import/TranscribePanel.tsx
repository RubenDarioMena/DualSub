/**
 * Panel de transcripción (ASR, spec 005) en el Import: para el caso "tengo el video
 * pero NO tengo subtítulos". Elige el idioma hablado, transcribe el audio vía el
 * proveedor de Settings (BYOK, reusa la clave) y abre el Player con un documento
 * solo-origen, listo para traducir (003) y guardar (004). Muestra etapa y errores
 * accionables. La red vive en `engines/api`; aquí solo orquestamos.
 */
import { useState } from 'react'
import type { MediaRef } from '../../core/services/projectStore'
import { LANG_CODES, type LangCode } from '../../core/models'
import {
  getTranscriberInfo,
  TranscriptionError,
  type TranscriptionErrorKind,
  type TranscriptionProgress,
} from '../../core/services/transcriber'
import { getTranscriber } from '../../engines/api'
import { buildFromTranscript } from '../../core/transcription/buildFromTranscript'
import { usePlayerStore } from '../../state/playerStore'
import { useSettingsStore } from '../../state/settingsStore'
import { diag } from '../../state/diagnosticsStore'

const LANG_LABEL: Record<LangCode, string> = {
  en: 'Inglés',
  es: 'Español',
  ja: 'Japonés',
}

/** Por encima de esto avisamos: los proveedores suelen rechazar archivos grandes. */
const SIZE_WARN_MB = 25

type Status = 'idle' | 'running' | 'error'

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
  const [stage, setStage] = useState<TranscriptionProgress['stage'] | null>(null)
  const [error, setError] = useState<{ kind: TranscriptionErrorKind; message: string } | null>(null)

  const info = getTranscriberInfo(asrProvider)
  const sizeMb = videoBlob ? videoBlob.size / (1024 * 1024) : 0
  const tooBig = sizeMb > SIZE_WARN_MB

  const run = async () => {
    if (!videoBlob) {
      setError({ kind: 'bad-shape', message: 'No se encontró el archivo de video.' })
      setStatus('error')
      return
    }
    setStatus('running')
    setError(null)
    setStage(null)
    diag('info', `ASR: ${asrProvider} (${info.model}) · idioma ${lang} · ${sizeMb.toFixed(1)} MB`)

    try {
      const transcriber = getTranscriber(asrProvider)
      const result = await transcriber.transcribe(
        {
          media: videoBlob,
          filename: videoRef?.name ?? 'video',
          lang,
          apiKey: keys[asrProvider],
        },
        (p) => setStage(p.stage),
      )
      const doc = buildFromTranscript(result)
      // Proyecto NUEVO con el video ya elegido; conserva el blob para guardarlo (004).
      loadProject({ doc, mediaUrl: videoUrl, mediaRef: videoRef, mediaBlob: videoBlob })
      diag('info', `ASR OK: ${result.segments.length} segmentos (${asrProvider})`)
    } catch (e) {
      if (e instanceof TranscriptionError) {
        setError({ kind: e.kind, message: e.message })
        diag('error', `ASR ${e.kind} (${asrProvider}): ${e.message}`, e.detail)
      } else {
        setError({ kind: 'network', message: 'Error inesperado durante la transcripción.' })
        diag('error', `ASR: error inesperado (${asrProvider})`, e instanceof Error ? e.stack : String(e))
      }
      setStatus('error')
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-3">
      <div>
        <h2 className="text-sm font-medium text-neutral-200">¿No tienes subtítulos?</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Genera los subtítulos a partir del audio del video con {info.label}. Después
          podrás traducirlos para ver el par doble.
        </p>
      </div>

      <label className="flex items-center justify-between gap-2 text-xs text-neutral-400">
        Idioma hablado en el audio
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as LangCode)}
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-100"
        >
          {LANG_CODES.map((l) => (
            <option key={l} value={l}>
              {LANG_LABEL[l]}
            </option>
          ))}
        </select>
      </label>

      {tooBig && (
        <p className="rounded-md bg-amber-950/50 px-3 py-2 text-xs text-amber-300">
          El video pesa {sizeMb.toFixed(0)} MB. Los proveedores suelen limitar el tamaño
          (~{SIZE_WARN_MB} MB); si falla, prueba con un clip más corto.
        </p>
      )}

      <button
        type="button"
        onClick={run}
        disabled={status === 'running'}
        className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white active:bg-violet-700 disabled:bg-neutral-800 disabled:text-neutral-500"
      >
        {status === 'running'
          ? stage === 'uploading'
            ? 'Subiendo audio…'
            : 'Transcribiendo…'
          : 'Transcribir audio'}
      </button>

      {status === 'error' && error && (
        <ErrorNotice error={error} onRetry={run} onSettings={() => setScreen('settings')} />
      )}
    </section>
  )
}

function ErrorNotice({
  error,
  onRetry,
  onSettings,
}: {
  error: { kind: TranscriptionErrorKind; message: string }
  onRetry: () => void
  onSettings: () => void
}) {
  const goSettings =
    error.kind === 'no-key' || error.kind === 'auth' || error.kind === 'provider-unavailable'
  return (
    <div className="flex flex-col gap-2 rounded-md bg-rose-950/50 px-3 py-2 text-xs text-rose-200">
      <span>{message(error.kind, error.message)}</span>
      <div className="flex gap-2">
        {goSettings ? (
          <button
            type="button"
            onClick={onSettings}
            className="rounded-md bg-rose-800/60 px-3 py-1.5 font-medium text-rose-100 active:bg-rose-800"
          >
            {error.kind === 'provider-unavailable' ? 'Elegir proveedor' : 'Configurar API key'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-rose-800/60 px-3 py-1.5 font-medium text-rose-100 active:bg-rose-800"
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  )
}

function message(kind: TranscriptionErrorKind, raw: string): string {
  switch (kind) {
    case 'no-key':
      return 'Configura la API key del proveedor de transcripción en Settings.'
    case 'auth':
      return 'La API key es inválida o no tiene permisos. Revísala en Settings.'
    case 'rate-limit':
      return 'Alcanzaste el límite de uso del proveedor. Espera y reintenta.'
    case 'too-large':
      return 'El video es demasiado grande para el proveedor. Prueba con un clip más corto.'
    case 'network':
      return raw || 'Fallo de red al transcribir. Reintenta.'
    case 'bad-shape':
      return raw || 'El proveedor devolvió un formato inesperado. Reintenta.'
    case 'provider-unavailable':
      return 'Ese proveedor de transcripción no está disponible. Elige otro en Settings.'
  }
}
