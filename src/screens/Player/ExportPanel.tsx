/**
 * Export del proyecto (spec 009): descarga un .mp4 con el par visible
 * (Arriba/Abajo, offset aplicado) como pista incrustada (rápido, sin
 * recodificar) o quemado en la imagen (experimental, lento), o solo el .srt.
 * Pensado para compartir con gente no técnica / verlo en la TV. Plegado por
 * defecto para no robar espacio a la lista (360px).
 */
import { useState } from 'react'
import { usePlayerStore } from '../../state/playerStore'
import { buildDualSrt } from '../../core/export/subtitleExport'
import {
  exportVideoWithSubs,
  VideoExportError,
  type ExportMode,
} from '../../engines/api/ffmpegVideoExporter'
import { diag } from '../../state/diagnosticsStore'

type Status = 'idle' | 'running' | 'error'

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // Da tiempo al navegador a iniciar la descarga antes de revocar.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function baseName(name: string | undefined): string {
  const n = name ?? 'dualsub'
  return n.replace(/\.[^.]+$/, '')
}

export default function ExportPanel() {
  const doc = usePlayerStore((s) => s.doc)
  const topId = usePlayerStore((s) => s.topId)
  const bottomId = usePlayerStore((s) => s.bottomId)
  const offsetMs = usePlayerStore((s) => s.offsetMs)
  const mediaBlob = usePlayerStore((s) => s.mediaBlob)
  const mediaRef = usePlayerStore((s) => s.mediaRef)

  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [mode, setMode] = useState<ExportMode | null>(null)
  const [error, setError] = useState<string | null>(null)

  const srt = () => buildDualSrt(doc, { top: topId, bottom: bottomId }, offsetMs)
  const name = baseName(mediaRef?.name)

  const exportSrt = () => {
    download(new Blob([srt()], { type: 'text/plain' }), `${name}.dual.srt`)
  }

  const exportVideo = async (m: ExportMode) => {
    if (!mediaBlob) return
    setStatus('running')
    setMode(m)
    setProgress(0)
    setError(null)
    diag('info', `Export ${m}: ${name} (${(mediaBlob.size / 1e6).toFixed(1)} MB)`)
    try {
      const out = await exportVideoWithSubs(mediaBlob, srt(), m, setProgress)
      download(out, `${name}.dualsub.mp4`)
      setStatus('idle')
      diag('info', `Export ${m} OK (${(out.size / 1e6).toFixed(1)} MB)`)
    } catch (e) {
      const msg =
        e instanceof VideoExportError ? e.message : 'Fallo inesperado durante el export.'
      setError(msg)
      setStatus('error')
      diag('error', `Export ${m}: ${msg}`, e instanceof VideoExportError ? e.detail : String(e))
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-left text-xs font-medium text-neutral-300 active:bg-neutral-800"
      >
        ⬇ Exportar (.mp4 con subtítulos / .srt)
      </button>
    )
  }

  const busy = status === 'running'

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-neutral-300">
          Exportar el par visible {bottomId ? '(dos líneas)' : '(una línea)'}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-neutral-500 active:text-neutral-300"
        >
          Cerrar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !mediaBlob}
          onClick={() => exportVideo('track')}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white active:bg-emerald-700 disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          {busy && mode === 'track' ? 'Incrustando…' : '.mp4 · pista (rápido)'}
        </button>
        <button
          type="button"
          disabled={busy || !mediaBlob}
          onClick={() => exportVideo('burn')}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 active:bg-neutral-800 disabled:text-neutral-600"
        >
          {busy && mode === 'burn' ? `Quemando… ${Math.round(progress * 100)}%` : '.mp4 · quemado (beta, lento)'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={exportSrt}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 active:bg-neutral-800"
        >
          Solo .srt
        </button>
      </div>

      {!mediaBlob && (
        <p className="text-[11px] text-neutral-500">
          Para exportar el video vuelve a elegir el archivo (el .srt sí está disponible).
        </p>
      )}
      <p className="text-[11px] text-neutral-600">
        «Pista»: sin pérdida, la muestran VLC/TVs. «Quemado»: se ve en todo, pero
        recodifica el video (tarda) y aún es experimental.
      </p>

      {status === 'error' && error && (
        <p className="rounded-md bg-rose-950/50 px-3 py-2 text-xs text-rose-200">{error}</p>
      )}
    </div>
  )
}
