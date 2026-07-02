/**
 * Una fila de diálogo: pista de arriba + pista de abajo (spec 007). Solo arriba
 * si falta la de abajo (FR-007). `memo` + `forwardRef`: solo se re-renderiza la
 * fila cuyo `isActive` cambia, y la activa expone su ref para el autoscroll.
 * Spec: specs/001-player-dual-mock.
 */
import { forwardRef, memo } from 'react'
import type { SubtitleSegment } from '../../core/models'

interface TranscriptRowProps {
  segment: SubtitleSegment
  index: number
  topId: string
  bottomId: string | null
  isActive: boolean
  onSelect: (index: number) => void
}

const TranscriptRow = forwardRef<HTMLButtonElement, TranscriptRowProps>(
  function TranscriptRow(
    { segment, index, topId, bottomId, isActive, onSelect },
    ref,
  ) {
    const top = segment.texts[topId]
    const bottom = bottomId !== null ? segment.texts[bottomId] : undefined

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onSelect(index)}
        className={[
          'block w-full border-l-2 px-4 py-3 text-left transition-colors',
          isActive
            ? 'border-sky-400 bg-sky-500/15'
            : 'border-transparent active:bg-neutral-800/60',
        ].join(' ')}
      >
        <p
          className={[
            'text-base leading-snug break-words [overflow-wrap:anywhere]',
            isActive ? 'font-medium text-white' : 'text-neutral-200',
          ].join(' ')}
        >
          {top}
        </p>
        {bottom && (
          <p className="mt-0.5 text-sm leading-snug break-words text-neutral-400 [overflow-wrap:anywhere]">
            {bottom}
          </p>
        )}
      </button>
    )
  },
)

export default memo(TranscriptRow)
