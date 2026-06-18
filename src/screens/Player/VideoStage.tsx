/**
 * El `<video>` es el RELOJ MAESTRO del player. Un bucle requestAnimationFrame
 * lee `currentTime` mientras reproduce y deriva el segmento activo con la función
 * pura `findActiveSegmentIndex` (spec 000), escribiéndolo en el store SOLO cuando
 * cambia (rendimiento, D3). También aplica las peticiones de seek.
 * Spec: specs/001-player-dual-mock (FR-003, FR-011, D1).
 */
import { useEffect, useRef } from 'react'
import { findActiveSegmentIndex } from '../../core/sync'
import { usePlayerStore } from '../../state/playerStore'

export default function VideoStage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaUrl = usePlayerStore((s) => s.mediaUrl)
  const seekRequestMs = usePlayerStore((s) => s.seekRequestMs)
  const offsetMs = usePlayerStore((s) => s.offsetMs)

  // Reloj maestro: rAF mientras reproduce; una actualización puntual al pausar
  // o tras un seek (para que el highlight responda también en pausa).
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let raf = 0
    let lastPosWrite = 0

    const computeOnce = () => {
      const { doc, offsetMs, setActiveIndex } = usePlayerStore.getState()
      const tMs = Math.round(video.currentTime * 1000)
      setActiveIndex(findActiveSegmentIndex(doc.segments, tMs - offsetMs))
    }
    // Reporta la posición al store con throttle (~2 s); se persiste con debounce
    // en `libraryStore`. `force` para pausa/seek (spec 004, D5).
    const reportPosition = (force = false) => {
      const now = performance.now()
      if (!force && now - lastPosWrite < 2000) return
      lastPosWrite = now
      usePlayerStore.getState().setPosition(Math.round(video.currentTime * 1000))
    }
    const loop = () => {
      computeOnce()
      reportPosition()
      raf = requestAnimationFrame(loop)
    }
    const onPlay = () => {
      usePlayerStore.getState().setPlaying(true)
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(loop)
    }
    const onPause = () => {
      usePlayerStore.getState().setPlaying(false)
      cancelAnimationFrame(raf)
      computeOnce()
      reportPosition(true)
    }
    const onSeeked = () => {
      computeOnce()
      reportPosition(true)
    }
    // Al cargar un video nuevo, si hay posición restaurada (>0), salta a ella
    // (restaurar un proyecto, spec 004 FR-004). Import nuevo ⇒ positionMs 0 ⇒ no salta.
    const onLoadedMetadata = () => {
      const { positionMs } = usePlayerStore.getState()
      if (positionMs > 0) video.currentTime = positionMs / 1000
    }

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    return () => {
      cancelAnimationFrame(raf)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
    }
  }, [])

  // Recoloca el highlight al instante cuando cambia el offset (también en pausa,
  // donde el bucle rAF está detenido). Spec US4 (FR-008).
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const { doc, setActiveIndex } = usePlayerStore.getState()
    const tMs = Math.round(video.currentTime * 1000)
    setActiveIndex(findActiveSegmentIndex(doc.segments, tMs - offsetMs))
  }, [offsetMs])

  // Consume una petición de seek (R3): coloca el tiempo de video y la limpia.
  // El evento `seeked` recalculará el segmento activo.
  useEffect(() => {
    const video = videoRef.current
    if (!video || seekRequestMs == null) return
    video.currentTime = seekRequestMs / 1000
    usePlayerStore.getState().clearSeek()
  }, [seekRequestMs])

  return (
    <video
      ref={videoRef}
      src={mediaUrl ?? undefined}
      controls
      playsInline
      className="h-full w-full bg-black object-contain"
    />
  )
}
