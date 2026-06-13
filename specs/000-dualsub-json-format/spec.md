# Feature Specification: Formato DualSub JSON v1 + sincronización

**Feature Branch**: `000-dualsub-json-format`

**Created**: 2026-06-12

**Status**: Draft

**Input**: Guía de trabajo §5 (spec 000) — el contrato del que cuelga todo lo
demás. Pura lógica en `src/core`, cero red/UI, cero riesgo.

## Resumen

Define el **formato interno DualSub JSON v1** (el modelo de datos canónico de la
app) y las funciones puras de **sincronización** que lo consumen. SRT/VTT y las
APIs son solo import/export hacia/desde este formato; nunca se usan directamente
en la UI. Es el cimiento de specs 001 (player), 002 (import) y 003 (pipeline).

Todo vive en `src/core` (TS puro: sin React, DOM ni `fetch`) y se valida con
tests de milisegundos (constitución, principio I).

## Decisiones de diseño (resueltas, no asumidas)

1. **Modelo 1:1 con timing compartido.** Un único array de segmentos ordenados;
   cada segmento tiene un intervalo `[startMs, endMs)` y un mapa `texts` por
   idioma. Origen y destino comparten el mismo timing. (No pistas independientes.)
2. **Exactamente 2 idiomas por documento:** `sourceLang` + `targetLang`. Cambiar
   de par = otro documento. El mapa `texts` puede contener ambos; el destino
   puede faltar mientras la traducción está pendiente.
3. **`findActiveSegment`: fin exclusivo + null en huecos.** Activo ⇔
   `startMs ≤ t < endMs`. Si ningún segmento cubre `t`, devuelve `null` / `-1`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Localizar el diálogo activo (Priority: P1)

Como motor del player, dado un documento dual y un tiempo de reproducción `t`,
necesito saber qué segmento está activo (para resaltarlo y mostrar su overlay) o
si estamos en un silencio.

**Why this priority**: Es el corazón de toda la UX de reproducción (overlay
horizontal y lista vertical con highlight/autoscroll). Si esto falla, todo el
player falla.

**Independent Test**: Llamar `findActiveSegment(segments, t)` con tiempos en
bordes exactos, en huecos, antes del primero y después del último, y verificar el
resultado sin abrir el navegador.

**Acceptance Scenarios**:

1. **Given** segmentos `[0–1800), [2100–4200)`, **When** `t = 0`, **Then**
   devuelve el segmento 0 (inicio incluido).
2. **Given** los mismos, **When** `t = 1800`, **Then** devuelve `null` (fin
   excluido: 1800 ya no pertenece al segmento 0).
3. **Given** los mismos, **When** `t = 1900` (hueco), **Then** devuelve `null`.
4. **Given** los mismos, **When** `t = 4199`, **Then** devuelve el segmento 1; con
   `t = 4200`, devuelve `null`.
5. **Given** lista vacía, **When** cualquier `t`, **Then** devuelve `null` sin error.

### User Story 2 — Ajustar la sincronización con un offset (Priority: P2)

Como usuario, si los subtítulos van adelantados/atrasados respecto al video,
aplico un offset en ms (±) y los tiempos se desplazan en bloque.

**Why this priority**: Necesario para el player (spec 001), pero secundario al
cálculo del segmento activo.

**Independent Test**: `applyOffset(segments, ±N)` devuelve una copia con todos los
`startMs`/`endMs` desplazados, sin mutar la entrada.

**Acceptance Scenarios**:

1. **Given** un segmento `[1000–2000)`, **When** `applyOffset(segs, +500)`,
   **Then** queda `[1500–2500)` y el array original no cambia.
2. **Given** un segmento `[200–800)`, **When** `applyOffset(segs, -500)`, **Then**
   queda `[-300–300)` (se permiten tiempos negativos; simplemente no estarán
   activos para `t ≥ 0` hasta que el intervalo cruce 0).

### User Story 3 — Persistir y recargar un documento sin pérdida (Priority: P2)

Como app, serializo un documento a JSON (para guardar/exportar) y lo vuelvo a
parsear validando sus invariantes, sin perder información (round-trip).

**Why this priority**: Habilita guardar proyectos y es la red de seguridad contra
documentos corruptos provenientes del pipeline o de import.

**Independent Test**: `parse(serialize(doc))` es profundamente igual a `doc`; y
`parse` rechaza documentos que violan invariantes con un error claro.

