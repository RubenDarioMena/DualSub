/**
 * AudioExtractor de demostración (spec 008): no toca ffmpeg ni red. Devuelve un blob
 * pequeño al instante para desarrollar y probar toda la UI/pipeline sin cargar wasm ni
 * gastar API. `slice` devuelve un blob trivial. Empareja con el `mockTranscriber`.
 */
import type { AudioExtractor, ExtractedAudio } from '../../core/services/audioExtractor'

/** Duración fija simulada (2 min): cabe holgado → envío único en el pipeline. */
const MOCK_DURATION_MS = 120_000

export const mockAudioExtractor: AudioExtractor = {
  async extract(_media, onProgress) {
    onProgress?.(0)
    const blob = new Blob(['mock-audio'], { type: 'audio/mpeg' })
    onProgress?.(1)
    return { blob, durationMs: MOCK_DURATION_MS, sizeBytes: blob.size } satisfies ExtractedAudio
  },
  async slice() {
    return new Blob(['mock-chunk'], { type: 'audio/mpeg' })
  },
}
