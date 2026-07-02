/**
 * Dropdowns Arriba/Abajo: qué pista se ve en cada línea del dual (spec 007).
 * Lista todas las pistas del documento (varios idiomas y varias traducciones
 * del mismo idioma); "Abajo" admite "Ninguna" (solo una línea). La elección se
 * persiste con el proyecto (auto-guardado 004).
 */
import { usePlayerStore } from '../../state/playerStore'
import { trackOptionLabel } from '../shared/langLabels'

export default function TrackSelector() {
  const doc = usePlayerStore((s) => s.doc)
  const topId = usePlayerStore((s) => s.topId)
  const bottomId = usePlayerStore((s) => s.bottomId)
  const setView = usePlayerStore((s) => s.setView)

  if (doc.tracks.length < 2 && bottomId === null) return null

  return (
    <div className="flex items-center gap-3 text-xs">
      <Select
        label="Arriba"
        value={topId}
        allowNone={false}
        onChange={(id) => setView(id as string, bottomId)}
      />
      <Select
        label="Abajo"
        value={bottomId}
        allowNone
        onChange={(id) => setView(topId, id)}
      />
    </div>
  )
}

function Select({
  label,
  value,
  allowNone,
  onChange,
}: {
  label: string
  value: string | null
  allowNone: boolean
  onChange: (id: string | null) => void
}) {
  const doc = usePlayerStore((s) => s.doc)
  return (
    <label className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className="shrink-0 text-neutral-500">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-100"
      >
        {allowNone && <option value="">Ninguna</option>}
        {doc.tracks.map((t) => (
          <option key={t.id} value={t.id}>
            {trackOptionLabel(t, doc.tracks)}
          </option>
        ))}
      </select>
    </label>
  )
}
