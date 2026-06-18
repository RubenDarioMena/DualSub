/**
 * Transcriber FALSO para desarrollar la UI sin red ni clave (constitución II).
 * Devuelve unos segmentos de ejemplo con tiempos, en el idioma pedido, simulando las
 * etapas de subida/transcripción. Spec: specs/005-asr-pipeline.
 */
import type {
  Transcriber,
  TranscriptionProgress,
  TranscriptionRequest,
  TranscriptionResult,
} from '../../core/services/transcriber'

const SAMPLE: Record<string, string[]> = {
  en: ['This is a demo transcription.', 'It comes from the mock engine.', 'No audio was sent anywhere.'],
  es: ['Esta es una transcripción de demo.', 'Viene del motor mock.', 'No se envió ningún audio.'],
  ja: ['これはデモの文字起こしです。', 'モックエンジンからのものです。', '音声はどこにも送信されていません。'],
}

export const mockTranscriber: Transcriber = {
  async transcribe(
    req: TranscriptionRequest,
    onProgress?: (p: TranscriptionProgress) => void,
  ): Promise<TranscriptionResult> {
    onProgress?.({ stage: 'uploading' })
    onProgress?.({ stage: 'transcribing' })
    const lines = SAMPLE[req.lang] ?? SAMPLE.en
    const segments = lines.map((text, i) => ({
      startMs: i * 2000,
      endMs: i * 2000 + 1800,
      text,
    }))
    onProgress?.({ stage: 'done' })
    return { lang: req.lang, segments }
  },
}