**Acceptance Scenarios**:

1. **Given** un documento válido, **When** `serializeDualSub` y luego
   `parseDualSub`, **Then** el resultado es deep-equal al original.
2. **Given** un JSON con `version` ≠ 1, segmentos desordenados, solapados,
   `endMs ≤ startMs`, idioma inválido, o `sourceLang === targetLang`, **When**
   `parseDualSub`, **Then** lanza `DualSubParseError` con mensaje describiendo el
   problema.

### Edge Cases

- `t` exactamente en `startMs` (activo) y en `endMs` (no activo) — frontera.
- Hueco entre dos segmentos → `null`.
- `t` antes del primer segmento y después del último → `null`.
- Lista vacía → `null` / `-1`, sin excepción.
- Segmento de longitud cero (`endMs === startMs`) → inválido en `parse`.
- Solapamiento entre segmentos → inválido en `parse`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El formato MUST modelar un documento dual como
  `{ version: 1, sourceLang, targetLang, segments[], meta? }` con segmentos
  `{ startMs, endMs, texts }`, todo en `src/core` (sin React/DOM/fetch).
- **FR-002**: Los tiempos MUST ser enteros en milisegundos (`startMs`, `endMs`);
  nunca segundos en coma flotante.
- **FR-003**: Los idiomas MUST ser ISO 639-1 restringidos a `"en" | "es" | "ja"`,
  con `sourceLang !== targetLang`.
- **FR-004**: `findActiveSegment(segments, t)` MUST devolver el segmento activo
  (`startMs ≤ t < endMs`) o `null` en huecos / listas vacías; complejidad
  `O(log n)` (búsqueda binaria), asumiendo segmentos ordenados y sin solapamiento.
- **FR-005**: MUST existir `findActiveSegmentIndex` (devuelve índice o `-1`) como
  base de la anterior, para que la UI pueda hacer autoscroll por índice.
- **FR-006**: `applyOffset(segments, offsetMs)` MUST devolver una copia desplazada
  sin mutar la entrada; admite offset negativo y tiempos resultantes negativos.
- **FR-007**: `serializeDualSub(doc)` y `parseDualSub(json)` MUST hacer round-trip
  sin pérdida para documentos válidos.
- **FR-008**: `parseDualSub` MUST validar invariantes (versión, idiomas, orden,
  no-solapamiento, `endMs > startMs`, `startMs ≥ 0`, presencia de
  `texts[sourceLang]`) y lanzar `DualSubParseError` con mensaje útil al fallar.

### Key Entities

- **DualSubDocument**: el documento dual completo (versión, par de idiomas,
  segmentos, metadatos opcionales).
- **SubtitleSegment**: un diálogo — intervalo `[startMs, endMs)` + `texts` por
  idioma (timing compartido entre idiomas).
- **MediaProject**: (mínimo en esta spec) un medio + su `DualSubDocument` +
  `offsetMs`; el contenedor que la UI manipulará en specs posteriores.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% de los escenarios de aceptación cubiertos por tests Vitest
  que pasan (`pnpm test` verde).
- **SC-002**: `pnpm build` (incluye `tsc --noEmit` estricto) verde: el formato y
  las funciones compilan sin errores de tipos.
- **SC-003**: `findActiveSegment` resuelve correctamente los 5 casos de frontera
  (inicio, fin, hueco, antes, después) y la lista vacía.
- **SC-004**: Round-trip `parse(serialize(doc))` deep-equal para al menos un
  documento representativo, y `parse` rechaza ≥5 clases de documento inválido.

## Assumptions

- Los segmentos almacenados están ordenados por `startMs` y no se solapan; es una
  **invariante del formato** que `parseDualSub` hace cumplir. Las funciones de
  sync asumen esa invariante (no re-ordenan en caliente).
- El destino (`texts[targetLang]`) puede faltar cuando la traducción está
  pendiente; el origen siempre está presente.
- El offset es estado de runtime (lo manejará el store en spec 001); aquí solo se
  provee la función pura que lo aplica.
- SRT/VTT y APIs se mapearán a/desde este formato en specs 002 y 003; no forman
  parte de esta spec.

## Out of scope

- Parsers SRT/VTT (spec 002) y pipeline API (spec 003).
- Cualquier componente React, estado Zustand o I/O de archivos.
- Soporte de >2 idiomas simultáneos en un mismo documento.
