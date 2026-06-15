import { usePlayerStore } from './state/playerStore'
import ImportScreen from './screens/Import/ImportScreen'
import PlayerScreen from './screens/Player/PlayerScreen'

export default function App() {
  const screen = usePlayerStore((s) => s.screen)
  return screen === 'player' ? <PlayerScreen /> : <ImportScreen />
}
