/**
 * [diag] Modo diagnóstico in-app: muestra el log capturado (errores globales, console y el
 * payload crudo de fallos de traducción) para poder leerlo y COPIARLO desde el móvil.
 * El `<textarea>` permite seleccionar-todo y copiar a mano cuando la API de portapapeles
 * no está disponible (http en LAN no es contexto seguro). Móvil-first a 360px.
 * Spec: specs/003-translate-api-byok (modo diagnóstico).
 */
import { useMemo, useState } from 'react'
import { usePlayerStore } from '../../state/playerStore'
import { useDiagnosticsStore, type DiagEntry } from '../../state/diagnosticsStore'

export default function DiagnosticsScreen() {
  const setScreen = usePlayerStore((s) => s.setScreen)
  const mediaUrl = usePlayerStore((s) => s.mediaUrl)
  const entries = useDiagnosticsStore((s) => s.entries)
  const clear = useDiagnosticsStore((s) => s.clear)
  const [copied, setCopied] = useState(false)

  const text = useMemo(() => entries.map(formatEntry).join('\n'), [entries])

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Sin portapapeles (http en LAN): el usuario copia desde el textarea de abajo.
      setCopied(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-800 px-4 py-3">
        <button
          type="button"
          onClick={() => setScreen(mediaUrl ? 'player' : 'import')}
          className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 active:bg-neutral-800"
        >
          ← Volver
        </button>
        <h1 className="text-sm font-semibold tracking-tight">Diagnóstico</h1>
        <span className="ml-auto text-xs text-neutral-500">{entries.length} eventos</span>
      </header>

      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCopy}
            disabled={entries.length === 0}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white active:bg-sky-700 disabled:bg-neutral-800 disabled:text-neutral-600"
          >
            {copied ? 'Copiado ✓' : 'Copiar'}
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={entries.length === 0}
            className="rounded-lg px-4 py-2 text-sm font-medium text-rose-400 active:bg-neutral-800 disabled:text-neutral-700"
          >
            Limpiar
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="text-xs text-neutral-500">
            Sin eventos todavía. Aquí aparecerán los errores y los detalles de los fallos
            de traducción para poder copiarlos.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {entries
              .slice()
              .reverse()
              .map((e, i) => (
                <li
                  key={entries.length - i}
                  className="rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2"
                >
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[11px] font-semibold uppercase ${levelColor(e.level)}`}>
                      {e.level}
                    </span>
                    <span className="text-[11px] tabular-nums text-neutral-500">{time(e.t)}</span>
                  </div>
                  <p className="mt-0.5 break-words text-xs text-neutral-200">{e.msg}</p>
                  {e.detail && (
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-neutral-950 px-2 py-1 text-[11px] text-neutral-400">
                      {e.detail}
                    </pre>
                  )}
                </li>
              ))}
          </ol>
        )}

        {/* Respaldo para copiar a mano en móvil (http LAN no permite portapapeles). */}
        {entries.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="diag-text" className="text-xs font-medium text-neutral-400">
              Texto plano (mantén pulsado → Seleccionar todo → Copiar)
            </label>
            <textarea
              id="diag-text"
              readOnly
              value={text}
              onFocus={(e) => e.currentTarget.select()}
              className="h-40 w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 font-mono text-[11px] text-neutral-300"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function formatEntry(e: DiagEntry): string {
  const head = `[${time(e.t)}] ${e.level.toUpperCase()} ${e.msg}`
  return e.detail ? `${head}\n    ${e.detail.replace(/\n/g, '\n    ')}` : head
}

function time(t: number): string {
  return new Date(t).toLocaleTimeString()
}

function levelColor(level: DiagEntry['level']): string {
  if (level === 'error') return 'text-rose-400'
  if (level === 'warn') return 'text-amber-400'
  return 'text-sky-400'
}
