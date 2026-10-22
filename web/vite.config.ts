import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  worker: { format: 'es' },
  test: { environment: 'jsdom', exclude: ['e2e/**', 'node_modules/**'] },
})
