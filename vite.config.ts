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
  build: {
    rollupOptions: {
      output: {
        // Pull the vendors that the landing page already loads into their own
        // chunks so they keep their hash across app deploys. This does not shrink
        // the first visit (they are all statically imported either way), it makes
        // every later visit cheaper: ~286 kB raw / ~91 kB gzip of dependency code
        // stops being invalidated every time app code changes.
        //
        // Every group below is a package that is *only* reachable from the entry,
        // so grouping it cannot drag lazy-route code forward. Two candidates were
        // measured and rejected for exactly that reason:
        //   framer-motion  entry + challenges share it, so a group hoists 17.9 kB
        //                  of challenge-only motion code into the first load
        //                  (+2.7 kB gzip, even with entriesAware).
        //   lucide-react   same shape, worse: a group hoists all 111 icons instead
        //                  of the 72 the eager graph uses (+16.6 kB pre-minify).
        // matter-js is deliberately absent; it stays inside CatapultChallenge.
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[/\\](react|react-dom|scheduler)[/\\]/,
              priority: 30,
            },
            {
              name: 'vendor-router',
              test: /node_modules[/\\](react-router|react-router-dom)[/\\]/,
              priority: 20,
            },
            {
              // roughjs and its geometry helpers. The sketchy borders are in the
              // hero, so this chunk is eager on purpose.
              name: 'vendor-rough',
              test: /node_modules[/\\](roughjs|path-data-parser|points-on-curve|hachure-fill)[/\\]/,
              priority: 20,
            },
            {
              name: 'vendor-css',
              test: /node_modules[/\\](tailwind-merge|clsx)[/\\]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
}))
