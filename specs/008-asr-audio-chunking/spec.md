# Feature Specification: ASR de videos grandes/largos (extracción de audio + troceo)

**Feature Branch**: `008-asr-audio-chunking`

**Created**: 2026-07-02

**Status**: Draft

**Amplía**: spec 005 — ASR pipeline

**Input**: User description: "Ampliación de la spec 005 — ASR: extraer el audio en el cliente y trocearlo bajo el límite del proveedor para que la transcripción funcione con videos largos (p. ej. 26 min y más), sin acción manual del usuario."

## Contexto del problema

Hoy la transcripción envía el **archivo de video entero** al proveedor (Whisper vía Groq/OpenAI), que rechaza a partir de ~25 MB. Un video de 360p de ~100 MB y 26 min se rechaza aunque su audio, separado y comprimido, cabría de sobra. La app actual solo **advierte** por tamaño; no resuelve el caso. Esta feature convierte ese aviso en un pipeline que sí procesa el video, sin pedirle al usuario que recorte nada.

## Clarifications

### Session 2026-07-02

- Q: ¿Cuándo extraer el audio del video? → A: **Siempre** (un solo camino; subidas siempre pequeñas), con independencia del tamaño.
- Q: ¿Cómo cortar los trozos de audio largos? → A: **Tiempo fijo con solape de ~2 s** entre partes vecinas, de-duplicando al re-ensamblar (no cortar en silencios).
- Q: ¿Qué hacer con videos muy largos? → A: **Sin tope duro**; si el trabajo requiere muchas partes, **avisar antes** (cuántos envíos / puede tardar y gastar) y pedir confirmación.
- Q: ¿Cachear el audio ya extraído? → A: **No cachear**; se extrae al vuelo y se descarta al terminar (un reintento total lo re-extrae).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Transcribir un video largo que hoy se rechaza (Priority: P1)

Como estudiante que tiene un video largo sin subtítulos (p. ej. una clase de 26 min), quiero pulsar "Transcribir" y obtener los subtítulos completos, de principio a fin, sin que el proveedor me rechace el archivo y sin tener que recortar o convertir el video yo mismo.

**Why this priority**: Es el motivo de la feature. Sin esto, la transcripción es inútil para cualquier video real que pase de unos pocos minutos. Entrega valor por sí sola aunque no existan US2 ni US3.

**Independent Test**: Elegir un video largo (≥26 min) sin subtítulos, elegir el idioma hablado, pulsar Transcribir, y verificar que se genera una pista de subtítulos que cubre desde el inicio hasta el final del video con tiempos correctos.

**Acceptance Scenarios**:

1. **Given** un video cuyo audio, ya preparado, cabe en el límite del proveedor, **When** el usuario transcribe, **Then** el audio se envía en una sola pieza y se obtienen los subtítulos completos.
2. **Given** un video cuyo audio preparado supera el límite del proveedor, **When** el usuario transcribe, **Then** el sistema divide el trabajo en partes de forma automática, transcribe cada una y entrega **una** pista de subtítulos con tiempos continuos de principio a fin.
3. **Given** un video de 26 min que hoy se rechaza, **When** el usuario transcribe, **Then** el resultado incluye subtítulos hasta los últimos segundos del video (no se corta a la mitad).

---

### User Story 2 - Ver el progreso durante el proceso (Priority: P2)

Como usuario en un teléfono, mientras se transcribe un video largo quiero ver en qué fase va y cuánto falta, para saber que la app sigue trabajando y no está colgada.

**Why this priority**: Preparar audio y transcribir varias partes puede tardar minutos; sin señal de avance el usuario cree que se congeló y cierra la app. Mejora fuerte de confianza, pero la transcripción ya funciona sin ella (US1).

**Independent Test**: Transcribir un video que requiere varias partes y verificar que la interfaz muestra fases legibles (preparando audio / enviando parte k de N / etc.) que cambian a lo largo del proceso.

**Acceptance Scenarios**:

1. **Given** una transcripción en curso que requiere troceo, **When** el proceso avanza, **Then** la interfaz muestra la fase actual y, si hay varias partes, el progreso "parte k de N".
2. **Given** una transcripción en curso, **When** pasan varios segundos, **Then** el usuario percibe avance (nunca una pantalla estática sin señal).

---

### User Story 3 - Recuperarse de un fallo parcial sin repetir todo (Priority: P3)

Como usuario con red inestable o límites de uso del proveedor, si una parte de la transcripción falla, quiero reintentar solo esa parte sin perder las que ya se transcribieron ni volver a procesar el video completo.

