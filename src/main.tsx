import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { applyStoredScope } from '@/lib/profile'

// Point storage at whoever is signed in BEFORE the first render, otherwise the
// hooks' initial state reads from the wrong (or no) account.
applyStoredScope()

// basename keeps routes working under the GitHub Pages subpath (/eng-ex/) and
// stays '/' in local dev. Vite fills BASE_URL from the `base` in vite.config.ts.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
