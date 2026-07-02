/**
 * Adaptador en memoria del puerto `ProjectStore`. Fallback cuando IndexedDB no está
 * disponible (modo privado / bloqueado): la app sigue usable en la sesión pero NO
 * persiste — `available()` devuelve `false` (FR-012). También útil en validación.
 * Spec: specs/004-local-persistence · contrato: contracts/project-store.md
 */
import type { LangCode } from '../../core/models'
import type {
  ProjectStore,
  StoredProject,
  StoredProjectMeta,
} from '../../core/services/projectStore'

interface Entry {
  project: StoredProject
  media?: Blob
}

const store = new Map<string, Entry>()

function collectLangs(project: StoredProject): LangCode[] {
  const doc = project.doc
  const master = doc.tracks.find((t) => t.id === doc.masterId) ?? doc.tracks[0]
  const seen = new Set<LangCode>([master.lang])
  for (const t of doc.tracks) seen.add(t.lang)
  return [...seen]
}

function toMeta(p: StoredProject): StoredProjectMeta {
  const hasVideo = p.storageMode === 'with-video'
  return {
    id: p.id,
    title: p.title,
    langs: collectLangs(p),
    storageMode: p.storageMode,
    hasVideo,
    sizeBytes: JSON.stringify(p.doc).length + (hasVideo ? p.media.sizeBytes : 0),
    updatedAt: p.updatedAt,
  }
}

export const memoryProjectStore: ProjectStore = {
  async available() {
    return false
  },
  async list() {
    return [...store.values()]
      .map((e) => toMeta(e.project))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },
  async get(id) {
    return store.get(id)?.project ?? null
  },
  async getMedia(id) {
    return store.get(id)?.media ?? null
  },
  async save(project, media) {
    const prev = store.get(project.id)
    const createdAt = prev?.project.createdAt ?? project.createdAt ?? Date.now()
    const wantsVideo = project.storageMode === 'with-video' && !!media
    store.set(project.id, {
      project: { ...project, createdAt, updatedAt: Date.now() },
      media: wantsVideo ? media : undefined,
    })
    return { ok: true, videoSaved: wantsVideo, degradedToLight: false }
  },
  async remove(id) {
    store.delete(id)
  },
  async usage() {
    return { usedBytes: 0 }
  },
}
