# Feature Specification: Import — video + sidecar .srt/.vtt + parsers + merge dual

**Feature Branch**: `002-import-sidecar-subs`

**Created**: 2026-06-13

**Status**: Draft

**Input**: Guía de trabajo §5 (spec 002) — "Import: video + detección de sidecar
.srt/.vtt, parsers, merge de dos pistas en dual. Habilita el caso 'el video ya
trae subtítulos'." Lógica pura en `src/core` con tests contra fixtures feos.

## Resumen

Habilita el caso **"el video ya trae subtítulos"**: el usuario elige un video
local y uno o dos archivos **sidecar** (`.srt`/`.vtt`) que tenga junto al video.
La app **parsea** esos archivos a segmentos del **formato DualSub JSON v1**
(spec 000) y abre la pantalla Player (spec 001) con el documento **real** en
lugar del mock.

Dos caminos:

- **Un sidecar** → documento de **un idioma** (origen presente, destino pendiente).
  El Player ya muestra solo-origen sin romper layout (FR-007 de spec 001).
- **Dos sidecars de idiomas distintos** → **merge dual**: se alinean por tiempo
  usando una pista como **master** y adjuntando a cada segmento el texto de la otra
  pista que solapa.

El valor de la spec está en **parsers robustos**: archivos reales vienen "sucios"
(BOM, CRLF, etiquetas `<i>`, cues multilínea, timestamps con coma o punto, líneas
en blanco, cabeceras `NOTE`/`STYLE` de VTT). Los parsers son **lógica pura en
`src/core`** y se blindan con tests Vitest contra **fixtures** guardados en
`tests/fixtures/` (constitución, principios I y Calidad/tests).

## Decisiones de diseño (resueltas, no asumidas)

1. **Parsers puros, separados del DOM.** `parseSrt(text)` y `parseVtt(text)`
   reciben **string** (no `File`) y devuelven segmentos; la lectura del archivo
   (`File.text()`) ocurre en la capa UI. Así el 100% del parsing se testea sin
   navegador.
2. **Normalización al formato (no confianza ciega).** Tras parsear, los segmentos
   se **ordenan por `startMs`** y se resuelven solapamientos/duplicados de timing
   para cumplir la invariante del formato (orden + no-solape) antes de construir el
   `DualSubDocument`. Un archivo desordenado o con cues solapados **no** debe hacer
   fallar `parseDualSub`.
3. **Etiquetas de formato se descartan en v0.1.** `<i>`, `<b>`, `<u>`, `<font…>`,
   `{\anX}`, tags de posición de VTT → se elimina el markup y se conserva el texto
   plano. (El estilizado rico queda fuera de v0.1.)
4. **Timestamps**: SRT usa coma (`00:00:01,500`), VTT usa punto (`00:00:01.500`);
   ambos se aceptan en ambos parsers de forma tolerante y se convierten a **ms
   enteros**. Las horas son opcionales en VTT (`MM:SS.mmm`).
5. **Merge dual = master + solape.** Con dos pistas, la pista **origen** es el
   master de timing; para cada segmento origen, el texto destino es el de la(s)
   pista(s) destino cuyo intervalo **solapa** (mayor solape gana; si varios, se
   concatenan en orden). Segmentos origen sin solape destino quedan con destino
   vacío (Player muestra solo-origen). **El timing del documento es el del origen.**
6. **Idioma por nombre de archivo, confirmable.** Se infiere de sufijos como
   `pelicula.en.srt` / `pelicula.es.vtt`; si no se puede inferir o ambos coinciden,
   el usuario **elige** el idioma (en/es/ja) antes de continuar. El usuario decide
   cuál pista es origen y cuál destino.
7. **Errores claros, no cuelgues.** Un archivo ilegible o sin ningún cue válido
   produce un **mensaje de error accionable** en la pantalla Import, no una pantalla
   en blanco.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ver mi video con su subtítulo (un idioma) (Priority: P1)

Como usuario que ya tiene un video y su archivo `.srt`/`.vtt`, quiero importarlos
y verlos en el Player, para estudiar con subtítulos reales aunque aún no tenga
traducción.

**Why this priority**: Es el primer valor real más allá del mock: el usuario ve
**su** contenido. Desbloquea todo el caso "el video ya trae subtítulos".

**Independent Test**: Elegir un video + un `.srt` real (incluso "sucio") y verificar
que el Player abre con esos diálogos resaltándose al ritmo del video; el parsing se
prueba además de forma aislada con fixtures sin abrir el navegador.

**Acceptance Scenarios**:

1. **Given** un `.srt` limpio de N cues, **When** se importa con un video, **Then**
   el Player abre con N segmentos en orden y el highlight sigue al video.
