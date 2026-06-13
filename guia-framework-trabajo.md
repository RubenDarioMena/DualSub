# Framework de trabajo: DualSub web-app con Claude
### Cómo vamos a trabajar tú y yo para que esto salga rápido, barato y bien

---

## 0. El alcance delimitado de la Iteración 1 (lo que SÍ haremos primero)

Para que todo lo demás tenga sentido, fijamos el contrato de producto de esta primera etapa:

> **DualSub v0.1 — "Sube, procesa, estudia"**
> 1. El usuario sube un video desde el navegador del smartphone.
> 2. La app detecta si trae subtítulos propios (archivo sidecar .srt/.vtt que el usuario añada, o pistas embebidas si son extraíbles).
>    - Si los trae → ofrece mostrarlos en dual (idioma original + traducción generada del segundo idioma).
>    - Si no → genera transcripción + traducción vía API para los idiomas seleccionados.
> 3. Idiomas: **EN / ES / JA** (cualquier combinación origen→destino entre ellos).
> 4. Visualización:
>    - **Horizontal:** subtítulos dobles en overlay sobre el video.
>    - **Vertical:** lista de diálogos con highlight + autoscroll del diálogo activo.
> 5. Prioridad: smartphone de **cualquier gama** → procesamiento vía **APIs** (no IA local en v0.1).
> 6. La IA local en dispositivo queda explícitamente FUERA de v0.1 (vendrá como engine alternativo después, sin rehacer nada, gracias a la arquitectura de interfaces).

**Decisión técnica que esto implica y hay que asumir desde ya:** "vía APIs" + "cualquier gama" significa que el teléfono debe poder subir el audio a la API. Las APIs de ASR tienen límite de tamaño (OpenAI: 25 MB), así que **sí necesitamos extraer/comprimir el audio en el cliente** antes de enviarlo (no subimos el video entero). Eso es barato en CPU (decodificar + re-encodear audio) y funciona en gama baja; lo pesado (Whisper) ocurre en el servidor del proveedor.

---

## 1. Dónde trabajamos: chat vs. Claude Code

| | Chat (claude.ai) | Claude Code (CLI/VS Code) |
|---|---|---|
| Para qué sirve mejor | Specs, decisiones, diseño, revisar enfoques, depurar UN error concreto | Escribir/editar código real, correr tests, iterar contra el repo |
| Acceso al repo | No (me pegas fragmentos) | Sí (leo/edito archivos, ejecuto comandos, veo output real) |
| Economía de tokens | Mala para código (re-pegar contexto cada vez) | Buena (diffs pequeños, lee solo lo necesario) |
| Verificación | Por fe / por lo que me cuentes | Por evidencia (corre `pnpm test` y ve el resultado) |

**Recomendación firme:** las sesiones de *código* hazlas en **Claude Code** sobre el repo. Las sesiones de *pensar* (specs nuevas, decisiones de producto, revisar este framework) pueden ser en chat. Si aún no tienes Claude Code: `npm install -g @anthropic-ai/claude-code` y `claude` dentro del repo. El comando `/init` genera un CLAUDE.md base, pero usa mejor la plantilla de la sección 4, que ya está adaptada al proyecto.

Si por ahora trabajas solo en chat: funciona, pero adopta la disciplina de la sección 6 (qué pegarme y qué no) o quemaremos tokens en contexto repetido.

---

## 2. Veredicto sobre las metodologías que te propuso el otro modelo

Tomo autoridad sobre la lista, como pediste:

