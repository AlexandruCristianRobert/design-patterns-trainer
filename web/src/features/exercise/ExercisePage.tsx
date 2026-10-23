import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Languages,
  LoaderCircle,
  RotateCcw,
  RotateCw,
  Eye,
  EyeOff,
  History,
  ListChecks,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { CodePanel } from '../../code/CodePanel'
import { useDraft } from '../../code/useDraft'
import { useCompiler } from '../../compiler/CompilerProvider'
import { getCatalog, getCatalogText } from '../../content/catalog'
import { getPattern, type PatternContent } from '../../content/patterns'
import { getExerciseText, getPatternText } from '../../content/text'
import type { ExerciseText } from '../../content/schema'
import { deleteDraft } from '../../progress/drafts'
import {
  applyExerciseEvent,
  recordExerciseEvent,
  type ExerciseEvent,
  type ExerciseProgress,
  type ExerciseStatus,
} from '../../progress/progressStore'
import { usePatternProgress } from '../../progress/useProgress'
import { CheckList } from './CheckList'
import { ContractView } from './ContractView'
import { CompileErrorList, ContractViolationList } from './GradeDiagnostics'
import { gradeExercise, type GradeResult } from './gradeExercise'
import { HintsPanel } from './HintsPanel'
import { inlineCode } from './inlineCode'
import { SolutionPanel } from './SolutionPanel'

export function ExercisePage() {
  const { patternId = '', exerciseId = '' } = useParams()
  const pattern = getPattern(patternId)
  if (!pattern) return <Unavailable kind="pattern" patternId={patternId} />
  const index = pattern.exercises.findIndex((e) => e.id === exerciseId)
  if (index === -1) return <Unavailable kind="exercise" patternId={patternId} />
  // Keyed: another Exercise starts from a fresh page (results, open panels, Draft).
  return <Exercise key={`${patternId}/${exerciseId}`} patternId={patternId} pattern={pattern} index={index} />
}

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  /** The engine itself failed (not the learner's code). */
  | { kind: 'failed' }
  /** `source` is the code that was checked, so results can be flagged once the code changes. */
  | { kind: 'graded'; grade: GradeResult; helped: boolean; source: string }

type StorageNote = 'unavailable' | 'saveFailed'

/**
 * The Exercise's progress, from the store while it works. When the store can't be read, or a write fails, progress
 * carries on in memory for this page, so hints, the solution and status keep working ("Nothing is locked"); `note`
 * says why it won't be kept.
 */
function useExerciseProgress(patternId: string, exerciseId: string) {
  const stored = usePatternProgress(patternId)
  const [memory, setMemory] = useState<{ note: StorageNote; own: ExerciseProgress | undefined } | null>(null)
  const note: StorageNote | undefined = memory?.note ?? (stored.error ? 'unavailable' : undefined)
  const own = memory ? memory.own : stored.data?.exercises[exerciseId]
  const loaded = stored.data !== undefined || note !== undefined
  // Async callers need the latest values, not the ones from the render that started them.
  const latest = useRef({ own, note })
  useEffect(() => {
    latest.current = { own, note }
  })

  async function record(e: ExerciseEvent): Promise<ExerciseProgress> {
    const inMemory = (n: StorageNote) => {
      const next = applyExerciseEvent(latest.current.own, e, new Date().toISOString())
      latest.current = { own: next, note: n }
      setMemory({ note: n, own: next })
      return next
    }
    if (latest.current.note) return inMemory(latest.current.note)
    try {
      const next = await recordExerciseEvent(patternId, exerciseId, e)
      latest.current = { ...latest.current, own: next }
      return next
    } catch {
      return inMemory('saveFailed')
    }
  }

  return { own, loaded, note, record }
}

