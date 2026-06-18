# Feature Specification: Persistencia local de proyectos + biblioteca

**Feature Branch**: `004-local-persistence`

**Created**: 2026-06-17

**Status**: Draft

**Input**: User description: "Persistencia local de proyectos + biblioteca (spec 004). Que el
trabajo (video, subtítulos/traducción, offset, posición) sobreviva a recargas y cierres, para
que la app sea usable por los primeros testers. Modo ligero por defecto (no guarda el video) con
interruptor en Settings para optar a guardarlo. Biblioteca de varios proyectos. Modelo A (un par
por entrada) con segmentos sobre la rejilla del idioma pivote, más una lógica para derivar pares
que comparten pivote (p. ej. ES/JA desde EN/ES + EN/JA)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - No perder el trabajo al recargar (Priority: P1)

Como estudiante en el teléfono, importo un video y su traducción, cierro la pestaña (o el sistema
la descarta, o pierdo la conexión y recargo). Al volver a abrir la app, mi trabajo sigue ahí: los
subtítulos dobles, el ajuste de sincronización (offset) y la posición donde me quedé. No tengo que
volver a importar ni a traducir.

**Why this priority**: Es el dolor que bloquea el uso real hoy. Sin esto, cada recarga borra todo
el trabajo (la traducción cuesta tiempo y, con proveedores de pago, dinero). Es lo mínimo que
convierte la app en algo usable para los primeros testers.

**Independent Test**: Importar/traducir un proyecto, recargar la app y comprobar que el proyecto
reaparece con subtítulos, offset y posición intactos (en modo ligero, tras volver a elegir el
archivo de video). Entrega valor por sí solo aunque solo se guarde un proyecto.

**Acceptance Scenarios**:

1. **Given** un proyecto con traducción y offset aplicados, **When** recargo la app, **Then** el
   proyecto sigue disponible con los mismos subtítulos dobles y el mismo offset.
2. **Given** que estaba reproduciendo en el minuto 12, **When** recargo y reabro el proyecto,
   **Then** la reproducción retoma en (o muy cerca de) el minuto 12.
3. **Given** un proyecto en modo ligero, **When** lo reabro, **Then** la app conserva subtítulos,
   offset y posición y solo me pide volver a elegir el archivo de video (sin volver a preguntar
   idiomas ni re-importar subtítulos).
4. **Given** que aún no hay ningún proyecto guardado, **When** abro la app, **Then** arranco en el
   flujo de importación normal (sin biblioteca vacía que estorbe).

---

### User Story 2 - Biblioteca de varios proyectos (Priority: P2)

Como usuario que estudia con varios videos, quiero una lista de mis proyectos guardados para abrir
el que quiera, borrar los que ya no uso y ver cuánto espacio ocupan.

**Why this priority**: Sin biblioteca, un proyecto nuevo pisaría al anterior. Tener varios es lo
que pidió el usuario y lo que hace la app útil más allá de un único video de prueba.

**Independent Test**: Guardar dos o más proyectos, abrir la biblioteca, abrir uno, volver, borrar
otro y confirmar que el espacio usado se actualiza. Testeable sobre la persistencia de US1.

**Acceptance Scenarios**:

1. **Given** dos proyectos guardados, **When** abro la biblioteca, **Then** veo ambos con título,
   par de idiomas, fecha y tamaño aproximado.
2. **Given** la biblioteca con dos proyectos, **When** importo/creo uno nuevo, **Then** se añade a
   la lista sin borrar los anteriores.
3. **Given** un proyecto que ya no uso, **When** lo borro, **Then** desaparece de la lista, su
   espacio se libera y el indicador de espacio usado se actualiza.
4. **Given** un proyecto abierto, **When** vuelvo a la biblioteca, **Then** mi progreso (posición,
   offset) en ese proyecto queda guardado.

---

### User Story 3 - Guardar también el video (opt-in en Settings) (Priority: P3)

Como usuario que quiere reabrir sin fricción, activo en Settings la opción de guardar el video en
el navegador. A partir de ahí, reabrir un proyecto reproduce al instante sin volver a elegir el
archivo. Si el video no cabe en el almacenamiento disponible, la app me avisa y guarda el proyecto
en modo ligero (sin perder subtítulos ni offset).

**Why this priority**: Mejora la experiencia, pero el valor central (no perder el trabajo) ya lo
cubre US1 en modo ligero. Es opt-in porque un video largo puede pesar cientos de MB y el
almacenamiento del navegador tiene límites.

