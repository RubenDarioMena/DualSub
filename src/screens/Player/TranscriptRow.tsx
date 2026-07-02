/**
 * Una fila de diálogo: pista de arriba + pista de abajo (spec 007). Solo arriba
 * si falta la de abajo (FR-007). `memo` + `forwardRef`: solo se re-renderiza la
 * fila cuyo `isActive` cambia, y la activa expone su ref para el autoscroll.
 * Spec: specs/001-player-dual-mock.
 */
import { forwardRef, memo } from 'react'
import type { SubtitleSegment } from '../../core/models'
import { CopyButton, LoopButton } from './subtitleControls'

interface TranscriptRowProps {
  segment: SubtitleSegment
  index: number
  topId: string
  bottomId: string | null
  isActive: boolean
  isLooping: boolean
  onSelect: (index: number) => void
  onToggleLoop: (index: number) => void
}

const TranscriptRow = forwardRef<HTMLButtonElement, TranscriptRowProps>(
  function TranscriptRow(
    { segment, index, topId, bottomId, isActive, isLooping, onSelect, onToggleLoop },
    ref,
  ) {
    const top = segment.texts[topId]
    const bottom = bottomId !== null ? segment.texts[bottomId] : undefined

    // El texto (centro) hace tap-to-seek; bucle a la izquierda y copiar a la
    // derecha son botones aparte (no anidados, HTML válido).
    return (
      <div
        className={[
          'flex items-center gap-1 border-l-2 pr-1 transition-colors',
          isActive ? 'border-sky-400 bg-sky-500/15' : 'border-transparent',
        ].join(' ')}
      >
        <LoopButton active={isLooping} onToggle={() => onToggleLoop(index)} className="ml-1" />
        <button
          ref={ref}
          type="button"
          onClick={() => onSelect(index)}
          className="min-w-0 flex-1 px-2 py-3 text-left active:bg-neutral-800/40"
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
        <CopyButton text={top ?? ''} />
      </div>
    )
  },
)

export default memo(TranscriptRow)
