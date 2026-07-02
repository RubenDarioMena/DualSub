/**
 * Estado de runtime del Player (Zustand). Capa UI: puede tocar DOM (object URLs),
 * pero el cálculo del segmento activo se delega a `src/core/sync` (puro).
 * Spec: specs/001-player-dual-mock · contrato: contracts/player-store.md
 */
import { create } from 'zustand'
import type { DualSubDocument } from '../core/models'
import { resolveView, type TrackView } from '../core/tracks'
import type { MediaRef } from '../core/services/projectStore'
import { getMockDualSubDocument } from '../engines/mock/mockDocument'

export type ViewMode = 'list' | 'overlay'

/**
 * Genera un id de proyecto. `crypto.randomUUID` SOLO existe en contexto seguro
 * (https/localhost); en LAN http (uso real en el teléfono) no está, así que hay
 * fallback con `getRandomValues` (sí disponible en http) o `Math.random`. Spec 004.
 */
function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch {
    // contexto no seguro: seguimos al fallback
  }
  const b = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'))
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`
}

/** Pantalla activa de la app (sin router; spec 002 D10, spec 003 D9, spec 004). */
export type Screen = 'import' | 'player' | 'settings' | 'diagnostics' | 'library'

interface PlayerState {
  /** Pantalla activa: arranca en Import hasta que un import válido abre el Player. */
  screen: Screen
  /** Desde dónde se entró a Settings, para que «Volver» regrese ahí (spec 007). */
  returnScreen: Screen | null
  /** Object URL del video local; `null` antes de elegir. */
  mediaUrl: string | null
  /** Identidad del archivo de video (nombre/tamaño) para persistencia (spec 004). */
  mediaRef: MediaRef | null
  /**
   * Blob real del video, retenido para poder guardarlo en el navegador (US3). Solo
   * vive en RAM; se persiste a IndexedDB si el interruptor de Settings está activo.
   */
  mediaBlob: Blob | null
  /** Documento dual activo (mock al inicio; reemplazado por `loadProject`). */
  doc: DualSubDocument
  /** Pista mostrada arriba (spec 007). Siempre existe en `doc.tracks`. */
  topId: string
  /** Pista mostrada abajo, o `null` para "solo arriba" (spec 007). */
  bottomId: string | null
  /** Id del proyecto persistido; `null` mientras está el mock inicial (spec 004). */
  projectId: string | null
  /** Desfase de sincronización en ms (±). No muta `doc`. */
  offsetMs: number
  /** Última posición de reproducción en ms (auto-guardada; spec 004). */
  positionMs: number
  isPlaying: boolean
  /** Índice del segmento activo, o -1 en hueco / fuera de rango. */
  activeIndex: number
  viewMode: ViewMode
  /** Petición de seek pendiente (ms de video) que `VideoStage` aplica y limpia. */
  seekRequestMs: number | null
  /**
   * Índice del segmento en bucle (repite `[startMs, endMs)` del segmento), o
   * `null` sin bucle. Estado efímero de runtime; no se persiste.
   */
  loopIndex: number | null

  /**
   * Carga un proyecto y abre el Player. Sin `projectId` se trata como proyecto
   * NUEVO (Import 002 → id nuevo); con `projectId` continúa uno existente (Translate
   * 003 / restaurar 004). `offsetMs`/`positionMs` por defecto 0 salvo al restaurar.
   */
  loadProject: (p: {
    doc: DualSubDocument
    mediaUrl: string | null
    projectId?: string
    offsetMs?: number
    positionMs?: number
    mediaRef?: MediaRef | null
    mediaBlob?: Blob | null
    view?: TrackView | null
  }) => void
  /**
   * Reemplaza SOLO el documento (p. ej. tras traducir): conserva posición,
   * offset, reproducción y video; la vista se re-valida contra las pistas
   * nuevas. Nada "se reinicia" (spec 007, fix del reset de 003).
   */
  updateDoc: (doc: DualSubDocument) => void
  /** Elige qué pista va arriba y cuál abajo (dropdowns, spec 007). */
  setView: (top: string, bottom: string | null) => void
  /** Cambia la pantalla activa (navegación sin router; spec 003 D9). */
  setScreen: (s: Screen) => void
  setMedia: (url: string | null, ref?: MediaRef | null, blob?: Blob | null) => void
  /** Reporta la posición de reproducción (VideoStage, throttle; spec 004). */
  setPosition: (ms: number) => void
  setOffset: (ms: number) => void
  nudgeOffset: (deltaMs: number) => void
  setPlaying: (playing: boolean) => void
  setActiveIndex: (i: number) => void
  setViewMode: (mode: ViewMode) => void
  requestSeek: (videoMs: number) => void
  clearSeek: () => void
  /** Activa/desactiva el bucle sobre un segmento (mismo índice ⇒ lo apaga). */
  toggleLoop: (index: number) => void
  /** Fija el segmento en bucle, o `null` para quitarlo. */
  setLoop: (index: number | null) => void
}

const initialDoc = getMockDualSubDocument()
const initialView = resolveView(initialDoc)

export const usePlayerStore = create<PlayerState>((set, get) => ({
  screen: 'import',
  returnScreen: null,
  mediaUrl: null,
  mediaRef: null,
  mediaBlob: null,
  doc: initialDoc,
  topId: initialView.top,
  bottomId: initialView.bottom,
  projectId: null,
  offsetMs: 0,
  positionMs: 0,
  isPlaying: false,
  activeIndex: -1,
  viewMode: 'list',
  seekRequestMs: null,
  loopIndex: null,

  // Reemplaza el documento y el video por los del proyecto y abre el Player.
  loadProject: ({ doc, mediaUrl, projectId, offsetMs = 0, positionMs = 0, mediaRef, mediaBlob, view }) => {
    const prev = get().mediaUrl
    if (prev && prev !== mediaUrl) URL.revokeObjectURL(prev)
    const v = resolveView(doc, view)
    set({
      doc,
      topId: v.top,
      bottomId: v.bottom,
      mediaUrl,
      mediaRef: mediaRef ?? (mediaUrl ? get().mediaRef : null),
      // Al continuar un proyecto sin pasar blob (p. ej. traducir) conserva el actual;
      // al abrir uno nuevo sin video (derivar par) lo limpia.
      mediaBlob: mediaBlob !== undefined ? mediaBlob : mediaUrl ? get().mediaBlob : null,
      // Sin projectId explícito ⇒ proyecto NUEVO (id nuevo); con él, continúa.
      projectId: projectId ?? newId(),
      screen: 'player',
      offsetMs,
      positionMs,
      activeIndex: -1,
      isPlaying: false,
      loopIndex: null,
    })
  },
  updateDoc: (doc) => {
    const v = resolveView(doc, { top: get().topId, bottom: get().bottomId })
    set({ doc, topId: v.top, bottomId: v.bottom })
  },
  setView: (top, bottom) => {
    const v = resolveView(get().doc, { top, bottom })
    set({ topId: v.top, bottomId: v.bottom })
  },
  // Al entrar a Settings se recuerda el origen (Diagnóstico no lo pisa: se llega
  // desde Settings y su «Volver» regresa a Settings).
  setScreen: (s) => {
    const cur = get().screen
    if (s === 'settings' && cur !== 'settings' && cur !== 'diagnostics') {
      set({ screen: s, returnScreen: cur })
    } else {
      set({ screen: s })
    }
  },
  // C3: revoca el object URL previo exactamente una vez al reemplazarlo.
  setMedia: (url, ref, blob) => {
    const prev = get().mediaUrl
    if (prev && prev !== url) URL.revokeObjectURL(prev)
    set({
      mediaUrl: url,
      mediaRef: ref !== undefined ? ref : get().mediaRef,
      mediaBlob: blob !== undefined ? blob : get().mediaBlob,
      isPlaying: false,
      activeIndex: -1,
      loopIndex: null,
    })
  },
  setPosition: (ms) => set({ positionMs: Math.max(0, Math.round(ms)) }),
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
  toggleLoop: (index) => set((s) => ({ loopIndex: s.loopIndex === index ? null : index })),
  setLoop: (index) => set({ loopIndex: index }),
}))
