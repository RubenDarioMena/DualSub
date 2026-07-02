# Contract: `AudioExtractor`

**Ubicación**: `src/core/services/audioExtractor.ts` (interfaz + tipos + `AudioExtractError`). Implementaciones en `src/engines/` (constitución II). Es la interfaz `AudioExtractor` anticipada en el Principio II de la constitución.

## Interfaz

```ts
export interface AudioExtractor {
  /**
   * Extrae y comprime el audio de un video a mono 16 kHz (mp3). No cachea:
   * el blob resultante vive en memoria hasta que quien llama lo suelte.
   * Lanza AudioExtractError; nunca cuelga.
   */
  extract(
    media: Blob,
    onProgress?: (ratio01: number) => void,
  ): Promise<ExtractedAudio>

  /**
   * Recorta un tramo [startMs, endMs) del audio ya extraído y devuelve un
   * blob transcribible (mismo formato). Usado por el pipeline para cada trozo
   * (con solape). Barato: opera sobre el audio ya comprimido.
   */
  slice(audio: ExtractedAudio, startMs: number, endMs: number): Promise<Blob>
}
```

## Contrato de comportamiento

| Regla | Detalle |
|-------|---------|
| Formato de salida | mp3, **1 canal, 16 kHz** (R2). `ExtractedAudio.sizeBytes` = `blob.size`. |
| `durationMs` | Duración real del audio, ms enteros. |
| Sin red | El extractor NO llama a ningún proveedor; es 100% local. La red es del `Transcriber`. |
| Errores | `AudioExtractError` con `kind ∈ {load, no-audio, decode, oom}`. Nunca lanza genérico sin tipar. |
| `slice` límites | Clampa a `[0, durationMs]`; `endMs > startMs`. Devuelve audio decodificable por sí mismo. |
| Progreso | `extract` reporta `ratio01` (0..1) para la barra; opcional. |

## Factory (engines)

```ts
// src/engines/api/index.ts
export function getAudioExtractor(mode: 'ffmpeg' | 'mock'): AudioExtractor
```

- `'ffmpeg'` → `ffmpegAudioExtractor` (`@ffmpeg/ffmpeg` monohilo, carga lazy).
- `'mock'` → `mockAudioExtractor` (devuelve un blob pequeño falso al instante; para dev y tests de UI; `slice` recorta trivialmente). Permite desarrollar toda la UI sin cargar wasm.

**Futuro Capacitor**: se añade un tercer modo (p. ej. `'native'`) que envuelve un plugin ffmpeg nativo, sin tocar la interfaz ni el pipeline.

## Tests

- La interfaz no se testea directamente; se testea el **pipeline** con un `AudioExtractor` mock (ver contrato del pipeline). El adaptador ffmpeg se valida en la quickstart (dispositivo/navegador real).
