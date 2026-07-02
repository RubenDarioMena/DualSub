/**
 * Botones de acción sobre un subtítulo, reutilizados por el overlay (sobre el
 * video) y por cada fila de la lista (spec 007 / mejora UX): bucle a la izquierda
 * y copiar a la derecha. Presentacionales: la lógica de estado vive en el store
 * (`loopIndex`) y en `copyToClipboard`.
 */
import { useState } from 'react'
import { copyToClipboard } from '../shared/clipboard'

/** Botón de bucle (repite el segmento). Resaltado cuando el bucle está activo. */
export function LoopButton({
  active,
  onToggle,
  className = '',
}: {
  active: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={active ? 'Detener bucle' : 'Repetir en bucle'}
      aria-pressed={active}
      className={[
        'shrink-0 rounded-full px-3 py-2 text-base leading-none transition-colors',
        active ? 'bg-sky-500 text-white' : 'text-neutral-200 active:bg-neutral-700',
        className,
      ].join(' ')}
    >
      ↻
    </button>
  )
}

/** Botón de copiar el texto dado al portapapeles; muestra ✓ un instante al copiar. */
export function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="Copiar subtítulo"
      disabled={!text}
      className={[
        'shrink-0 rounded-full px-3 py-2 text-base leading-none transition-colors disabled:opacity-30',
        copied ? 'text-emerald-400' : 'text-neutral-200 active:bg-neutral-700',
        className,
      ].join(' ')}
    >
      {copied ? '✓' : '⧉'}
    </button>
  )
}
