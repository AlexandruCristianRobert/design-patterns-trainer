import mdx from '@mdx-js/rollup'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { yamlPlugin } from './scripts/vite-plugin-yaml.ts'

/**
 * Lessons are MDX, compiled before react() so the JSX they turn into goes through the React transform too.
 * `lesson.en.mdx?raw` (the content test scans the source) must stay a string, so ids with a query are skipped:
 * @mdx-js/rollup itself strips the query before matching the extension.
 */
function lessonMdx(): Plugin {
  const plugin = mdx({ providerImportSource: '@mdx-js/react' })
  const transform = plugin.transform as (this: unknown, code: string, id: string) => unknown
  return {
    ...plugin,
    enforce: 'pre',
    transform(code, id) {
      return id.includes('?') ? null : transform.call(this, code, id)
    },
  } as Plugin
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    lessonMdx(),
    react({ include: /\.(mdx|js|jsx|ts|tsx)$/ }),
    yamlPlugin(),
  ],
  server: { fs: { allow: ['..'] } },
  resolve: {
    // Lessons live in ../content, outside this package: resolve the imports their compiled code makes from here.
    dedupe: ['react', '@mdx-js/react'],
    // monaco-editor's package exports map every subpath to `.js`; this reaches its stylesheets (see monacoFeatures.ts).
    alias: { 'monaco-editor-esm': fileURLToPath(new URL('./node_modules/monaco-editor/esm/vs', import.meta.url)) },
  },
  worker: { format: 'es' },
  test: { environment: 'jsdom', setupFiles: ['src/test/setup.ts'], exclude: ['e2e/**', 'node_modules/**'] },
})
