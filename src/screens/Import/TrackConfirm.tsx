/**
 * Confirmación de pistas antes de abrir el Player. Por cada sidecar: idioma
 * propuesto (editable) y, con dos pistas, cuál es la principal (origen, arriba).
 * Con una sola pista, selector "Traducir a:" con opción "Ninguno" (D7).
 * Spec: specs/002-import-sidecar-subs (US2, US3, FR-008) · contracts/import-flow.md
 */
import { LANG_CODES, type LangCode } from '../../core/models'

export type TargetChoice = LangCode | 'none'

export interface TrackInfo {
  filename: string
  /** `null` cuando no se pudo inferir: el usuario debe elegir (US3). */
  lang: LangCode | null
  role: 'source' | 'target'
}

const LANG_LABEL: Record<LangCode, string> = {
  en: 'Inglés',
  es: 'Español',
  ja: 'Japonés',
}

interface TrackConfirmProps {
  tracks: TrackInfo[]
  targetChoice: TargetChoice
  error: string | null
  canOpen: boolean
  onLangChange: (index: number, lang: LangCode) => void
  onMakeSource: (index: number) => void
  onTargetChoiceChange: (choice: TargetChoice) => void
  onOpen: () => void
}

export default function TrackConfirm({
  tracks,
  targetChoice,
  error,
  canOpen,
  onLangChange,
  onMakeSource,
  onTargetChoiceChange,
  onOpen,
}: TrackConfirmProps) {
  const dual = tracks.length === 2
  const sourceLang = tracks.find((t) => t.role === 'source')?.lang ?? null

  return (
    <div className="flex flex-col gap-4">
      {tracks.map((t, i) => (
        <div
          key={t.filename}
          className="flex flex-col gap-2 rounded-lg border border-neutral-700 p-3"
        >
          <p className="truncate text-sm text-neutral-300">{t.filename}</p>

          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="text-neutral-400">Idioma</span>
            <select
              value={t.lang ?? ''}
              onChange={(e) => onLangChange(i, e.target.value as LangCode)}
              className="rounded bg-neutral-800 px-2 py-1 text-neutral-100"
            >
              <option value="" disabled>
                Elegir…
              </option>
              {LANG_CODES.map((l) => (
                <option key={l} value={l}>
                  {LANG_LABEL[l]}
                </option>
              ))}
            </select>
          </label>

          {dual && (
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="radio"
                name="source-track"
                checked={t.role === 'source'}
                onChange={() => onMakeSource(i)}
              />
              Principal (arriba)
            </label>
          )}
        </div>
      ))}

      {!dual && (
        <label className="flex items-center justify-between gap-2 text-sm">
          <span className="text-neutral-400">Traducir a</span>
          <select
            value={targetChoice}
            onChange={(e) => onTargetChoiceChange(e.target.value as TargetChoice)}
            className="rounded bg-neutral-800 px-2 py-1 text-neutral-100"
          >
            <option value="none">Ninguno por ahora</option>
            {LANG_CODES.filter((l) => l !== sourceLang).map((l) => (
              <option key={l} value={l}>
                {LANG_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        disabled={!canOpen}
        onClick={onOpen}
        className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white active:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
      >
        Abrir en el Player
      </button>
    </div>
  )
}