| Propuesta | Veredicto | Por qué |
|---|---|---|
| Spec-Driven Development | ✅ **Adoptar** | Es exactamente lo que tu PDF original ya hacía. Specs cortas y accionables por iteración (no documentos masivos: una spec de 1-2 páginas por feature rinde más que una de 40). |
| TDD estricto en todo | ⚠️ **Adoptar parcialmente** | TDD real para el **core** (parsers, sincronización, merge de subtítulos, validación 1:1 de traducciones): ahí los tests son baratos y detectan regresiones que a simple vista no se ven. Para **UI** es burocracia en v0.1: ahí basta smoke-test manual con checklist en dispositivo real. |
| "Evidencia antes de cerrar tarea" | ✅ **Adoptar** | Regla de oro: yo no declaro nada "terminado" sin pegar el output real de `pnpm test` / `pnpm build`. Va escrito en el CLAUDE.md. |
| CLAUDE.md + Progressive Disclosure | ✅ **Adoptar** | CLAUDE.md corto (reglas + mapa), detalles en `/docs` enlazados. Es la herramienta #1 de ahorro de tokens. |
| Multi-Agent Orchestration (orquestador + subagentes) | ❌ **Descartar por ahora** | Es para refactors masivos en codebases grandes. Tu proyecto en v0.1 son ~30-50 archivos; la orquestación añadiría complejidad y costo sin beneficio. Si algún día el monorepo crece (engines nativos, backend, móvil), lo reevaluamos. |
| Evitar "vibe coding" improvisado | ✅ **Adoptar** | Cada sesión empieza con una spec o un bug concreto, nunca con "mejora la app". |

---

## 3. Estructura del repositorio (v0.1: simple a propósito)

Nada de monorepo todavía — eso era para el plan completo; para iterar rápido, un solo paquete con el core aislado por carpeta:

```
dualsub/
├── CLAUDE.md                  ← reglas del proyecto (plantilla abajo)
├── docs/
│   ├── DECISIONS.md           ← log de decisiones (1 línea c/u, con fecha)
│   ├── PROGRESS.md            ← qué está hecho / en curso / siguiente
│   └── specs/
│       ├── 001-player-dual-mock.md
│       ├── 002-import-y-deteccion-subs.md
│       ├── 003-pipeline-api.md
│       └── ...
├── src/
│   ├── core/                  ← TS PURO, sin React ni DOM. Testeable 100%.
│   │   ├── models.ts          (MediaProject, SubtitleSegment, etc.)
│   │   ├── formats/           (parseSrt, parseVtt, dualsubJson)
│   │   ├── sync.ts            (findActiveSegment, applyOffset)
│   │   └── services/          (interfaces: Transcriber, Translator, AudioExtractor)
│   ├── engines/
│   │   ├── api/               (implementación OpenAI/Groq/Gemini)
│   │   └── mock/              (implementación falsa para dev/tests — clave, ver §7)
│   ├── ui/                    (componentes React)
│   ├── screens/               (Import, Processing, Player, TranscriptList)
│   ├── state/                 (stores Zustand)
│   └── workers/               (extracción/encodeo de audio si aplica)
├── tests/                     (Vitest, espeja src/core y engines)
├── e2e/                       (vacío en v0.1; Playwright después)
└── package.json               (Vite + React + TS + Tailwind + Vitest)
```

**Reglas estructurales que me mantienen eficiente:**
- `src/core` jamás importa React, DOM ni fetch. Si una función toca red o UI, no va ahí. Esto hace que el 80% de los bugs lógicos se cacen con tests de milisegundos, sin abrir el navegador.
- Las pantallas consumen **interfaces** de `core/services`; en dev se inyecta `engines/mock`, en prod `engines/api`. Así desarrollamos la UI completa sin gastar un centavo de API ni esperar 30 s por transcripción.

---

## 4. Plantilla de CLAUDE.md (lista para pegar en la raíz del repo)

