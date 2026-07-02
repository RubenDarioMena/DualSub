import { describe, expect, it } from 'vitest'
import {
  defaultView,
  getTrack,
  masterTrack,
  nextTrackId,
  pendingCount,
  resolveView,
  tracksForLang,
} from '../../src/core/tracks'
import type { DualSubDocument } from '../../src/core/models'

const doc: DualSubDocument = {
  version: 2,
  masterId: 'en',
  tracks: [
    { id: 'en', lang: 'en', origin: 'asr' },
    { id: 'es', lang: 'es', origin: 'translation', label: 'Groq' },
    { id: 'es-2', lang: 'es', origin: 'translation', label: 'DeepL' },
  ],
  segments: [
    { startMs: 0, endMs: 1000, texts: { en: 'Hello', es: 'Hola' } },
    { startMs: 1000, endMs: 2000, texts: { en: '' } }, // maestra vacía: no cuenta
    { startMs: 2000, endMs: 3000, texts: { en: 'Bye', es: 'Adiós', 'es-2': 'Chao' } },
  ],
}

describe('tracks helpers (spec 007)', () => {
  it('getTrack / masterTrack / tracksForLang', () => {
    expect(getTrack(doc, 'es-2')?.label).toBe('DeepL')
    expect(getTrack(doc, 'nope')).toBeNull()
    expect(masterTrack(doc).id).toBe('en')
    expect(tracksForLang(doc, 'es').map((t) => t.id)).toEqual(['es', 'es-2'])
  })

  it('nextTrackId no colisiona: en→en-2, ja→ja', () => {
    expect(nextTrackId(doc, 'ja')).toBe('ja')
    expect(nextTrackId(doc, 'es')).toBe('es-3')
    expect(nextTrackId(doc, 'en')).toBe('en-2')
  })

  it('defaultView: maestra arriba, primera no-maestra abajo', () => {
    expect(defaultView(doc)).toEqual({ top: 'en', bottom: 'es' })
    const single: DualSubDocument = { ...doc, tracks: [doc.tracks[0]] }
    expect(defaultView(single)).toEqual({ top: 'en', bottom: null })
  })

  it('resolveView: respeta vistas válidas y repara ids colgantes', () => {
    expect(resolveView(doc, { top: 'es-2', bottom: 'en' })).toEqual({
      top: 'es-2',
      bottom: 'en',
    })
    expect(resolveView(doc, { top: 'ghost', bottom: 'ghost' })).toEqual({
      top: 'en',
      bottom: null,
    })
    expect(resolveView(doc, null)).toEqual({ top: 'en', bottom: 'es' })
    // Arriba y abajo nunca son la misma pista.
    expect(resolveView(doc, { top: 'es', bottom: 'es' }).bottom).not.toBe('es')
  })

  it('pendingCount: cuenta solo segmentos con maestra no vacía y sin texto', () => {
    expect(pendingCount(doc, 'es')).toBe(0) // seg2 tiene maestra vacía
    expect(pendingCount(doc, 'es-2')).toBe(1) // falta en el primero
    expect(pendingCount(doc, 'ja')).toBe(2) // pista inexistente: todo pendiente
  })
})
