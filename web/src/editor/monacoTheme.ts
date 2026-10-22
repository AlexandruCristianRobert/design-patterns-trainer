import type * as monaco from 'monaco-editor'

/** Builds the editor theme from the live DESIGN.md tokens so the editor and app never mismatch. */
export function buildMonacoTheme(
  readVar: (name: string) => string,
  base: 'vs' | 'vs-dark',
): monaco.editor.IStandaloneThemeData {
  const v = (name: string) => readVar(name).trim()
  const bg = v('--bg')
  const codeBg = v('--code-bg')
  const text = v('--text')
  const muted = v('--muted')
  const accent = v('--accent')
  const border = v('--border')
  const lineHighlight = v('--line-highlight')
  return {
    base,
    inherit: true,
    rules: [],
    colors: {
      'editor.background': codeBg,
      'editor.foreground': text,
      'editorGutter.background': codeBg,
      'editorLineNumber.foreground': muted,
      'editorLineNumber.activeForeground': text,
      'editorCursor.foreground': accent,
      // Current line gets a quiet border; the amber token is kept for highlighted ranges (e.g. a clicked error).
      'editor.lineHighlightBackground': '#00000000',
      'editor.lineHighlightBorder': border,
      'editor.rangeHighlightBackground': lineHighlight,
      'editorIndentGuide.background1': border,
      'editorWidget.background': bg,
      'editorWidget.border': border,
      'editorHoverWidget.background': bg,
      'editorHoverWidget.border': border,
      focusBorder: accent,
    },
  }
}
