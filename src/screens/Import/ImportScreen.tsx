/**
 * Pantalla Import (spec 002). Flujo móvil-first: elegir video + 1-2 sidecars →
 * confirmar idioma/rol → construir el DualSubDocument (buildSingle/mergeDual) y
 * abrir el Player. La lectura de archivos (`File.text()`) y el object URL del
 * video viven aquí (capa UI); el parsing/merge es core puro.
 * Spec: specs/002-import-sidecar-subs · contracts/import-flow.md
 */
import { useState } from 'react'
import type { LangCode } from '../../core/models'
import type { MediaRef } from '../../core/services/projectStore'
import { buildSingle, mergeDual } from '../../core/formats/buildDocument'
import { parseSrt } from '../../core/formats/srt'
import { parseVtt } from '../../core/formats/vtt'
import {
  SubtitleParseError,
  inferLang,
  pickParser,
  type SubtitleTrack,
} from '../../core/formats/subtitleCommon'
import { usePlayerStore } from '../../state/playerStore'
import { useLibraryStore } from '../../state/libraryStore'
import { diag } from '../../state/diagnosticsStore'
import SidecarPicker from './SidecarPicker'
import TrackConfirm, { type TargetChoice } from './TrackConfirm'
import TranscribePanel from './TranscribePanel'

interface LoadedTrack {
  track: SubtitleTrack
  filename: string
  lang: LangCode | null
  role: 'source' | 'target'
}

async function loadSidecar(file: File): Promise<LoadedTrack> {
  const format = pickParser(file.name)
  if (!format) {
    throw new SubtitleParseError(
      `Formato no soportado: ${file.name}. Usa .srt o .vtt.`,
    )
  }
  const text = await file.text()
  const track = format === 'srt' ? parseSrt(text) : parseVtt(text)
  return { track, filename: file.name, lang: inferLang(file.name), role: 'source' }
}

export default function ImportScreen() {
  const loadProject = usePlayerStore((s) => s.loadProject)
  const setScreen = usePlayerStore((s) => s.setScreen)
  const hasProjects = useLibraryStore((s) => s.projects.length > 0)

  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoName, setVideoName] = useState<string | null>(null)
  const [videoRef, setVideoRef] = useState<MediaRef | null>(null)
  // Blob real del video, para poder guardarlo en el navegador (spec 004, US3).
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [tracks, setTracks] = useState<LoadedTrack[]>([])
  const [targetChoice, setTargetChoice] = useState<TargetChoice>('none')
  const [error, setError] = useState<string | null>(null)

  const onVideo = (file: File) => {
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setVideoName(file.name)
    setVideoRef({ name: file.name, sizeBytes: file.size, mimeType: file.type })
    setVideoBlob(file)
  }

  const onSidecars = async (files: File[]) => {
    const results = await Promise.allSettled(files.map(loadSidecar))
    const loaded: LoadedTrack[] = []
    const errors: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') loaded.push(r.value)
      else {
        errors.push(
          r.reason instanceof SubtitleParseError
            ? r.reason.message
            : `No se pudo leer ${files[i].name}.`,
        )
      }
    })

    // Solo reemplazamos la selección si hay pistas válidas; un archivo malo NO
    // borra lo ya elegido (A3). El primero es origen (principal); el 2.º, destino.
    if (loaded.length > 0) {
      loaded.forEach((t, i) => {
        t.role = i === 0 ? 'source' : 'target'
      })
      setTracks(loaded.slice(0, 2))
      setTargetChoice('none')
    }
    setError(errors.length > 0 ? errors.join(' ') : null)
  }

  const onLangChange = (index: number, lang: LangCode) => {
    setTracks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, lang } : t)),
    )
  }

  const onMakeSource = (index: number) => {
    setTracks((prev) =>
      prev.map((t, i) => ({ ...t, role: i === index ? 'source' : 'target' })),
    )
  }

  const source = tracks.find((t) => t.role === 'source') ?? null
  const target = tracks.find((t) => t.role === 'target') ?? null
  const dual = tracks.length === 2

  const allLangsChosen = tracks.length > 0 && tracks.every((t) => t.lang !== null)
  const dualLangsDistinct =
    !dual || (source?.lang != null && target?.lang != null && source.lang !== target.lang)
  const validationError =
    dual && allLangsChosen && !dualLangsDistinct
      ? 'El origen y el destino no pueden ser el mismo idioma.'
      : null
  const canOpen =
    videoUrl !== null && allLangsChosen && dualLangsDistinct && !error

  const onOpen = () => {
    if (!canOpen || !videoUrl || !source?.lang) return
    try {
      const doc =
        dual && target?.lang
          ? mergeDual(source.track, source.lang, target.track, target.lang)
          : buildSingle(
              source.track,
              source.lang,
              targetChoice === 'none' ? undefined : targetChoice,
            )
      loadProject({ doc, mediaUrl: videoUrl, mediaRef: videoRef, mediaBlob: videoBlob })
    } catch (e) {
      // [diag] registra la causa real (antes se tragaba el error → mensaje opaco).
      diag('error', 'Import: no se pudo abrir el proyecto', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
      setError('No se pudo construir el documento a partir de los subtítulos.')
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-neutral-950 px-4 py-8 text-neutral-100">
      <header>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {hasProjects && (
              <button
                type="button"
                onClick={() => setScreen('library')}
                aria-label="Volver a la biblioteca"
                className="shrink-0 rounded-full border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-200 active:bg-neutral-800"
              >
                ←
              </button>
            )}
            <h1 className="text-xl font-semibold">Importar</h1>
          </div>
          <button
            type="button"
            onClick={() => setScreen('settings')}
            aria-label="Settings"
            className="shrink-0 rounded-full border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-200 active:bg-neutral-800"
          >
            ⚙
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-400">
          Elige un video y sus subtítulos (.srt o .vtt). Con dos archivos verás
          doble subtítulo.
        </p>
      </header>

      <SidecarPicker
        videoName={videoName}
        sidecarNames={tracks.map((t) => t.filename)}
        onVideo={onVideo}
        onSidecars={onSidecars}
      />

      {/* Error de lectura/parseo: visible siempre, junto al selector. */}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {tracks.length > 0 && (
        <TrackConfirm
          tracks={tracks.map(({ filename, lang, role }) => ({
            filename,
            lang,
            role,
          }))}
          targetChoice={targetChoice}
          error={validationError}
          canOpen={canOpen}
          onLangChange={onLangChange}
          onMakeSource={onMakeSource}
          onTargetChoiceChange={setTargetChoice}
          onOpen={onOpen}
        />
      )}

      {/* Caso "no tengo subtítulos": video elegido y aún sin pistas → ASR (spec 005). */}
      {videoUrl && tracks.length === 0 && (
        <TranscribePanel videoUrl={videoUrl} videoBlob={videoBlob} videoRef={videoRef} />
      )}
    </div>
  )
}
