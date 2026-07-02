/**
 * Overlay dual sobre el video (modo horizontal). Muestra origen + destino del
 * segmento activo; nada en huecos; solo origen si falta traducción (FR-007).
 * Respeta safe-areas y deja sitio para los controles nativos (D6). No intercepta
 * toques (`pointer-events-none`). Spec: specs/001-player-dual-mock (US3, FR-006).
 */
import { usePlayerStore } from '../../state/playerStore'
import { CopyButton, LoopButton } from './subtitleControls'

export default function SubtitleOverlay() {
  const doc = usePlayerStore((s) => s.doc)
  const topId = usePlayerStore((s) => s.topId)
  const bottomId = usePlayerStore((s) => s.bottomId)
  const activeIndex = usePlayerStore((s) => s.activeIndex)
  const loopIndex = usePlayerStore((s) => s.loopIndex)
  const toggleLoop = usePlayerStore((s) => s.toggleLoop)

  if (activeIndex < 0) return null // sin segmento activo → overlay vacío
  const seg = doc.segments[activeIndex]
  const source = seg.texts[topId]
  const target = bottomId !== null ? seg.texts[bottomId] : undefined

  // El contenedor no intercepta toques; solo los botones (`pointer-events-auto`).
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-3 pb-[calc(env(safe-area-inset-bottom)+3.5rem)]">
      {/* Bucle (izquierda): repite el segmento activo. */}
      <LoopButton
        className="pointer-events-auto bg-black/50"
        active={loopIndex === activeIndex}
        onToggle={() => toggleLoop(activeIndex)}
      />
      {/* Subtítulo dual centrado. `dual-text` (index.css) deja preparado el
          fallback Noto Sans JP para JA. */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
        <p className="dual-text inline-block max-w-3xl rounded bg-black/40 px-2 py-0.5 text-lg font-semibold leading-snug text-white break-words [overflow-wrap:anywhere] [text-shadow:0_2px_8px_rgb(0_0_0/0.9)]">
          {source}
        </p>
        {target && (
          <p className="dual-text inline-block max-w-3xl rounded bg-black/30 px-2 py-0.5 text-base leading-snug text-sky-200 break-words [overflow-wrap:anywhere] [text-shadow:0_2px_8px_rgb(0_0_0/0.9)]">
            {target}
          </p>
        )}
      </div>
      {/* Copiar (derecha): copia al portapapeles el subtítulo de origen (arriba). */}
      <CopyButton className="pointer-events-auto bg-black/50" text={source ?? ''} />
    </div>
  )
}
