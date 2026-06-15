# Contract: Import UI flow + ampliación del store

**Módulos**: `src/screens/Import/`, `src/state/playerStore.ts`, `src/App.tsx` ·
**Spec**: [../spec.md](../spec.md). UI **mínima** (DECISIONS 2026-06-13);
verificación manual en dispositivo (framework §8), sin tests automatizados de UI.

## Ampliación del `playerStore` (diff mínimo)

Estado nuevo:

| Campo    | Tipo                      | Inicial    |
|----------|---------------------------|------------|
| `screen` | `'import' \| 'player'`    | `'import'` |

Acción nueva:

```ts
loadProject(p: { doc: DualSubDocument; mediaUrl: string }): void
```

- Fija `doc = p.doc`, `mediaUrl = p.mediaUrl`, `screen = 'player'`.
- Resetea `offsetMs = 0`, `activeIndex = -1`, `isPlaying = false`.
- Revoca el `mediaUrl` previo si existía (igual que `setMedia`, evita fugas).

> El resto del store (spec 001) no cambia. El `doc` inicial puede seguir siendo el
> mock como fallback, pero la app arranca en `screen='import'`, así que el Player
> solo se ve tras un import válido.

## `App.tsx`

```tsx
const screen = usePlayerStore((s) => s.screen)
return screen === 'player' ? <PlayerScreen /> : <ImportScreen />
```

## `ImportScreen` (orquestador)

Estados de la pantalla (móvil-first, 360px):

1. **Selección**: `SidecarPicker` para video (`accept="video/*"`) y 1-2 sidecars
   (`accept=".srt,.vtt"`). Al elegir cada sidecar: leer `File.text()`, elegir
   parser con `pickParser(file.name)`, parsear, e inferir idioma con
   `inferLang(file.name)`.
2. **Confirmación** (`TrackConfirm`): por cada pista, idioma propuesto (editable
   `en/es/ja`) y rol (origen/destino).
   - Con **2 pistas**: exactamente un origen y un destino y `lang(origen) !==
     lang(destino)` (FR-008); botón "Abrir" deshabilitado si no se cumple.
   - Con **1 pista** (origen): selector **"Traducir a:"** con los dos idiomas
     distintos del origen + **"Ninguno por ahora"** (default). El idioma elegido
     se pasa como `targetLang` a `buildSingle` para que spec 003 lo aproveche;
     "Ninguno" omite el parámetro (placeholder, D7).
3. **Abrir**: construir el documento (`buildSingle(track, source, targetChoice)` o
   `mergeDual`) y llamar `loadProject({ doc, mediaUrl })`.

## Manejo de errores (FR-010, SC-004)

- `SubtitleParseError` al parsear (archivo sin cues / formato malo) → mostrar el
  mensaje en Import, NO navegar al Player, permitir reelegir el archivo.
- `pickParser` → `null` (extensión no .srt/.vtt) → mensaje "formato no soportado".
- `lang(origen) === lang(destino)` → bloquear "Abrir" con aviso (US2 escenario 3).
- Cualquier excepción al construir el documento se captura y se muestra; la app
  nunca queda en blanco.

## Reglas móvil-first / privacidad

- El video se maneja como **object URL** local; nunca se sube (FR-011).
- Layout a 360px primero; controles tocables.
- Sin persistencia: al recargar se vuelve a Import (Assumptions).

## Aceptación (manual, dispositivo)

- US1: video + un `.srt` real → Player abre, highlight sigue al video.
- US2: video + `.en.srt` + `.es.srt` → Player muestra ambos idiomas alineados.
- US3: `*.en.srt` propone `en`; `subs.txt`/sin sufijo pide elegir idioma.
- Archivo inválido → error claro, sin pantalla en blanco.
