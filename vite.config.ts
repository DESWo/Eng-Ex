import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // On GitHub Pages the site is served from https://deswo.github.io/Eng-Ex/, and
  // Pages paths are CASE-SENSITIVE, so this must match the repo name exactly ('Eng-Ex').
  // Local dev stays at root. (Custom domain or repo rename? change this to '/' or '/<new-name>/'.)
  base: mode === 'production' ? '/Eng-Ex/' : '/',
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
