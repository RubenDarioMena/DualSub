# Quickstart: validar Traducción vía API (BYOK)

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

El grueso del valor se valida con **tests del core** (batching/validación/ensamblado
1:1 con el engine mock). El proveedor real (Groq) y la UI se validan a mano.

## 1. Tests del core (la red principal)

```bash
pnpm test          # incluye batch + assemble verdes
pnpm build         # tsc estricto + vite build verdes
```

**Qué deben cubrir** (SC-001/SC-005):

- `tests/core/batch.test.ts`:
  - `planBatches`: agrupa por `maxItems`/`maxChars`; **omite vacíos**; un texto enorme
    queda en su propio lote; preserva orden e `indices`.
  - `encodeBatch`/`decodeBatch`: round-trip JSON; tolera ```code fences``` y texto
    alrededor; **lanza `TranslationError('bad-shape')`** si la longitud no coincide
    (garantía 1:1) y con texto **multilínea** (segmento con `\n`).
- `tests/core/assemble.test.ts`:
  - `assembleTranslated`: mismo nº de segmentos y **timing intacto**; el documento
    **origen no se muta**; un segmento de origen vacío queda solo-origen; el resultado
    **pasa `validateDocument`**.

## 2. Validación manual con el engine mock (sin costo)

```bash
pnpm dev --host
```

- Importar (002) un `.srt` de un idioma y abrir el Player (solo-origen).
- En Settings, proveedor **"Mock (demo)"** (sin clave). Volver al Player.
- Pulsar **Traducir** → el Player pasa a **dual** al instante (texto falso),
  con el **mismo timing** y nº de segmentos. Verifica progreso y que el origen no cambia.

## 3. Validación del proveedor real (Groq, BYOK)

> Requiere una API key de Groq del propio usuario (BYOK). El costo corre por su cuenta.

| # | Paso | Esperado |
|---|------|----------|
| 1 | Settings → proveedor **Groq** + pegar clave → Guardar | La clave persiste tras recargar (localStorage). |
| 2 | Player → **Traducir** | Progreso por lotes; al terminar, destino real relleno 1:1. |
| 3 | Borrar la clave en Settings y traducir | Aviso "Configura tu API key", sin llamada. |
| 4 | Clave inválida | Error de autenticación accionable, sin colgarse. |
| 5 | Documento largo (cientos de segmentos) | Varias llamadas por lote; alineamiento 1:1 intacto. |
| 6 | Inspeccionar DevTools/Network/bundle | La clave **solo** en localStorage; nunca en el bundle (SC-004). |
| 7 | 360px (vertical) | Settings y panel de traducción usables. |

## 4. Criterio de cierre (principio III)

Pegar en `docs/PROGRESS.md` la salida real de `pnpm test` y `pnpm build` en verde y
el resultado de la checklist manual (al menos: traducir con mock y con Groq real, y un
caso de error). Sin eso, la spec **no** se declara completa.
