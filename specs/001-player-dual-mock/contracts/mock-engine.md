# Contract — Mock document engine

Proveedor del documento dual falso para desarrollar la UI sin APIs (constitución,
principio II). Vive en `src/engines/mock/mockDocument.ts`. TS puro salvo que solo
construye datos; no toca red ni DOM.

## API expuesta

```ts
/** Documento dual de demo, EN→ES, listo para el Player. Estable entre llamadas. */
export function getMockDualSubDocument(): DualSubDocument

/** Proyecto de runtime con el doc mock y offset 0. mediaUrl se rellena al elegir video. */
export function createMockProject(): MediaProject
```

## Garantías del documento devuelto

| ID | Garantía | Por qué |
|---|---|---|
| M1 | `version === 1`, `sourceLang === 'en'`, `targetLang === 'es'`. | Par fijo de la spec 001. |
| M2 | `segments.length >= 200`, ordenados por `startMs`, sin solaparse, `endMs > startMs`, `startMs >= 0`. | Valida fluidez (SC-005) y cumple invariantes del formato. |
| M3 | Existen **huecos** (≥1) entre segmentos. | Ejercita `activeIndex === -1` (edge case "sin activo"). |
| M4 | Existe **≥1 segmento sin traducción** (`texts` solo `en`, sin `es`). | Valida FR-007 (solo origen) en lista y overlay. |
| M5 | Existe **≥1 segmento con líneas largas**. | Valida `word-break`/wrap del overlay. |
| M6 | `parseDualSub(serializeDualSub(doc))` no lanza (round-trip válido). | Auto-verificación: el mock respeta el contrato de spec 000. |

## Notas

- El texto es ilustrativo; **no** corresponde a ningún audio real (es demo de UX de
  sincronización, no de contenido traducido fiel).
- `createMockProject` produce `mediaUrl: ''` (o placeholder); el object URL real lo
  inyecta `MediaPicker` vía `setMedia`. Mantiene el modelo puro (sin DOM en el mock).
- Si más adelante se quiere variar el contenido, este módulo es el único punto a
  tocar; la UI no conoce el origen de los datos (mock vs futuro import/API).
