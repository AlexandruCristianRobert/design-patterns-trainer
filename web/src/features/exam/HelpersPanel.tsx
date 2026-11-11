import { ClipboardPaste, ExternalLink, Eye, EyeOff, ListChecks, LoaderCircle, Shapes } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCompiler } from '../../compiler/CompilerProvider'
import { getCatalogText } from '../../content/catalog'
import type { ExamQuestionContent } from '../../content/exam'
import { getPattern } from '../../content/patterns'
import type { ExamQuestionText } from '../../content/schema'
import { getExamQuestionText, getPatternText } from '../../content/text'
import type { HelpUse } from '../../exam/types'
import { StructureDiagram } from '../../visuals/StructureDiagram'
import { CheckList } from '../exercise/CheckList'
import { CompileErrorList, ContractViolationList } from '../exercise/GradeDiagnostics'
import { gradeExercise, type GradeResult } from '../exercise/gradeExercise'

export interface HelpersPanelProps {
  question: ExamQuestionContent
  text: ExamQuestionText
  /** The answer's code as it is now. */
  code: string
  /** Nothing may change: grading has started or the time is up. */
  locked: boolean
  /** A Run holds the runner, so Check must wait. */
  runBusy: boolean
  /** Told the first time each Helper is used; the page records it. */
  onUse(use: HelpUse): void
  onCopySolution(): void
  /** Named mode already shows the pattern's name on the page. */
  named: boolean
  /** Told when a check starts and ends, so Run, Submit and the question list wait for it. */
  onCheckingChange(checking: boolean): void
}

type Check = { code: string; result: GradeResult | 'error' }

/** The Helpers for one Exam Question. Keyed per question by the page, so nothing carries over to the next one. */
export function HelpersPanel({ question, text, code, locked, runBusy, named, onUse, onCopySolution, onCheckingChange }: HelpersPanelProps) {
  const { t } = useTranslation('exam')
  const titleId = useId()
  return (
    <section className="ex-block exam-helpers" aria-labelledby={titleId}>
      <h2 id={titleId} className="ex-h2">
        {t('session.helpers.title')}
      </h2>
      <p className="ex-small">{t('session.helpers.intro')}</p>
      <CheckHelper question={question} text={text} code={code} locked={locked} runBusy={runBusy} onUse={onUse} onCheckingChange={onCheckingChange} />
      <PatternHelper patternId={question.patternId} named={named} onUse={onUse} />
      <SolutionHelper solution={question.solution} locked={locked} onUse={onUse} onCopy={onCopySolution} />
    </section>
  )
}

function CheckHelper({
  question,
  text,
  code,
  locked,
  runBusy,
  onUse,
  onCheckingChange,
}: Pick<HelpersPanelProps, 'question' | 'text' | 'code' | 'locked' | 'runBusy' | 'onUse' | 'onCheckingChange'>) {
  const { t } = useTranslation('exam')
  const { status, compiler, runner } = useCompiler()
  const [checking, setChecking] = useState(false)
  const [check, setCheck] = useState<Check | null>(null)
  const inFlight = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  async function run() {
    if (inFlight.current) return
    inFlight.current = true
    const source = code
    onUse('check')
    setChecking(true)
    onCheckingChange(true)
    try {
      // The `en` text names the checks (never a translation's keys), as in grading.
      const ids = Object.keys(getExamQuestionText(question.key, 'en').value.checks)
      const result = await gradeExercise(source, question, ids, compiler, runner)
      if (alive.current) setCheck({ code: source, result })
    } catch {
      if (alive.current) setCheck({ code: source, result: 'error' })
    } finally {
      inFlight.current = false
      if (alive.current) setChecking(false)
      onCheckingChange(false)
    }
  }

  // A result belongs to the code it checked: once the code changes it is out of date and goes.
  const shown = check && check.code === code ? check.result : null
  return (
    <div className="exam-helper">
      <button type="button" className="btn btn-quiet" disabled={locked || runBusy || checking || status !== 'ready'} onClick={() => void run()}>
        {checking ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <ListChecks size={16} aria-hidden="true" />}
        <span>{checking ? t('session.helpers.check.running') : t('session.helpers.check.action')}</span>
      </button>
      <div aria-live="polite">
        {shown === 'error' && <p className="ex-small exam-bad">{t('session.helpers.check.error')}</p>}
        {shown !== null && shown !== 'error' && shown.kind === 'checked' && (
          <>
            <p className="results-summary">
              {t('session.helpers.check.summary', { passed: shown.results.filter((r) => r.status === 'passed').length, total: shown.results.length })}
            </p>
            <CheckList results={shown.results} text={text} />
          </>
        )}
        {shown !== null && shown !== 'error' && shown.kind === 'compileErrors' && <CompileErrorList diagnostics={shown.diagnostics} />}
        {shown !== null && shown !== 'error' && shown.kind === 'contractViolations' && <ContractViolationList violations={shown.violations} />}
      </div>
    </div>
  )
}

