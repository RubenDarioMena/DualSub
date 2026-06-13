/**
 * Selector de video local. Crea un object URL y lo entrega al store; el archivo
 * nunca sale del dispositivo (sin red). Spec: specs/001-player-dual-mock (FR-001).
 */
import type { ChangeEvent } from 'react'
import { usePlayerStore } from '../../state/playerStore'

export default function MediaPicker() {
  const setMedia = usePlayerStore((s) => s.setMedia)

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setMedia(URL.createObjectURL(file))
  }

  return (
    <label className="cursor-pointer rounded-full bg-sky-500 px-4 py-2 text-sm font-medium text-white active:bg-sky-600">
      Elegir video
      <input
        type="file"
        accept="video/*"
        onChange={onChange}
        className="hidden"
      />
    </label>
  )
}
