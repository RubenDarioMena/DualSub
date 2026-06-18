/**
 * Selector del adaptador de persistencia (FR-012). Devuelve el adaptador IndexedDB
 * si está disponible; si no (modo privado / IDB bloqueado), cae al adaptador en
 * memoria (la app sigue usable, sin guardar). La elección se cachea.
 * Spec: specs/004-local-persistence
 */
import type { ProjectStore } from '../../core/services/projectStore'
import { idbProjectStore } from './idbProjectStore'
import { memoryProjectStore } from './memoryProjectStore'

let cached: ProjectStore | undefined

export async function getProjectStore(): Promise<ProjectStore> {
  if (cached) return cached
  if (typeof indexedDB !== 'undefined' && (await idbProjectStore.available())) {
    cached = idbProjectStore
  } else {
    cached = memoryProjectStore
  }
  return cached
}
