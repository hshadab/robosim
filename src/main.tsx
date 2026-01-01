import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/common'
import { validateEnvConfig } from './lib/config'
import { loggers } from './lib/logger'

const log = loggers.ai;

// Validate environment configuration at startup
const envValidation = validateEnvConfig();
if (envValidation.errors.length > 0) {
  log.error('Environment configuration errors', envValidation.errors);
}
envValidation.warnings.forEach(warning => {
  log.warn(warning);
});

// StrictMode disabled - causes double-mounting which crashes Intel Arc GPU WebGL
// The GPU can't handle two WebGL contexts being created simultaneously
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary name="RoboSim App">
    <App />
  </ErrorBoundary>,
)
