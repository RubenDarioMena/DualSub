/**
 * Panel de traducción en el Player: dispara la traducción del idioma destino vía el
 * proveedor elegido (BYOK), muestra progreso por lote y errores accionables, y al
 * terminar reemplaza el documento por el dual (loadProject). Conserva lo ya traducido
 * y reintenta solo lo pendiente (FR-007/FR-008). Spec: specs/003-translate-api-byok.
 */
import { useRef, useState } from 'react'
import { usePlayerStore } from '../../state/playerStore'
import { useSettingsStore } from '../../state/settingsStore'
import {
  getProviderInfo,
  TranslationError,
  type TranslationErrorKind,
  type TranslationProgress,
} from '../../core/services/translator'
import { getTranslator } from '../../engines/api'
import { assembleTranslated } from '../../core/translation/assemble'

type Status = 'idle' | 'running' | 'error'

interface ErrorState {
  kind: TranslationErrorKind
  message: string
}

export default function TranslatePanel() {
  const doc = usePlayerStore((s) => s.doc)
  const mediaUrl = usePlayerStore((s) => s.mediaUrl)
  const loadProject = usePlayerStore((s) => s.loadProject)
  const setScreen = usePlayerStore((s) => s.setScreen)
  const provider = useSettingsStore((s) => s.provider)
  const keys = useSettingsStore((s) => s.keys)

  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<TranslationProgress | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)
  // Traducción acumulada por índice; persiste entre reintentos (FR-008).
  const accRef = useRef<(string | undefined)[]>([])

  const info = getProviderInfo(provider)
  const sourceTexts = doc.segments.map((s) => s.texts[doc.sourceLang] ?? '')
  const missingTarget = doc.segments.some((s) => {
    const src = s.texts[doc.sourceLang]
    return src !== undefined && src.trim() !== '' && s.texts[doc.targetLang] === undefined
  })
  const offerable = doc.sourceLang !== doc.targetLang && missingTarget

  if (!offerable) return null

  const run = async () => {
    setStatus('running')
    setError(null)
    setProgress(null)

    if (accRef.current.length !== sourceTexts.length) {
      accRef.current = new Array(sourceTexts.length).fill(undefined)
    }
    const acc = accRef.current
    // Solo se envía lo pendiente: los índices ya traducidos van como '' (planBatches los omite).
    const pending = sourceTexts.map((t, i) => (acc[i] !== undefined ? '' : t))

    try {
      const translator = getTranslator(provider)
      const result = await translator.translate(
        {
          sourceLang: doc.sourceLang,
          targetLang: doc.targetLang,
          texts: pending,
          apiKey: keys[provider],
        },
        setProgress,
      )
      mergeInto(acc, result.texts)
      const dual = assembleTranslated(doc, doc.targetLang, acc)
      loadProject({ doc: dual, mediaUrl })
      setStatus('idle')
    } catch (e) {
      if (e instanceof TranslationError) {
        if (e.partial) mergeInto(acc, e.partial)
        setError({ kind: e.kind, message: e.message })
      } else {
        setError({ kind: 'network', message: 'Error inesperado durante la traducción.' })
      }
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-neutral-400">
          Falta el destino ({doc.sourceLang}→{doc.targetLang}) · {info.label}
        </span>
        <button
          type="button"
          onClick={run}
          disabled={status === 'running'}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white active:bg-sky-700 disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          {status === 'running' ? 'Traduciendo…' : 'Traducir'}
        </button>
      </div>

      {status === 'running' && progress && (
        <ProgressBar done={progress.done} total={progress.total} />
      )}

      {status === 'error' && error && (
        <ErrorNotice error={error} onRetry={run} onSettings={() => setScreen('settings')} />
      )}
    </div>
  )
}

/** Fusiona `src` (por índice) en `acc` sin pisar lo ya presente con `undefined`. */
function mergeInto(acc: (string | undefined)[], src: (string | undefined)[]): void {
  src.forEach((v, i) => {
    if (v !== undefined) acc[i] = v
  })
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div className="flex flex-col gap-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-neutral-500">
        Traduciendo {done}/{total}
      </span>
    </div>
  )
}

function ErrorNotice({
  error,
  onRetry,
  onSettings,
}: {
  error: ErrorState
  onRetry: () => void
  onSettings: () => void
}) {
  const goSettings = error.kind === 'no-key' || error.kind === 'auth' || error.kind === 'provider-unavailable'
  return (
    <div className="flex flex-col gap-2 rounded-md bg-rose-950/50 px-3 py-2 text-xs text-rose-200">
      <span>{message(error)}</span>
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

function message(error: ErrorState): string {
  switch (error.kind) {
    case 'no-key':
      return 'Configura tu API key para este proveedor antes de traducir.'
    case 'auth':
      return 'La API key es inválida o no tiene permisos. Revísala en Settings.'
    case 'rate-limit':
      return 'Alcanzaste el límite de uso del proveedor. Espera y reintenta.'
    case 'network':
      return error.message || 'Fallo de red. Lo ya traducido se conservó; reintenta lo pendiente.'
    case 'bad-shape':
      return 'El proveedor devolvió un formato inesperado. Reintenta el lote pendiente.'
    case 'provider-unavailable':
      return 'Este proveedor todavía no está disponible. Elige otro en Settings.'
  }
}
