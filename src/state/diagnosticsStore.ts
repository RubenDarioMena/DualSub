/**
 * [diag] Log de diagnóstico in-app. Captura errores y eventos clave para poder verlos y
 * copiarlos DESDE EL MÓVIL (no hay consola accesible en el teléfono). Se persiste en
 * `localStorage` (capado) para que sobreviva al propio reinicio de la pestaña: si tras
 * apagar la pantalla aparecen dos "app iniciada" seguidas, ahí está el descarte del SO.
 * Capa de estado (como `settingsStore`): toca `localStorage`, nunca el core. Spec: 003.
 */
import { create } from 'zustand'

export type DiagLevel = 'error' | 'warn' | 'info'

export interface DiagEntry {
  /** Epoch ms. */
  t: number
  level: DiagLevel
  msg: string
  /** Texto largo opcional (p.ej. el payload crudo de un fallo de traducción). */
  detail?: string
}

const STORAGE_KEY = 'dualsub.diag'
const MAX_ENTRIES = 200
/** Trunca detalles largos para no reventar localStorage. */
const MAX_DETAIL = 4000

function load(): DiagEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as DiagEntry[]) : []
  } catch {
    return []
  }
}

function persist(entries: DiagEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage lleno o no disponible: el log sigue en runtime.
  }
}

interface DiagnosticsState {
  entries: DiagEntry[]
  log: (level: DiagLevel, msg: string, detail?: string) => void
  clear: () => void
}

export const useDiagnosticsStore = create<DiagnosticsState>((set, get) => ({
  entries: load(),

  log: (level, msg, detail) => {
    const entry: DiagEntry = {
      t: Date.now(),
      level,
      msg: String(msg).slice(0, 1000),
      detail: detail ? String(detail).slice(0, MAX_DETAIL) : undefined,
    }
    // Más reciente al final; recorta por el principio si excede el tope.
    const next = [...get().entries, entry].slice(-MAX_ENTRIES)
    set({ entries: next })
    persist(next)
  },

  clear: () => {
    set({ entries: [] })
    persist([])
  },
}))

/** Atajo para loguear sin hook (handlers globales, capa de engines/UI). */
export function diag(level: DiagLevel, msg: string, detail?: string): void {
  useDiagnosticsStore.getState().log(level, msg, detail)
}
