import type { editor } from 'monaco-editor/editor/editor.api'

type Collection = Pick<editor.IEditorDecorationsCollection, 'set' | 'clear'>
type Revealer = Pick<editor.IStandaloneCodeEditor, 'revealLinesInCenterIfOutsideViewport'>

/** Marks 1-based lines [from, to] as linked to the diagram (whole-line `line-linked`) and scrolls them into view; null clears. */
export function applyLinkedLines(
  ed: Revealer,
  collection: Collection,
  lines: [number, number] | null | undefined,
  { reveal = true }: { reveal?: boolean } = {},
) {
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
  if (reveal) ed.revealLinesInCenterIfOutsideViewport(from, to)
}

type ContentChange = { isFlush: boolean; changes: readonly { rangeOffset: number; text: string }[] }

/** True when an edit replaced the whole value (setValue, or @monaco-editor/react syncing a new `value` prop). */
export function replacedWholeValue(e: ContentChange, valueAfter: string): boolean {
  if (e.isFlush) return true
  return e.changes.length === 1 && e.changes[0].rangeOffset === 0 && e.changes[0].text === valueAfter
}
