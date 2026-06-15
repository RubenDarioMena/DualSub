# Data Model: Import — sidecar .srt/.vtt + merge dual

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-06-13

Esta spec **no modifica** los modelos de spec 000 (`SubtitleSegment`,
`DualSubDocument`, `LangCode`). Añade dos tipos **intermedios** en core (entre el
texto del archivo y el documento final) y un pipeline puro de transformación.

## Tipos nuevos (core, `src/core/formats/subtitleCommon.ts`)

### SubtitleCue (intermedio)

Resultado crudo del parser para **un** cue, ya sin markup.

| Campo     | Tipo     | Reglas |
|-----------|----------|--------|
| `startMs` | `number` | Entero ≥ 0 (ms). Convertido del timecode. |
| `endMs`   | `number` | Entero (ms). El parser NO garantiza `endMs > startMs`; lo hace `normalizeCues`. |
| `text`    | `string` | Texto plano; multilínea unida con `\n`; sin tags ni entidades. Puede ser `''` si el cue no tenía texto (se filtra luego). |

> Diferencia con `SubtitleSegment`: el cue tiene **un solo** `text` (una pista),
> no `texts` por idioma; y aún no cumple las invariantes de orden/no-solape.

### SubtitleTrack (intermedio)

Una pista completa parseada de **un** archivo (un idioma).

| Campo    | Tipo                | Reglas |
|----------|---------------------|--------|
| `format` | `'srt' \| 'vtt'`    | Formato de origen (procedencia/depuración). |
| `cues`   | `SubtitleCue[]`     | Crudos, en el orden del archivo (posiblemente desordenados/solapados). |

> El **idioma** y el **rol** (origen/destino) NO viven en la pista: los aporta la
> UI al construir el documento (se confirman con el usuario, FR-008). Así el
> parser no necesita conocer el nombre del archivo.

### SubtitleParseError

`class SubtitleParseError extends Error` — se lanza solo cuando un archivo no
produce **ningún** cue válido (ver D9). Cues individuales malos no lanzan.

## Tipo runtime (UI, `src/screens/Import/`)

### ImportSelection

Estado efímero mientras el usuario confirma, antes de abrir el Player. No es un
modelo de core (vive en el componente/estado local de Import).

| Campo        | Tipo | Notas |
|--------------|------|-------|
| `videoUrl`   | `string \| null` | object URL del video local. |
| `tracks`     | `Array<{ track: SubtitleTrack; filename: string; lang: LangCode \| null; role: 'source' \| 'target' }>` | 1-2 entradas. `lang` propuesto por `inferLang` (editable). |
| `targetChoice` | `LangCode \| 'none'` | Solo con **1** pista: idioma destino que el usuario prepara para spec 003, o `'none'` (default). Ignorado con 2 pistas. |
| `error`      | `string \| null` | Mensaje accionable si algo falla. |

Regla: con 2 pistas, `role` debe ser uno `source` y otro `target`, y
`lang(source) !== lang(target)` (FR-008). Con 1 pista, su `role` es `source` y el
destino lo decide `targetChoice` (D7).

## Pipeline puro (de archivo a documento)

```text
File (UI)
  │  File.text()                         ← capa UI (DOM permitido)
  ▼
string ──parseSrt/parseVtt──► SubtitleTrack (cues crudos)   ← core puro
                                   │  normalizeCues
                                   ▼
                            SubtitleCue[] ordenados, sin solape, válidos
                                   │
                  ┌────────────────┴─────────────────┐
            1 pista │                            2 pistas │
                    ▼                                     ▼
         buildSingle(track, lang)            mergeDual(source, target, langs)
                    │                                     │
                    └──────────────► DualSubDocument ◄────┘   ← validado por
                                          │                     validateDocument
                                          ▼                     (red de seguridad)
                                   store.loadProject({ doc, mediaUrl })
                                          ▼
                                    PlayerScreen (spec 001)
```

## Funciones core nuevas (firmas)

```ts
// subtitleCommon.ts
export interface SubtitleCue { startMs: number; endMs: number; text: string }
export interface SubtitleTrack { format: 'srt' | 'vtt'; cues: SubtitleCue[] }
export class SubtitleParseError extends Error {}

export function parseTimecode(raw: string): number          // → ms enteros
export function stripMarkup(raw: string): string            // → texto plano
export function normalizeCues(cues: SubtitleCue[]): SubtitleCue[]  // D5
export function inferLang(filename: string): LangCode | null      // D8
export function pickParser(filename: string): 'srt' | 'vtt' | null

// srt.ts
export function parseSrt(text: string): SubtitleTrack       // lanza SubtitleParseError si 0 cues

// vtt.ts
export function parseVtt(text: string): SubtitleTrack       // ídem

// buildDocument.ts
export function buildSingle(
  track: SubtitleTrack, sourceLang: LangCode, targetLang?: LangCode,
): DualSubDocument                                          // D7 (targetLang opcional; placeholder si se omite)
export function mergeDual(
  source: SubtitleTrack, sourceLang: LangCode,
  target: SubtitleTrack, targetLang: LangCode,
): DualSubDocument                                          // D6
```

## Validación y reglas (trazabilidad)

| Regla | Origen | Dónde se cumple |
|-------|--------|-----------------|
| Tiempos en ms enteros | Constitución, FR-003 | `parseTimecode` (`Math.round`) |
| Sin markup, multilínea con `\n` | FR-004 | `stripMarkup` |
| Orden + no-solape + sin `endMs<=startMs` | FR-005, spec 000 | `normalizeCues` |
| 1 sidecar → solo-origen; destino elegible o "Ninguno" | FR-006 | `buildSingle` + selector D7 (placeholder si "Ninguno") |
| 2 sidecars → master origen + solape | FR-007 | `mergeDual` |
| `sourceLang != targetLang` | spec 000, FR-008 | UI bloquea + `validateDocument` |
| Documento final cumple invariantes 000 | FR-005, FR-009 | `validateDocument` como red de seguridad |
| Archivo sin cues → error, no crash | FR-010, SC-004 | `SubtitleParseError` + catch en UI |
