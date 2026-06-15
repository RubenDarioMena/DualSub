# Contract: Settings (BYOK) + acción Traducir + navegación

**Módulos**: `src/state/settingsStore.ts`, `src/screens/Settings/SettingsScreen.tsx`,
`src/screens/Player/TranslatePanel.tsx`, `src/state/playerStore.ts`, `src/App.tsx` ·
**Spec**: [../spec.md](../spec.md). UI **mínima**, verificación en dispositivo (§8).

## `settingsStore` (Zustand, persistido en localStorage)

Estado: `{ provider: ProviderId; keys: Partial<Record<ProviderId, string>> }`
(default `provider: 'mock'`). Acciones:

```ts
setProvider(id: ProviderId): void     // cambia el activo; NO borra claves de otros
setKey(id: ProviderId, key: string): void
clearKey(id: ProviderId): void
```

- Persistencia **explícita** a `localStorage` (clave única, p. ej. `dualsub.settings`).
  Las claves se leen al iniciar y se escriben en cada cambio.
- La clave **solo** vive aquí + `localStorage`; nunca en logs, repo ni bundle (SC-004).

## `playerStore` (ampliación mínima)

- `screen` pasa a `'import' | 'player' | 'settings'`; nueva acción `setScreen(s)`.
- La traducción **no** añade estado al store: al terminar llama `loadProject({ doc,
  mediaUrl })` con el doc dual (reusa la acción de 002). El `mediaUrl` actual se
  conserva (la traducción no cambia el video).

## `SettingsScreen`

- Selector de **proveedor** (`PROVIDERS` del catálogo; muestra familia y si está
  implementado; "Mock (demo)" no pide clave).
- Input de **clave** `type="password"` para el proveedor activo (si `needsKey`);
  botones **Guardar** y **Borrar**. Aviso si el proveedor está marcado como no
  implementado (stub).
- Móvil-first 360px. Botón **volver** → `setScreen('player'|'import')`.

## `TranslatePanel` (en el Player)

- Visible cuando el doc tiene **origen y falta destino** (algún `texts[targetLang]`
  ausente) y `sourceLang !== targetLang`.
- Al pulsar **Traducir**: arma `TranslationRequest` desde `doc` + `settingsStore`,
  obtiene el engine con `getTranslator(provider, key)` y ejecuta con `onProgress`.
  - **Progreso**: barra/contador "traduciendo N/total" por lote (FR-007).
  - **Éxito**: `assembleTranslated` → `loadProject` → el Player muestra dual.
  - **Error** (`TranslationError.kind`): mensaje + acción por caso —
    `no-key`/`auth` → "Configura tu API key" (link a Settings); `rate-limit`/`network`
    → "Reintentar"; `bad-shape` → reintentar lote; `provider-unavailable` → elegir otro
    proveedor. Lo ya traducido se conserva para reintentar lo pendiente (FR-008).

## `App.tsx`

```tsx
const screen = usePlayerStore((s) => s.screen)
return screen === 'settings' ? <SettingsScreen />
     : screen === 'player'   ? <PlayerScreen />
     :                         <ImportScreen />
```

## Aceptación (manual, dispositivo)

- US2: elegir proveedor + guardar clave → persiste tras recargar; cambiar de
  proveedor no pisa la clave del otro; borrar la elimina.
- US1: con "Mock (demo)" pulsar Traducir → el Player pasa a dual al instante.
- US1+US2: con Groq + clave real → traducción real rellena el destino 1:1.
- US3: sin clave / clave inválida / red caída → mensaje accionable, sin colgarse.
- 360px: Settings y panel de traducción usables.
