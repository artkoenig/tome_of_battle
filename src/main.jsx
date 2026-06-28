import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { DebugProvider } from './hooks/DebugContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DebugProvider>
      <App />
    </DebugProvider>
  </StrictMode>,
)
