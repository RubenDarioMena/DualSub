/**
 * Estado de Settings (BYOK). El proveedor activo y la clave **por proveedor** se
 * persisten SOLO en `localStorage`, con lectura/escritura explícita (sin middleware)
 * para que la superficie de la credencial sea auditable (D6). La clave nunca se
 * loguea ni sale salvo hacia el proveedor elegido. Spec: 003-translate-api-byok.
 */
import { create } from 'zustand'
import type { ProviderId } from '../core/services/translator'
import type { TranscriberId } from '../core/services/transcriber'

const STORAGE_KEY = 'dualsub.settings'

interface PersistedSettings {
  provider: ProviderId
  keys: Partial<Record<ProviderId, string>>
  /** Proveedor de transcripción (ASR) activo; reusa la clave del mismo id (spec 005). */
  asrProvider: TranscriberId
  /** Guardar también el video en el navegador (spec 004, US3). Por defecto `false`. */
  saveVideoInBrowser: boolean
}

const DEFAULTS: PersistedSettings = {
  provider: 'mock',
  keys: {},
  asrProvider: 'mock',
  saveVideoInBrowser: false,
}

function load(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    return {
      provider: parsed.provider ?? DEFAULTS.provider,
      keys: parsed.keys ?? {},
      asrProvider: parsed.asrProvider ?? DEFAULTS.asrProvider,
      saveVideoInBrowser: parsed.saveVideoInBrowser ?? DEFAULTS.saveVideoInBrowser,
    }
  } catch {
    return DEFAULTS
  }
}

function persist(state: PersistedSettings): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        provider: state.provider,
        keys: state.keys,
        asrProvider: state.asrProvider,
        saveVideoInBrowser: state.saveVideoInBrowser,
      }),
    )
  } catch {
    // localStorage no disponible (modo privado): la sesión sigue en runtime.
  }
}

interface SettingsState extends PersistedSettings {
  /** Cambia el proveedor activo; NO borra las claves de otros. */
  setProvider: (id: ProviderId) => void
  /** Guarda/actualiza la clave de un proveedor. */
  setKey: (id: ProviderId, key: string) => void
  /** Elimina la clave de un proveedor (de runtime y de localStorage). */
  clearKey: (id: ProviderId) => void
  /** Cambia el proveedor de transcripción (ASR). */
  setAsrProvider: (id: TranscriberId) => void
  /** Activa/desactiva guardar el video en el navegador (US3). */
  setSaveVideoInBrowser: (on: boolean) => void
}

/** Estado persistido actual (para `persist` sin repetir lecturas). */
function snapshot(get: () => SettingsState): PersistedSettings {
  const s = get()
  return {
    provider: s.provider,
    keys: s.keys,
    asrProvider: s.asrProvider,
    saveVideoInBrowser: s.saveVideoInBrowser,
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...load(),

  setProvider: (id) => {
    set({ provider: id })
    persist(snapshot(get))
  },
  setKey: (id, key) => {
    set({ keys: { ...get().keys, [id]: key } })
    persist(snapshot(get))
  },
  clearKey: (id) => {
    const keys = { ...get().keys }
    delete keys[id]
    set({ keys })
    persist(snapshot(get))
  },
  setAsrProvider: (id) => {
    set({ asrProvider: id })
    persist(snapshot(get))
  },
  setSaveVideoInBrowser: (on) => {
    set({ saveVideoInBrowser: on })
    persist(snapshot(get))
  },
}))
