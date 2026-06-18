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

  if (screen === 'settings') return <SettingsScreen />
  if (screen === 'diagnostics') return <DiagnosticsScreen /> // [diag]
  if (screen === 'library') return <LibraryScreen />
  if (screen === 'player') return <PlayerScreen />
  return <ImportScreen />
}