function Exercise({ patternId, pattern, index }: { patternId: string; pattern: PatternContent; index: number }) {
  const { t, i18n } = useTranslation('exercise')
  const lng = i18n.language
  const exercise = pattern.exercises[index]
  const key = `exercise:${patternId}/${exercise.id}` as const
  const text = useMemo(() => getExerciseText(patternId, exercise.id, lng), [patternId, exercise.id, lng])
  // Check ids are compared with the English text, which always lists every check, not a possibly partial translation.
  const checkIds = useMemo(() => Object.keys(getExerciseText(patternId, exercise.id, 'en').value.checks), [patternId, exercise.id])
  const patternText = useMemo(() => getPatternText(patternId, lng), [patternId, lng])
  const catalogText = useMemo(() => getCatalogText(patternId, lng), [patternId, lng])
  const untranslated = text.untranslated || catalogText.untranslated || patternText.untranslated

  const { status: engineStatus, compiler, runner } = useCompiler()
  const { own, loaded: progressLoaded, note: storageNote, record } = useExerciseProgress(patternId, exercise.id)
  const status: ExerciseStatus | undefined = progressLoaded ? (own?.status ?? 'notStarted') : undefined
  const draft = useDraft(key, exercise.starter, exercise.meta.version)

  const [state, setState] = useState<CheckState>({ kind: 'idle' })
  const [solutionOpen, setSolutionOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)
  // Set synchronously so a double click can't start two checks or reveal two hints.
  const busy = useRef(false)
  // Bumped by Reset: a Check that was already running then drops its result instead of undoing the reset.
  const generation = useRef(0)

  async function runCheck() {
    if (busy.current) return
    busy.current = true
    const gen = generation.current
    const source = draft.code
    setState({ kind: 'checking' })
    try {
      let grade: GradeResult | null = null
      try {
        grade = await gradeExercise(source, exercise, checkIds, compiler, runner)
      } catch {
        grade = null
      }
      if (gen !== generation.current) return
      // The attempt counts either way: the learner pressed Check, and that unlocks the solution.
      const saved = await record({ type: 'checked', allPassed: grade?.kind === 'checked' && grade.allPassed })
      if (gen !== generation.current) return
      if (!grade) setState({ kind: 'failed' })
      else setState({ kind: 'graded', grade, helped: saved.status === 'solvedWithHelp', source })
    } finally {
      busy.current = false
    }
  }

  async function revealHint() {
    if (busy.current) return
    busy.current = true
    try {
      await record({ type: 'hintRevealed' })
    } finally {
      busy.current = false
    }
  }

  function toggleSolution() {
    if (!solutionOpen && !own?.solutionRevealed) void record({ type: 'solutionRevealed' })
    setSolutionOpen(!solutionOpen)
    setCopied(false)
  }

  async function reset() {
    generation.current++
    setConfirmingReset(false)
    setState({ kind: 'idle' })
    setSolutionOpen(false)
    setCopied(false)
    draft.reset(exercise.starter)
    await Promise.all([record({ type: 'reset' }), deleteDraft(key).catch(() => undefined)])
  }

  const prev = index > 0 ? pattern.exercises[index - 1] : undefined
  const next = index < pattern.exercises.length - 1 ? pattern.exercises[index + 1] : undefined
  const checking = state.kind === 'checking'
  const canCheck = engineStatus === 'ready' && draft.loaded && !checking
  const checkedOnce = own?.checkedOnce ?? false
  const outdated = state.kind === 'graded' && draft.code !== state.source

  return (
    <div className="exercise">
      <header className="exercise-head">
        <nav aria-label={t('breadcrumb.label')} className="crumbs">
          <ol>
            <li>
              <Link to="/">{t('breadcrumb.catalog')}</Link>
            </li>
            <li>
              <Link to={`/patterns/${patternId}`}>{catalogText.value.name}</Link>
            </li>
            <li>
              <span aria-current="page">{t('breadcrumb.exercise', { index: index + 1 })}</span>
            </li>
          </ol>
        </nav>
        <h1 className="lesson-title">{text.value.title}</h1>
        <div className="exercise-meta">
          <span className="kind-badge">{t(`kind.${exercise.meta.kind}`)}</span>
          {/* Hidden until progress loads, so a returning learner never sees a wrong status flash. */}
          {status && (
            <span className="exercise-status">
              <span className={`dot dot-${status}`} aria-hidden="true" />
              <span>{t(`status.${status}`)}</span>
            </span>
          )}
          {untranslated && (
            <span className="badge badge-inline">
              <Languages size={14} aria-hidden="true" />
              {t('lesson:untranslated')}
            </span>
          )}
        </div>
        <p className="ex-small exercise-small-screen">{t('largerScreen')}</p>
        {storageNote && (
          <p className="lesson-note exercise-storage" role="status">
            <CircleAlert size={14} aria-hidden="true" />
            <span>{t(`storage.${storageNote}`)}</span>
          </p>
        )}
      </header>

      <div className="exercise-brief">
        <section className="ex-block" aria-label={t('scenario')}>
          <div className="scenario">
            {text.value.scenario
              .trim()
              .split(/\n\s*\n/)
              .map((para, i) => (
                <p key={i}>{inlineCode(para.replace(/\n/g, ' '))}</p>
              ))}
          </div>
        </section>
        <ContractView types={exercise.meta.contract.types} />
      </div>

      <div className="exercise-aids">
        <HintsPanel
          hints={text.value.hints}
          revealed={own?.hintsRevealed ?? 0}
          disabled={!progressLoaded || checking}
          onReveal={() => void revealHint()}
        />

        <section className="ex-block">
          <h2 className="ex-h2">{t('solution.title')}</h2>
          <button
            type="button"
            className="btn btn-quiet"
            disabled={!checkedOnce}
            aria-expanded={solutionOpen}
            aria-describedby={!checkedOnce ? 'solution-locked' : undefined}
            onClick={toggleSolution}
          >
            {solutionOpen ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            <span>{solutionOpen ? t('solution.hide') : t('solution.reveal')}</span>
          </button>
          {!checkedOnce && (
            <p id="solution-locked" className="ex-small">
              {t('solution.locked')}
            </p>
          )}
          {solutionOpen && (
            <SolutionPanel
              solution={exercise.solution}
              copied={copied}
              onCopy={() => {
                draft.setCode(exercise.solution)
                setCopied(true)
              }}
            />
          )}
        </section>

        <ResetControl
          confirming={confirmingReset}
          onAsk={() => setConfirmingReset(true)}
          onCancel={() => setConfirmingReset(false)}
          onConfirm={() => void reset()}
          disabled={!draft.loaded || checking}
        />

        <nav className="exercise-nav" aria-label={t('nav.label')}>
          {prev ? (
            <Link to={`/patterns/${patternId}/practice/${prev.id}`} rel="prev">
              <ArrowLeft size={14} aria-hidden="true" />
              {t('nav.previous', { title: getExerciseText(patternId, prev.id, lng).value.title })}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={`/patterns/${patternId}/practice/${next.id}`} rel="next">
              {t('nav.next', { title: getExerciseText(patternId, next.id, lng).value.title })}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </nav>
      </div>

      <div className="exercise-work">
        {draft.stale && (
          <div className="lesson-note exercise-stale" role="status">
            <span>{t('stale.message')}</span>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => draft.reset(exercise.starter)}>
              {t('stale.restart')}
            </button>
          </div>
        )}
        <CodePanel
          code={draft.code}
          onChange={draft.setCode}
          fileName={t('fileName')}
          ariaLabel={t('editorLabel')}
          readOnly={!draft.loaded}
          extraActions={
            <button type="button" className="btn btn-primary" disabled={!canCheck} onClick={() => void runCheck()}>
              {state.kind === 'checking' ? (
                <LoaderCircle size={16} className="spin" aria-hidden="true" />
              ) : (
                <ListChecks size={16} aria-hidden="true" />
              )}
              <span>{state.kind === 'checking' ? t('checking') : t('check')}</span>
            </button>
          }
          results={
            <Results
              state={state}
              outdated={outdated}
              text={text.value}
              canCheck={canCheck}
              onAgain={() => void runCheck()}
              next={next ? `/patterns/${patternId}/practice/${next.id}` : undefined}
              lesson={`/patterns/${patternId}`}
            />
          }
        />
        {draft.saveError && (
          <p className="lesson-note lesson-note-bad" role="alert">
            <CircleAlert size={14} aria-hidden="true" />
            {t('lesson:example.saveError')}
          </p>
        )}
      </div>
    </div>
  )
}

function ResetControl({
  confirming,
  disabled,
  onAsk,
  onCancel,
  onConfirm,
}: {
  confirming: boolean
  disabled: boolean
  onAsk(): void
  onCancel(): void
  onConfirm(): void
}) {
  const { t } = useTranslation('exercise')
  const ask = useRef<HTMLButtonElement>(null)
  const keep = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  // The confirmation replaces the button in place: focus goes to the safe choice, and back to the trigger after.
  useEffect(() => {
    if (confirming) keep.current?.focus()
    else if (wasConfirming.current) ask.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  if (!confirming) {
    return (
      <div className="ex-block">
        <button ref={ask} type="button" className="btn btn-quiet" disabled={disabled} onClick={onAsk}>
          <RotateCcw size={16} aria-hidden="true" />
          <span>{t('reset.action')}</span>
        </button>
      </div>
    )
  }
  return (
    <div className="ex-block reset-confirm" role="group" aria-labelledby="reset-question">
      <p id="reset-question" className="reset-question">
        {t('reset.confirm')}
      </p>
      <div className="reset-actions">
        <button type="button" className="btn btn-danger" disabled={disabled} onClick={onConfirm}>
          {t('reset.yes')}
        </button>
        <button ref={keep} type="button" className="btn btn-quiet" onClick={onCancel}>
          {t('reset.no')}
        </button>
      </div>
    </div>
  )
}

function Results({
  state,
  outdated,
  text,
  canCheck,
  onAgain,
  next,
  lesson,
}: {
  state: CheckState
  /** The code changed since these results were produced. */
  outdated: boolean
  text: ExerciseText
  canCheck: boolean
  onAgain(): void
  next?: string
  lesson: string
}) {
  const { t } = useTranslation('exercise')
  return (
    <section className="panel results" aria-labelledby="results-title">
      <div className="panel-head">
        <h2 id="results-title" className="panel-title">
          {t('results.title')}
        </h2>
      </div>
      <div className="output-body" aria-live="polite">
        {outdated && (
          <p className="note note-muted results-outdated">
            <span className="note-icon" aria-hidden="true">
              <History size={16} />
            </span>
            <span>{t('results.outdated')}</span>
          </p>
        )}
        <ResultsBody state={state} text={text} canCheck={canCheck} onAgain={onAgain} next={next} lesson={lesson} />
      </div>
    </section>
  )
}

function ResultsBody({ state, text, canCheck, onAgain, next, lesson }: Omit<Parameters<typeof Results>[0], 'outdated'>) {
  const { t } = useTranslation('exercise')
  switch (state.kind) {
    case 'idle':
      return <p className="muted">{t('results.idle')}</p>
    case 'checking':
      return (
        <p className="note note-muted">
          <span className="note-icon" aria-hidden="true">
            <LoaderCircle size={16} className="spin" />
          </span>
          <span>{t('checking')}</span>
        </p>
      )
    case 'failed':
      return (
        <div className="results-error" role="alert">
          <p className="note note-bad">
            <span className="note-icon" aria-hidden="true">
              <CircleAlert size={16} />
            </span>
            <span>{t('results.error')}</span>
          </p>
          <button type="button" className="btn btn-quiet" disabled={!canCheck} onClick={onAgain}>
            <RotateCw size={14} aria-hidden="true" />
            <span>{t('results.again')}</span>
          </button>
        </div>
      )
  }
  const { grade } = state
  if (grade.kind === 'contractViolations') return <ContractViolationList violations={grade.violations} />
  if (grade.kind === 'compileErrors') return <CompileErrorList diagnostics={grade.diagnostics} />
  const passed = grade.results.filter((r) => r.status === 'passed').length
  return (
    <div className="results-checked">
      <p className="results-summary">{t('summary', { passed, total: grade.results.length })}</p>
      <CheckList results={grade.results} text={text} />
      {grade.allPassed && (
        <div className="solved">
          <p className="solved-msg">
            <CircleCheck size={18} aria-hidden="true" />
            <span>{state.helped ? t('solvedWithHelp') : t('solved')}</span>
          </p>
          <Link className="btn btn-quiet" to={next ?? lesson}>
            <span>{next ? t('next') : t('backToLesson')}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  )
}

function Unavailable({ kind, patternId }: { kind: 'pattern' | 'exercise'; patternId: string }) {
  const { t, i18n } = useTranslation('exercise')
  const known = getCatalog().find((c) => c.id === patternId)
  const name = known ? getCatalogText(patternId, i18n.language).value.name : null
  const view =
    kind === 'exercise'
      ? { title: t('unavailable.missingTitle'), body: t('unavailable.missingBody'), to: `/patterns/${patternId}`, back: t('backToLesson') }
      : name
        ? { title: t('unavailable.soonTitle'), body: t('unavailable.soonBody', { name }), to: '/', back: t('unavailable.catalog') }
        : { title: t('unavailable.unknownTitle'), body: t('unavailable.unknownBody'), to: '/', back: t('unavailable.catalog') }
  return (
    <div className="page-head lesson-soon">
      <h1 className="page-title">{view.title}</h1>
      <p className="page-intro">{view.body}</p>
      <p>
        <Link className="back-link" to={view.to}>
          <ArrowLeft size={14} aria-hidden="true" />
          {view.back}
        </Link>
      </p>
    </div>
  )
}
