/**
 * Settings (BYOK): selector de proveedor + clave por proveedor en localStorage.
 * Móvil-first a 360px. La clave es `type="password"` y nunca se loguea (D6, FR-004).
 * Spec: specs/003-translate-api-byok · contrato: contracts/settings-ui.md
 */
import { useState } from 'react'
import { usePlayerStore } from '../../state/playerStore'
import { useSettingsStore } from '../../state/settingsStore'
import { PROVIDERS, getProviderInfo, type ProviderId } from '../../core/services/translator'

export default function SettingsScreen() {
  const setScreen = usePlayerStore((s) => s.setScreen)
  const mediaUrl = usePlayerStore((s) => s.mediaUrl)
  const provider = useSettingsStore((s) => s.provider)
  const keys = useSettingsStore((s) => s.keys)
  const setProvider = useSettingsStore((s) => s.setProvider)
  const setKey = useSettingsStore((s) => s.setKey)
  const clearKey = useSettingsStore((s) => s.clearKey)

  const info = getProviderInfo(provider)
  // Borrador local del input; se confirma con "Guardar".
  const [draft, setDraft] = useState('')
  const savedKey = keys[provider]

  const onSave = () => {
    if (draft.trim() === '') return
    setKey(provider, draft.trim())
    setDraft('')
  }
  const onClear = () => {
    clearKey(provider)
    setDraft('')
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-800 px-4 py-3">
        <button
          type="button"
          onClick={() => setScreen(mediaUrl ? 'player' : 'import')}
          className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 active:bg-neutral-800"
        >
          ← Volver
        </button>
        <h1 className="text-sm font-semibold tracking-tight">Settings · Traducción</h1>
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
            <label htmlFor="apikey" className="text-xs font-medium text-neutral-400">
              API key de {info.label}
            </label>
            <input
              id="apikey"
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
              La clave se guarda solo en este dispositivo (localStorage). Nunca se
              envía a otro sitio salvo a {info.label}.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}

function familyLabel(family: string): string {
  if (family === 'llm') return 'LLM'
  if (family === 'mt') return 'Traductor dedicado'
  return 'Demo local'
}
