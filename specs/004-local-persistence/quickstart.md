# Quickstart: validar Persistencia local + biblioteca

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

El valor puro (derivación de pares) se valida con **tests del core**; la persistencia
(IndexedDB, cuota, modo ligero/con-video) se valida **a mano en el teléfono**, porque es IO
y no se testea automatizado en v0.1.

## 1. Tests del core (la red principal)

```bash
pnpm test          # incluye combine.test.ts verde
pnpm build         # tsc estricto + vite build verdes
```

**Qué deben cubrir** (SC-005):

- `tests/core/combine.test.ts`:
  - `sharesPivotGrid`: `true` con misma rejilla; `false` si difiere `startMs`/`endMs`, el nº
    de segmentos o el `sourceLang` (pivote).
  - `combineByPivot`: fusiona `texts` por índice (en+es+ja); **no muta** los inputs; timing
    intacto; el resultado pasa `validateDocument`; segmento con texto ausente en un input
    conserva solo las claves disponibles.
  - `selectPair`: fija `sourceLang`/`targetLang` y deja ambos textos legibles; no muta.
  - borde: pivote o rejilla distintos ⇒ `sharesPivotGrid=false` y `combineByPivot` señala el
    desajuste sin corromper los originales.

## 2. Validación manual en el teléfono (checklist de dispositivo, §8)

```bash
pnpm dev --host    # abrir desde el móvil por LAN, o usar el deploy de Netlify
```

**US1 — no perder el trabajo (P1):**
- [ ] Importar (002) un `.srt` + video, traducir (003). Recargar la pestaña → el proyecto
      reaparece con subtítulos y offset intactos.
- [ ] Reproducir hasta ~min 2, recargar y reabrir → retoma cerca del min 2.
- [ ] Modo ligero: al reabrir pide **solo** re-elegir el video (no idiomas, no re-importar).
- [ ] Sin proyectos guardados, arranca en Import (no biblioteca vacía).

**US2 — biblioteca (P2):**
- [ ] Guardar 2+ proyectos → aparecen en Library con título/idiomas/fecha/tamaño.
- [ ] Importar uno nuevo no borra los anteriores.
- [ ] Borrar uno → desaparece y el espacio usado baja.

**US3 — guardar video (P3):**
- [ ] Toggle apagado por defecto → guarda en ligero.
- [ ] Toggle encendido + espacio suficiente → al reabrir reproduce sin pedir archivo.
- [ ] Forzar un video grande que no quepa → aviso en llano + degradación a ligero, sin
      perder subtítulos/offset/posición.

**US4 — reusar idiomas por el inglés (P3):**
- [ ] Con EN/ES y EN/JA del mismo video, "Combinar idiomas" → par ES/JA al instante, sin
      llamadas de traducción y con tiempos intactos.

**Robustez / bordes:**
- [ ] Cerrar la pestaña a mitad de un guardado no corrompe la biblioteca.
- [ ] Modo privado: la app avisa "no se guardará" y sigue usable.

## 3. Evidencia de cierre (constitución III)

Pegar salida real de `pnpm test` (N/N) y `pnpm build` (OK), más el resultado de la checklist
de dispositivo (qué pasó en teléfono real, no "debería funcionar").
