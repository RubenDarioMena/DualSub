# Quickstart: validar Import sidecar .srt/.vtt + merge dual

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Guía para correr los tests del core y validar el import en un teléfono real. El
**grueso del valor se valida con tests** (parsers/merge); la UI de Import se
verifica manualmente (constitución: UI sin tests automatizados en v0.1).

## 1. Tests del core (la red principal)

```bash
pnpm test          # debe incluir srt/vtt/buildDocument verdes
pnpm build         # tsc estricto verde
```

**Qué deben cubrir** (SC-001/SC-003/SC-005):

- `tests/core/srt.test.ts` y `vtt.test.ts` contra fixtures en `tests/fixtures/`:
  - BOM al inicio → descartado.
  - CRLF y LF → ambos separan cues.
  - `<i>`/`<b>`/`<font>`/posición VTT → texto plano.
  - Cue multilínea → líneas unidas con `\n`.
  - Timestamp con coma y con punto → mismos ms enteros.
  - VTT con `WEBVTT`/`NOTE`/`STYLE` e identificador de cue → ignorados.
  - Archivo vacío / sin cues → lanza `SubtitleParseError`.
- `tests/core/buildDocument.test.ts`:
  - `normalizeCues`: desordenados → ordenados; solapados → truncados; `endMs<=startMs`
    → descartado; duplicados → colapsados. Resultado pasa `validateDocument`.
  - `buildSingle`: documento solo-origen, `targetLang` placeholder ≠ origen.
  - `mergeDual`: timing 1:1 (cada segmento con ambos textos); timing dispar
    (texto destino por solape; múltiples solapantes concatenados); sin solape
    (solo-origen, sin error).

## 2. Fixtures sugeridas (`tests/fixtures/`)

Crear archivos reales (no strings inline) para que los tests lean del disco:

```text
tests/fixtures/
├── clean.srt              # N cues limpios, ordenados
├── dirty.srt             # BOM + CRLF + <i> + multilínea + coma
├── unordered-overlap.srt # cues desordenados y un par solapado + un endMs<=startMs
├── basic.vtt             # WEBVTT + timestamps MM:SS.mmm (sin hora)
├── notes.vtt             # NOTE/STYLE + identificador de cue + <c>/posición
├── empty.srt             # vacío / sin cues válidos → error
├── movie.en.srt          # pista origen para merge
└── movie.es.srt          # pista destino con timing ligeramente distinto
```

## 3. Validación manual en el teléfono (checklist §8)

Servir en la red local y abrir desde el móvil:

```bash
pnpm dev --host        # o pnpm build && pnpm preview --host
```

| # | Caso | Esperado |
|---|------|----------|
| 1 | Elegir video + `movie.en.srt` (US1) | Player abre; highlight sigue al video; tap-to-seek funciona. |
| 2 | Elegir video + `movie.en.srt` + `movie.es.srt` (US2) | Lista y overlay muestran EN+ES alineados por tiempo. |
| 3 | Pista sin sufijo de idioma (US3) | Import pide elegir idioma antes de "Abrir". |
| 4 | Dos archivos del mismo idioma | "Abrir" bloqueado con aviso (`origen===destino`). |
| 5 | Archivo `.srt` vacío / basura | Mensaje de error claro en Import; no se abre el Player. |
| 6 | Layout a 360px (vertical) y horizontal | Import y Player usables; overlay con safe-areas (spec 001). |

## 4. Criterio de cierre (principio III)

Pegar en `docs/PROGRESS.md` la salida real de `pnpm test` y `pnpm build` en verde,
y el resultado de la checklist manual (al menos US1+US2 en teléfono). Sin eso, la
spec **no** se declara completa.
