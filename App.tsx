import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RemotePlayScreen } from './src/online/RemotePlayScreen';
import { CardsDebugScreen } from './src/cards/CardsDebugScreen';

const SHOW_CARDS_DEBUG_SCREEN = false;

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {SHOW_CARDS_DEBUG_SCREEN ? <CardsDebugScreen /> : <RemotePlayScreen />}
    </GestureHandlerRootView>
  );
}
