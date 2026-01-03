import { MainLayout } from './components/layout';
import { useLoadSharedState } from './hooks/useLoadSharedState';

function App() {
  // Load shared state from URL on startup
  useLoadSharedState();

  return <MainLayout />;
}

export default App;
