/**
 * Control de offset (±ms) para corregir el desfase de subtítulos en runtime.
 * Llama a `nudgeOffset`/`setOffset` del store; NO muta el documento (C1, R4).
 * Spec: specs/001-player-dual-mock (US4, FR-008).
 */
import { usePlayerStore } from '../../state/playerStore'

function formatOffset(ms: number): string {
  if (ms === 0) return 'Sinc. 0.0s'
  const sign = ms > 0 ? '+' : '−'
  return `${sign}${(Math.abs(ms) / 1000).toFixed(1)}s`
}

const STEP = 'min-w-11 rounded-md bg-neutral-800 px-2 py-2 text-xs font-medium text-neutral-100 active:bg-neutral-700'

export default function OffsetControl() {
  const offsetMs = usePlayerStore((s) => s.offsetMs)
  const nudgeOffset = usePlayerStore((s) => s.nudgeOffset)
  const setOffset = usePlayerStore((s) => s.setOffset)

  return (
    <div className="flex items-center justify-center gap-1.5">
      <button type="button" className={STEP} onClick={() => nudgeOffset(-500)}>
        −0.5
      </button>
      <button type="button" className={STEP} onClick={() => nudgeOffset(-100)}>
        −0.1
      </button>
      <span className="min-w-20 text-center text-xs tabular-nums text-neutral-300">
        {formatOffset(offsetMs)}
      </span>
      <button type="button" className={STEP} onClick={() => nudgeOffset(100)}>
        +0.1
      </button>
      <button type="button" className={STEP} onClick={() => nudgeOffset(500)}>
        +0.5
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-2 text-xs font-medium text-sky-400 disabled:text-neutral-600"
        onClick={() => setOffset(0)}
        disabled={offsetMs === 0}
      >
        Reset
      </button>
    </div>
  )
}
