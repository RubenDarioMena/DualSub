import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { installDiagnostics } from './state/installDiagnostics'

// [diag] Instrumentación de logging (modo diagnóstico). Grep `[diag]` para hallar toda
// la instrumentación incrustada en código de producto y poder optimizarla/quitarla.
installDiagnostics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
