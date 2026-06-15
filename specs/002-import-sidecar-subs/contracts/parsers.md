# Contract: parsers + pipeline (core puro)

**Módulo**: `src/core/formats/` · **Spec**: [../spec.md](../spec.md) ·
**Consumido por**: `src/screens/Import/` · **Probado por**: `tests/core/*.test.ts`
contra `tests/fixtures/`.

Todas las funciones son **puras** (sin React/DOM/fetch) y reciben `string`, nunca
`File`. Tiempos siempre en **ms enteros**.

## `parseTimecode(raw: string): number`

- Acepta `HH:MM:SS,mmm`, `HH:MM:SS.mmm`, `MM:SS,mmm`, `MM:SS.mmm` (coma o punto,
  horas opcionales). Ignora espacios alrededor.
- Devuelve ms enteros (`Math.round`).
- Si no matchea ningún patrón → lanza/`NaN` que el caller trata como cue inválido
  (el cue se descartará en `normalizeCues`); nunca cuelga.

## `stripMarkup(raw: string): string`

- Elimina tags `<...>` (i/b/u/font/c/v y cierres), llaves ASS `{\...}`, settings
  de posición VTT; decodifica `&amp;/&lt;/&gt;/&nbsp;`.
- Conserva saltos de línea internos (`\n`); recorta espacios por línea; colapsa
  líneas vacías sobrantes.
- Entrada vacía o solo-markup → `''`.

## `parseSrt(text: string): SubtitleTrack` · `parseVtt(text: string): SubtitleTrack`

**Garantías**:
1. Descartan BOM inicial; aceptan CRLF y LF; separan cues por línea(s) en blanco.
2. SRT: ignoran el número de índice del bloque. VTT: ignoran cabecera `WEBVTT`,
   bloques `NOTE`/`STYLE`/`REGION` y el identificador de cue (línea previa al
   timecode).
3. Cada cue → `{ startMs, endMs, text }` con `text` ya pasado por `stripMarkup`,
   multilínea unida con `\n`.
4. Toleran timestamps con coma **o** punto en ambos formatos (FR-003).
5. Devuelven cues **en el orden del archivo** (NO ordenan ni resuelven solape —
   eso es `normalizeCues`).
6. Si **no** se extrae ningún cue válido → lanzan `SubtitleParseError` con mensaje
   accionable (FR-010). Cues sueltos inválidos no lanzan; se omiten.

**Cubierto por fixtures** (SC-001, ≥6 clases): BOM, CRLF, tags `<i>`, multilínea,
coma/punto, `NOTE`/`STYLE`, desordenado, solapado, vacío/sin-cues.

## `normalizeCues(cues: SubtitleCue[]): SubtitleCue[]`

Política (D5), en orden:
1. Descarta `endMs <= startMs` o `startMs < 0`.
2. Ordena por `startMs` asc (estable; desempate `endMs`).
3. Dedupe de cues idénticos (`startMs`,`endMs`,`text`).
4. Resuelve solape truncando: `cur.startMs < prev.endMs` ⇒ `prev.endMs =
   cur.startMs`; si `prev` queda inválido, se descarta.

**Postcondición**: el array cumple "ordenado y sin solape" de spec 000 (apto para
`validateDocument` sin lanzar).

## `inferLang(filename: string): LangCode | null` · `pickParser(filename): 'srt'|'vtt'|null`

- `inferLang`: match `/\.(en|es|ja)\.(srt|vtt)$/i` → `LangCode`; si no, `null`.
- `pickParser`: por extensión `.srt`/`.vtt` (case-insensitive); si no, `null`.

## `buildSingle(track, sourceLang, targetLang?): DualSubDocument`

- Normaliza `track.cues`, mapea a `SubtitleSegment` con `texts[sourceLang]=cue.text`.
- `targetLang`: si se pasa (≠ source) se usa tal cual (el usuario lo prepara para
  spec 003); si se omite (el usuario eligió "Ninguno") se usa el primer
  `LangCode != sourceLang` como placeholder determinista (D7).
- En ambos casos NO se añade texto destino (solo-origen).
- `meta.source` = `'import-srt'` o `'import-vtt'` según `track.format`.
- Resultado válido para `validateDocument` (red de seguridad recomendada).

## `mergeDual(source, sourceLang, target, targetLang): DualSubDocument`

**Precondición**: `sourceLang !== targetLang` (el caller lo garantiza; si no,
`validateDocument` lo rechazaría).

- Normaliza ambas pistas. Timing = el de `source` (master).
- Para cada segmento origen: `texts[sourceLang]=cue.text`; recoge los cues destino
  que **solapan** `[startMs,endMs)`; si hay ≥1, `texts[targetLang]` = sus textos
  concatenados en orden temporal con `\n`; si 0, se omite el destino (solo-origen).
- `meta.source` = formato del **origen**.
- Recorrido O(n+m) con dos punteros sobre pistas ordenadas.

**Cubierto por tests** (SC-003): timing idéntico (1:1), timing dispar (mayor
solape / múltiples solapantes), y sin solape (solo-origen).
