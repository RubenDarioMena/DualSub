# Contrato: Library + toggle de video + flujos guardar/restaurar

**Spec**: [../spec.md](../spec.md) · **Plan**: [../plan.md](../plan.md)

UI móvil-first a 360px, navegación con `screen` del store (sin router; añade `'library'`).

## Pantalla Library (`screens/Library/LibraryScreen.tsx`) — US2

- **Lista** (de `libraryStore.projects` = `StoredProjectMeta[]`, orden `updatedAt` desc).
  Cada fila: título, par de idiomas (p. ej. `EN → ES`), fecha relativa, tamaño aprox., e
  icono si tiene video guardado.
- **Abrir**: `open(id)` → carga `get(id)`, restaura en `playerStore` (doc/offset/position) y
  va a `screen:'player'`.
- **Borrar**: confirma y `remove(id)`; la lista y el **espacio usado** se actualizan.
- **Espacio usado**: muestra `usedBytes` (y `quotaBytes` si está) en formato legible.
- **Nuevo proyecto**: botón → flujo de Import (002).
- **Aviso si `available()=false`**: banner "Tu navegador no guardará el trabajo (modo
  privado o almacenamiento bloqueado)". (FR-012)

## Settings — interruptor de video (US3)

- En `SettingsScreen`: interruptor **"Guardar el video en el navegador"**, **apagado por
  defecto** (`settingsStore.saveVideoInBrowser`).
- Texto de ayuda en **llano** (constitución VII): "Activa para reabrir sin volver a elegir el
  archivo. Ojo: un video largo ocupa mucho y el navegador puede borrarlo si falta espacio
  (en iPhone, tras ~7 días sin abrir la app). Si no cabe, guardamos solo los subtítulos."

## Flujo de guardado automático (US1, FR-001)

- Tras `loadProject` (desde Import 002 o tras Traducir 003): se crea/actualiza un
  `StoredProject` y se llama `save()`. `storageMode` = `with-video` si
  `saveVideoInBrowser` y hay blob disponible; si no, `light`.
- Cambios de `offsetMs`/`positionMs`/`doc`: auto-guardado **debounced** (no en cada frame).
- Si `save()` devuelve `degradedToLight`, se avisa una vez en llano ("No cabía el video;
  guardamos los subtítulos. Reproduce eligiendo el archivo").

## Flujo de restauración (US1, FR-004)

1. **Arranque**: si `list()` tiene ≥1 proyecto → `screen:'library'`; si no → Import.
2. **Abrir un proyecto**:
   - **con-video** y `getMedia(id)` devuelve blob → object URL → `mediaUrl` listo →
     reproducir; aplicar `requestSeek(positionMs)` al tener metadatos.
   - **ligero** (o blob evictado) → Player muestra "Elige el video" (reusa `MediaPicker`);
     subtítulos/offset/posición ya están; al elegir, `requestSeek(positionMs)`.
   - En **ningún** caso se vuelve a preguntar idiomas ni a re-importar subtítulos.

## Derivar par (US4) — entrada mínima en esta spec

- Cuando dos proyectos comparten pivote y rejilla (`sharesPivotGrid`), Library ofrece
  "Combinar idiomas" → `derivePair(idA, idB, source, target)` =
  `selectPair(combineByPivot(get(idA).doc, get(idB).doc), source, target)` → nuevo proyecto
  guardado (sin traducir; SC-005). Si no comparten esqueleto, se informa sin tocar los
  originales.
- La UI rica de "cambiar par en caliente" queda **fuera** (futuro modelo B).