```markdown
# DualSub — Reglas del proyecto

## Qué es
Web-app móvil-first para ver videos con doble subtítulo (EN/ES/JA) y estudiar
idiomas. v0.1 procesa vía APIs externas; IA local queda para fases futuras.

## Stack
React 18 + Vite + TypeScript estricto + Tailwind + Zustand + Vitest. pnpm.
Deploy: Netlify (estático). Sin backend propio en v0.1 (modo BYOK, ver
docs/specs/003).

## Mapa rápido
- src/core/      → lógica pura (modelos, parsers, sync). SIN React/DOM/fetch.
- src/engines/   → implementaciones de Transcriber/Translator (api | mock).
- src/screens/   → Import, Processing, Player, TranscriptList.
- docs/specs/    → una spec por iteración; trabajar SIEMPRE contra una spec.
- docs/PROGRESS.md → estado actual; leer al iniciar sesión, actualizar al cerrar.

## Reglas de trabajo (no negociables)
1. Nunca declarar una tarea completa sin pegar la salida real de
   `pnpm test` y `pnpm build`. Si fallan, la tarea no está completa.
2. Lógica nueva en src/core ⇒ test en tests/ ANTES o JUNTO al código.
3. Diffs mínimos: editar lo necesario, no reescribir archivos enteros,
   no reformatear código ajeno al cambio.
4. UI siempre desarrollada contra engines/mock; engines/api solo se toca
   cuando la spec lo pide explícitamente.
5. No añadir dependencias sin justificarlo en una línea en docs/DECISIONS.md.
6. Mobile-first: todo componente se diseña para 360px de ancho primero.
7. API keys: SOLO en localStorage vía pantalla Settings (BYOK). Jamás
   hardcodeadas, jamás en el repo, jamás en variables de build.
8. Si una spec es ambigua, preguntar UNA cosa concreta, no asumir en silencio
   decisiones de producto (idiomas, costos, UX).

## Comandos
pnpm dev / pnpm test / pnpm test:watch / pnpm build / pnpm preview

## Convenciones
- Tiempos siempre en ms enteros (startMs/endMs), nunca segundos float en core.
- Idiomas: códigos ISO 639-1 ("en" | "es" | "ja").
- El formato interno es DualSub JSON v1 (docs/specs/000-formato.md);
  SRT/VTT son solo import/export.
```

Ese archivo pesa <1 página y me da el 90% del contexto que necesito en cada sesión por ~600 tokens. Los detalles viven en `/docs` y los leo *solo cuando la tarea los toca* (progressive disclosure real).

---

## 5. La metodología por iteración (el bucle que repetiremos)

Cada feature sigue este ciclo, sin excepciones:

1. **Spec (tú + yo, en chat o Code):** documento de 1-2 páginas en `docs/specs/NNN-nombre.md` con: objetivo, criterios de aceptación verificables, qué queda fuera, y riesgos conocidos. Tu PDF original ya tenía este músculo (RF-001…RF-008 con criterios de aceptación); es el mismo formato, en pequeño.
2. **Tests primero (solo core):** escribo los tests de la lógica nueva contra la spec. Tú los revisas: si los tests describen el comportamiento que quieres, el código que los pase será correcto.
3. **Implementación:** diffs pequeños, archivo por archivo.
4. **Evidencia:** corro `pnpm test` + `pnpm build` y pego el output. En UI: checklist manual en TU teléfono (la sección 8) y me reportas qué falló.
5. **Cierre:** actualizo `PROGRESS.md` (3 líneas) y, si hubo decisión nueva, `DECISIONS.md` (1 línea). Commit con mensaje que referencia la spec (`feat(player): overlay dual — spec 001`).

**Tamaño de iteración:** algo demostrable en tu teléfono en 1-3 sesiones. Si una spec no cabe ahí, se parte. Las primeras cuatro:

