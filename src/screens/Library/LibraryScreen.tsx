/**
 * Biblioteca de proyectos (spec 004, US2). Hogar de la app cuando hay trabajo
 * guardado: listar, abrir (retomar), borrar y empezar uno nuevo. Móvil-first 360px.
 * Spec: specs/004-local-persistence · contrato: contracts/library-ui.md
 */
import { useState } from 'react'
import { usePlayerStore } from '../../state/playerStore'
import { useLibraryStore } from '../../state/libraryStore'
import type { StoredProjectMeta } from '../../core/services/projectStore'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function LibraryScreen() {
  const projects = useLibraryStore((s) => s.projects)
  const available = useLibraryStore((s) => s.available)
  const usedBytes = useLibraryStore((s) => s.usedBytes)
  const videoDegraded = useLibraryStore((s) => s.videoDegraded)
  const open = useLibraryStore((s) => s.open)
  const remove = useLibraryStore((s) => s.remove)
  const dismissVideoNotice = useLibraryStore((s) => s.dismissVideoNotice)
  const setScreen = usePlayerStore((s) => s.setScreen)

  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-neutral-950 px-4 py-6 text-neutral-100">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Biblioteca</h1>
        <button
          type="button"
          onClick={() => setScreen('settings')}
          aria-label="Settings"
          className="shrink-0 rounded-full border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-200 active:bg-neutral-800"
        >
          ⚙
        </button>
      </header>

      <button
        type="button"
        onClick={() => setScreen('import')}
        className="rounded-full bg-sky-500 px-4 py-3 text-sm font-semibold text-white active:bg-sky-600"
      >
        ＋ Nuevo proyecto
      </button>

      <button
        type="button"
        onClick={() => setScreen('youtube')}
        className="rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 active:bg-neutral-800"
      >
        ▶ YouTube con tus subtítulos (beta)
      </button>

      {!available && (
        <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
          Tu navegador no guardará el trabajo (modo privado o almacenamiento
          bloqueado). Lo que hagas se perderá al recargar.
        </p>
      )}

      {videoDegraded && (
        <button
          type="button"
          onClick={dismissVideoNotice}
          className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-left text-xs text-amber-300"
        >
          El video no cabía en el navegador, así que guardamos solo los subtítulos y tu
          progreso. (Toca para descartar.)
        </button>
      )}

      {projects.length === 0 ? (
        <p className="mt-4 text-center text-sm text-neutral-500">
          Aún no tienes proyectos. Empieza uno con «Nuevo proyecto».
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((p) => (
            <ProjectRow
              key={p.id}
              p={p}
              confirming={confirmId === p.id}
              onOpen={() => open(p.id)}
              onAskDelete={() => setConfirmId(p.id)}
              onCancelDelete={() => setConfirmId(null)}
              onConfirmDelete={() => {
                setConfirmId(null)
                void remove(p.id)
              }}
            />
          ))}
        </ul>
      )}

      {projects.length >= 2 && <CombineSection projects={projects} />}

      {projects.length > 0 && (
        <p className="mt-auto pt-2 text-center text-xs text-neutral-600">
          Espacio usado: {formatBytes(usedBytes)}
        </p>
      )}
    </div>
  )
}

/**
 * Combinar proyectos (US4, reformulado en spec 007): dos proyectos del MISMO
 * video que comparten el idioma base se unen en UN proyecto multi-pista (p. ej.
 * EN/ES + EN/JA → EN/ES/JA), al instante, sin traducir y con tiempos intactos.
 * Después eliges qué par ver con los menús Arriba/Abajo del Player.
 */
function CombineSection({ projects }: { projects: StoredProjectMeta[] }) {
  const combineProjects = useLibraryStore((s) => s.combineProjects)
  const [open, setOpen] = useState(false)
  const [idA, setIdA] = useState(projects[0].id)
  const [idB, setIdB] = useState(projects[1].id)
  const [error, setError] = useState<string | null>(null)

  const a = projects.find((p) => p.id === idA)
  const b = projects.find((p) => p.id === idB)
  const canCombine = !!a && !!b && idA !== idB

  const onCombine = async () => {
    if (!canCombine) return
    setError(null)
    const ok = await combineProjects(idA, idB)
    if (!ok) {
      setError(
        'Esos dos proyectos no comparten el mismo idioma base ni la misma rejilla de ' +
          'tiempos, así que no se pueden combinar. (No tocamos los originales.)',
      )
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-300 active:bg-neutral-800"
      >
        ⇄ Combinar idiomas de dos proyectos
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-3">
      <p className="text-xs text-neutral-400">
        Combina dos proyectos del mismo video que comparten el idioma base: el resultado
        tendrá TODAS sus pistas, sin volver a traducir. El par a ver se elige en el
        Player (menús Arriba/Abajo).
      </p>
      <ProjectSelect label="Proyecto A" value={idA} projects={projects} onChange={setIdA} />
      <ProjectSelect label="Proyecto B" value={idB} projects={projects} onChange={setIdB} />
      <p className="text-xs text-neutral-500">
        Se creará un proyecto con{' '}
        <span className="font-medium text-neutral-300">
          {[...new Set([...(a?.langs ?? []), ...(b?.langs ?? [])])]
            .map((l) => l.toUpperCase())
            .join(' + ') || '—'}
        </span>
      </p>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCombine}
          disabled={!canCombine}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white active:bg-sky-700 disabled:bg-neutral-800 disabled:text-neutral-600"
        >
          Combinar
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 active:bg-neutral-800"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function ProjectSelect({
  label,
  value,
  projects,
  onChange,
}: {
  label: string
  value: string
  projects: StoredProjectMeta[]
  onChange: (id: string) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-100"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title} ({p.langs.map((l) => l.toUpperCase()).join('·')})
          </option>
        ))}
      </select>
    </label>
  )
}

function ProjectRow({
  p,
  confirming,
  onOpen,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  p: StoredProjectMeta
  confirming: boolean
  onOpen: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{p.title}</span>
          {p.hasVideo && <span title="Video guardado">🎬</span>}
        </div>
        <div className="mt-0.5 text-xs text-neutral-500">
          {p.langs.map((l) => l.toUpperCase()).join(' · ')} · {formatDate(p.updatedAt)} ·{' '}
          {formatBytes(p.sizeBytes)}
        </div>
      </button>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onConfirmDelete}
            className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white active:bg-red-700"
          >
            Borrar
          </button>
          <button
            type="button"
            onClick={onCancelDelete}
            className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300"
          >
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAskDelete}
          aria-label={`Borrar ${p.title}`}
          title="Borrar proyecto"
          className="shrink-0 rounded-full border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-400 active:bg-red-950 active:text-red-300"
        >
          ✕
        </button>
      )}
    </li>
  )
}
