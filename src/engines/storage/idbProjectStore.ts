/**
 * Adaptador IndexedDB del puerto `ProjectStore` (IO: vive fuera de core, const. I).
 * Dos object stores: `projects` (registro con doc serializado + metadatos cacheados)
 * y `media` (blobs de video). `list()` no toca blobs ni parsea docs (campos cacheados).
 * Guardado atómico por proyecto con degradación ante cuota (FR-008/FR-011).
 * Spec: specs/004-local-persistence · contrato: contracts/project-store.md
 */
import { serializeDualSub, parseDualSub } from '../../core/formats/dualsub'
import type { LangCode } from '../../core/models'
import type { TrackView } from '../../core/tracks'
import type {
  MediaRef,
  ProjectStore,
  StorageMode,
  StoredProject,
  StoredProjectMeta,
} from '../../core/services/projectStore'

const DB_NAME = 'dualsub'
const DB_VERSION = 1
const STORE_PROJECTS = 'projects'
const STORE_MEDIA = 'media'

/** Registro persistido: doc serializado + langs cacheados para listar barato. */
interface ProjectRecord {
  id: string
  schemaVersion: 1
  title: string
  docJson: string
  /** Idiomas del proyecto (maestro primero). Registros pre-007 no lo tienen. */
  langs?: LangCode[]
  /** Vista Arriba/Abajo elegida (spec 007). */
  view?: TrackView
  /** Campos legacy (pre-007), solo para leer registros antiguos. */
  sourceLang?: LangCode
  targetLang?: LangCode
  availableLangs?: LangCode[]
  offsetMs: number
  positionMs: number
  storageMode: StorageMode
  media: MediaRef
  createdAt: number
  updatedAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function getDb(): Promise<IDBDatabase> {
  return (dbPromise ??= openDb())
}

/** Envuelve una IDBRequest en promesa. */
function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function putRecord(record: ProjectRecord): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(STORE_PROJECTS, 'readwrite')
  await reqToPromise(tx.objectStore(STORE_PROJECTS).put(record))
}

async function getRecord(id: string): Promise<ProjectRecord | undefined> {
  const db = await getDb()
  const tx = db.transaction(STORE_PROJECTS, 'readonly')
  return reqToPromise<ProjectRecord | undefined>(
    tx.objectStore(STORE_PROJECTS).get(id) as IDBRequest<ProjectRecord | undefined>,
  )
}

/** Idiomas del documento: el maestro primero, sin duplicados (spec 007). */
function collectLangs(project: StoredProject): LangCode[] {
  const doc = project.doc
  const master = doc.tracks.find((t) => t.id === doc.masterId) ?? doc.tracks[0]
  const seen = new Set<LangCode>([master.lang])
  for (const t of doc.tracks) seen.add(t.lang)
  return [...seen]
}

function toRecord(project: StoredProject, createdAt: number): ProjectRecord {
  return {
    id: project.id,
    schemaVersion: 1,
    title: project.title,
    docJson: serializeDualSub(project.doc),
    langs: collectLangs(project),
    ...(project.view ? { view: project.view } : {}),
    offsetMs: project.offsetMs,
    positionMs: project.positionMs,
    storageMode: project.storageMode,
    media: project.media,
    createdAt,
    updatedAt: Date.now(),
  }
}

/** Idiomas para listar, tolerante con registros pre-007 (sourceLang/targetLang). */
function recordLangs(r: ProjectRecord): LangCode[] {
  if (r.langs && r.langs.length > 0) return r.langs
  const seen = new Set<LangCode>()
  if (r.sourceLang) seen.add(r.sourceLang)
  for (const l of r.availableLangs ?? []) seen.add(l)
  return [...seen]
}

function toMeta(r: ProjectRecord): StoredProjectMeta {
  const hasVideo = r.storageMode === 'with-video'
  return {
    id: r.id,
    title: r.title,
    langs: recordLangs(r),
    storageMode: r.storageMode,
    hasVideo,
    sizeBytes: r.docJson.length + (hasVideo ? r.media.sizeBytes : 0),
    updatedAt: r.updatedAt,
  }
}

async function deleteMedia(id: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(STORE_MEDIA, 'readwrite')
  await reqToPromise(tx.objectStore(STORE_MEDIA).delete(id))
}

function isQuotaError(e: unknown): boolean {
  return e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)
}

export const idbProjectStore: ProjectStore = {
  async available() {
    try {
      await getDb()
      return true
    } catch {
      dbPromise = null
      return false
    }
  },

  async list() {
    const db = await getDb()
    const tx = db.transaction(STORE_PROJECTS, 'readonly')
    const records = await reqToPromise<ProjectRecord[]>(
      tx.objectStore(STORE_PROJECTS).getAll() as IDBRequest<ProjectRecord[]>,
    )
    return records.map(toMeta).sort((a, b) => b.updatedAt - a.updatedAt)
  },

  async get(id) {
    const r = await getRecord(id)
    if (!r) return null
    return {
      id: r.id,
      schemaVersion: 1,
      title: r.title,
      // parseDualSub migra al vuelo los docs v1 guardados antes de la 007.
      doc: parseDualSub(r.docJson),
      ...(r.view ? { view: r.view } : {}),
      offsetMs: r.offsetMs,
      positionMs: r.positionMs,
      storageMode: r.storageMode,
      media: r.media,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  },

  async getMedia(id) {
    const db = await getDb()
    const tx = db.transaction(STORE_MEDIA, 'readonly')
    const row = await reqToPromise<{ id: string; blob: Blob } | undefined>(
      tx.objectStore(STORE_MEDIA).get(id) as IDBRequest<{ id: string; blob: Blob } | undefined>,
    )
    return row?.blob ?? null
  },

  async save(project, media) {
    const existing = await getRecord(project.id)
    const record = toRecord(project, existing?.createdAt ?? project.createdAt ?? Date.now())

    let videoSaved = false
    let degradedToLight = false

    if (project.storageMode === 'with-video' && media) {
      try {
        const db = await getDb()
        const tx = db.transaction(STORE_MEDIA, 'readwrite')
        await reqToPromise(tx.objectStore(STORE_MEDIA).put({ id: project.id, blob: media }))
        videoSaved = true
      } catch (e) {
        if (!isQuotaError(e)) throw e
        // Cuota excedida: degradar a ligero sin perder el doc (FR-008).
        await deleteMedia(project.id)
        record.storageMode = 'light'
        degradedToLight = true
      }
    } else {
      // Modo ligero (o sin blob): borrar cualquier video previo del proyecto.
      await deleteMedia(project.id)
    }

    await putRecord(record)
    return { ok: true, videoSaved, degradedToLight }
  },

  async remove(id) {
    const db = await getDb()
    const tx = db.transaction([STORE_PROJECTS, STORE_MEDIA], 'readwrite')
    await Promise.all([
      reqToPromise(tx.objectStore(STORE_PROJECTS).delete(id)),
      reqToPromise(tx.objectStore(STORE_MEDIA).delete(id)),
    ])
  },

  async usage() {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate()
      return { usedBytes: est.usage ?? 0, quotaBytes: est.quota }
    }
    return { usedBytes: 0 }
  },
}
