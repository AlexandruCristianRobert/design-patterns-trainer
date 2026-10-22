import { CircleAlert, LoaderCircle, Play, RotateCw } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useCompiler, type CompilerStatus } from '../compiler/CompilerProvider'
import type { CodeEditorHandle } from '../editor/CodeEditor'
import { useLiveDiagnostics } from '../editor/useLiveDiagnostics'
import { OutputPanel, type OutputState } from '../features/sandbox/OutputPanel'
import { runSandbox } from '../features/sandbox/runSandbox'

// Monaco is large: load it after the page (and the compiler status) are already on screen.
const CodeEditor = lazy(() => import('../editor/CodeEditor').then((m) => ({ default: m.CodeEditor })))

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const PANEL_ATTR = 'data-code-panel'

export interface CodePanelProps {
  code: string
  onChange(c: string): void
  fileName: string
  ariaLabel: string
  highlightedLines?: [number, number] | null
  /** Placed in the toolbar before Run (e.g. the Exercise "Check" button). */
  extraActions?: ReactNode
  /** Rendered under the output (e.g. the Check list). */
  results?: ReactNode
  readOnly?: boolean
}

/** Editor + compiler status + Run (Ctrl/Cmd+Enter) + output. */
export function CodePanel({
  code,
  onChange,
  fileName,
  ariaLabel,
  highlightedLines,
  extraActions,
  results,
  readOnly,
}: CodePanelProps) {
  const { t } = useTranslation('sandbox')
  const { status, compiler, runner } = useCompiler()
  const [output, setOutput] = useState<OutputState>({ kind: 'idle' })
  const editorRef = useRef<CodeEditorHandle>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const diagnostics = useLiveDiagnostics(code, status === 'ready' ? compiler : null)
  const running = output.kind === 'running'
  const canRun = status === 'ready' && !running

  const latest = useRef({ code, canRun })
  useEffect(() => {
    latest.current = { code, canRun }
  })

  // Set synchronously: two triggers in the same tick (double click, key repeat) must not both pass the check
  // before React re-renders with the running state.
  const inFlight = useRef(false)
  const run = useCallback(async () => {
    if (!latest.current.canRun || inFlight.current) return
    inFlight.current = true
    setOutput({ kind: 'running' })
    try {
      setOutput(await runSandbox(latest.current.code, compiler, runner))
    } catch {
      setOutput({ kind: 'failed' })
    } finally {
      inFlight.current = false
    }
  }, [compiler, runner])

  // Ctrl/Cmd+Enter runs the panel that has focus, including inside the editor (capture phase beats Monaco's own
  // binding). With focus outside every panel it runs only when this is the one panel on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      const root = rootRef.current
      if (!root) return
      const target = e.target instanceof Node ? e.target : null
      if (!(target && root.contains(target))) {
        const inOtherPanel = target instanceof Element && target.closest(`[${PANEL_ATTR}]`)
        if (inOtherPanel || document.querySelectorAll(`[${PANEL_ATTR}]`).length !== 1) return
      }
      e.preventDefault()
      e.stopPropagation()
      void run()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [run])

  return (
    <div className="code-panel" ref={rootRef} {...{ [PANEL_ATTR]: '' }}>
      <section className="panel editor-panel" aria-label={fileName}>
        <div className="panel-head toolbar">
          <span className="file-name">{fileName}</span>
          <CompilerStatusLine status={status} />
          <div className="toolbar-actions">
            {extraActions}
            <button
              type="button"
              className="btn btn-primary run-btn"
              onClick={() => void run()}
              disabled={!canRun}
              aria-keyshortcuts="Control+Enter Meta+Enter"
            >
              {running ? (
                <LoaderCircle size={16} className="spin" aria-hidden="true" />
              ) : (
                <Play size={16} aria-hidden="true" />
              )}
              <span>{running ? t('running') : t('run')}</span>
              <kbd className="kbd-on-accent" aria-hidden="true">
                {isMac ? t('common:keys.cmd') : t('common:keys.ctrl')}+{t('common:keys.enter')}
              </kbd>
            </button>
          </div>
        </div>
        <div className="editor-host">
          <Suspense fallback={<div className="editor-placeholder" />}>
            <CodeEditor
              ref={editorRef}
              value={code}
              onChange={onChange}
              diagnostics={diagnostics}
              ariaLabel={ariaLabel}
              readOnly={readOnly}
              highlightedLines={highlightedLines}
            />
          </Suspense>
        </div>
      </section>
      <div className="code-panel-side">
        <OutputPanel output={output} onLocate={(line, column) => editorRef.current?.revealPosition(line, column)} />
        {results}
      </div>
    </div>
  )
}

function CompilerStatusLine({ status }: { status: CompilerStatus }) {
  const { t } = useTranslation()
  return (
    <div className="compiler-status" data-state={status} role="status">
      {status === 'starting' && (
        <span className="status-msg">
          <LoaderCircle size={14} className="spin" aria-hidden="true" />
          <span>{t('compiler.starting')}</span>
        </span>
      )}
      {status === 'ready' && (
        <span className="status-msg">
          <span className="status-dot" aria-hidden="true" />
          <span>{t('compiler.ready')}</span>
        </span>
      )}
      {status === 'failed' && (
        <>
          <span className="status-msg">
            <CircleAlert size={14} className="status-bad" aria-hidden="true" />
            <span className="status-bad-text">{t('compiler.failed')}</span>
          </span>
          <button type="button" className="btn btn-quiet btn-small" onClick={() => location.reload()}>
            <RotateCw size={14} aria-hidden="true" />
            <span>{t('actions.reload')}</span>
          </button>
        </>
      )}
    </div>
  )
}
