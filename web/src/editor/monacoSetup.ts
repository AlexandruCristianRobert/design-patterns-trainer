// Bundles Monaco with the app (no CDN): @monaco-editor/react uses this instance instead of fetching one.
// Only the core editor API, the features in monacoFeatures.ts and the C# tokenizer are bundled, plus the generic
// editor worker; none of Monaco's other languages or language-service workers.
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/editor/editor.api'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import './monacoFeatures'

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
