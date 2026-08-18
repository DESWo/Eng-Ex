import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { applyStoredScope } from '@/lib/profile'

// Point storage at whoever is signed in BEFORE the first render, otherwise the
// hooks' initial state reads from the wrong (or no) account.
applyStoredScope()

// basename tracks whatever `base` vite.config.ts sets: '/' now that the app has
// its own domain, and the Pages subpath before that. Vite fills BASE_URL from
// that value, so this line needs no edit if the host ever moves again.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
