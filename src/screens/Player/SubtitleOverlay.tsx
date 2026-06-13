/**
 * Overlay dual sobre el video (modo horizontal). Muestra origen + destino del
 * segmento activo; nada en huecos; solo origen si falta traducción (FR-007).
 * Respeta safe-areas y deja sitio para los controles nativos (D6). No intercepta
 * toques (`pointer-events-none`). Spec: specs/001-player-dual-mock (US3, FR-006).
 */
import { usePlayerStore } from '../../state/playerStore'

export default function SubtitleOverlay() {
  const doc = usePlayerStore((s) => s.doc)
  const activeIndex = usePlayerStore((s) => s.activeIndex)

  if (activeIndex < 0) return null // sin segmento activo → overlay vacío
  const seg = doc.segments[activeIndex]
  const source = seg.texts[doc.sourceLang]
  const target = seg.texts[doc.targetLang]

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 px-4 pb-[calc(env(safe-area-inset-bottom)+3.5rem)] text-center">
      {/* `dual-text` (index.css) deja preparado el fallback Noto Sans JP para JA. */}
      <p className="dual-text inline-block max-w-3xl rounded bg-black/40 px-2 py-0.5 text-lg font-semibold leading-snug text-white break-words [overflow-wrap:anywhere] [text-shadow:0_2px_8px_rgb(0_0_0/0.9)]">
        {source}
      </p>
      {target && (
        <p className="dual-text inline-block max-w-3xl rounded bg-black/30 px-2 py-0.5 text-base leading-snug text-sky-200 break-words [overflow-wrap:anywhere] [text-shadow:0_2px_8px_rgb(0_0_0/0.9)]">
          {target}
        </p>
      )}
    </div>
  )
}
