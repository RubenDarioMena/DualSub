/**
 * Estado de la biblioteca + orquestación del auto-guardado (spec 004). Habla con el
 * puerto `ProjectStore` (IndexedDB o memoria-fallback); la lógica de serialización es
 * del core (000). El auto-guardado se suscribe a `playerStore` y persiste con debounce
 * cuando cambia el doc/offset/posición de un proyecto con `projectId` (no el mock).
 * Spec: specs/004-local-persistence · contrato: contracts/library-ui.md
 */
import { create } from 'zustand'
import type {
  StorageMode,
  StoredProject,
  StoredProjectMeta,
} from '../core/services/projectStore'
import type { LangCode } from '../core/models'
import { combineByPivot, selectPair, PivotMismatchError } from '../core/project/combine'
import { getProjectStore } from '../engines/storage'
import { usePlayerStore } from './playerStore'
import { useSettingsStore } from './settingsStore'

interface LibraryState {
  projects: StoredProjectMeta[]
  /** ¿Persistencia real disponible? `false` ⇒ avisar "no se guardará" (FR-012). */
  available: boolean
  ready: boolean
  usedBytes: number
  /** El último guardado pidió video pero no cupo y degradó a ligero (US3, FR-008). */
  videoDegraded: boolean
  /** Refresca la lista y el estado de disponibilidad/espacio. */
  refresh: () => Promise<void>
  /** Restaura un proyecto guardado en el Player. */
  open: (id: string) => Promise<void>
  /** Borra un proyecto (doc + video) y refresca la lista. */
  remove: (id: string) => Promise<void>
  /** Guarda YA el proyecto activo (al activar/desactivar el video, US3). */
  saveNow: () => Promise<void>
  /** Descarta el aviso de degradación de video. */
  dismissVideoNotice: () => void
  /**
   * Deriva un par (p. ej. ES/JA) combinando dos proyectos que comparten el inglés
   * base y la rejilla de tiempos, SIN traducir (US4). Abre el resultado en el Player.
   * Devuelve `false` si no comparten esqueleto (no toca los originales).
   */
  derivePair: (idA: string, idB: string, source: LangCode, target: LangCode) => Promise<boolean>
  /** Al arrancar: si hay proyectos, aterriza en la Biblioteca (US2). */
  init: () => Promise<void>
}

/** Construye el registro persistible desde el estado actual del Player. */
function buildStoredProject(
  p: ReturnType<typeof usePlayerStore.getState>,
  storageMode: StorageMode,
): StoredProject {
  const now = Date.now()
  return {
    id: p.projectId as string,
    schemaVersion: 1,
    title: p.doc.meta?.title ?? p.mediaRef?.name ?? 'Proyecto',
    doc: p.doc,
    offsetMs: p.offsetMs,
    positionMs: p.positionMs,
    storageMode,
    media: p.mediaRef ?? { name: 'video', sizeBytes: 0 },
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Persiste el estado actual del Player aplicando la preferencia de video (US3):
 * si el interruptor está activo y hay blob, guarda 'with-video'; ante cuota, el
 * adaptador degrada a ligero y lo refleja en `SaveResult.degradedToLight`.
 */
async function persistActive(): Promise<void> {
  const p = usePlayerStore.getState()
  if (!p.projectId) return
  const wantVideo = useSettingsStore.getState().saveVideoInBrowser && !!p.mediaBlob
  const store = await getProjectStore()
  const project = buildStoredProject(p, wantVideo ? 'with-video' : 'light')
  const result = await store.save(project, wantVideo ? (p.mediaBlob as Blob) : undefined)
  await useLibraryStore.getState().refresh()
  if (result.degradedToLight) useLibraryStore.setState({ videoDegraded: true })
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  projects: [],
  available: false,
  ready: false,
  usedBytes: 0,
  videoDegraded: false,

  refresh: async () => {
    const store = await getProjectStore()
    const [projects, available, usage] = await Promise.all([
      store.list(),
      store.available(),
      store.usage(),
    ])
    set({ projects, available, usedBytes: usage.usedBytes, ready: true })
  },

  open: async (id) => {
    const store = await getProjectStore()
    const proj = await store.get(id)
    if (!proj) return
    let mediaUrl: string | null = null
    let mediaBlob: Blob | null = null
    if (proj.storageMode === 'with-video') {
      const blob = await store.getMedia(id)
      if (blob) {
        mediaBlob = blob
        mediaUrl = URL.createObjectURL(blob)
      }
    }
    usePlayerStore.getState().loadProject({
      doc: proj.doc,
      mediaUrl,
      projectId: proj.id,
      offsetMs: proj.offsetMs,
      positionMs: proj.positionMs,
      mediaRef: proj.media,
      mediaBlob,
    })
  },

  remove: async (id) => {
    const store = await getProjectStore()
    await store.remove(id)
    await get().refresh()
  },

  saveNow: async () => {
    await persistActive()
  },

  dismissVideoNotice: () => set({ videoDegraded: false }),

  derivePair: async (idA, idB, source, target) => {
    const store = await getProjectStore()
    const [a, b] = await Promise.all([store.get(idA), store.get(idB)])
    if (!a || !b) return false
    try {
      const combined = combineByPivot(a.doc, b.doc)
      const paired = selectPair(combined, source, target)
      const title = `${source.toUpperCase()}→${target.toUpperCase()} · ${a.title}`
      const doc = { ...paired, meta: { ...paired.meta, title } }
      // Proyecto NUEVO (id nuevo), ligero y sin video; el auto-guardado lo persiste.
      usePlayerStore.getState().loadProject({ doc, mediaUrl: null })
      return true
    } catch (e) {
      if (e instanceof PivotMismatchError) return false
      throw e
    }
  },

  init: async () => {
    await get().refresh()
    // US2: si hay proyectos, la Biblioteca es el hogar (en vez de saltar al último).
    if (get().projects.length > 0 && !usePlayerStore.getState().projectId) {
      usePlayerStore.getState().setScreen('library')
    }
  },
}))

// --- Auto-guardado (suscripción fuera de React) -----------------------------
let saveTimer: ReturnType<typeof setTimeout> | undefined

function scheduleSave(): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void persistActive()
  }, 1000)
}

usePlayerStore.subscribe((s, prev) => {
  if (!s.projectId) return
  if (
    s.projectId === prev.projectId &&
    s.doc === prev.doc &&
    s.offsetMs === prev.offsetMs &&
    s.positionMs === prev.positionMs &&
    s.mediaBlob === prev.mediaBlob
  ) {
    return
  }
  scheduleSave()
})
