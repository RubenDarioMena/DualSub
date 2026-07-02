/**
 * Panel de traducción en el Player (BYOK, spec 003; multi-pista, spec 007).
 * La fuente es SIEMPRE la pista maestra (transcripción/original): su timing
 * manda. El usuario elige el idioma destino en un dropdown; cada traducción es
 * una PISTA nueva (puede haber varias del mismo idioma, p. ej. dos proveedores)
 * y si una pista quedó a medias se ofrece completarla. El resultado se aplica
 * con `updateDoc` (conserva posición/offset/reproducción — nada se reinicia) y
 * lo parcial se ensambla también, así un fallo de red no pierde lo traducido.
 */
import { useState } from 'react'
import { usePlayerStore } from '../../state/playerStore'
import { useSettingsStore } from '../../state/settingsStore'
import { LANG_CODES, type LangCode } from '../../core/models'
import { masterTrack, nextTrackId, pendingCount, tracksForLang } from '../../core/tracks'
import {
  getProviderInfo,
  TranslationError,
  type TranslationErrorKind,
  type TranslationProgress,
} from '../../core/services/translator'
import { getTranslator } from '../../engines/api'
import { assembleTranslated } from '../../core/translation/assemble'
import { diag } from '../../state/diagnosticsStore'
import { LANG_LABEL } from '../shared/langLabels'

type Status = 'idle' | 'running' | 'error'

interface ErrorState {
  kind: TranslationErrorKind
  message: string
}

export default function TranslatePanel() {
  const doc = usePlayerStore((s) => s.doc)
  const topId = usePlayerStore((s) => s.topId)
  const updateDoc = usePlayerStore((s) => s.updateDoc)
  const setView = usePlayerStore((s) => s.setView)
  const setScreen = usePlayerStore((s) => s.setScreen)
  const provider = useSettingsStore((s) => s.provider)
  const keys = useSettingsStore((s) => s.keys)

  const master = masterTrack(doc)
  const candidates = LANG_CODES.filter((l) => l !== master.lang)
  const [targetLang, setTargetLang] = useState<LangCode>(() => {
    // Por defecto, el primer idioma que aún no tiene ninguna pista.
    const uncovered = candidates.find((l) => tracksForLang(doc, l).length === 0)
    return uncovered ?? candidates[0]
  })
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<TranslationProgress | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)

  const info = getProviderInfo(provider)

  // Si hay una pista incompleta del idioma elegido, se completa; si no, pista nueva.
  const incomplete = tracksForLang(doc, targetLang).find((t) => pendingCount(doc, t.id) > 0)
  const targetTrackId = incomplete?.id ?? nextTrackId(doc, targetLang)
  const isNew = !incomplete
  const existingCount = tracksForLang(doc, targetLang).length

  const run = async () => {
    setStatus('running')
    setError(null)
    setProgress(null)

    // Solo se envía lo pendiente: lo ya traducido va como '' (planBatches lo omite).
    const texts = doc.segments.map((s) => {
      const src = s.texts[master.id] ?? ''
      if (!isNew && s.texts[targetTrackId] !== undefined) return ''
      return src
    })
    const pendingTotal = texts.filter((t) => t.trim() !== '').length
    diag('info', `Traducir: ${provider} ${master.lang}→${targetLang} · pista ${targetTrackId} · ${pendingTotal} pendientes`)

    const spec = {
      id: targetTrackId,
      lang: targetLang,
      ...(isNew ? { label: info.label } : incomplete?.label ? { label: incomplete.label } : {}),
    }
    const apply = (byIndex: (string | undefined)[]) => {
      const next = assembleTranslated(doc, spec, byIndex)
      updateDoc(next)
      // Muestra la traducción abajo (conservando lo que haya arriba).
      setView(topId, targetTrackId)
    }

    try {
      const translator = getTranslator(provider)
      const result = await translator.translate(
        {
          sourceLang: master.lang,
          targetLang,
          texts,
          apiKey: keys[provider],
        },
        setProgress,
      )
      apply(result.texts)
      setStatus('idle')
      diag('info', `Traducción OK (${provider} ${master.lang}→${targetLang} · ${targetTrackId})`)
    } catch (e) {
      if (e instanceof TranslationError) {
        // Lo parcial se ensambla igualmente: queda una pista incompleta que se
        // puede completar con el mismo botón (no se pierde nada).
        if (e.partial && e.partial.some((t) => t !== undefined)) apply(e.partial)
        setError({ kind: e.kind, message: e.message })
        diag('error', `Traducción ${e.kind} (${provider} ${master.lang}→${targetLang}): ${e.message}`, e.detail)
      } else {
        setError({ kind: 'network', message: 'Error inesperado durante la traducción.' })
        diag('error', `Traducción: error inesperado (${provider})`, e instanceof Error ? e.stack : String(e))
      }
      setStatus('error')
    }
  }

  const buttonLabel =
    status === 'running'
      ? 'Traduciendo…'
      : !isNew
        ? 'Completar'
        : existingCount > 0
          ? 'Otra traducción'
          : 'Traducir'

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-neutral-400">
          <span className="shrink-0">Traducir a</span>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value as LangCode)}
            disabled={status === 'running'}
            className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-100"
          >
            {candidates.map((l) => {
              const n = tracksForLang(doc, l).length
              return (
                <option key={l} value={l}>
                  {LANG_LABEL[l]}
                  {n > 0 ? ` (${n})` : ''}
                </option>
              )
            })}
          </select>
        </label>
        <button
          type="button"
          onClick={run}
          disabled={status === 'running'}
          className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white active:bg-sky-700 disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          {buttonLabel}
        </button>
      </div>
      <span className="text-[11px] text-neutral-500">
        Desde {LANG_LABEL[master.lang]} (pista maestra) · {info.label}
        {!isNew && ` · ${pendingCount(doc, targetTrackId)} pendientes`}
      </span>

      {status === 'running' && progress && (
        <ProgressBar done={progress.done} total={progress.total} />
      )}

      {status === 'error' && error && (
        <ErrorNotice error={error} onRetry={run} onSettings={() => setScreen('settings')} />
      )}
    </div>
  )
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
