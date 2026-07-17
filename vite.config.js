import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Netlify serves the built SPA from dist/. The app talks to server logic
// only through /api/* Netlify Functions (see netlify.toml redirect), so the
// Vite dev server proxies /api → the local Netlify dev functions port when
// running `netlify dev`. In plain `vite` the /api calls just 404 locally —
// use `netlify dev` for full-stack local work.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8888',
    },
  },
})
