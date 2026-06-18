/**
 * [diag] Instala los captadores globales del modo diagnóstico: errores no atrapados, promesas
 * rechazadas y `console.error/warn`. Se llama UNA vez al arrancar (`main.tsx`). Loguea
 * "app iniciada" en cada carga para hacer visible el reinicio de la pestaña en móvil.
 * Spec: 003-translate-api-byok (modo diagnóstico).
 */
import { diag } from './diagnosticsStore'

let installed = false

export function installDiagnostics(): void {
  if (installed) return
  installed = true

  diag('info', 'app iniciada', `${navigator.userAgent} · ${location.href}`)

  window.addEventListener('error', (e) => {
    const where = e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : ''
    diag('error', `JS error: ${e.message}`, [where, e.error?.stack].filter(Boolean).join('\n'))
  })

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason
    const msg = reason instanceof Error ? reason.message : String(reason)
    const stack = reason instanceof Error ? reason.stack : undefined
    diag('error', `Promesa rechazada: ${msg}`, stack)
  })

  // Espeja console.error/warn al log (sin recursión: el store no usa console).
  for (const level of ['error', 'warn'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      try {
        diag(level === 'error' ? 'error' : 'warn', args.map(stringify).join(' '))
      } catch {
        // nunca dejar que el logging rompa la app
      }
      original(...args)
    }
  }
}

function stringify(v: unknown): string {
  if (typeof v === 'string') return v
  if (v instanceof Error) return v.message
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}
