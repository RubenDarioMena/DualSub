# Contrato: puerto `ProjectStore` (persistencia local)

**Spec**: [../spec.md](../spec.md) · **Plan**: [../plan.md](../plan.md) · **Data model**: [../data-model.md](../data-model.md)

Interfaz **pura** en `src/core/services/projectStore.ts` (sin DOM). Implementaciones en
`src/engines/storage/`: `idbProjectStore` (IndexedDB) y `memoryProjectStore` (fallback/tests).
`getProjectStore()` selecciona en runtime.

## Métodos y garantías

| Método | Entrada | Salida | Garantías |
|---|---|---|---|
| `available()` | — | `Promise<boolean>` | `true` si IndexedDB usable; `false` en modo privado/bloqueado (se usa memoria). No lanza. |
| `list()` | — | `Promise<StoredProjectMeta[]>` | Solo metadatos; **no** carga `doc` pesado ni blobs. Orden por `updatedAt` desc. |
| `get(id)` | `id` | `Promise<StoredProject \| null>` | Devuelve el proyecto completo (con `doc`), **sin** blob. `null` si no existe. |
| `getMedia(id)` | `id` | `Promise<Blob \| null>` | Blob bajo demanda. `null` en modo ligero o si fue evictado. |
| `save(project, media?)` | `StoredProject`, `Blob?` | `Promise<SaveResult>` | Upsert atómico por proyecto. Ver reglas de cuota abajo. |
| `remove(id)` | `id` | `Promise<void>` | Borra de `projects` **y** `media`. Idempotente. |
| `usage()` | — | `Promise<{usedBytes; quotaBytes?}>` | De `navigator.storage.estimate()`; `quotaBytes` puede faltar. |

## Reglas de `save` (FR-001, FR-003, FR-008)

1. Escribe siempre el registro en `projects` (doc + metadatos + `updatedAt = now`).
2. Si `project.storageMode === 'with-video'` **y** se pasó `media`:
   - intenta `put` del blob en `media`.
   - **éxito** → `SaveResult { ok, videoSaved: true, degradedToLight: false }`.
   - **`QuotaExceededError`** → borra cualquier blob previo del proyecto, fija
     `storageMode='light'` en el registro persistido, y devuelve
     `SaveResult { ok, videoSaved: false, degradedToLight: true }`. **Nunca** pierde el
     `doc`/`offset`/`positionMs` (FR-008).
3. Si `storageMode === 'light'`: no toca `media`; si había blob de un guardado previo, lo
   borra (el usuario desactivó el video). `SaveResult { ok, videoSaved:false, degradedToLight:false }`.
4. Una transacción IDB por `save`: si falla a media escritura, **no** deja otros proyectos
   corruptos (FR-011).

## Selección del adaptador (`getProjectStore`)

- Intenta abrir IndexedDB. Si lanza o no existe `indexedDB` → `memoryProjectStore` con
  `available()=false`. La app sigue usable en la sesión y la UI avisa "no se guardará"
  (FR-012).
- `idbProjectStore` crea (v1, `onupgradeneeded`) dos object stores: `projects` (keyPath
  `id`) y `media` (keyPath `id`). `schemaVersion` por registro para migraciones futuras.

## Privacidad (FR-010)

Ningún método hace red. Todos los datos viven en IndexedDB del dispositivo. Coherente con
"sin backend" y BYOK.
