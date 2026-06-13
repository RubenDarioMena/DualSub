/**
 * Pantalla Player. Dos modos sobre el MISMO `VideoStage` (reloj maestro) que NO
 * se remonta al cambiar de modo/orientación (FR-009, D5):
 *  - 'list'    (vertical):   video arriba + lista de diálogos + offset.
 *  - 'overlay' (horizontal): video a pantalla con subtítulos superpuestos.
 * El modo sigue la orientación por defecto, con override manual hasta el próximo
 * cambio de orientación. Móvil-first a 360px. Spec: specs/001-player-dual-mock.
 */
import { useEffect } from 'react'
import { usePlayerStore } from '../../state/playerStore'
import MediaPicker from './MediaPicker'
import VideoStage from './VideoStage'
import SubtitleOverlay from './SubtitleOverlay'
import TranscriptList from './TranscriptList'
import OffsetControl from './OffsetControl'

export default function PlayerScreen() {
  const mediaUrl = usePlayerStore((s) => s.mediaUrl)
  const doc = usePlayerStore((s) => s.doc)
  const viewMode = usePlayerStore((s) => s.viewMode)
  const setViewMode = usePlayerStore((s) => s.setViewMode)

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

  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      {/* Header: oculto en overlay para maximizar el video. */}
      <header className={overlay ? 'hidden' : 'shrink-0 border-b border-neutral-800'}>
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <h1 className="text-sm font-semibold tracking-tight">
            DualSub
            <span className="ml-1.5 font-normal text-neutral-500">
              {doc.sourceLang}→{doc.targetLang}
            </span>
          </h1>
          <div className="flex items-center gap-2">
            <ModeToggle overlay={overlay} onToggle={() => setViewMode('overlay')} />
            <MediaPicker />
          </div>
        </div>
      </header>

      {/* Zona de video: VideoStage SIEMPRE es el primer hijo de este div; solo
          cambia la className → React no lo remonta (conserva la reproducción). */}
      <div className={overlay ? 'relative flex-1 bg-black' : 'relative aspect-video shrink-0 bg-black'}>
        <VideoStage />
        {overlay && <SubtitleOverlay />}
        {!mediaUrl && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-4 text-center text-sm text-neutral-400">
            Elige un video local para ver la demo dual.
            <br />
            Los subtítulos son de ejemplo (mock).
          </div>
        )}
        {/* Controles flotantes en overlay (vuelta a lista + offset). */}
        {overlay && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
            <div className="pointer-events-auto rounded-full bg-black/50 px-2 py-1">
              <OffsetControl />
            </div>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="pointer-events-auto rounded-full bg-black/50 px-3 py-2 text-xs font-medium text-neutral-100"
            >
              Lista
            </button>
          </div>
        )}
      </div>

      {/* Zona de lista: oculta en overlay. min-h-0 permite que la lista scrollee. */}
      <div className={overlay ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
        <div className="shrink-0 border-b border-neutral-800 px-2 py-2">
          <OffsetControl />
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
