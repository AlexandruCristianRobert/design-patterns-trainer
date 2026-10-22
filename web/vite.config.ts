import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    // monaco-editor's package exports map every subpath to `.js`; this reaches its stylesheets (see monacoFeatures.ts).
    alias: { 'monaco-editor-esm': fileURLToPath(new URL('./node_modules/monaco-editor/esm/vs', import.meta.url)) },
  },
  worker: { format: 'es' },
  test: { environment: 'jsdom', setupFiles: ['src/test/setup.ts'], exclude: ['e2e/**', 'node_modules/**'] },
})
