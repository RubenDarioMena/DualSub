/**
 * Estado de runtime del Player (Zustand). Capa UI: puede tocar DOM (object URLs),
 * pero el cálculo del segmento activo se delega a `src/core/sync` (puro).
 * Spec: specs/001-player-dual-mock · contrato: contracts/player-store.md
 */
import { create } from 'zustand'
import type { DualSubDocument } from '../core/models'
import { getMockDualSubDocument } from '../engines/mock/mockDocument'

export type ViewMode = 'list' | 'overlay'

/** Pantalla activa de la app (sin router; spec 002 D10). */
export type Screen = 'import' | 'player'

interface PlayerState {
  /** Pantalla activa: arranca en Import hasta que un import válido abre el Player. */
  screen: Screen
  /** Object URL del video local; `null` antes de elegir. */
  mediaUrl: string | null
  /** Documento dual activo (mock al inicio; reemplazado por `loadProject`). */
  doc: DualSubDocument
  /** Desfase de sincronización en ms (±). No muta `doc`. */
  offsetMs: number
  isPlaying: boolean
  /** Índice del segmento activo, o -1 en hueco / fuera de rango. */
  activeIndex: number
  viewMode: ViewMode
  /** Petición de seek pendiente (ms de video) que `VideoStage` aplica y limpia. */
  seekRequestMs: number | null

  /** Carga un proyecto importado (spec 002) y abre el Player. */
  loadProject: (p: { doc: DualSubDocument; mediaUrl: string }) => void
  setMedia: (url: string | null) => void
  setOffset: (ms: number) => void
  nudgeOffset: (deltaMs: number) => void
  setPlaying: (playing: boolean) => void
  setActiveIndex: (i: number) => void
  setViewMode: (mode: ViewMode) => void
  requestSeek: (videoMs: number) => void
  clearSeek: () => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  screen: 'import',
  mediaUrl: null,
  doc: getMockDualSubDocument(),
  offsetMs: 0,
  isPlaying: false,
  activeIndex: -1,
  viewMode: 'list',
  seekRequestMs: null,

  // Reemplaza el documento y el video por los del import y abre el Player.
  loadProject: ({ doc, mediaUrl }) => {
    const prev = get().mediaUrl
    if (prev && prev !== mediaUrl) URL.revokeObjectURL(prev)
    set({
      doc,
      mediaUrl,
      screen: 'player',
      offsetMs: 0,
      activeIndex: -1,
      isPlaying: false,
    })
  },
  // C3: revoca el object URL previo exactamente una vez al reemplazarlo.
  setMedia: (url) => {
    const prev = get().mediaUrl
    if (prev && prev !== url) URL.revokeObjectURL(prev)
    set({ mediaUrl: url, isPlaying: false, activeIndex: -1 })
  },
  setOffset: (ms) => set({ offsetMs: Math.round(ms) }),
  nudgeOffset: (deltaMs) => set((s) => ({ offsetMs: s.offsetMs + deltaMs })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  // R2: solo re-renderiza si el índice realmente cambió.
  setActiveIndex: (i) => {
    if (i !== get().activeIndex) set({ activeIndex: i })
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  // C2: nunca deja un seek negativo.
  requestSeek: (videoMs) => set({ seekRequestMs: Math.max(0, videoMs) }),
  clearSeek: () => set({ seekRequestMs: null }),
}))
