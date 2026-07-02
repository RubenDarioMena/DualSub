/**
 * Puerto de persistencia de proyectos (interfaz PURA: sin DOM/IndexedDB/fetch).
 * Las implementaciones viven en `src/engines/storage/` (IndexedDB real + memoria
 * fallback). La UI/estado consumen esta interfaz, no la implementación (const. II),
 * para poder migrar a almacenamiento nativo (Capacitor/RN) sin tocar UI ni core.
 * Spec: specs/004-local-persistence · contrato: contracts/project-store.md
 */
import type { DualSubDocument, LangCode } from '../models'
import type { TrackView } from '../tracks'

/** Identidad del archivo de video (modo ligero: re-pedir el mismo archivo). */
export interface MediaRef {
  name: string
  sizeBytes: number
  durationMs?: number
  mimeType?: string
}

export type StorageMode = 'light' | 'with-video'

/** Registro completo de un proyecto guardado (el blob de video va aparte). */
export interface StoredProject {
  id: string
  schemaVersion: 1
  title: string
  doc: DualSubDocument
  offsetMs: number
  /** Última posición de reproducción, en ms. */
  positionMs: number
  /** Vista Arriba/Abajo elegida (spec 007); ausente en registros antiguos. */
  view?: TrackView
  storageMode: StorageMode
  media: MediaRef
  createdAt: number
  updatedAt: number
}

/** Proyección ligera para listar la biblioteca (sin cargar docs pesados ni blobs). */
export interface StoredProjectMeta {
  id: string
  title: string
  /** Idiomas del proyecto (el maestro primero, sin duplicados). */
  langs: LangCode[]
  storageMode: StorageMode
  hasVideo: boolean
  /** Tamaño aproximado ocupado (doc + video si lo hay). */
  sizeBytes: number
  updatedAt: number
}

/** Resultado de `save`: refleja la degradación elegante por cuota (FR-008). */
export interface SaveResult {
  ok: true
  videoSaved: boolean
  degradedToLight: boolean
}

/** Puerto de persistencia. Ninguna operación hace red (FR-010). */
export interface ProjectStore {
  /** ¿Persistencia real disponible? `false` en modo privado / IDB bloqueado (FR-012). */
  available(): Promise<boolean>
  /** Metadatos de todos los proyectos, orden `updatedAt` desc. */
  list(): Promise<StoredProjectMeta[]>
  /** Proyecto completo (con `doc`), sin el blob de video. `null` si no existe. */
  get(id: string): Promise<StoredProject | null>
  /** Blob de video bajo demanda (`null` en modo ligero o si fue evictado). */
  getMedia(id: string): Promise<Blob | null>
  /**
   * Upsert. Si `media` y `storageMode==='with-video'`, intenta guardar el blob;
   * ante cuota, degrada a 'light' y lo refleja en `SaveResult`. Nunca pierde el doc.
   */
  save(project: StoredProject, media?: Blob): Promise<SaveResult>
  remove(id: string): Promise<void>
  /** Espacio usado/cuota del navegador (navigator.storage.estimate). */
  usage(): Promise<{ usedBytes: number; quotaBytes?: number }>
}