function PatternHelper({ patternId, named, onUse }: { patternId: string; named: boolean; onUse(use: HelpUse): void }) {
  const { t, i18n } = useTranslation('exam')
  const lng = i18n.language
  const [open, setOpen] = useState(false)
  const pattern = getPattern(patternId)
  // Memoized: new descriptions would rebuild the diagram's nodes (see DevVisualsPage).
  const descriptions = useMemo(() => (pattern ? getPatternText(patternId, lng).value.structure : {}), [pattern, patternId, lng])
  const name = getCatalogText(patternId, lng).value.name
  return (
    <div className="exam-helper">
      <button
        type="button"
        className="btn btn-quiet"
        aria-expanded={open}
        onClick={() => {
          if (!open) onUse('pattern')
          setOpen(!open)
        }}
      >
        {open ? <EyeOff size={16} aria-hidden="true" /> : <Shapes size={16} aria-hidden="true" />}
        <span>{open ? t('session.helpers.pattern.hide') : t('session.helpers.pattern.show')}</span>
      </button>
      {open && (
        <div className="exam-helper-body">
          {!named && <p className="exam-pattern">{t('session.helpers.pattern.name', { name })}</p>}
          {pattern && <StructureDiagram structure={pattern.structure} descriptions={descriptions} />}
          <p>
            <Link className="back-link" to={`/patterns/${patternId}`} target="_blank" rel="noopener">
              {t('session.helpers.pattern.lesson', { name })}
              <ExternalLink size={14} aria-hidden="true" />
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}

function SolutionHelper({ solution, locked, onUse, onCopy }: { solution: string; locked: boolean; onUse(use: HelpUse): void; onCopy(): void }) {
  const { t } = useTranslation('exam')
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)
  const questionId = useId()
  const copy = useRef<HTMLButtonElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const was = useRef(false)
  // The confirmation takes the button's place: focus goes to the safe choice, and back to the trigger after.
  useEffect(() => {
    if (confirming) cancel.current?.focus()
    else if (was.current) copy.current?.focus()
    was.current = confirming
  }, [confirming])
  return (
    <div className="exam-helper">
      <button
        type="button"
        className="btn btn-quiet"
        aria-expanded={open}
        onClick={() => {
          if (!open) onUse('solution')
          setOpen(!open)
          setConfirming(false)
        }}
      >
        {open ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        <span>{open ? t('session.helpers.solution.hide') : t('session.helpers.solution.show')}</span>
      </button>
      {open && (
        <section className="solution" aria-labelledby={titleId}>
          <div className="solution-head">
            <h3 id={titleId} className="ex-h3">
              {t('session.helpers.solution.title')}
            </h3>
            {!confirming && (
              <button ref={copy} type="button" className="btn btn-quiet btn-small" disabled={locked} onClick={() => setConfirming(true)}>
                <ClipboardPaste size={14} aria-hidden="true" />
                <span>{t('session.helpers.solution.copy')}</span>
              </button>
            )}
          </div>
          {confirming && (
            <div className="prog-confirm" role="group" aria-labelledby={questionId}>
              <p id={questionId} className="prog-confirm-q">{t('session.helpers.solution.confirm')}</p>
              <div className="reset-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  disabled={locked}
                  onClick={() => {
                    onCopy()
                    setConfirming(false)
                    setCopied(true)
                  }}
                >
                  {t('session.helpers.solution.replace')}
                </button>
                <button ref={cancel} type="button" className="btn btn-quiet btn-small" onClick={() => setConfirming(false)}>
                  {t('session.helpers.solution.cancel')}
                </button>
              </div>
            </div>
          )}
          {/* Focusable so a keyboard user can scroll a long solution. */}
          <pre className="solution-code" tabIndex={0}>
            <code>{solution}</code>
          </pre>
          {copied && (
            <p className="ex-small" role="status">
              {t('session.helpers.solution.copied')}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
