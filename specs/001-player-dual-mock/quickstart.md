# Quickstart — Validar el Player dual (spec 001)

Guía para correr y verificar la feature end-to-end. La validación de UI es
**manual en dispositivo** (framework §8); el core ya está cubierto por tests.

## Prerrequisitos

- Dependencias instaladas: `pnpm install` (sin deps nuevas en esta spec).
- Un archivo de video local (cualquiera; el contenido no importa, el subtítulo es mock).

## Correr

```bash
pnpm dev        # abre Vite; en el teléfono usa la URL de red (--host si hace falta)
```

Para depurar en el teléfono Android: `chrome://inspect` desde el PC con USB
(framework §7).

## Evidencia de cierre (obligatoria, principio III)

```bash
pnpm test       # 24/24 de spec 000 siguen verdes (esta spec no añade tests de core)
pnpm build      # tsc --noEmit estricto + vite build, en verde
```

## Checklist de validación en dispositivo (mapea a la spec)

> Hacer en un teléfono real a ~360px, no solo en el emulador de DevTools.

- [ ] **Elegir video** desde la galería reproduce dentro del Player (`accept="video/*"`). *(FR-001, SC-004)*
- [ ] **Vertical — highlight**: al reproducir, el diálogo correcto se resalta; en un
  silencio (hueco) **no** queda ninguno resaltado. *(US1, FR-003, SC-001)*
- [ ] **Vertical — autoscroll**: la lista se desplaza suave para mantener el activo a
  la vista. *(US1, FR-004)*
- [ ] **Tap-to-seek**: tocar un diálogo salta el video a su inicio (±100 ms) y lo
  resalta. *(US2, FR-005, SC-002)*
- [ ] **Overlay (horizontal)**: origen + destino legibles sobre el video, sin tapar
  por notch/controles; en hueco el overlay desaparece. *(US3, FR-006, FR-007)*
- [ ] **Segmento sin traducción**: muestra solo el origen sin romper el layout (lista
  y overlay). *(FR-007)*
- [ ] **Offset ±**: aplicar `+500`/`−500 ms` recoloca el highlight de forma coherente;
  volver a `0` restaura el estado; el documento no cambia. *(US4, FR-008, SC-003)*
- [ ] **Rotación a mitad de reproducción**: no reinicia el video; posición, play/pause
  y offset se conservan; cambia el modo. *(FR-009)*
- [ ] **Lista larga (≥200 segs)**: scroll y autoscroll fluidos, sin jank. *(SC-005)*
- [ ] **Legibilidad** a distancia de brazo (~40 cm). *(FR-010)*

Reportar fallos con el formato del framework §7 (dispositivo, navegador,
orientación, captura, pasos) para alimentar la siguiente sesión.

## Referencias

- Estado y acciones: [contracts/player-store.md](./contracts/player-store.md)
- Documento mock: [contracts/mock-engine.md](./contracts/mock-engine.md)
- Estado de runtime: [data-model.md](./data-model.md)
- Decisiones técnicas: [research.md](./research.md)
