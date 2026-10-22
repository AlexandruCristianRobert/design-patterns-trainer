import { describe, expect, it, vi } from 'vitest'
import { applyLinkedLines } from './lineHighlight'

function fakeEditor() {
  const collection = { set: vi.fn(), clear: vi.fn() }
  return { collection, editor: { revealLinesInCenterIfOutsideViewport: vi.fn() } }
}

describe('applyLinkedLines', () => {
  it('decorates the whole line range with line-linked and reveals it', () => {
    const { collection, editor } = fakeEditor()
    applyLinkedLines(editor, collection, [3, 5])
    expect(collection.set).toHaveBeenCalledWith([
      {
        range: { startLineNumber: 3, startColumn: 1, endLineNumber: 5, endColumn: 1 },
        options: { isWholeLine: true, className: 'line-linked', linesDecorationsClassName: 'line-linked-gutter' },
      },
    ])
    expect(editor.revealLinesInCenterIfOutsideViewport).toHaveBeenCalledWith(3, 5)
  })

  it('clears the decoration for null', () => {
    const { collection, editor } = fakeEditor()
    applyLinkedLines(editor, collection, null)
    expect(collection.clear).toHaveBeenCalled()
    expect(collection.set).not.toHaveBeenCalled()
    expect(editor.revealLinesInCenterIfOutsideViewport).not.toHaveBeenCalled()
  })
})
