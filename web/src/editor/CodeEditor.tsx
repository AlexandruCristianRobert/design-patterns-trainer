import Editor from '@monaco-editor/react'
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import type { DiagnosticInfo } from '../compiler/protocol'
import { useTheme } from '../theme/ThemeProvider'
import { diagnosticMessage } from './diagnosticMessage'
import { applyLinkedLines, replacedWholeValue } from './lineHighlight'
import { monaco } from './monacoSetup'
import { buildMonacoTheme } from './monacoTheme'

export interface CodeEditorHandle {
  /** Moves the cursor to a 1-based position, scrolls it into view and focuses the editor. */
  revealPosition(line: number, column: number): void
}

const readVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name)

function applyTheme(resolved: 'light' | 'dark') {
  const name = resolved === 'dark' ? 'dp-dark' : 'dp-light'
  monaco.editor.defineTheme(name, buildMonacoTheme(readVar, resolved === 'dark' ? 'vs-dark' : 'vs'))
  monaco.editor.setTheme(name)
  return name
}

const severity = {
  error: monaco.MarkerSeverity.Error,
  warning: monaco.MarkerSeverity.Warning,
  info: monaco.MarkerSeverity.Info,
} as const

export function CodeEditor(props: {
  value: string
  onChange(v: string): void
  diagnostics: DiagnosticInfo[]
  readOnly?: boolean
  ariaLabel: string
  /** 1-based inclusive line range shown as linked (e.g. to a diagram participant); null clears it. */
  highlightedLines?: [number, number] | null
  ref?: Ref<CodeEditorHandle>
}) {
  const { value, onChange, diagnostics, readOnly, ariaLabel, highlightedLines, ref } = props
  const { t } = useTranslation()
  const { resolved } = useTheme()
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null)
  // Later theme changes go through applyTheme in an effect; this only names the theme the editor is created with.
  const [initialTheme] = useState(() => (resolved === 'dark' ? 'dp-dark' : 'dp-light'))

  useImperativeHandle(
    ref,
    () => ({
      revealPosition(line, column) {
        if (!editor) return
        editor.setPosition({ lineNumber: line, column })
        editor.revealPositionInCenterIfOutsideViewport({ lineNumber: line, column })
        editor.focus()
      },
    }),
    [editor],
  )

  // Passive effect: runs after ThemeProvider's layout effect has updated data-theme, so the variables are current.
  useEffect(() => {
    if (editor) applyTheme(resolved)
  }, [editor, resolved])

  useEffect(() => {
    const model = editor?.getModel()
    if (!model) return
    monaco.editor.setModelMarkers(
      model,
      'dp',
      diagnostics
        .filter((d) => d.file === 'user')
        .map((d) => ({
          severity: severity[d.level],
          message: diagnosticMessage(d, t),
          code: d.id,
          startLineNumber: d.startLine,
          startColumn: d.startColumn,
          endLineNumber: d.endLine,
          endColumn: d.endColumn,
        })),
    )
  }, [editor, diagnostics, t])

  // Depend on the numbers, not the tuple: a new array with the same lines must not scroll the editor again.
  const linked = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  const from = highlightedLines?.[0]
  const to = highlightedLines?.[1]
  useEffect(() => {
    if (!editor) return
    const collection = (linked.current ??= editor.createDecorationsCollection())
    const lines: [number, number] | null = from !== undefined && to !== undefined ? [from, to] : null
    applyLinkedLines(editor, collection, lines)
    if (!lines) return
    // Replacing the whole value (a reset, a loaded Draft) collapses decorations: put the highlight back, without scrolling.
    const sub = editor.onDidChangeModelContent((e) => {
      if (replacedWholeValue(e, editor.getValue())) applyLinkedLines(editor, collection, lines, { reveal: false })
    })
    return () => sub.dispose()
  }, [editor, from, to])

  // Monaco measures glyphs once; re-measure when the web font arrives.
  useEffect(() => {
    if (!editor || !document.fonts) return
    let active = true
    void document.fonts.ready.then(() => active && monaco.editor.remeasureFonts())
    return () => {
      active = false
    }
  }, [editor])

  return (
    <Editor
      className="code-editor"
      language="csharp"
      value={value}
      theme={initialTheme}
      beforeMount={() => applyTheme(resolved)}
      onMount={(e) => setEditor(e)}
      onChange={(v) => onChange(v ?? '')}
      loading={null}
      options={{
        ariaLabel,
        readOnly,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 13,
        lineHeight: 21,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        fixedOverflowWidgets: true,
        tabSize: 4,
        renderLineHighlight: 'line',
        overviewRulerBorder: false,
        scrollbar: { useShadows: false },
      }}
    />
  )
}
