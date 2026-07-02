/**
 * Settings (BYOK): selector de proveedor + clave por proveedor en localStorage.
 * Móvil-first a 360px. La clave es `type="password"` y nunca se loguea (D6, FR-004).
 * Spec: specs/003-translate-api-byok · contrato: contracts/settings-ui.md
 */
import { useState } from 'react'
import { usePlayerStore } from '../../state/playerStore'
import { useLibraryStore } from '../../state/libraryStore'
import { useSettingsStore } from '../../state/settingsStore'
import { PROVIDERS, getProviderInfo, type ProviderId } from '../../core/services/translator'
import { TRANSCRIBERS, type TranscriberId } from '../../core/services/transcriber'

export default function SettingsScreen() {
  const setScreen = usePlayerStore((s) => s.setScreen)
  const projectId = usePlayerStore((s) => s.projectId)
  const returnScreen = usePlayerStore((s) => s.returnScreen)
  const hasProjects = useLibraryStore((s) => s.projects.length > 0)
  const saveNow = useLibraryStore((s) => s.saveNow)
  // Volver a la pantalla desde la que se entró (así un import a medias no se
  // pierde); sin origen registrado, heurística: Player → Biblioteca → Import.
  const back = returnScreen ?? (projectId ? 'player' : hasProjects ? 'library' : 'import')
  const provider = useSettingsStore((s) => s.provider)
  const setProvider = useSettingsStore((s) => s.setProvider)
  const asrProvider = useSettingsStore((s) => s.asrProvider)
  const setAsrProvider = useSettingsStore((s) => s.setAsrProvider)
  const saveVideoInBrowser = useSettingsStore((s) => s.saveVideoInBrowser)
  const setSaveVideoInBrowser = useSettingsStore((s) => s.setSaveVideoInBrowser)

  const info = getProviderInfo(provider)

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-800 px-4 py-3">
        <button
          type="button"
          onClick={() => setScreen(back)}
          className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 active:bg-neutral-800"
        >
          ← Volver
        </button>
        <h1 className="text-sm font-semibold tracking-tight">Settings</h1>
        {/* [diag] acceso al modo diagnóstico */}
        <button
          type="button"
          onClick={() => setScreen('diagnostics')}
          className="ml-auto rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 active:bg-neutral-800"
        >
          Diagnóstico
        </button>
      </header>

      <div className="flex flex-col gap-6 px-4 py-5">
        <section className="flex flex-col gap-2">
          <label htmlFor="provider" className="text-xs font-medium text-neutral-400">
            Proveedor de traducción
          </label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderId)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.implemented ? '' : ' (próximamente)'}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500">
            Familia: {familyLabel(info.family)}
            {info.needsKey ? ' · requiere API key' : ' · sin clave (demo local)'}
          </p>
          {!info.implemented && (
            <p className="rounded-md bg-amber-950/60 px-3 py-2 text-xs text-amber-300">
              Este proveedor todavía no está disponible. Úsalo cuando se implemente o
              elige Groq / Mock (demo).
            </p>
          )}
        </section>

        {info.needsKey && (
          <section className="flex flex-col gap-2">
            <ApiKeyField providerId={provider} label={info.label} />
          </section>
        )}

        {/* --- Transcripción (ASR), spec 005 --- */}
        <section className="flex flex-col gap-2 border-t border-neutral-800 pt-5">
          <label htmlFor="asr" className="text-xs font-medium text-neutral-400">
            Transcripción del audio (cuando no hay subtítulos)
          </label>
          <select
            id="asr"
            value={asrProvider}
            onChange={(e) => setAsrProvider(e.target.value as TranscriberId)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          >
            {TRANSCRIBERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500">
            Genera los subtítulos a partir del audio del video. Groq y OpenAI comparten la
            misma API key con su proveedor de traducción: si ya la pusiste arriba, vale; si
            no, pégala aquí.
          </p>
          {asrProvider !== 'mock' && (
            <ApiKeyField
              providerId={asrProvider}
              label={getProviderInfo(asrProvider).label}
            />
          )}
        </section>

        {/* --- Guardar el video en el navegador (US3) --- */}
        <section className="flex flex-col gap-2 border-t border-neutral-800 pt-5">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-neutral-200">
              Guardar el video en el navegador
            </span>
            <input
              type="checkbox"
              checked={saveVideoInBrowser}
              onChange={(e) => {
                setSaveVideoInBrowser(e.target.checked)
                // Aplica el cambio al proyecto abierto sin esperar al próximo guardado.
                void saveNow()
              }}
              className="h-5 w-9 shrink-0 appearance-none rounded-full bg-neutral-700 transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:rounded-full before:bg-white before:transition-transform checked:bg-sky-500 checked:before:translate-x-[1.125rem]"
            />
          </label>
          <p className="text-xs text-neutral-500">
            Por defecto solo guardamos los subtítulos y tu progreso (ocupan poco). El
            video pesa mucho: si lo activas, al reabrir el proyecto se reproduce sin
            volver a elegir el archivo, pero el navegador puede borrarlo para liberar
            espacio y, si no cabe, guardaremos solo los subtítulos.
          </p>
        </section>
      </div>
    </div>
  )
}

/**
 * Campo de API key reutilizable, ligado a un proveedor por su `id`. La traducción y la
 * transcripción comparten el almacén de claves por `id` (Groq/OpenAI sirven a ambos), así
 * que reusarlo aquí garantiza que el ASR tenga DÓNDE pegar su clave aunque el proveedor de
 * traducción sea otro. La clave vive solo en localStorage (D6, FR-004).
 */
function ApiKeyField({ providerId, label }: { providerId: ProviderId; label: string }) {
  const savedKey = useSettingsStore((s) => s.keys[providerId])
  const setKey = useSettingsStore((s) => s.setKey)
  const clearKey = useSettingsStore((s) => s.clearKey)
  // Borrador local del input; se confirma con "Guardar".
  const [draft, setDraft] = useState('')

  const onSave = () => {
    if (draft.trim() === '') return
    setKey(providerId, draft.trim())
    setDraft('')
  }
  const onClear = () => {
    clearKey(providerId)
    setDraft('')
  }

  return (
    <>
      <label htmlFor={`apikey-${providerId}`} className="text-xs font-medium text-neutral-400">
        API key de {label}
      </label>
      <input
        id={`apikey-${providerId}`}
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder={savedKey ? '•••••••• (guardada)' : 'Pega tu clave'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={draft.trim() === ''}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white active:bg-sky-700 disabled:bg-neutral-800 disabled:text-neutral-600"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!savedKey}
          className="rounded-lg px-4 py-2 text-sm font-medium text-rose-400 active:bg-neutral-800 disabled:text-neutral-700"
        >
          Borrar
        </button>
        <span className="ml-auto text-xs text-neutral-500">
          {savedKey ? 'Clave guardada ✓' : 'Sin clave'}
        </span>
      </div>
      <p className="text-xs text-neutral-500">
        La clave se guarda solo en este dispositivo (localStorage). Nunca se envía a otro
        sitio salvo a {label}.
      </p>
    </>
  )
}

function familyLabel(family: string): string {
  if (family === 'llm') return 'LLM'
  if (family === 'mt') return 'Traductor dedicado'
  return 'Demo local'
}
