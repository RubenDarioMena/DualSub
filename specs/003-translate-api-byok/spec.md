# Feature Specification: Traducción vía API (BYOK) — rellenar el idioma destino

**Feature Branch**: `003-translate-api-byok`

**Created**: 2026-06-14

**Status**: Draft

**Input**: Roadmap framework §5 (spec 003), acotada a **solo traducción** (sin
ASR/transcripción): traducir un `DualSubDocument` que solo tiene origen — el caso
que produce el Import (spec 002) — para rellenar el idioma destino vía una API
externa con clave del propio usuario (BYOK).

## Resumen

Cierra el bucle "ver doble subtítulo" cuando el usuario **solo tiene un idioma**:
toma un `DualSubDocument` con texto de origen y **genera la traducción** al idioma
destino, produciendo un documento **dual** que el Player ya sabe mostrar (spec 001).

Es el **primer uso real de una API externa** en DualSub. Hasta ahora la UI corrió
contra datos mock; aquí se introduce una interfaz **Translator** (lógica pura, en
`src/core/services`) con implementaciones **`mock`** (traducciones falsas
instantáneas, sin costo, para desarrollar la UI) y **`api`** (la real, BYOK). El
usuario **elige su proveedor** y pega su clave en una pantalla **Settings**; la
**clave vive SOLO en `localStorage`**, nunca en el repo ni en variables de build.

La traducción es **1:1 por segmento**: cada `texts[sourceLang]` se traduce a
`texts[targetLang]` **sin tocar el timing** (`startMs`/`endMs`) ni el número de
segmentos. El documento origen **no se muta**: se produce uno nuevo con el destino
relleno. Como traducir frase a frase aislada da mala calidad y muchas llamadas, se
traduce **por lotes** preservando el alineamiento 1:1.

## Decisiones de diseño (resueltas, no asumidas)

1. **Solo traducción.** No hay extracción de audio ni ASR en esta spec (queda para
   una futura). El origen ya existe (importado en 002 o pegado).
2. **Interfaz primero, implementación intercambiable.** La UI consume una interfaz
   `Translator` (en `core/services`, pura: sin `fetch` en la firma). En desarrollo
   se inyecta `engines/mock`; la traducción real es `engines/api`. (Constitución II.)
3. **1:1 estricto e inmutable.** El resultado tiene exactamente el mismo número de
   segmentos y el mismo timing que el origen; solo se añade `texts[targetLang]`. Si
   el proveedor devuelve un número de líneas distinto al enviado en un lote, ese lote
   es un **error** (no se adivina el alineamiento).
4. **BYOK en localStorage.** La clave se introduce en Settings y se guarda solo en
   `localStorage`. La app nunca la incluye en el bundle ni la envía a ningún sitio
   salvo al proveedor de traducción elegido.
5. **Batching para costo y calidad.** Los segmentos se agrupan en lotes (un tope de
   líneas/caracteres por llamada) para minimizar llamadas y dar contexto, validando
   el conteo de líneas por lote.
6. **Sin persistencia del documento.** El documento traducido vive en runtime; al
   recargar se vuelve a importar/traducir (coherente con 001/002). La **clave** sí
   persiste (es config del usuario, no contenido).
7. **Multi-proveedor (BYOK con selector).** En Settings el usuario elige su
   **proveedor** y pega la clave correspondiente. Catálogo objetivo: **Anthropic
   (Claude), OpenAI (ChatGPT), Google Translate, Gemini, DeepSeek, DeepL y Groq**.
   Todos viven detrás de la misma interfaz `Translator`; los adaptadores se añaden
   **de forma incremental** (no hace falta que los 7 funcionen el día uno). Hay dos
   **familias**: **LLM** (Anthropic/OpenAI/Gemini/DeepSeek/Groq), que traducen un
   lote de líneas vía prompt y exigen **validar el conteo de líneas** devuelto; y
   **traductores dedicados** (Google Translate, DeepL), cuya API recibe y devuelve un
   **array** de textos (1:1 natural). La validación 1:1 se adapta a cada familia.
8. **Transcripción (ASR) futura.** Cuando llegue (otra spec) se prevé Whisper de
   buena calidad; queda **fuera** de esta spec.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Traducir mi subtítulo de un idioma a dual (Priority: P1)

Como usuario que tiene un video con subtítulos en **un solo idioma** (importados en
002), quiero **traducirlos** al idioma destino para estudiar con doble subtítulo.

**Why this priority**: Es el valor central de la spec y completa la promesa "dual"
cuando el usuario no tiene un segundo archivo. Desarrollable y demostrable contra el
engine **mock** sin gastar API.

**Independent Test**: Con el engine **mock**, abrir un documento de un idioma, pulsar
**Traducir** y verificar que el Player pasa a mostrar origen+destino con el **mismo
timing** y **mismo número** de segmentos; la lógica de mapeo 1:1 se prueba aislada.

**Acceptance Scenarios**:

1. **Given** un documento con `sourceLang` y `targetLang` definidos y sin texto
   destino, **When** se traduce, **Then** cada segmento gana `texts[targetLang]` y el
   timing/número de segmentos no cambia.
2. **Given** el documento origen, **When** se traduce, **Then** el documento origen
   **no se muta** (se produce uno nuevo).
3. **Given** un segmento sin texto de origen (vacío), **When** se traduce, **Then** ese
   segmento se conserva sin romper el alineamiento (queda sin destino o vacío, no
   desplaza a los demás).
4. **Given** un documento ya **dual** (con destino), **When** se ofrece traducir,
   **Then** la acción no está disponible o se confirma re-traducir (no se duplica).

### User Story 2 — Elegir proveedor y usar mi propia API key (BYOK) (Priority: P1)

Como usuario, quiero **elegir mi proveedor** de traducción e introducir mi **clave**
en una pantalla de Settings para traducir de verdad, sabiendo que la clave **solo**
queda en mi dispositivo.

**Why this priority**: Sin proveedor+clave no hay traducción real; junto con US1 forma
el MVP. La separación permite desarrollar US1 contra mock antes de tocar la API.

**Independent Test**: Elegir un proveedor y guardar su clave en Settings, recargar y
verificar que persisten en `localStorage`; con el engine **api**, una traducción usa el
proveedor+clave elegidos; sin clave, la acción de traducir avisa de que falta
configurarla.

**Acceptance Scenarios**:

1. **Given** Settings sin clave para el proveedor elegido, **When** se intenta traducir
   con el engine real, **Then** se muestra un aviso accionable "configura tu API key" y
   no se llama a la API.
2. **Given** un proveedor y clave guardados, **When** se recarga la app, **Then** siguen
   disponibles (persistieron en `localStorage`).
3. **Given** una clave guardada, **When** el usuario la borra en Settings, **Then** deja
   de usarse y se elimina de `localStorage`.
4. **Given** varios proveedores, **When** el usuario cambia de proveedor, **Then** se usa
   la clave de ese proveedor (las claves no se pisan entre proveedores).
5. **Given** cualquier estado, **When** se inspecciona el bundle/repo, **Then** ninguna
   clave **aparece** (solo viven en `localStorage` del navegador).

### User Story 3 — Ver progreso y recuperarme de errores (Priority: P2)

Como usuario que traduce un documento largo, quiero ver el **progreso** y, si algo
falla, un **mensaje claro** que me diga qué hacer, sin perder lo ya traducido.

**Why this priority**: Hace la traducción real usable y confiable, pero es secundaria a
que la traducción funcione (US1) y se pueda autenticar (US2).

**Independent Test**: Simular respuestas de error (clave inválida, rate limit, red,
conteo de líneas distinto) y verificar mensajes accionables; simular un documento de N
segmentos y verificar indicador de progreso por lotes.

**Acceptance Scenarios**:

1. **Given** una traducción en curso, **When** avanza, **Then** se muestra progreso
   (p. ej. lotes/segmentos completados de total).
2. **Given** la API responde clave inválida / rate limit / fallo de red, **When** ocurre,
   **Then** se muestra un mensaje accionable distinto por caso y la app no se cuelga.
3. **Given** un lote cuya respuesta trae un número de líneas distinto al enviado,
   **When** se detecta, **Then** ese lote se marca como error (no se desalinea el doc).
4. **Given** un fallo a mitad de un documento largo, **When** ocurre, **Then** lo ya
   traducido no se pierde y se puede reintentar lo pendiente.

### Edge Cases

- **Sin clave** configurada y engine real → aviso "configura tu API key", sin llamada.
- **Clave inválida / expirada** → error de autenticación accionable.
- **Rate limit / cuota** → mensaje específico; opción de reintentar.
- **Fallo de red / timeout** → error claro; lo traducido se conserva.
- **Respuesta con distinto nº de líneas** que el lote enviado → lote inválido, no se
  adivina el alineamiento.
- **Segmento de origen vacío** → no rompe el mapeo 1:1.
- **Documento ya dual** → no re-traducir sin confirmación.
- **`sourceLang === targetLang`** → bloqueado (no tiene sentido traducir).
- **Documento muy largo** → batching mantiene el alineamiento y un costo razonable.
- **Caracteres especiales / CJK (japonés)** → se preservan; el conteo de líneas usa
  el separador acordado, no espacios.
- **Familia del proveedor** → traductores dedicados (Google/DeepL) devuelven un **array**
  1:1; los **LLM** devuelven texto que hay que partir y **contar**: la validación 1:1
  difiere por familia.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir **traducir** los segmentos de origen de un
  `DualSubDocument` al idioma destino, produciendo un **documento nuevo** con
  `texts[targetLang]` relleno y **sin mutar** el origen.
- **FR-002**: La traducción MUST ser **1:1**: mismo número de segmentos y mismo
  `startMs`/`endMs` que el origen; solo se añade el texto destino.