| Spec | Contenido | Por qué en este orden |
|---|---|---|
| **000** | Formato DualSub JSON v1 + modelos + `findActiveSegment` con tests | El contrato del que cuelga todo; pura lógica, cero riesgo |
| **001** | Player dual con datos mock: video local + JSON, overlay horizontal, lista vertical con highlight/autoscroll, offset | El corazón de la UX, sin tocar APIs. Validas en tu teléfono la experiencia completa |
| **002** | Import: video + detección de sidecar .srt/.vtt, parsers, merge de dos pistas en dual | Habilita el caso "el video ya trae subtítulos" |
| **003** | Pipeline API (BYOK): extracción/compresión de audio en cliente → ASR con timestamps → traducción por segmentos con validación 1:1 → DualSub JSON | El caso "no trae subtítulos". Lo más riesgoso, por eso va al final con todo lo demás ya estable |

Nota sobre **subtítulos embebidos** (pistas dentro del MP4/MKV): extraerlos en navegador es posible pero no trivial (los browsers no exponen pistas mov_text/ASS de forma estándar; requiere demuxear con mediabunny o ffmpeg.wasm). En v0.1 lo resolvemos con sidecar files (.srt/.vtt junto al video) y dejamos la extracción embebida como spec 002b opcional — así no bloquea el camino crítico. Es el tipo de decisión que va a `DECISIONS.md`.

---

## 6. Economía de tokens: reglas prácticas

**En Claude Code (donde casi todo es automático):**
- CLAUDE.md corto + docs enlazadas = yo leo solo lo que la tarea necesita.
- Pídeme cambios por spec o por bug, no "revisa todo el proyecto".
- `/clear` entre tareas no relacionadas; el contexto acumulado de una tarea anterior es costo muerto para la siguiente.
- Añade `.claudeignore` (o configura permisos) para que no lea `node_modules`, `dist`, lockfiles.

**En chat (si trabajamos aquí):**
- Pégame el **error + el archivo relevante**, no el proyecto entero. Con la estructura de carpetas de §3, decir "es en `src/core/sync.ts`" me ubica sin que pegues nada más.
- Mantén un mensaje-plantilla de inicio de sesión: "Proyecto DualSub. Spec actual: 003. Estado: X. Tarea de hoy: Y". Tres líneas me ahorran releer todo.
- Cuando te entregue código largo, pide diffs ("solo lo que cambia") en vez de archivos completos re-emitidos.

**En diseño de la app (ahorro de tokens *de API de IA*, que también es tu dinero):**
- El engine mock devuelve transcripciones/traducciones falsas instantáneas → desarrollamos UI sin gastar API.
- Cachear resultados por hash del archivo de audio: re-procesar el mismo video no debe costar dos veces.
- Traducción por lotes de segmentos (10-20 por request con IDs) en vez de un request por frase: 10-20x menos overhead.

---

## 7. Harness de calidad y depuración

**Tests (Vitest), en orden de valor:**
1. `sync.ts`: segmento activo en bordes exactos, huecos entre segmentos, offset positivo/negativo, listas vacías. (Es el bug más probable y el más molesto de cazar a ojo.)
2. Parsers SRT/VTT: archivos limpios + archivos feos reales (BOM, CRLF, tags `<i>`, cues multilínea, timestamps con coma y con punto). Guarda los archivos feos en `tests/fixtures/`.
3. Pipeline de traducción: que la validación 1:1 detecte respuestas con segmentos de más/de menos, y que el reintento individual funcione (con Translator mock que falla a propósito).
4. Serialización DualSub JSON: round-trip (parse → serialize → parse) sin pérdida.

**Lo que NO testeamos automatizado en v0.1:** componentes React, estilos, el player. Eso se verifica con la checklist de dispositivo (§8). Playwright entra en v0.2 si las regresiones de UI empiezan a doler.

**Depuración entre tú y yo (protocolo):**
- Bug de lógica → me das input + output esperado + output real → lo convierto en test que falla → lo arreglo → test pasa. El bug queda vacunado para siempre.
- Bug de UI móvil → me das: dispositivo, navegador, orientación, captura/video, y pasos. Para errores JS en el teléfono: en Android, `chrome://inspect` desde tu PC con el cable USB te da DevTools completas del Chrome del teléfono — configúralo desde el día 1, es la herramienta de depuración móvil más valiosa que existe.
- Errores de API → el engine api loguea (en consola dev) request-id, status y payload truncado; sin eso, depurar APIs es adivinar.

