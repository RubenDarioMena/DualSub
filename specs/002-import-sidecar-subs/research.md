# Research: Import — parsers .srt/.vtt + merge dual

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-06-13

Las decisiones de producto ya vienen resueltas en la spec (sección "Decisiones de
diseño"). Aquí se cierran las decisiones **técnicas** que habilitan la
implementación y los tests. No quedan marcadores `NEEDS CLARIFICATION`.

## D1 — Parsers escritos a mano, sin librería

**Decisión**: implementar `parseSrt`/`parseVtt` a mano en TS puro, sin añadir
dependencias (`subtitle`, `srt-parser-2`, etc.).

**Rationale**: SRT/VTT son formatos simples basados en bloques; el grano de
robustez que pide la spec (BOM, CRLF, tags, multilínea, coma/punto, NOTE/STYLE)
cabe en pocas decenas de líneas y se testea exhaustivamente con fixtures. Evita
una dependencia (principio V) y deja el parser bajo nuestro control para reusarlo
en MKV-embed (002b)/YouTube. El parser es el **entregable de valor** de la spec.

**Alternativas**: una librería externa traería estilos/posición que descartamos
en v0.1 y una línea en `DECISIONS.md` sin beneficio claro a esta escala.

## D2 — Grano del parser: `SubtitleCue` crudo, normalización aparte

**Decisión**: `parseSrt`/`parseVtt` devuelven una `SubtitleTrack` =
`{ format, cues }` con `cues: SubtitleCue[]` donde `SubtitleCue = { startMs,
endMs, text }` (texto ya **sin markup**, líneas unidas con `\n`). La validación
de invariantes del formato (orden, no-solape) NO la hace el parser: la hace una
función separada `normalizeCues` antes de construir el `DualSubDocument`.

**Rationale**: separa "qué dice el archivo" de "qué exige el formato". El parser
es tolerante y fiel al archivo (incluso desordenado); la normalización es una
política reutilizable y testeable por sí sola. Coincide con la decisión de diseño
2 de la spec ("normalización al formato, no confianza ciega").

**Alternativas**: normalizar dentro del parser → mezcla responsabilidades y
dificulta testear el solape/orden de forma aislada.

## D3 — Timecodes tolerantes → ms enteros

**Decisión**: un único `parseTimecode(s)` acepta `HH:MM:SS,mmm`, `HH:MM:SS.mmm`,
`MM:SS.mmm` y `MM:SS,mmm` (coma o punto como separador decimal; horas
opcionales). Devuelve `ms` enteros (`Math.round` sobre milisegundos). Líneas de
tiempo VTT pueden traer settings de posición tras el timestamp (`... line:90%`):
se ignora todo lo posterior al segundo timecode.

**Rationale**: cumple FR-003 y la decisión de diseño 4. Un solo helper compartido
evita divergencias SRT/VTT y centraliza los tests de timecode.

## D4 — Limpieza de texto (`stripMarkup`)

**Decisión**: `stripMarkup(s)` elimina: tags HTML/VTT `<...>` (`<i>`, `<b>`,
`<u>`, `<font ...>`, `<c.classname>`, `<v Speaker>`, `</...>`), llaves de estilo
ASS inline `{\...}`, y entidades VTT básicas (`&amp;`→`&`, `&lt;`→`<`, `&gt;`→`>`,
`&nbsp;`→espacio). Conserva el texto plano y los **saltos de línea** internos del
cue (multilínea → `\n`). Recorta espacios por línea y descarta líneas vacías
sobrantes.

**Rationale**: FR-004 + edge cases. El estilizado rico queda fuera de v0.1
(decisión de diseño 3).

## D5 — Normalización a invariantes (`normalizeCues`)

**Decisión**: `normalizeCues(cues)`:
1. **Descarta** cues con `endMs <= startMs` o `startMs < 0` (inválidos).
2. **Ordena** por `startMs` ascendente (estable; desempate por `endMs`).
3. **Dedupe**: cues idénticos en `[startMs,endMs)` y texto → se colapsan en uno.
4. **Resuelve solape**: si `cur.startMs < prev.endMs`, se **trunca** `prev.endMs =
   cur.startMs` (gana el que empieza después; el fin exclusivo del modelo lo
   permite). Si al truncar `prev` queda `endMs <= startMs`, se descarta `prev`.

El resultado cumple la invariante "ordenado y sin solape" que exige
`validateDocument` (spec 000), por lo que `parseDualSub`/`validateDocument` no
falla con archivos feos (decisión de diseño 2).

**Rationale**: truncar (en vez de fusionar o descartar el segundo) preserva el
máximo de contenido legible y es determinista. La política se testea aislada.

**Alternativas**: fusionar cues solapados (concatenaría textos no relacionados);
descartar el solapado (perdería diálogo). Truncar es el término medio simple.

## D6 — Merge dual: origen como master, cada destino a su segmento de mayor solape

**Decisión** (corregida 2026-06-14 — ver "Bug de duplicación" abajo):
`mergeDual(source, target)` (ambos `SubtitleTrack` ya normalizados):
- El **timing del documento es el del origen** (master). Recorrido O(n+m) con un
  puntero móvil.
- Cada cue **destino** se asigna a **un solo** segmento origen: aquel con el que
  tiene **mayor solape** en ms (`min(ends) - max(starts)`); en **empate**, el
  segmento más temprano.
- Cada segmento origen concatena (en orden temporal, con `\n`) los cues destino que
  le fueron asignados. Si no le tocó ninguno → destino vacío (solo-origen; el Player
  lo soporta, FR-007 de spec 001).

Esto implementa la decisión de diseño 5 de la spec ("mayor solape gana") sin perder
texto cuando varios destinos cortos caen bajo un mismo origen (todos se le asignan).

> **Bug de duplicación (corregido).** La primera versión recogía, por cada segmento
> origen, *todos* los destinos solapantes. Un destino que **cruza dos segmentos
> origen** quedaba en ambos → el texto de abajo se repetía dos veces seguidas al
> reproducir (reportado validando la 002). La asignación "cada destino a un único
> origen (máx. solape)" lo elimina. Cubierto por test explícito en
> `tests/core/buildDocument.test.ts`.

**Rationale**: FR-007 + decisión de diseño 5; timing 1:1 con el modelo (texts
comparten intervalo). O(n+m) trivial a esta escala.

## D7 — Un sidecar: selector de idioma destino con opción "Ninguno"

**Decisión**: con **un** sidecar, la UI muestra un selector **"Traducir a:"** con
los dos `LangCode` distintos del origen + una opción **"Ninguno por ahora"**
(default). `buildSingle(track, sourceLang, targetLang?)`:
- Si el usuario elige un idioma → `targetLang` = ese idioma (sin texto destino aún;
  queda preparado para que spec 003 genere la traducción a ese idioma).
- Si elige "Ninguno" → `targetLang` = primer `LangCode != sourceLang`
  (placeholder determinista: `en`→`es`, `es`→`en`, `ja`→`en`).

En ambos casos los segmentos llevan solo `texts[sourceLang]`; el Player muestra
solo-origen (FR-007 de spec 001).

**Rationale**: el usuario pidió exponer el selector ya (se usará en el MVP cuando
llegue spec 003) pero pudiendo declarar "no quiero traducir ahora". El modelo
`DualSubDocument` (spec 000) exige `sourceLang != targetLang`, así que incluso con
"Ninguno" hay que nominar un destino; se usa un placeholder determinista que es
invisible en el render (no hay texto destino). Cuando el usuario sí elige un
idioma, ese valor persiste y lo aprovechará spec 003.

**Alternativas**: no mostrar selector (variante original) → el usuario no podría
preparar el destino para la traducción futura. Cambiar el modelo para permitir
documentos de un solo idioma → ampliaría spec 000 sin necesidad (el placeholder
cubre el caso sin tocar el formato).

## D8 — Inferencia de idioma por nombre de archivo

**Decisión**: `inferLang(filename)` busca el sufijo de pista antes de la
extensión con `/\.(en|es|ja)\.(srt|vtt)$/i`; devuelve el `LangCode` o `null` si
no hay match. La extensión también determina qué parser usar
(`/\.srt$/i`→`parseSrt`, `/\.vtt$/i`→`parseVtt`). La inferencia y la elección de
parser son funciones puras testeable; la UI las usa para **proponer** valores que
el usuario confirma/edita (FR-008, US3).

**Rationale**: simple, predecible, cubre los casos del spec (`pelicula.en.srt`).
`null` activa la petición de elegir idioma (US3 escenario 2).

## D9 — Errores: tipo propio, nunca crash

**Decisión**: el parser lanza `SubtitleParseError` (subclase de `Error`) cuando
**no** logra extraer ningún cue válido (archivo vacío, sin timecodes, formato
irreconocible). La capa UI lo captura y muestra un mensaje accionable en Import
sin navegar al Player (FR-010). Cues individuales inválidos NO lanzan: se
descartan en `normalizeCues` (D5). `origen === destino` se bloquea en la UI antes
de construir (FR-008) y, como red de seguridad, `validateDocument` también lo
rechazaría.

**Rationale**: SC-004 ("ningún archivo crashea") + decisión de diseño 7.

## D10 — Flujo de pantalla sin router

**Decisión**: añadir `screen: 'import' | 'player'` al `playerStore` y una acción
`loadProject({ doc, mediaUrl })` que fija `doc`, `mediaUrl` y `screen='player'`
(reseteando `offsetMs`, `activeIndex`, `isPlaying`). `App.tsx` renderiza
`<ImportScreen/>` o `<PlayerScreen/>` según `screen`. El `doc` inicial del store
deja de ser el mock cuando hay import; arranque en `screen='import'`.

**Rationale**: evita añadir `react-router` (dependencia) para dos pantallas
(principio V). Diff mínimo sobre el store existente. La lectura del archivo
(`File.text()`) ocurre en la UI; el store recibe ya el `DualSubDocument` puro.

**Alternativas**: `react-router` → dependencia injustificada a esta escala.

## Riesgos y mitigaciones

- **Variedad real de archivos**: se mitiga con un set amplio de fixtures
  (≥6 clases de "suciedad", SC-001). Cualquier archivo real que falle se convierte
  primero en fixture+test (constitución, Calidad).
- **Encoding**: se asume UTF-8 (lo que entrega `File.text()`); BOM se descarta.
  Otros encodings quedan fuera de v0.1.
- **Merge confuso con timing muy dispar**: aceptable en v0.1 (alineación
  lingüística avanzada es spec 003); el solape temporal es el contrato declarado.
