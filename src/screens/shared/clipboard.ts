/**
 * Copia texto al portapapeles. `navigator.clipboard` SOLO existe en contexto
 * seguro (https/localhost); en LAN http (uso real en el teléfono) no está —
 * mismo criterio que el fallback de `crypto.randomUUID` en `playerStore`. Por eso
 * hay respaldo con un <textarea> temporal + `execCommand('copy')`. Devuelve si
 * la copia tuvo éxito (para dar feedback en la UI).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // sin permisos o contexto no seguro: seguimos al fallback
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
