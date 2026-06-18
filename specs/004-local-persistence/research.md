# Research: Persistencia local de proyectos + biblioteca

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-06-17

Decisiones de Fase 0. No quedan `NEEDS CLARIFICATION` (lo de producto se cerró en la spec).

## D1 — Almacenamiento: IndexedDB con dos object stores

**Decisión**: IndexedDB con **dos almacenes**: `projects` (metadatos + `doc` serializado,
clave `id`) y `media` (blobs de video, clave `id`). `list()` lee solo de `projects`; los
blobs se cargan **bajo demanda** con `getMedia(id)`.

**Rationale**: separar el blob pesado de los metadatos hace que la **biblioteca liste
rápido** sin tocar cientos de MB de video. IndexedDB es el único almacén del navegador que
guarda **blobs binarios grandes** de forma estructurada (localStorage es texto y ~5 MB;
Cache API es para respuestas de red, no encaja). Versionamos el schema con
`onupgradeneeded` (v1) y un `schemaVersion` en cada registro para migraciones futuras.

**Alternativas**: `localStorage` (descartado: tamaño y solo texto), Cache API (semántica de
red), OPFS/File System Access (potente pero soporte móvil irregular en 2026, sobre todo
iOS) — reservado para el futuro adaptador nativo.

## D2 — Sin dependencias: wrapper de promesas propio (no `idb`)

**Decisión**: envolver IndexedDB en un mini-helper de promesas dentro de
`idbProjectStore.ts`; **no** añadir la librería `idb`.

**Rationale**: la API cruda de IndexedDB es por eventos (`onsuccess`/`onerror`), pero
nuestra superficie es pequeña (open, get, put, delete, getAll, cursor de uso). Un wrapper de
~30 líneas la vuelve `async/await` sin coste de dependencia (constitución V). Si la
complejidad creciera (transacciones múltiples, índices), reconsiderar `idb` **con línea en
`docs/DECISIONS.md`**.

## D3 — Cuota, persistencia y evicción (riesgo a explicar en llano)

**Decisión**: al guardar video, intentar `put` del blob y **capturar `QuotaExceededError`**
→ degradar ese proyecto a **modo ligero** y avisar (FR-008). Mostrar espacio con
`navigator.storage.estimate()`. Al activar el guardado de video, pedir una vez
`navigator.storage.persist()` para reducir la evicción.

**📎 Efecto práctico (constitución VII)** — el almacenamiento del navegador **no es un disco
garantizado**:
- **iOS Safari** borra los datos de un sitio tras **~7 días sin visitarlo** (si no está
  "añadido a pantalla de inicio"). Para el video esto significa: puede desaparecer aunque el
  usuario no haga nada. `persist()` ayuda pero **no garantiza** en iOS.
- **Android Chrome** es más estable, pero también puede vaciar **bajo presión de espacio**.
- Conclusión: refuerza **modo ligero por defecto** (el video pesa y es lo más volátil) y
  justifica avisar al usuario al activar el guardado de video y al detectar pérdida al
  reabrir. Los subtítulos/offset (KB) son baratos y mucho menos propensos a evicción.

**Alternativas**: asumir permanencia (descartado: rompe en iOS y frustra al tester);
bloquear el guardado de video en iOS (descartado: mejor ofrecerlo con aviso claro).

## D4 — Puerto `ProjectStore` + fallback en memoria

**Decisión**: interfaz `ProjectStore` en `core/services` (pura, sin DOM); dos adaptadores en
`engines/storage`: `idbProjectStore` (real) y `memoryProjectStore` (en memoria).
`getProjectStore()` devuelve IndexedDB si está disponible; si no (modo privado / IDB
bloqueado), cae a memoria y marca `available=false` (la app sigue usable, avisa que no
guardará — FR-012).

**Rationale**: mismo patrón que `engines` (constitución II); permite el **futuro adaptador
nativo** (Capacitor/RN con sistema de archivos) sin tocar UI ni core. El fallback en memoria
cubre el caso "no se puede persistir" sin ramas especiales en la UI.

## D5 — Posición de reproducción y ciclo de vida del object URL

**Decisión**: `VideoStage` reporta `positionMs` al store con **throttle** (p. ej. cada ~2 s
en play, y en `pause`/`seeked`); el auto-guardado persiste con **debounce**. Al restaurar,
se crea un object URL nuevo desde el Blob (modo con-video) o se pide re-elegir archivo (modo
ligero) y se aplica `requestSeek(positionMs)` cuando el video tiene metadatos. La revocación
de object URLs previos ya existe en `setMedia`/`loadProject` (C3) y se mantiene.

**Rationale**: evita escrituras excesivas a IndexedDB y re-renders; reusa el mecanismo de
seek (R3) y de revocación ya probado en 001/003.

## D6 — `combineByPivot`: caso limpio vs rejillas distintas

**Decisión**: caso principal = **mismo idioma pivote (`sourceLang`) y misma rejilla de
tiempos** ⇒ **zip índice a índice** fusionando `texts` por segmento (resultado multi-idioma
del que `selectPair` proyecta cualquier par). Si las rejillas **no coinciden**, MVP devuelve
un resultado tipado de "no comparten esqueleto" (`sharesPivotGrid` lo detecta) **sin
corromper** los originales; la combinación por **solape** (reusando `mergeDual` de la 002)
queda anotada como mejora secundaria.

**Rationale**: el 99% del valor está en el caso limpio (mismo inglés base, o ambos idiomas
traducidos sobre el mismo `doc`), que es exacto y barato. Implementar ya el overlap completo
añade complejidad por un caso de borde; se acota el MVP (constitución IV) sin cerrar la
puerta.

**Alternativas**: forzar siempre overlap (más caro, menos exacto en el caso común); exigir
que el usuario re-importe (descartado: es justo el re-trabajo que esta feature elimina).

## D7 — Arranque y navegación

**Decisión**: al cargar la app, `getProjectStore().list()`; si hay ≥1 proyecto, arrancar en
`screen: 'library'`; si no, mantener el flujo de Import actual (FR-002, escenario 4).
Navegación con el `screen` del store (sin router), como en 002/003 (añade `'library'`).

**Rationale**: coherente con la arquitectura sin router existente; evita una biblioteca vacía
que estorbe a un usuario nuevo.
