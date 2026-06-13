/**
 * Una fila de diálogo: origen + destino. Solo origen si falta traducción (FR-007).
 * `memo` + `forwardRef`: solo se re-renderiza la fila cuyo `isActive` cambia, y la
 * activa expone su ref para el autoscroll. Spec: specs/001-player-dual-mock.
 */
import { forwardRef, memo } from 'react'
import type { LangCode, SubtitleSegment } from '../../core/models'

interface TranscriptRowProps {
  segment: SubtitleSegment
  index: number
  sourceLang: LangCode
  targetLang: LangCode
  isActive: boolean
  onSelect: (index: number) => void
}

const TranscriptRow = forwardRef<HTMLButtonElement, TranscriptRowProps>(
  function TranscriptRow(
    { segment, index, sourceLang, targetLang, isActive, onSelect },
    ref,
  ) {
    const source = segment.texts[sourceLang]
    const target = segment.texts[targetLang]

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
          {source}
        </p>
        {target && (
          <p className="mt-0.5 text-sm leading-snug break-words text-neutral-400 [overflow-wrap:anywhere]">
            {target}
          </p>
        )}
      </button>
    )
  },
)

export default memo(TranscriptRow)
