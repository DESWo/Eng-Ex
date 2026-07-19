import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // On GitHub Pages the site is served from https://<user>.github.io/eng-ex/,
  // so production assets must be prefixed with that subpath. Local dev stays at root.
  // (If you rename the repo or use a custom domain, change this to '/<new-name>/' or '/'.)
  base: mode === 'production' ? '/eng-ex/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
}))
