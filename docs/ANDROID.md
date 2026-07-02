# DualSub en Android (Capacitor)

La app Android es una **cáscara** (WebView) que carga `https://dualsub-rdm.netlify.app`.
Eso significa que **NO hay que recompilar el APK para actualizar la app**: cada
`git push` (deploy de Netlify) actualiza lo que ves dentro del APK, igual que la web.
Solo hay que recompilar si cambia la cáscara (`capacitor.config.ts`, plugins nativos,
icono, etc.).

## Instalar el APK en tu teléfono (primera vez)

El APK de debug ya compilado queda en:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Dos maneras de meterlo en el teléfono:

**A. Por cable (adb)**
1. En el teléfono: Ajustes → Información del teléfono → toca 7 veces «Número de
   compilación» → se activa «Opciones de desarrollador» → activa «Depuración USB».
2. Conecta el cable y acepta el diálogo de confianza.
3. En el Mac: `~/Library/Android/sdk/platform-tools/adb install android/app/build/outputs/apk/debug/app-debug.apk`

**B. Sin cable (más simple)**
1. Mándate el `app-debug.apk` por Google Drive/Telegram/AirDrop-equivalente.
2. Ábrelo en el teléfono y acepta «instalar apps de origen desconocido» (es un APK
   de debug sin firmar para tienda; es normal que Android avise).

## Recompilar la cáscara (solo si cambia lo nativo)

```bash
pnpm build && npx cap sync android
cd android && JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home" ./gradlew assembleDebug
```

Requisitos ya presentes en este Mac: Android SDK en `~/Library/Android/sdk`
(ruta cacheada en `android/local.properties`, que NO se versiona) y OpenJDK 21
(instalado vía Homebrew).

## Cosas que saber

- **Requiere conexión** (carga desde Netlify). Si algún día quieres que funcione
  offline: quita `server.url` de `capacitor.config.ts`, `pnpm build && npx cap sync`
  y recompila — la app irá empaquetada dentro del APK y se actualizará recompilando.
- Los proyectos/keys viven en el almacenamiento del WebView de la app (separado del
  Chrome del teléfono): lo que guardaste en Chrome no aparece en la app, y viceversa.
- Las descargas del export (.mp4/.srt) las gestiona el WebView; si alguna no baja
  bien, es el primer candidato a plugin nativo (`@capacitor/filesystem`).
- Pantalla completa: el botón ⛶ del modo Overlay ya hace fullscreen del contenedor
  (video + doble subtítulo juntos) — dentro del APK no hay barra del navegador, así
  que el modo horizontal queda limpio.