**Mi obligación de evidencia:** ya está en el CLAUDE.md, pero la repito porque es la regla que más calidad compra: nunca te diré "listo, debería funcionar". Te diré "listo: 14/14 tests pasan, build OK, aquí el output", o "implementado, pero el test X falla por Y, decidamos".

---

## 8. Checklist de dispositivo (tu rol QA, formalizado)

Después de cada spec que toque UI, 5 minutos en tu teléfono real (no el emulador de DevTools, que miente sobre touch y rendimiento):

- [ ] Carga en frío < 3 s en 4G
- [ ] Importar video desde galería funciona (input file con `accept="video/*"`)
- [ ] Vertical: lista de diálogos hace highlight del activo y autoscroll suave; tocar un diálogo hace seek
- [ ] Horizontal/fullscreen: overlay dual legible, no tapado por controles nativos, safe-areas respetadas (notch)
- [ ] Rotar el teléfono a mitad de reproducción no rompe estado ni posición
- [ ] Pantalla apagada/bloqueada y volver: el player se recupera
- [ ] Tipografía legible a distancia de brazo (los subtítulos se leen a ~40 cm)
- [ ] Sin jank al hacer scroll de la lista con 500+ segmentos (virtualizar si duele: `react-virtuoso` está pre-aprobada como dependencia si hace falta)

Reportas con el formato del §7 y eso alimenta la siguiente sesión. Dado tu colmillo de QA, esta parte del framework está en las mejores manos posibles.

---

## 9. Decisiones de la capa API (para que la spec 003 no empiece de cero)

Pre-decisiones razonables, vetables por ti en su momento:

- **ASR:** Groq (`whisper-large-v3-turbo`) como primera opción — timestamps por segmento, muy barato (~$0.04/hora de audio) y rápido; OpenAI `whisper-1` con `verbose_json` como alternativa. Ambos manejan EN/ES/JA bien.
- **Traducción:** un LLM económico por lotes (te da naturalidad y contexto, crucial para JA↔ES/EN donde la traducción literal sufre). Google Cloud Translation como plan B mecánico.
- **Compresión de audio en cliente:** decodificar con WebAudio y re-encodear a Opus/AAC de ~32-48 kbps (WebCodecs/mediabunny o MediaRecorder). Una hora de audio queda en ~15-20 MB → bajo el límite de 25 MB, y subir eso por 4G es razonable.
- **Keys:** BYOK en localStorage (v0.1 es para ti). Si la app se abre a terceros, se inserta el proxy serverless (Netlify Function/Cloudflare Worker) sin tocar la UI — la interfaz `Transcriber` no cambia, solo la URL a la que pega.
- **Japonés, nota UX:** los subtítulos JA necesitan fuente adecuada (`font-family` con fallback `Noto Sans JP`) y la lista vertical debe manejar líneas sin espacios (word-break). Pequeño, pero si no se anota, se olvida.

---

## 10. Resumen operativo (qué hacer ahora mismo)

1. Crear repo `dualsub` + estructura del §3 + pegar el CLAUDE.md del §4.
2. Instalar Claude Code y abrirlo en el repo (o decidir que seguimos en chat con la disciplina del §6).
3. Primera sesión de trabajo: redactar juntos `docs/specs/000-formato.md` (media página) y dejarme implementar core + tests. Es una sesión corta y deja cimiento verificable.
4. Segunda sesión: spec 001, el player dual mock — al final de esa, ya ves DualSub vivo en tu teléfono.
5. A partir de ahí, el bucle del §5 hasta la 003.

El framework completo cabe en una frase: **specs pequeñas, core puro con tests, UI contra mocks, evidencia antes de "listo", y tu teléfono como juez final.**
