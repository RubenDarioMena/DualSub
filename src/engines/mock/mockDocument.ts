/**
 * Proveedor de documento dual FALSO para desarrollar la UI sin APIs ni import
 * real (constitución, principio II). El texto es ilustrativo: NO corresponde a
 * ningún audio real — es una demo de la UX de sincronización.
 * Spec: specs/001-player-dual-mock · contrato: contracts/mock-engine.md
 */
import type {
  DualSubDocument,
  MediaProject,
  SegmentTexts,
  SubtitleSegment,
} from '../../core/models'

/** Frases de ejemplo en inglés (origen). */
const EN_LINES: readonly string[] = [
  'Hey, are you ready to go?',
  'I think we should leave soon.',
  'The weather looks great today.',
  'Did you finish the report?',
  'Let me grab my coffee first.',
  'That sounds like a good plan.',
  'I cannot believe it is already noon.',
  'Where did you put the keys?',
  'We are going to be late.',
  'Take your time, no rush at all.',
]

/** Sus "traducciones" al español (destino). */
const ES_LINES: readonly string[] = [
  '¿Oye, estás listo para irnos?',
  'Creo que deberíamos salir pronto.',
  'El clima se ve genial hoy.',
  '¿Terminaste el informe?',
  'Déjame tomar mi café primero.',
  'Eso suena como un buen plan.',
  'No puedo creer que ya sea mediodía.',
  '¿Dónde pusiste las llaves?',
  'Vamos a llegar tarde.',
  'Tómate tu tiempo, no hay prisa.',
]

const SEGMENT_COUNT = 220
const SEGMENT_MS = 1800
const SHORT_GAP_MS = 200
const LONG_GAP_MS = 600

/**
 * Documento dual de demo, EN→ES. Estable entre llamadas. Garantías (contrato):
 * ≥200 segmentos ordenados sin solape, huecos (M3), ≥1 segmento sin traducción
 * (M4) y ≥1 con líneas largas (M5).
 */
export function getMockDualSubDocument(): DualSubDocument {
  const segments: SubtitleSegment[] = []
  let cursor = 0

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const startMs = cursor
    const endMs = startMs + SEGMENT_MS

    const texts: SegmentTexts = { en: EN_LINES[i % EN_LINES.length] }
    // M4: dejar algunos segmentos sin traducción para ejercitar FR-007.
    if (i % 17 !== 5) texts.es = ES_LINES[i % ES_LINES.length]

    segments.push({ startMs, endMs, texts })

    // M3: hueco largo cada 4º segmento; corto el resto.
    cursor = endMs + (i % 4 === 3 ? LONG_GAP_MS : SHORT_GAP_MS)
  }

  // M5: un segmento con líneas largas para validar word-break/wrap.
  segments[3] = {
    ...segments[3],
    texts: {
      en: 'This is a deliberately very long subtitle line meant to test wrapping and word-break behavior on narrow mobile screens.',
      es: 'Esta es una línea de subtítulo deliberadamente muy larga para probar el ajuste de texto y el corte de palabras en pantallas móviles estrechas.',
    },
  }

  return {
    version: 2,
    masterId: 'en',
    tracks: [
      { id: 'en', lang: 'en', origin: 'mock', label: 'Demo' },
      { id: 'es', lang: 'es', origin: 'mock', label: 'Demo' },
    ],
    segments,
    meta: { title: 'Demo dual (mock)', source: 'mock' },
  }
}

/**
 * Proyecto de runtime con el documento mock y offset 0. `mediaUrl` queda vacío:
 * el object URL real lo inyecta `MediaPicker` vía `setMedia` (modelo puro).
 */
export function createMockProject(): MediaProject {
  return {
    id: 'mock-1',
    mediaUrl: '',
    doc: getMockDualSubDocument(),
    offsetMs: 0,
  }
}
