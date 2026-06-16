import { usePlayerStore } from './state/playerStore'
import ImportScreen from './screens/Import/ImportScreen'
import PlayerScreen from './screens/Player/PlayerScreen'
import SettingsScreen from './screens/Settings/SettingsScreen'

export default function App() {
  const screen = usePlayerStore((s) => s.screen)
  if (screen === 'settings') return <SettingsScreen />
  if (screen === 'player') return <PlayerScreen />
  return <ImportScreen />
}
