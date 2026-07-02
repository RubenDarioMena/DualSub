/**
 * EXPERIMENTAL (pre-spec 006, Camino A): reproducir un video de YouTube con el
 * doble subtítulo del PROYECTO ACTIVO debajo. El iframe oficial (IFrame Player
 * API) es el reloj: un bucle rAF lee `getCurrentTime()` y deriva el segmento
 * activo con el core de sync (000), con el offset del usuario. Sin captions
 * automáticos aún (eso necesita el proxy de la 006): los subtítulos salen de lo
 * que ya importaste/transcribiste. No descargamos nada de YouTube.
 */
import { useEffect, useRef, useState } from 'react'
import { findActiveSegmentIndex } from '../../core/sync'
import { usePlayerStore } from '../../state/playerStore'
import OffsetControl from '../Player/OffsetControl'

/** Tipado mínimo del IFrame Player API (se carga desde youtube.com). */
interface YTPlayer {
  getCurrentTime(): number
  destroy(): void
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: object) => YTPlayer
}
declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

/** Extrae el videoId de una URL de YouTube (watch, youtu.be, shorts, embed) o id pelado. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  try {
    const u = new URL(s)
    if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1, 12) || null
    const v = u.searchParams.get('v')
    if (v && /^[\w-]{11}$/.test(v)) return v
    const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]{11})/)
    if (m) return m[2]
  } catch {
    // no era una URL
  }
  return null
}

let apiPromise: Promise<YTNamespace> | null = null
function loadYouTubeApi(): Promise<YTNamespace> {
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      if (window.YT?.Player) return resolve(window.YT)
      window.onYouTubeIframeAPIReady = () => resolve(window.YT as YTNamespace)
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    })
  }
  return apiPromise
}

export default function YouTubeScreen() {
  const doc = usePlayerStore((s) => s.doc)
  const topId = usePlayerStore((s) => s.topId)
  const bottomId = usePlayerStore((s) => s.bottomId)
  const setScreen = usePlayerStore((s) => s.setScreen)

  const [url, setUrl] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [inputError, setInputError] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)

  const onLoad = () => {
    const id = parseYouTubeId(url)
    setInputError(id === null)
    if (id) setVideoId(id)
  }

  // Crea el player cuando hay videoId y lo destruye al salir.
  useEffect(() => {
    if (!videoId || !hostRef.current) return
    let cancelled = false
    let raf = 0
    void loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return
      playerRef.current = new YT.Player(hostRef.current, {
        width: '100%',
        height: '100%',
        videoId,
        playerVars: { playsinline: 1, rel: 0 },
      })
      // El iframe es el reloj: bucle rAF (barato; solo escribe si cambia el índice).
      const loop = () => {
        const p = playerRef.current
        if (p && typeof p.getCurrentTime === 'function') {
          const { doc, offsetMs } = usePlayerStore.getState()
          const tMs = Math.round(p.getCurrentTime() * 1000)
          const idx = findActiveSegmentIndex(doc.segments, tMs - offsetMs)
          setActiveIndex((prev) => (prev === idx ? prev : idx))
        }
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [videoId])

  const seg = activeIndex >= 0 ? doc.segments[activeIndex] : null
  const top = seg?.texts[topId]
  const bottom = seg && bottomId !== null ? seg.texts[bottomId] : undefined

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-neutral-950 px-4 py-6 text-neutral-100">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setScreen('library')}
          aria-label="Volver a la biblioteca"
          className="shrink-0 rounded-full border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-200 active:bg-neutral-800"
        >
          ←
        </button>
        <div>
          <h1 className="text-lg font-semibold">
            YouTube <span className="rounded bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 align-middle">beta</span>
          </h1>
          <p className="text-xs text-neutral-500">
            Usa los subtítulos del proyecto ABIERTO sobre un video de YouTube.
          </p>
        </div>
      </header>

      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onLoad()}
          placeholder="Pega la URL del video…"
          className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600"
        />
        <button
          type="button"
          onClick={onLoad}
          className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white active:bg-sky-700"
        >
          Cargar
        </button>
      </div>
      {inputError && (
        <p className="text-xs text-rose-400">Eso no parece una URL (o id) de YouTube.</p>
      )}

      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        {videoId ? (
          <div ref={hostRef} className="h-full w-full" />
        ) : (
          <div className="grid h-full place-items-center text-sm text-neutral-500">
            El video aparecerá aquí
          </div>
        )}
      </div>

      {/* Doble subtítulo bajo el video (el iframe no admite overlay táctil fiable). */}
      <div className="min-h-24 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-3 text-center">
        {top ? (
          <>
            <p className="dual-text text-lg font-semibold leading-snug text-white">{top}</p>
            {bottom && (
              <p className="dual-text mt-1 text-base leading-snug text-sky-200">{bottom}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-neutral-600">
            {videoId ? '···' : 'Abre antes un proyecto con subtítulos y vuelve aquí.'}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-neutral-800 px-2 py-1.5">
        <OffsetControl />
      </div>

      <p className="text-[11px] leading-relaxed text-neutral-600">
        Experimental: los subtítulos son los del proyecto que tengas abierto (deben
        corresponder al mismo contenido). La descarga automática de captions llegará con
        la spec 006 (necesita un proxy).
      </p>
    </div>
  )
}