2. **Given** un `.srt` con BOM, CRLF, una etiqueta `<i>` y un cue multilínea,
   **When** se parsea, **Then** los segmentos resultantes tienen el texto plano
   (sin `<i>`, con saltos de línea preservados) y tiempos correctos en ms.
3. **Given** un `.vtt` con cabecera `WEBVTT`, un bloque `NOTE` y timestamps sin hora
   (`MM:SS.mmm`), **When** se parsea, **Then** las `NOTE`/`STYLE` se ignoran y los
   cues se convierten correctamente.
4. **Given** un archivo con cues **desordenados** o con un par **solapado**, **When**
   se importa, **Then** el documento resultante queda ordenado y sin solapes, y el
   Player no falla.
5. **Given** un archivo sin ningún cue válido, **When** se importa, **Then** se
   muestra un error claro en Import y no se abre el Player.

### User Story 2 — Ver doble subtítulo desde dos archivos (Priority: P1)

Como usuario con el subtítulo en dos idiomas (dos archivos), quiero importarlos
juntos y ver ambos en dual, para comparar origen y traducción.

**Why this priority**: Es el corazón "dual" de DualSub aplicado a contenido real;
junto con US1 forma el MVP de import.

**Independent Test**: Importar dos sidecars (p. ej. `.en.srt` + `.es.srt`),
designar origen/destino, y verificar que el Player muestra ambos idiomas alineados
por tiempo (overlay y lista).

**Acceptance Scenarios**:

1. **Given** dos pistas con **el mismo** timing por cue, **When** se hace merge,
   **Then** cada segmento tiene `texts[origen]` y `texts[destino]` del cue
   correspondiente.
2. **Given** dos pistas con timing **distinto**, **When** se hace merge con la pista
   origen como master, **Then** cada segmento origen recibe el texto destino de
   mayor solape; los que no solapan quedan solo-origen.
3. **Given** dos archivos del **mismo** idioma detectado, **When** se intenta
   importar como dual, **Then** se pide al usuario corregir el idioma (no se permite
   `origen === destino`).

### User Story 3 — Confirmar el idioma de cada pista (Priority: P2)

Como usuario, quiero que la app proponga el idioma de cada archivo (por su nombre)
y poder corregirlo, para que el documento quede con el par origen→destino correcto.

**Why this priority**: Necesario para un merge correcto, pero secundario a que el
parsing y la visualización funcionen.

**Independent Test**: Importar `video.en.srt` y verificar que propone "en"; importar
`subs.txt` (sin pista en el nombre) y verificar que pide elegir idioma.

**Acceptance Scenarios**:

1. **Given** un archivo `*.en.srt`, **When** se selecciona, **Then** la app propone
   `en` y permite cambiarlo a `es`/`ja`.
2. **Given** un archivo sin sufijo de idioma reconocible, **When** se selecciona,
   **Then** la app pide elegir el idioma antes de continuar.

### Edge Cases

- **BOM** (`﻿`) al inicio del archivo → se descarta antes de parsear.
- **CRLF vs LF** → ambos separan cues correctamente.
- **Etiquetas** `<i>/<b>/<u>/<font>` y posición VTT → se eliminan, texto plano.
- **Cue multilínea** → las líneas de texto se conservan unidas con `\n`.
- **Timestamp** con coma o punto, con o sin hora → ms enteros correctos.
- **Líneas en blanco** extra entre cues → no generan segmentos vacíos.
- **VTT** con `NOTE`, `STYLE`, `REGION` y/o identificador de cue → ignorados salvo
  el texto del cue.
- **Cues desordenados / solapados / duplicados** → se ordenan y se resuelve el
  solape; documento válido para `parseDualSub`.
- **Cue con `endMs <= startMs`** → se descarta ese cue (con aviso), no rompe todo.
- **Merge** sin solape entre pistas → destino vacío (solo-origen), nunca error.
- **Archivo vacío / sin cues / formato irreconocible** → error claro en Import.
- **`origen === destino`** → bloqueado con petición de corrección.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST ofrecer una pantalla Import para elegir un video local
  y uno o dos archivos sidecar `.srt`/`.vtt` desde el dispositivo.
- **FR-002**: MUST existir `parseSrt(text: string)` y `parseVtt(text: string)` en
  `src/core` (sin React/DOM/fetch) que devuelvan segmentos `{startMs,endMs,texts}`.
- **FR-003**: Los parsers MUST tolerar BOM, CRLF/LF, líneas en blanco, cues
  multilínea, timestamps con coma o punto y (VTT) horas opcionales; y convertir
  tiempos a **ms enteros**.
