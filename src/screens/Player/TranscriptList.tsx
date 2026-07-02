/**
 * Lista vertical de diálogos. Se suscribe a `activeIndex` (no al tiempo) para
 * re-renderizar poco (D3). Autoscroll suave del activo (FR-004) y tap-to-seek
 * ajustado por offset (FR-005, US2). Spec: specs/001-player-dual-mock.
 */
import { useCallback, useEffect, useRef } from 'react'
import { usePlayerStore } from '../../state/playerStore'
import TranscriptRow from './TranscriptRow'

export default function TranscriptList() {
  const doc = usePlayerStore((s) => s.doc)
  const topId = usePlayerStore((s) => s.topId)
  const bottomId = usePlayerStore((s) => s.bottomId)
  const activeIndex = usePlayerStore((s) => s.activeIndex)
  const loopIndex = usePlayerStore((s) => s.loopIndex)
  const toggleLoop = usePlayerStore((s) => s.toggleLoop)
  const requestSeek = usePlayerStore((s) => s.requestSeek)
  const activeRef = useRef<HTMLButtonElement>(null)

  // Estable entre renders → no rompe el memo de las filas.
  const onSelect = useCallback(
    (index: number) => {
      const seg = doc.segments[index]
      const { offsetMs } = usePlayerStore.getState()
      requestSeek(seg.startMs + offsetMs) // el store clampa a >= 0 (R3, C2)
    },
    [doc, requestSeek],
  )

  // Autoscroll al cambiar el activo. Si activeIndex === -1, activeRef es null y
  // no se scrollea (sin "pegarse" en huecos).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeIndex])

  return (
    <ol className="flex-1 divide-y divide-neutral-800/60 overflow-y-auto">
      {doc.segments.map((seg, i) => (
        <li key={i}>
          <TranscriptRow
            ref={i === activeIndex ? activeRef : undefined}
            segment={seg}
            index={i}
            topId={topId}
            bottomId={bottomId}
            isActive={i === activeIndex}
            isLooping={i === loopIndex}
            onSelect={onSelect}
            onToggleLoop={toggleLoop}
          />
        </li>
      ))}
    </ol>
  )
}
