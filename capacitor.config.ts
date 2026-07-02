import type { CapacitorConfig } from '@capacitor/cli'

/**
 * DualSub como app Android (cáscara Capacitor). `server.url` apunta al deploy
 * de Netlify: el APK se instala UNA vez y el contenido se actualiza con cada
 * `git push` (mismo flujo que la web). Para empaquetar la app en local (offline)
 * bastaría quitar `server.url` y recompilar (`pnpm build && npx cap sync`).
 * Instrucciones de build/instalación: docs/ANDROID.md.
 */
const config: CapacitorConfig = {
  appId: 'app.dualsub.rdm',
  appName: 'DualSub',
  webDir: 'dist',
  server: {
    url: 'https://dualsub-rdm.netlify.app',
    cleartext: false,
  },
}

export default config
