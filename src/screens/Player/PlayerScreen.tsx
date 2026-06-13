/**
 * Pantalla Player (MVP, layout vertical). Dueña de un único `VideoStage` (reloj
 * maestro) que no se remonta, con la lista de diálogos debajo. Móvil-first a
 * 360px. Spec: specs/001-player-dual-mock (US1, US2).
 */
import { usePlayerStore } from '../../state/playerStore'
import MediaPicker from './MediaPicker'
import VideoStage from './VideoStage'
import TranscriptList from './TranscriptList'

export default function PlayerScreen() {
  const mediaUrl = usePlayerStore((s) => s.mediaUrl)
  const doc = usePlayerStore((s) => s.doc)

  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="shrink-0 border-b border-neutral-800">
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <h1 className="text-sm font-semibold tracking-tight">
            DualSub
            <span className="ml-1.5 font-normal text-neutral-500">
              {doc.sourceLang}→{doc.targetLang}
            </span>
          </h1>
          <MediaPicker />
        </div>
        <div className="relative aspect-video bg-black">
          <VideoStage />
          {!mediaUrl && (
            <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-neutral-400">
              Elige un video local para ver la demo dual.
              <br />
              Los subtítulos son de ejemplo (mock).
            </div>
          )}
        </div>
      </header>

      <TranscriptList />
    </div>
  )
}