**Why this priority**: Reduce reprocesos costosos (tiempo, datos, cuota de API) en videos largos, pero es un pulido sobre el flujo feliz de US1/US2.

**Independent Test**: Provocar el fallo de una parte (p. ej. cortando la red durante un trozo) y verificar que la app conserva lo ya transcrito y ofrece reintentar solo la parte fallida hasta completar el resultado.

**Acceptance Scenarios**:

1. **Given** una transcripción por partes en la que una parte falla, **When** ocurre el fallo, **Then** las partes ya completadas se conservan y el sistema ofrece reintentar la parte fallida.
2. **Given** un reintento de la parte fallida con éxito, **When** termina, **Then** el resultado final es idéntico al de una transcripción sin fallos (tiempos continuos, sin duplicados ni huecos).

---

### Edge Cases

- **Video sin pista de audio** (o audio vacío): mensaje accionable, sin dejar el proceso a medias.
- **Formato de audio no procesable** por el extractor del cliente: error claro que sugiera una alternativa, no un fallo opaco.
- **Palabra partida en la frontera** entre dos partes: el solape entre partes evita perder o duplicar texto al re-ensamblar.
- **Video justo en el umbral** (audio ≈ al límite): se envía en una sola pieza siempre que sea seguro; no se trocea innecesariamente.
- **Video extremadamente largo** (p. ej. 2 h → muchas partes): sigue funcionando (sin tope duro), pero el sistema avisa del número de envíos y pide confirmación antes de empezar (FR-013).
- **Cancelar a mitad**: el estado queda limpio (sin proyecto corrupto).
- **Sin API key**: mismo comportamiento BYOK actual (pedir configurar la clave, sin llamar a la red).
- **El dispositivo se queda sin memoria** preparando el audio de un video muy grande: fallo controlado con mensaje, no cierre abrupto.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE generar subtítulos a partir del audio de un video **sin exigir** que el usuario recorte, comprima o convierta el archivo manualmente, con independencia del tamaño y la duración del video.
- **FR-002**: Antes de transcribir, el sistema DEBE **separar el audio del video** **siempre** (con independencia del tamaño), de modo que lo que se envía al proveedor corresponda solo al audio (no al video completo).
- **FR-003**: Cuando el audio preparado supere el tamaño aceptado por el proveedor, el sistema DEBE **dividir la transcripción en partes** automáticamente (cortes **por tiempo fijo**) y **unir** el resultado en UNA sola pista de subtítulos.
- **FR-004**: Los subtítulos ensamblados DEBEN tener **tiempos continuos y correctos** de principio a fin: los tiempos de cada parte se alinean con el video real (no se reinician por parte) y quedan expresados en milisegundos enteros.
- **FR-005**: El sistema DEBE **evitar perder o duplicar** texto en los puntos de corte, aplicando un **solape de ~2 s** entre partes vecinas y **de-duplicando** el texto solapado al re-ensamblar.
- **FR-006**: Durante el proceso, el sistema DEBE mostrar la **fase actual** y, cuando haya varias partes, el **avance (parte k de N)**.
- **FR-007**: Si una parte falla, el sistema DEBE permitir **reintentarla sin perder** las partes ya transcritas y sin reprocesar todo el video.
- **FR-008**: El sistema DEBE dar un **mensaje accionable** cuando el video no tenga audio utilizable o su formato no pueda procesarse en el cliente.
- **FR-009**: El proceso DEBE funcionar **sin backend propio** y respetando **BYOK**: la clave del proveedor sigue viniendo de Settings (localStorage), nunca del repo.
- **FR-010**: El resultado DEBE integrarse **igual que hoy**: queda como pista maestra lista para traducir (spec 003) y guardar (spec 004), sin cambiar los pasos posteriores.
- **FR-011**: El sistema DEBE **sustituir el aviso de tamaño** actual (que solo advertía) por este pipeline; el mensaje de "usa un clip más corto" solo debe aparecer si el procesamiento realmente no es viable en el dispositivo.
- **FR-012**: La capacidad de separar/preparar el audio DEBE quedar detrás de una **interfaz intercambiable** (equivalente a `AudioExtractor` de la constitución), para poder sustituir la implementación (p. ej. por una nativa al migrar a Capacitor) **sin cambiar** el resto del pipeline de transcripción ni la UI.
- **FR-013**: **No hay tope duro** de duración. Cuando el trabajo requiera **más de una parte por encima de un umbral** (p. ej. varias partes), el sistema DEBE **avisar antes de empezar** (cuántos envíos supone y que puede tardar/gastar) y **pedir confirmación** al usuario.
- **FR-014**: El audio extraído **no se cachea**: se genera al vuelo y se **descarta al terminar** (o al cancelar). Un reintento del trabajo completo re-extrae el audio; el reintento de una parte (FR-007) opera sobre el trabajo en curso, no sobre un audio persistido.

