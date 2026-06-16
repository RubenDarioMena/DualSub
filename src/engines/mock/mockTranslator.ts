/**
 * Translator FALSO instantáneo para desarrollar la UI sin red ni clave (proveedor
 * "demo", constitución II). Devuelve una traducción marcada alineada 1:1, respetando
 * los textos vacíos. Spec: 003-translate-api-byok.
 */
import type {
  Translator,
  TranslationRequest,
  TranslationResult,
  TranslationProgress,
} from '../../core/services/translator'

export const mockTranslator: Translator = {
  async translate(
    req: TranslationRequest,
    onProgress?: (p: TranslationProgress) => void,
  ): Promise<TranslationResult> {
    const total = req.texts.filter((t) => t.trim() !== '').length
    // Progreso a mitad y al final, para ejercitar la barra de la UI.
    onProgress?.({ done: Math.floor(total / 2), total })
    const texts = req.texts.map((t) =>
      t.trim() === '' ? undefined : `«${req.targetLang}» ${t}`,
    )
    onProgress?.({ done: total, total })
    return { texts }
  },
}
