/**
 * Estado de Settings (BYOK). El proveedor activo y la clave **por proveedor** se
 * persisten SOLO en `localStorage`, con lectura/escritura explícita (sin middleware)
 * para que la superficie de la credencial sea auditable (D6). La clave nunca se
 * loguea ni sale salvo hacia el proveedor elegido. Spec: 003-translate-api-byok.
 */
import { create } from 'zustand'
import type { ProviderId } from '../core/services/translator'

const STORAGE_KEY = 'dualsub.settings'

interface PersistedSettings {
  provider: ProviderId
  keys: Partial<Record<ProviderId, string>>
}

const DEFAULTS: PersistedSettings = { provider: 'mock', keys: {} }

function load(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    return {
      provider: parsed.provider ?? DEFAULTS.provider,
      keys: parsed.keys ?? {},
    }
  } catch {
    return DEFAULTS
  }
}

function persist(state: PersistedSettings): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ provider: state.provider, keys: state.keys }),
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
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...load(),

  setProvider: (id) => {
    set({ provider: id })
    persist({ provider: id, keys: get().keys })
  },
  setKey: (id, key) => {
    const keys = { ...get().keys, [id]: key }
    set({ keys })
    persist({ provider: get().provider, keys })
  },
  clearKey: (id) => {
    const keys = { ...get().keys }
    delete keys[id]
    set({ keys })
    persist({ provider: get().provider, keys })
  },
}))
