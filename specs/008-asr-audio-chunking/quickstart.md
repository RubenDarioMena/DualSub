# Quickstart — Validar ASR de videos grandes/largos

Guía de validación end-to-end. Detalles de tipos en [data-model.md](./data-model.md) y contratos en [contracts/](./contracts/).

## Prerrequisitos

- `pnpm install` (tras añadir `@ffmpeg/ffmpeg` + `@ffmpeg/util`; recordar la línea en `docs/DECISIONS.md`).
- Clave BYOK de Groq u OpenAI en Settings (para la prueba real de red).
- Un video largo real (p. ej. 360p, ~26 min, >25 MB) sin subtítulos.

## Tests automáticos (core puro) — el 80% de la lógica sin navegador

```bash
pnpm test
```

Debe cubrir y pasar:
- `tests/core/chunkPlan.test.ts`: envío único (≤24 MB → 1 chunk), troceo (N=ceil(size/20MB)), cobertura sin huecos/solape, solape clampeado en bordes.
- `tests/core/mergeChunks.test.ts`: identidad con 1 chunk; 2 y 3+ chunks con solape sin duplicar frontera; tiempos enteros y crecientes.
- `tests/core/pipeline.test.ts` (mocks): envío único; troceo feliz con progreso k/N; fallo de un chunk conserva los `ok` y el reintento completa; `confirmChunks` con N>WARN aborta si `false`.

## Validación de UI con mock (sin cargar wasm ni gastar API)

1. `pnpm dev`, Settings → ASR = **Mock**.
2. Import → elegir un video (cualquiera) sin subtítulos → **Transcribir**.
3. Esperado: progreso "Extrayendo audio… / Parte k de N…" con el `mockAudioExtractor`, y al terminar se abre el Player con la pista maestra (igual que hoy).

## Validación real en teléfono (checklist de dispositivo — constitución §Calidad)

Con clave real y el video largo:

1. Import → video de ~26 min → **Transcribir**.
2. **SC-001**: se generan subtítulos desde el inicio hasta los últimos segundos (no se corta).
3. **SC-002**: un video cuyo audio quede ≤24 MB se envía en **una** parte (progreso sin "k de N").
4. **SC-003**: en el caso troceado, revisar 1-2 fronteras entre partes: sin frase duplicada ni hueco perceptible.
5. **SC-005**: el progreso avanza de forma visible (nunca pantalla congelada).
6. **FR-013**: si el audio requiere >3 partes, aparece el aviso de confirmación antes de arrancar.
7. **FR-007**: cortar la red a mitad → error en la parte en curso + "Reintentar" que completa sin repetir lo hecho.
8. **FR-008**: probar un archivo sin audio → mensaje accionable, sin cuelgue.

## Evidencia para cerrar (constitución III)

Pegar salida de `pnpm test` (N/N) y `pnpm build` (OK), más notas de la checklist de teléfono (2-8 anteriores).