- **FR-004**: Los parsers MUST eliminar etiquetas de formato (`<i>`, `<b>`, `<u>`,
  `<font…>`, tags de posición/estilo VTT) conservando el texto plano; VTT MUST
  ignorar bloques `NOTE`/`STYLE`/`REGION` y los identificadores de cue.
- **FR-005**: El sistema MUST normalizar los segmentos parseados (ordenar por
  `startMs`, descartar cues inválidos `endMs<=startMs`, resolver solapes/duplicados)
  de modo que el `DualSubDocument` resultante cumpla las invariantes de spec 000.
- **FR-006**: Con **un** sidecar, el sistema MUST construir un `DualSubDocument` con
  el idioma de esa pista como origen y sin destino (destino pendiente).
- **FR-007**: Con **dos** sidecars de idiomas distintos, el sistema MUST producir un
  `DualSubDocument` dual con la pista origen como master de timing y el texto destino
  alineado por **solape** (mayor solape; concatenar si varios; vacío si ninguno).
- **FR-008**: El sistema MUST inferir el idioma de cada sidecar por el sufijo del
  nombre (`.en` / `.es` / `.ja`) y permitir al usuario confirmar/cambiarlo y designar
  origen/destino; MUST impedir `origen === destino`.
- **FR-009**: Tras un import válido, el sistema MUST abrir el Player (spec 001) con
  el documento importado en lugar del mock, reutilizando highlight/autoscroll/overlay/
  offset sin cambios.
- **FR-010**: Ante un archivo ilegible o sin cues válidos, el sistema MUST mostrar un
  mensaje de error accionable en Import y no navegar al Player.
- **FR-011**: La pantalla Import MUST ser móvil-first (360px) y el video importado
  MUST manejarse como object URL local (sin red, sin subir el archivo).

### Key Entities

- **SubtitleCue** (intermedio, en core): resultado crudo del parser — `startMs`,
  `endMs`, `text` (una sola cadena, ya sin markup). Paso previo al `SubtitleSegment`.
- **SubtitleTrack** (intermedio): lista de cues + idioma + formato de origen
  (`srt`/`vtt`), antes de merge/normalización.
- **DualSubDocument / SubtitleSegment** (spec 000): salida final que consume el Player.
- **ImportSelection** (runtime UI): el video elegido + 1-2 pistas con su idioma y rol
  (origen/destino) mientras el usuario confirma antes de abrir el Player.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% de los escenarios de aceptación de parsing cubiertos por tests
  Vitest verdes contra fixtures en `tests/fixtures/` (≥6 clases de archivo "sucio":
  BOM, CRLF, tags, multilínea, coma/punto, NOTE/STYLE).
- **SC-002**: Un `.srt`/`.vtt` real importado abre el Player con los diálogos
  sincronizados, verificado en teléfono (checklist §8).
- **SC-003**: El merge de dos pistas con timing distinto produce, para cada segmento
  origen, el texto destino esperado por solape en el 100% de los casos de prueba.
- **SC-004**: Ningún archivo de entrada (incluidos los "feos" y los inválidos) hace
  crashear la app: o importa, o muestra un error claro.
- **SC-005**: `pnpm test` verde (incluye los nuevos tests de parsers/merge) y
  `pnpm build` verde (tsc estricto).

## Assumptions

- Los sidecar los aporta el usuario como archivos sueltos junto al video; **no** se
  extraen pistas embebidas del contenedor (fuera de alcance, ver abajo).
- Una "pista" sidecar es de **un** idioma. El caso de un único archivo con dos
  idiomas mezclados no se contempla en v0.1.
- El merge prioriza **solape temporal**; no se hace alineación lingüística avanzada
  (eso correspondería a traducción generada, spec 003).
- El idioma se restringe a `en/es/ja` (ISO 639-1), coherente con el resto de v0.1.
- La verificación de la UI de Import es manual en dispositivo; la lógica nueva de
  core (parsers, normalización, merge) lleva tests antes o junto al código.
- No hay persistencia: al recargar se vuelve a importar.

## Out of scope

- Pistas embebidas en MP4/MKV (`mov_text`/ASS) — decisión ya registrada en
  `docs/DECISIONS.md`; sidecar en su lugar (posible spec 002b opcional).
- Transcripción y **traducción generada** vía API (spec 003): aquí el destino solo
  viene de un segundo archivo, nunca se genera.
- Estilizado rico de subtítulos (colores, posición, cursivas conservadas).
- Persistencia/exportación de proyectos.
- Formatos distintos de SRT/VTT (ASS/SSA, TTML) en v0.1.
