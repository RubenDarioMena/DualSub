# Data Model: Persistencia local de proyectos + biblioteca

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-06-17

No se modifican los modelos de la spec 000. Se añade el registro persistido
**`StoredProject`**, la interfaz **`ProjectStore`** (puerto) y la lógica pura de
**derivación de pares**. El `doc` se (de)serializa con `serializeDualSub`/`parseDualSub`
(000). `SegmentTexts` ya es `Partial<Record<LangCode,string>>`, así que un segmento puede
llevar `en`+`es`+`ja` a la vez sin tocar el formato.

## Tipos persistidos (core/services/projectStore.ts)

```ts
import type { DualSubDocument, LangCode } from '../models'

/** Identidad del archivo de video (para modo ligero: pedir el mismo archivo). */
export interface MediaRef {
  name: string             // nombre original del archivo
  sizeBytes: number
  durationMs?: number
  mimeType?: string
}

export type StorageMode = 'light' | 'with-video'

/** Registro completo de un proyecto guardado (sin el blob: va aparte). */
export interface StoredProject {
  id: string               // uuid v4 (crypto.randomUUID)
  schemaVersion: 1
  title: string            // de doc.meta.title o del nombre del archivo
  doc: DualSubDocument     // documento dual (multi-idioma posible en texts)
  offsetMs: number
  positionMs: number       // última posición de reproducción
  storageMode: StorageMode
  media: MediaRef
  createdAt: number        // epoch ms
  updatedAt: number        // epoch ms
}

/** Proyección ligera para listar la biblioteca (sin doc pesado ni blob). */
export interface StoredProjectMeta {
  id: string
  title: string
  sourceLang: LangCode
  targetLang: LangCode
  availableLangs: LangCode[]   // idiomas presentes en texts (para derivación)
  storageMode: StorageMode
  hasVideo: boolean
  sizeBytes: number            // aprox. ocupado por el proyecto (doc + video si lo hay)
  updatedAt: number
}

/** Resultado de save(): refleja la degradación elegante por cuota (FR-008). */
export interface SaveResult {
  ok: true
  videoSaved: boolean          // se guardó el blob
  degradedToLight: boolean     // se pidió guardar video pero no cupo → ligero
}
```

## Puerto (core/services/projectStore.ts)

```ts
export interface ProjectStore {
  /** ¿Hay persistencia real disponible? false en modo privado / IDB bloqueado (FR-012). */
  available(): Promise<boolean>
  /** Metadatos de todos los proyectos, sin cargar docs pesados ni blobs. */
  list(): Promise<StoredProjectMeta[]>
  /** Proyecto completo (con doc), sin el blob de video. */
  get(id: string): Promise<StoredProject | null>
  /** Blob de video bajo demanda (null en modo ligero o si fue evictado). */
  getMedia(id: string): Promise<Blob | null>
  /** Upsert. Si se pasa `media` y storageMode='with-video', intenta guardar el blob;
   *  ante cuota, degrada a 'light' y lo refleja en SaveResult. */
  save(project: StoredProject, media?: Blob): Promise<SaveResult>
  remove(id: string): Promise<void>
  /** Espacio usado/cuota del navegador (navigator.storage.estimate). */
  usage(): Promise<{ usedBytes: number; quotaBytes?: number }>
}
```

**Notas de comportamiento** (detalle en [contracts/project-store.md](./contracts/project-store.md)):
- `save` es **atómico** por proyecto: una escritura a medias no corrompe otros (transacción
  IDB). `media` se guarda en el store `media`; al degradar, se borra cualquier blob previo.
- `remove` borra de ambos stores (`projects` + `media`).
- El `idbProjectStore` versiona el schema (`onupgradeneeded`); `memoryProjectStore` es un
  `Map` (fallback / tests), siempre `available()=false` cuando se usa como fallback real.

## Lógica pura de derivación (core/project/combine.ts)

```ts
import type { DualSubDocument, LangCode } from '../models'

/** ¿Comparten idioma pivote (sourceLang) y la MISMA rejilla de tiempos índice a índice? */
export function sharesPivotGrid(a: DualSubDocument, b: DualSubDocument): boolean

/**
 * Unifica dos documentos que comparten pivote + rejilla en uno multi-idioma:
 * por cada segmento, texts = { ...a.texts_i, ...b.texts_i } (no muta entradas).
 * Precondición: sharesPivotGrid(a,b). Si no, lanza TypeError-equivalente tipado
 * (PivotMismatchError) — el llamador ya validó con sharesPivotGrid.
 * El timing queda intacto; el resultado pasa validateDocument.
 */
export function combineByPivot(a: DualSubDocument, b: DualSubDocument): DualSubDocument

/**
 * Proyecta un par a mostrar desde un doc (posiblemente multi-idioma):
 * devuelve { ...doc, sourceLang, targetLang } (los textos ya están en texts).
 * No muta; no recalcula timing.
 */
export function selectPair(doc: DualSubDocument, sourceLang: LangCode, targetLang: LangCode): DualSubDocument
```

**Caso de uso (US4)**: tengo EN/ES y EN/JA del mismo video (mismo inglés base).
`combineByPivot(enEs, enJa)` → doc con `texts {en,es,ja}`; `selectPair(unif, 'es', 'ja')` →
par ES/JA listo para el Player, **sin traducir nada** y con tiempos intactos (SC-005).

**Obligaciones de test** (`tests/core/combine.test.ts`):
- `sharesPivotGrid`: true para misma rejilla; false si difiere algún `startMs`/`endMs`,
  distinto nº de segmentos o distinto `sourceLang`.
- `combineByPivot`: fusiona `texts` por índice (en+es+ja); **no muta** a ni b; timing
  intacto; resultado pasa `validateDocument`; segmento con texto ausente en un input queda
  con las claves disponibles.
- `selectPair`: fija `sourceLang`/`targetLang` correctos; no muta; el Player puede leer
  ambos textos.
- borde: distinto pivote o distinto grid ⇒ `sharesPivotGrid=false` y `combineByPivot`
  señala el desajuste sin corromper los originales.

## Estado nuevo

- **`settingsStore`** (EDITAR): `saveVideoInBrowser: boolean` (default `false`) + setter;
  persistido en `localStorage` junto al resto de Settings.
- **`playerStore`** (EDITAR): `projectId: string | null`, `positionMs: number`,
  `setPosition(ms)`; `screen` añade `'library'`; `loadProject` recibe/asigna `projectId` y
  dispara auto-guardado.
- **`libraryStore`** (NUEVO): `projects: StoredProjectMeta[]`, `available: boolean`,
  `usedBytes`/`quotaBytes`; acciones `refresh()`, `open(id)`, `remove(id)`,
  `derivePair(idA, idB, source, target)`; orquesta el auto-guardado (debounced) suscrito a
  `playerStore`.
