import { CircleAlert, LoaderCircle, Play, RotateCw } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCompiler, type CompilerStatus } from '../../compiler/CompilerProvider'
import type { CodeEditorHandle } from '../../editor/CodeEditor'
import { useLiveDiagnostics } from '../../editor/useLiveDiagnostics'
import { OutputPanel, type OutputState } from './OutputPanel'
import { runSandbox } from './runSandbox'

// Monaco is large: load it after the page (and the compiler status) are already on screen.
const CodeEditor = lazy(() => import('../../editor/CodeEditor').then((m) => ({ default: m.CodeEditor })))

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function SandboxPage() {
  const { t } = useTranslation('sandbox')
  const { status, compiler, runner } = useCompiler()
  const [source, setSource] = useState(() => t('defaultCode'))
  const [output, setOutput] = useState<OutputState>({ kind: 'idle' })
  const editorRef = useRef<CodeEditorHandle>(null)

  const diagnostics = useLiveDiagnostics(source, status === 'ready' ? compiler : null)
  const running = output.kind === 'running'
  const canRun = status === 'ready' && !running

  const latest = useRef({ source, canRun })
  useEffect(() => {
    latest.current = { source, canRun }
  })

  // Set synchronously: two triggers in the same tick (double click, key repeat) must not both pass the check
  // before React re-renders with the running state.
  const inFlight = useRef(false)
  const run = useCallback(async () => {
    if (!latest.current.canRun || inFlight.current) return
    inFlight.current = true
    setOutput({ kind: 'running' })
    try {
      setOutput(await runSandbox(latest.current.source, compiler, runner))
    } catch {
      setOutput({ kind: 'failed' })
    } finally {
      inFlight.current = false
    }
  }, [compiler, runner])

  // Ctrl/Cmd+Enter runs from anywhere, including inside the editor (capture phase beats Monaco's own binding).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        void run()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [run])

  return (
    <div className="sandbox">
      <header className="page-head">
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-intro">{t('intro')}</p>
      </header>
      <div className="sandbox-split">
        <section className="panel editor-panel" aria-label={t('fileName')}>
          <div className="panel-head toolbar">
            <span className="file-name">{t('fileName')}</span>
            <CompilerStatusLine status={status} />
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
          <div className="editor-host">
            <Suspense fallback={<div className="editor-placeholder" />}>
              <CodeEditor
                ref={editorRef}
                value={source}
                onChange={setSource}
                diagnostics={diagnostics}
                ariaLabel={t('editorLabel')}
              />
            </Suspense>
          </div>
        </section>
        <OutputPanel output={output} onLocate={(line, column) => editorRef.current?.revealPosition(line, column)} />
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
