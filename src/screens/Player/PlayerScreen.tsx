/**
 * Pantalla Player. Dos modos sobre el MISMO `VideoStage` (reloj maestro) que NO
 * se remonta al cambiar de modo/orientación (FR-009, D5):
 *  - 'list'    (vertical):   video arriba + lista de diálogos + offset.
 *  - 'overlay' (horizontal): video a pantalla con subtítulos superpuestos.
 * El modo sigue la orientación por defecto, con override manual hasta el próximo
 * cambio de orientación. Pantalla completa del CONTENEDOR (no del `<video>`) para
 * que el overlay dual siga visible (fix B2 de la 001). Móvil-first a 360px.
 * Specs: specs/001-player-dual-mock · specs/007-multi-track-subtitles.
 */
import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '../../state/playerStore'
import { getTrack } from '../../core/tracks'
import MediaPicker from './MediaPicker'
import VideoStage from './VideoStage'
import SubtitleOverlay from './SubtitleOverlay'
import TranscriptList from './TranscriptList'
import OffsetControl from './OffsetControl'
import TranslatePanel from './TranslatePanel'
import TrackSelector from './TrackSelector'
import ExportPanel from './ExportPanel'

export default function PlayerScreen() {
  const mediaUrl = usePlayerStore((s) => s.mediaUrl)
  const doc = usePlayerStore((s) => s.doc)
  const topId = usePlayerStore((s) => s.topId)
  const bottomId = usePlayerStore((s) => s.bottomId)
  const projectId = usePlayerStore((s) => s.projectId)
  const mediaRef = usePlayerStore((s) => s.mediaRef)
  const viewMode = usePlayerStore((s) => s.viewMode)
  const setViewMode = usePlayerStore((s) => s.setViewMode)
  const setScreen = usePlayerStore((s) => s.setScreen)
  const stageRef = useRef<HTMLDivElement>(null)
  // Lista completa: oculta el video (sin desmontarlo) para leer todo el diálogo.
  const [expanded, setExpanded] = useState(false)

  // El modo por defecto sigue la orientación; el override manual gana hasta el
  // próximo cambio de orientación (el listener solo dispara entonces).
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)')
    setViewMode(mq.matches ? 'overlay' : 'list')
    const onChange = (e: MediaQueryListEvent) =>
      setViewMode(e.matches ? 'overlay' : 'list')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [setViewMode])

  const overlay = viewMode === 'overlay'
  const topLang = getTrack(doc, topId)?.lang ?? '·'
  const bottomLang = bottomId !== null ? getTrack(doc, bottomId)?.lang : null

  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      {/* Header: oculto en overlay para maximizar el video. */}
      <header className={overlay ? 'hidden' : 'shrink-0 border-b border-neutral-800'}>
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <h1 className="text-sm font-semibold tracking-tight">
            DualSub
            <span className="ml-1.5 font-normal text-neutral-500">
              {topLang}
              {bottomLang ? `→${bottomLang}` : ''}
            </span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScreen('library')}
              aria-label="Biblioteca"
              className="rounded-full border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-200 active:bg-neutral-800"
            >
              ☰
            </button>
            <button
              type="button"
              onClick={() => setScreen('settings')}
              aria-label="Settings"
              className="rounded-full border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-200 active:bg-neutral-800"
            >
              ⚙
            </button>
            <ModeToggle overlay={overlay} onToggle={() => setViewMode('overlay')} />
            <MediaPicker />
          </div>
        </div>
      </header>

      {/* Zona de video: VideoStage SIEMPRE es el primer hijo de este div; solo
          cambia la className → React no lo remonta (conserva la reproducción).
          También es el objetivo de pantalla completa (overlay incluido). */}
      <div
        ref={stageRef}
        className={
          overlay
            ? 'relative flex-1 bg-black'
            : expanded
              ? 'hidden' // lista completa: el video sigue montado (el audio no se corta)
              : 'relative aspect-video shrink-0 bg-black'
        }
      >
        <VideoStage />
        {overlay && <SubtitleOverlay />}
        {!mediaUrl && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-4 text-center text-sm text-neutral-400">
            {projectId ? (
              <span>
                Vuelve a elegir el video{mediaRef?.name ? ` «${mediaRef.name}»` : ''} para
                continuar.
                <br />
                Tus subtítulos y tu progreso están guardados.
              </span>
            ) : (
              <span>
                Elige un video local para ver la demo dual.
                <br />
                Los subtítulos son de ejemplo (mock).
              </span>
            )}
          </div>
        )}
        {/* Controles flotantes en overlay (offset + fullscreen + vuelta a lista). */}
        {overlay && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
            <div className="pointer-events-auto rounded-full bg-black/50 px-2 py-1">
              <OffsetControl />
            </div>
            <div className="pointer-events-auto flex items-center gap-2">
              <FullscreenButton targetRef={stageRef} />
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="rounded-full bg-black/50 px-3 py-2 text-xs font-medium text-neutral-100"
              >
                Lista
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Zona de lista: oculta en overlay. min-h-0 permite que la lista scrollee. */}
      <div className={overlay ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
        <div className="flex shrink-0 flex-col gap-2 border-b border-neutral-800 px-2 py-2">
          <TrackSelector />
          <div className="flex items-center justify-between gap-2">
            <OffsetControl />
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? 'Mostrar el video' : 'Desplegar la lista completa'}
              className="shrink-0 rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 active:bg-neutral-800"
            >
              {expanded ? '▾ Video' : '▴ Lista completa'}
            </button>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 px-2 pt-2">
          <TranslatePanel />
          <ExportPanel />
        </div>
        <TranscriptList />
      </div>
    </div>
  )
}

function ModeToggle({ overlay, onToggle }: { overlay: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-full border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-200 active:bg-neutral-800"
    >
      {overlay ? 'Lista' : 'Overlay'}
    </button>
  )
}

/**
 * Pantalla completa del CONTENEDOR del video (no del `<video>`), así el overlay
 * dual sigue visible (fix B2). Se oculta donde la API no existe (p. ej. iPhone,
 * donde solo hay fullscreen nativo del `<video>`).
 */
function FullscreenButton({ targetRef }: { targetRef: React.RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement != null)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  if (typeof document === 'undefined' || !document.fullscreenEnabled) return null

  const toggle = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else if (targetRef.current) {
      void targetRef.current.requestFullscreen().catch(() => {
        // Si el navegador lo rechaza (permisos), simplemente no pasa nada.
      })
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={active ? 'Salir de pantalla completa' : 'Pantalla completa'}
      className="rounded-full bg-black/50 px-3 py-2 text-xs font-medium text-neutral-100"
    >
      {active ? '✕ ⛶' : '⛶'}
    </button>
  )
}
