import type { editor } from 'monaco-editor/editor/editor.api'

type Collection = Pick<editor.IEditorDecorationsCollection, 'set' | 'clear'>
type Revealer = Pick<editor.IStandaloneCodeEditor, 'revealLinesInCenterIfOutsideViewport'>

/** Marks 1-based lines [from, to] as linked to the diagram (whole-line `line-linked`) and scrolls them into view; null clears. */
export function applyLinkedLines(ed: Revealer, collection: Collection, lines: [number, number] | null | undefined) {
  if (!lines) {
    collection.clear()
    return
  }
  const [from, to] = lines
  collection.set([
    {
      range: { startLineNumber: from, startColumn: 1, endLineNumber: to, endColumn: 1 },
      options: { isWholeLine: true, className: 'line-linked', linesDecorationsClassName: 'line-linked-gutter' },
    },
  ])
  ed.revealLinesInCenterIfOutsideViewport(from, to)
}
