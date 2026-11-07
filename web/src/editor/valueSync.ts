/**
 * Decides which `value` props are written into the editor. Monaco reports each keystroke outside a React event, so
 * the render it schedules can commit one keystroke late, carrying an older value the editor itself emitted. Writing
 * that back would delete what was typed since (e.g. the "." of `Console.`), so only values the editor never emitted
 * (a reset, a loaded Draft) are applied.
 */
export function createValueSync() {
  let echoes: string[] = []
  return {
    /** Records a value the editor emitted through onChange. */
    emitted(value: string) {
      echoes.push(value)
    },
    /** True when the prop should replace the editor's text. */
    shouldApply(prop: string, editorValue: string): boolean {
      if (prop === editorValue || echoes.includes(prop)) {
        if (prop === editorValue) echoes = []
        return false
      }
      echoes = []
      return true
    },
  }
}
