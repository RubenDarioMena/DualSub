import { useEffect } from 'react'
import { usePlayerStore } from './state/playerStore'
import { useLibraryStore } from './state/libraryStore'
import ImportScreen from './screens/Import/ImportScreen'
import PlayerScreen from './screens/Player/PlayerScreen'
import SettingsScreen from './screens/Settings/SettingsScreen'
import DiagnosticsScreen from './screens/Diagnostics/DiagnosticsScreen'
import LibraryScreen from './screens/Library/LibraryScreen'

export default function App() {
  const screen = usePlayerStore((s) => s.screen)

  // Spec 004: al arrancar, restaurar el proyecto más reciente si lo hay (US1).
  useEffect(() => {
    void useLibraryStore.getState().init()
  }, [])

  // Import se mantiene MONTADO (oculto) al visitar Settings/Diagnóstico: su
  // estado local (video + sidecars elegidos) no se pierde por ir a pegar una
  // API key a mitad del flujo. Se desmonta al ir a Player/Biblioteca.
  const keepImport =
    screen === 'import' || screen === 'settings' || screen === 'diagnostics'

  return (
    <>
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'diagnostics' && <DiagnosticsScreen />}
      {screen === 'library' && <LibraryScreen />}
      {screen === 'player' && <PlayerScreen />}
      {keepImport && (
        <div hidden={screen !== 'import'}>
          <ImportScreen />
        </div>
      )}
    </>
  )
}
