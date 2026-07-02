import { describe, expect, it } from 'vitest'
import { buildDualSrt, formatSrtTime } from '../../src/core/export/subtitleExport'
import type { DualSubDocument } from '../../src/core/models'

const doc: DualSubDocument = {
  version: 2,
  masterId: 'en',
  tracks: [
    { id: 'en', lang: 'en' },
    { id: 'es', lang: 'es' },
  ],
  segments: [
    { startMs: 0, endMs: 1500, texts: { en: 'Hello', es: 'Hola' } },
    { startMs: 2000, endMs: 3000, texts: { en: 'Solo arriba' } },
    { startMs: 3500, endMs: 4000, texts: { en: '  ', es: '' } }, // vacío → fuera
    { startMs: 3_600_000 + 61_234, endMs: 3_600_000 + 62_000, texts: { en: 'Late', es: 'Tarde' } },
  ],
}

describe('formatSrtTime', () => {
  it('formatea horas/minutos/segundos/milis con padding', () => {
    expect(formatSrtTime(0)).toBe('00:00:00,000')
    expect(formatSrtTime(3_661_234)).toBe('01:01:01,234')
  })
  it('clampa negativos a cero', () => {
    expect(formatSrtTime(-50)).toBe('00:00:00,000')
  })
})

describe('buildDualSrt', () => {
  it('une arriba y abajo en un mismo cue y numera secuencialmente', () => {
    const srt = buildDualSrt(doc, { top: 'en', bottom: 'es' })
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:01,500\nHello\nHola')
    expect(srt).toContain('2\n00:00:02,000 --> 00:00:03,000\nSolo arriba')
    expect(srt).not.toContain('3,500') // el vacío se omite
  })

  it('respeta la vista: solo la pista de arriba si bottom es null', () => {
    const srt = buildDualSrt(doc, { top: 'es', bottom: null })
    expect(srt.split('\n\n')[0]).toBe('1\n00:00:00,000 --> 00:00:01,500\nHola')
    // El segmento sin español desaparece.
    expect(srt).not.toContain('Solo arriba')
  })

  it('aplica el offset del usuario a los tiempos', () => {
    const srt = buildDualSrt(doc, { top: 'en', bottom: 'es' }, 500)
    expect(srt).toContain('00:00:00,500 --> 00:00:02,000')
  })

  it('omite cues que el offset deja por completo antes del cero', () => {
    const srt = buildDualSrt(doc, { top: 'en', bottom: 'es' }, -2000)
    expect(srt).not.toContain('Hello')
    expect(srt.startsWith('1\n')).toBe(true) // renumera desde 1
  })

  it('documento sin nada visible produce cadena vacía', () => {
    expect(buildDualSrt(doc, { top: 'es', bottom: null }, -10_000_000)).toBe('')
  })
})
