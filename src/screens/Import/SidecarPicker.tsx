/**
 * Selección de archivos para Import: un video local y 1-2 sidecars .srt/.vtt.
 * Solo expone los inputs y entrega los `File` al orquestador; la lectura
 * (`File.text()`) y el parsing ocurren en `ImportScreen`. El video nunca se sube.
 * Spec: specs/002-import-sidecar-subs (FR-001, FR-011) · contracts/import-flow.md
 */
import type { ChangeEvent } from 'react'

interface SidecarPickerProps {
  videoName: string | null
  sidecarNames: string[]
  onVideo: (file: File) => void
  onSidecars: (files: File[]) => void
}

export default function SidecarPicker({
  videoName,
  sidecarNames,
  onVideo,
  onSidecars,
}: SidecarPickerProps) {
  const handleVideo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onVideo(file)
    // Resetea el input: permite volver a elegir el MISMO archivo (en móvil el
    // `change` no se dispara si el value no cambia) y evita selecciones fantasma.
    e.target.value = ''
  }

  const handleSidecars = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files).slice(0, 2) : []
    if (files.length > 0) onSidecars(files)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="cursor-pointer rounded-full bg-sky-500 px-4 py-2 text-center text-sm font-medium text-white active:bg-sky-600">
          {videoName ? 'Cambiar video' : 'Elegir video'}
          <input
            type="file"
            accept="video/*"
            onChange={handleVideo}
            className="hidden"
          />
        </label>
        {videoName && (
          <p className="truncate px-1 text-xs text-neutral-400">{videoName}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="cursor-pointer rounded-full border border-neutral-600 px-4 py-2 text-center text-sm font-medium text-neutral-100 active:bg-neutral-800">
          {sidecarNames.length > 0 ? 'Cambiar subtítulos' : 'Elegir subtítulos (1-2)'}
          <input
            type="file"
            accept=".srt,.vtt"
            multiple
            onChange={handleSidecars}
            className="hidden"
          />
        </label>
        {sidecarNames.map((name) => (
          <p key={name} className="truncate px-1 text-xs text-neutral-400">
            {name}
          </p>
        ))}
      </div>
    </div>
  )
}