**Independent Test**: Activar la opción, guardar un proyecto, recargar y comprobar que reproduce
sin pedir el archivo; luego forzar un video demasiado grande y comprobar el aviso + caída elegante
a modo ligero.

**Acceptance Scenarios**:

1. **Given** la opción "guardar video" desactivada (por defecto), **When** guardo un proyecto,
   **Then** se guarda en modo ligero (sin el video).
2. **Given** la opción activada y espacio suficiente, **When** recargo y reabro el proyecto,
   **Then** reproduce sin pedirme volver a elegir el archivo.
3. **Given** la opción activada pero el video excede el espacio disponible, **When** intento
   guardarlo, **Then** la app me avisa en lenguaje claro y guarda el proyecto en modo ligero, sin
   perder subtítulos, offset ni posición.

---

### User Story 4 - Reusar idiomas que comparten el inglés (Priority: P3)

Como usuario que ya tiene EN/ES y EN/JA del mismo video (ambos cuadrados a los cues del inglés),
quiero ver el par ES/JA sin volver a traducir nada, aprovechando que ambos comparten el mismo
"esqueleto" de tiempos.

**Why this priority**: Aporta mucho valor de estudio (combinar dos idiomas estudiados) a coste casi
cero, pero depende de tener ya dos pares con el mismo pivote, así que no es lo primero que necesita
un tester nuevo.

**Independent Test**: Partiendo de dos proyectos del mismo video con el mismo inglés base (uno
EN/ES, otro EN/JA), derivar el par ES/JA y verificar que conserva los tiempos y no realiza ninguna
llamada de traducción.

**Acceptance Scenarios**:

1. **Given** EN/ES y EN/JA del mismo video con la misma rejilla de tiempos, **When** pido el par
   ES/JA, **Then** obtengo un documento ES/JA con los tiempos intactos y sin traducir nada de nuevo.
2. **Given** dos pares cuyo inglés base tiene tiempos distintos, **When** pido derivar el par,
   **Then** la app los combina por solape lo mejor posible o me indica que no comparten esqueleto
   (caso secundario), sin corromper ninguno de los originales.

---

### Edge Cases

- **Cuota excedida** al guardar (sobre todo con video): avisar en lenguaje claro y degradar a modo
  ligero para ese proyecto, conservando subtítulos/offset/posición.
- **El navegador vacía el almacenamiento** (presión de espacio del sistema): no es un crash; al
  reabrir, los proyectos afectados pueden faltar. Comunicar que el almacenamiento local no es
  garantía absoluta de permanencia (especialmente el video).
- **Cierre abrupto a mitad de guardado**: no debe corromper proyectos previos; un guardado a medias
  no deja la biblioteca en estado ilegible.
- **Modo ligero, archivo de video distinto**: si el usuario reabre y elige un archivo que no
  coincide (otra duración), la app sigue funcionando con los subtítulos pero la sincronía puede
  requerir ajustar el offset; no se bloquea.
- **Almacenamiento no disponible** (modo privado / navegador que bloquea persistencia): la app
  sigue usable en la sesión actual, pero advierte que el trabajo no se guardará.
- **Proyecto sin traducción todavía** (solo origen): se guarda igual; el par destino puede estar
  vacío.
- **Derivar par sin pivote común**: no debe romper; informar y dejar intactos los originales.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST guardar automáticamente el proyecto activo (documento dual, par de
  idiomas, offset, posición de reproducción y metadatos como título y duración) sin requerir una
  acción explícita de "guardar".
- **FR-002**: El sistema MUST restaurar los proyectos guardados al abrir la app: si existe al menos
  uno, ofrecerlos para continuar en vez de arrancar siempre desde cero/mock.
- **FR-003**: El sistema MUST, por defecto, guardar en **modo ligero**: NO almacenar el archivo de
  video, solo el documento dual, offset, posición y metadatos.
- **FR-004**: En modo ligero, al reabrir un proyecto el sistema MUST conservar subtítulos, offset y
  posición, y pedir únicamente volver a seleccionar el archivo de video, SIN volver a preguntar
  idiomas ni re-importar subtítulos.
- **FR-005**: El sistema MUST permitir varios proyectos a la vez (biblioteca): listar (título, par
  de idiomas, fecha, tamaño aproximado), abrir, borrar y mostrar el espacio total usado.
- **FR-006**: Importar o crear un proyecto nuevo MUST añadirlo a la biblioteca sin destruir los
  proyectos existentes.