### Key Entities *(include if feature involves data)*

- **Audio preparado**: el flujo de audio derivado del video, listo para transcribir. Atributos relevantes para el usuario: duración total y tamaño (determina si se trocea).
- **Parte (trozo)**: un tramo temporal del audio a transcribir por separado. Atributos: instante de inicio y fin dentro del video, solape con la parte vecina y estado (pendiente / completada / fallida).
- **Resultado de transcripción**: la pista de subtítulos final = segmentos con tiempos en ms enteros, ensamblados de todas las partes en orden y sin solape duplicado. Es el mismo tipo de resultado que produce la ASR actual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un video de **al menos 26 minutos** sin subtítulos se transcribe **completo** (subtítulos desde el primer hasta el último tramo hablado) **sin ninguna acción manual** de recorte/conversión por parte del usuario.
- **SC-002**: El **100%** de los videos cuyo audio preparado cabe bajo el límite del proveedor se envían **en una sola pieza** (no se trocea innecesariamente).
- **SC-003**: En videos que requieren troceo, los tiempos de los subtítulos son **continuos en las fronteras**: no hay huecos perceptibles ni segmentos duplicados al pasar de una parte a la siguiente (verificable comparando el resultado ensamblado contra la transcripción del audio sin trocear).
- **SC-004**: Ante el fallo de una parte, el usuario puede **completar** la transcripción reintentando **solo** esa parte, sin reprocesar las demás.
- **SC-005**: Durante todo el proceso el usuario ve **señal de avance de forma frecuente** (fase y, si aplica, k/N), sin tramos largos de pantalla congelada sin información.
- **SC-006**: Para un video típico de 360p, el tamaño que se envía a transcribir (solo audio) es una **fracción** del tamaño del video, de modo que casos antes rechazados por límite ahora se procesan.

## Assumptions

<!-- Decisiones técnicas ya acordadas con el usuario; el "cómo" fino se define en /speckit-plan. -->

- **Extracción en el cliente con ffmpeg.wasm** (decisión de equipo, 2026-07-02): se separa/comprime el audio a un formato compacto apto para Whisper (mono, frecuencia baja tipo 16 kHz). Se prevé el build **monohilo** para no requerir cabeceras de aislamiento (COOP/COEP) ni en Netlify ni en el WebView de Capacitor. 📎 Detalle técnico (códec, bitrate, flags) se fija en el plan.
- **Umbrales con margen** bajo el límite de ~25 MB del proveedor: enviar en una pieza si el audio cabe con holgura (~24 MB) y, si no, partir en tramos de ~≤20 MB cada uno (N = techo(tamaño/20 MB)), con **solape de ~2 s** entre tramos. Cifras exactas (incluido el umbral de partes que dispara el aviso de FR-013 y el tamaño del solape) afinables en el plan; el límite es del proveedor y puede cambiar.
- **Sin caché del audio** (FR-014): se extrae al vuelo y se descarta; no se persiste en memoria ni en el navegador. Mantiene bajo el uso de RAM/almacenamiento en el teléfono.
- **Interfaz `AudioExtractor`** ya prevista en la constitución (Principio II): implementaciones intercambiables — wasm ahora, **plugin nativo** tras migrar a Capacitor, y `mock` para desarrollo/tests de UI. El troceo hace falta también en la futura app nativa (el límite es del proveedor, no del navegador).
- **Reparto core/engines**: los helpers puros de cálculo de partes y de re-ensamblado/de-duplicación de tiempos viven en `src/core` con tests (constitución I); ffmpeg y la red viven en `src/engines`.
- **Nueva dependencia** (ffmpeg.wasm) ⇒ línea en `docs/DECISIONS.md` (constitución V).
- Se asume que el navegador/WebView **soporta WebAssembly** y que el video trae una **pista de audio decodificable** por el extractor elegido.
- Se reutilizan los proveedores de transcripción actuales (Groq/OpenAI Whisper); **no** se cambian ni se añade IA local.

## Out of Scope

- IA de transcripción local (en el dispositivo, sin API).
- Cambiar o añadir proveedores de transcripción.
- YouTube / fuentes online (spec 006).
- Migración a Capacitor en sí (esta feature solo la deja preparada mediante la interfaz intercambiable).
- Traducción y persistencia (specs 003/004): el resultado se entrega a esos flujos sin cambiarlos.