- **FR-003**: El sistema MUST exponer la traducción tras una interfaz **Translator**
  (lógica pura en `src/core/services`, sin `fetch`/DOM en su firma) con
  implementaciones **`mock`** (desarrollo) y **`api`** (real); la UI se desarrolla
  contra `mock` y usa `api` solo cuando corresponde.
- **FR-004**: El sistema MUST permitir al usuario **elegir su proveedor** e introducir,
  guardar y borrar su **API key** en una pantalla **Settings**, guardadas **solo en
  `localStorage`** (BYOK); nunca en el repo ni en variables de build. Las claves se
  guardan **por proveedor** para no perderlas al cambiar.
- **FR-005**: Al traducir con el engine real **sin** clave, el sistema MUST mostrar un
  aviso accionable y **no** realizar llamadas a la API.
- **FR-006**: El sistema MUST **agrupar** los segmentos en lotes para minimizar llamadas
  y dar contexto, **validando** que cada lote devuelve exactamente una traducción por
  segmento enviado; un lote con conteo distinto MUST tratarse como error.
- **FR-007**: El sistema MUST mostrar **progreso** durante la traducción y **mensajes de
  error accionables** diferenciados (clave ausente/inválida, rate limit, red, conteo
  inválido), sin colgarse.
- **FR-008**: Ante un fallo parcial, el sistema MUST conservar lo ya traducido y permitir
  **reintentar** lo pendiente.
- **FR-009**: El sistema MUST restringir idiomas a `en`/`es`/`ja` y MUST impedir traducir
  si `sourceLang === targetLang`.
- **FR-010**: El documento traducido NO se persiste más allá del runtime; la **clave** sí
  persiste en `localStorage`.
- **FR-011**: El sistema MUST ofrecer un **selector de proveedor** en Settings con el
  catálogo objetivo (**Anthropic, OpenAI, Google Translate, Gemini, DeepSeek, DeepL,
  Groq**), todos detrás de la misma interfaz `Translator`. Los adaptadores MAY añadirse
  de forma **incremental**: el MVP exige el selector + la abstracción + el engine `mock`
  + **al menos un proveedor real funcionando**. La validación 1:1 MUST adaptarse a la
  familia del proveedor (conteo de líneas en LLM; longitud de array en traductores
  dedicados).

### Key Entities

- **Translator** (interfaz, `core/services`): contrato que recibe segmentos de origen +
  par de idiomas y devuelve los textos destino alineados 1:1. Implementaciones `mock` y
  `api`.
- **TranslationRequest / TranslationResult** (intermedios): lo que se envía por lote
  (textos origen + idiomas) y lo que vuelve (textos destino en el mismo orden/conteo).
- **ProviderSettings** (runtime/persistencia): el **proveedor** seleccionado y la **clave
  BYOK** por proveedor, en `localStorage`. Cada proveedor pertenece a una familia (LLM o
  traductor dedicado) que determina cómo se construye la petición y se valida el 1:1.
- **DualSubDocument / SubtitleSegment** (spec 000): entrada (solo origen) y salida (dual).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las traducciones produce un documento con **el mismo número de
  segmentos y el mismo timing** que el origen (mapeo 1:1 verificado en tests con mock).
- **SC-002**: Un usuario puede **configurar su API key** y lanzar una traducción real en
  **menos de 1 minuto** desde Settings.
- **SC-003**: Ningún flujo (sin clave, clave inválida, rate limit, red caída, conteo
  inválido) **cuelga** la app: siempre hay traducción o mensaje accionable.
- **SC-004**: La API key **no aparece** en el bundle ni en el repositorio en ninguna
  circunstancia (solo en `localStorage`).
- **SC-005**: La lógica de mapeo/batching/validación 1:1 está cubierta por **tests
  verdes** (core, con mock), y `pnpm build` pasa (tsc estricto).

## Assumptions

- El usuario aporta su propia clave del proveedor que elija (BYOK); los costos corren por
  su cuenta. Los proveedores del catálogo se implementan **incrementalmente** detrás de la
  interfaz `Translator`; no se exige el catálogo completo en v0.1 (sí el selector + ≥1 real).
- La traducción opera sobre el texto ya extraído (origen presente); no hay audio/ASR aquí.
- La calidad de traducción depende del proveedor; DualSub solo garantiza el **alineamiento
  1:1** y la preservación del timing, no la calidad lingüística.
- El número de segmentos típico (cientos) cabe en pocos lotes; no se exige paralelismo
  agresivo en v0.1.
- Reutiliza el Player (001), el formato (000) y la salida del Import (002) sin cambiarlos.

## Out of scope

- **Transcripción/ASR** (audio → texto con timestamps): spec futura.
- **Exportar/persistir** el documento traducido (descargar SRT/VTT/JSON): fuera de v0.1.
- **Edición manual** de traducciones segmento a segmento.
- **Selección fina de modelo/parámetros** del proveedor más allá de elegir proveedor +
  clave (temperatura, modelo específico, glosarios, etc.); afinado avanzado queda fuera.
- **Caché** de traducciones entre sesiones (no hay persistencia del documento en v0.1).