- **FR-007**: El sistema MUST ofrecer en Settings un interruptor "guardar el video en el navegador",
  **desactivado por defecto**; cuando está activo, los proyectos intentan persistir también el
  video.
- **FR-008**: Si guardar el video excede el almacenamiento disponible, el sistema MUST avisar en
  lenguaje claro y degradar ese proyecto a modo ligero, sin perder subtítulos, offset ni posición.
- **FR-009**: El sistema MUST poder derivar un par de idiomas a partir de dos proyectos que
  comparten el mismo idioma pivote y la misma rejilla de tiempos (p. ej. ES/JA desde EN/ES + EN/JA)
  **sin volver a traducir** y conservando los tiempos. Cuando las rejillas no coinciden, el sistema
  MUST combinarlas por solape como caso secundario o informar de que no comparten esqueleto, sin
  corromper los originales.
- **FR-010**: Todos los datos MUST permanecer en el dispositivo (almacenamiento local del
  navegador); nada se envía a ningún servidor (coherente con "sin backend" y BYOK).
- **FR-011**: El guardado MUST ser resistente a cierres abruptos: un guardado a medias no debe
  corromper ni dejar ilegibles los proyectos ya almacenados.
- **FR-012**: Cuando el almacenamiento persistente no esté disponible (p. ej. modo privado), el
  sistema MUST seguir usable en la sesión y advertir que el trabajo no se guardará.

### Key Entities *(include if feature involves data)*

- **Proyecto guardado**: una unidad de estudio persistida. Atributos: identificador, título,
  idioma pivote, par de idiomas mostrado (origen/destino), idiomas disponibles en el documento,
  documento dual (segmentos sobre la rejilla del pivote, con texto por idioma), offset, posición de
  reproducción, modo de almacenamiento (ligero / con video), identidad del archivo de video (nombre,
  tamaño, duración) y opcionalmente sus bytes, fechas de creación y actualización, tamaño ocupado.
- **Biblioteca**: colección de proyectos guardados, con noción de espacio total usado.
- **Preferencia de almacenamiento**: ajuste del usuario "guardar el video en el navegador"
  (on/off), persistido junto al resto de ajustes (BYOK).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras recargar o reabrir la app, el 100% de los proyectos guardados siguen disponibles
  con subtítulos, offset y posición intactos (en modo ligero, salvo el archivo de video).
- **SC-002**: En modo ligero, reabrir un proyecto y seguir estudiando requiere un solo paso manual
  (volver a elegir el archivo de video) y **cero** pérdida de traducción.
- **SC-003**: Con la opción de video activada y espacio suficiente, reabrir un proyecto reproduce
  sin que el usuario tenga que volver a elegir ningún archivo.
- **SC-004**: El usuario puede mantener varios proyectos a la vez y borrarlos individualmente,
  viendo reflejado el espacio usado.
- **SC-005**: Derivar un par que comparte pivote (p. ej. ES/JA desde EN/ES + EN/JA) ocurre con
  **cero** llamadas de traducción y conserva los tiempos originales.
- **SC-006**: Ningún dato del usuario abandona el dispositivo en todo el flujo de persistencia.

## Assumptions

- El navegador objetivo (móvil moderno) soporta almacenamiento local persistente para datos
  binarios y estructurados. En modo privado o entornos que lo bloquean, se degrada a "sesión sin
  guardado" con aviso (FR-012).
- En modo ligero, el usuario conserva el archivo de video original en su dispositivo y puede volver
  a seleccionarlo al reabrir.
- El almacenamiento local del navegador puede ser vaciado por el sistema bajo presión de espacio;
  se comunica al usuario (sobre todo para el video) y no se garantiza permanencia absoluta.
- La derivación de pares (FR-009) asume como caso principal **mismo pivote + misma rejilla de
  tiempos** (resuelto índice a índice); rejillas distintas son el caso secundario (combinación por
  solape, reusando el merge dual de la 002).
- Decisiones de implementación ya acordadas (el detalle va al plan, no a esta spec): almacenamiento
  vía la base de datos local del navegador detrás de una **interfaz/puerto** intercambiable, para
  poder migrar a almacenamiento nativo si se empaqueta en Capacitor/React Native sin tocar UI ni
  core; la lógica pura de derivación de pares vive en `src/core` con tests; sin dependencias nuevas
  (si se valorase una, requiere línea en `docs/DECISIONS.md`).
- **Fuera de alcance** (futuras specs): cambiar el par de idiomas mostrado "en caliente" y la
  gestión multi-pista rica (modelo B); exportación de subtítulos/video; ASR (pasa a spec 005).
