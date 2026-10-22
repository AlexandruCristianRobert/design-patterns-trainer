// Bundles Monaco with the app (no CDN): @monaco-editor/react uses this instance instead of fetching one.
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'

self.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

loader.config({ monaco })

declare global {
  interface Window {
    monaco?: typeof monaco
  }
}

// End-to-end tests drive the editor through window.monaco.editor.getModels().
if (import.meta.env.DEV) window.monaco = monaco

export { monaco }
