import { ArrowLeft, CircleAlert, LoaderCircle, Lock, RotateCw, Send } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router'
import { CodePanel } from '../../code/CodePanel'
import { useCompiler, type CompilerStatus } from '../../compiler/CompilerProvider'
import { getCatalogText } from '../../content/catalog'
import { EXAM_STARTER, getExamQuestion } from '../../content/exam'
import { getExamQuestionText } from '../../content/text'
import { getSession } from '../../exam/examStore'
import { submitExam } from '../../exam/submitExam'
import type { ExamAnswer, ExamSession } from '../../exam/types'
import { useExamAnswer } from '../../exam/useExamAnswer'
import { subscribeProgress } from '../../progress/progressStore'
import { ContractView } from '../exercise/ContractView'
import { inlineCode } from '../exercise/inlineCode'
import { ExamTimer } from './ExamTimer'
import { IdentificationField } from './IdentificationField'
import { QuestionNav } from './QuestionNav'

type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'missing' } | { kind: 'ready'; session: ExamSession }

const isAnswered = (a: ExamAnswer | undefined) => a !== undefined && (a.code !== EXAM_STARTER || a.identification !== null)

export function ExamSessionPage() {
  const { sessionId = '' } = useParams()
  const [load, setLoad] = useState<{ id: string; value: Load } | null>(null)

  useEffect(() => {
    let live = true
    getSession(sessionId).then(
      (s) => live && setLoad({ id: sessionId, value: s ? { kind: 'ready', session: s } : { kind: 'missing' } }),
      () => live && setLoad({ id: sessionId, value: { kind: 'error' } }),
    )
    return () => {
      live = false
    }
  }, [sessionId])

  const current: Load = load?.id === sessionId ? load.value : { kind: 'loading' }
  if (current.kind === 'loading') return <Notice kind="loading" />
  if (current.kind === 'error') return <Notice kind="error" />
  if (current.kind === 'missing') return <Notice kind="missing" />
  if (current.session.status !== 'inProgress') return <Navigate to={`/exam/${sessionId}/report`} replace />
  return <Session key={sessionId} session={current.session} />
}

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'grading'; done: number; total: number }
  /** `save`: the last changes couldn't be stored, so nothing was graded. `submit`: grading or the final write failed. */
  | { kind: 'failed'; reason: 'save' | 'submit' }

function Session({ session }: { session: ExamSession }) {
  const { t, i18n } = useTranslation('exam')
  const lng = i18n.language
  const { status: engineStatus, compiler, runner } = useCompiler()
  const saver = useExamAnswer(session.id)
  const [answers, setAnswers] = useState(session.answers)
  const answersRef = useRef(answers)
  const [index, setIndex] = useState(0)
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' })
  const [ended, setEnded] = useState(false)
  // The session was deleted while open (an import replaces every stored exam).
  const [gone, setGone] = useState(false)
  const working = useRef(false)
  // Who asked for the submit, so Try again after a timer failure stays a timer submit.
  const lastBy = useRef<'learner' | 'timer'>('learner')
  const [timerExpired, setTimerExpired] = useState(false)
  const autoSubmitted = useRef(false)
  // A Run in flight shares the runner with grading: submit waits for it.
  const running = useRef(false)
  const [runBusy, setRunBusy] = useState(false)
  const runWaiters = useRef<(() => void)[]>([])

  const total = session.questionKeys.length
  const key = session.questionKeys[index]
  const question = getExamQuestion(key)
  // A question removed from content since the exam started has no text either; it scores 0 (Ruling 6).
  const text = useMemo(() => {
    try {
      return getExamQuestionText(key, lng).value
    } catch {
      return null
    }
  }, [key, lng])
  const answer = answers[key] ?? { code: EXAM_STARTER, identification: null }
  const named = session.setup.named
  const grading = submit.kind === 'grading'
  // After the deadline nothing more may change, even while the engine starts or a submit has failed.
  const locked = grading || timerExpired

  const latest = useRef({ compiler, runner, saver })
  useEffect(() => {
    latest.current = { compiler, runner, saver }
  })

  // The exam can end elsewhere (the Shell watcher auto-submits an expired one): follow it to the report.
  useEffect(() => {
    let live = true
    const check = () =>
      void getSession(session.id).then(
        (s) => {
          if (!live) return
          if (!s) setGone(true)
          else if (s.status !== 'inProgress') setEnded(true)
        },
        () => undefined,
      )
    const off = subscribeProgress(check)
    return () => {
      live = false
      off()
    }
  }, [session.id])

  const update = useCallback((k: string, next: ExamAnswer, immediately: boolean) => {
    answersRef.current = { ...answersRef.current, [k]: next }
    setAnswers(answersRef.current)
    latest.current.saver.schedule(k, next)
    if (immediately) void latest.current.saver.flush().catch(() => undefined)
  }, [])

  const onRunningChange = useCallback((now: boolean) => {
    running.current = now
    setRunBusy(now)
    if (!now) runWaiters.current.splice(0).forEach((resolve) => resolve())
  }, [])

  const submitNow = useCallback(
    async (by: 'learner' | 'timer') => {
      if (working.current) return
      working.current = true
      lastBy.current = by
      setSubmit({ kind: 'grading', done: 0, total })
      let stage: 'save' | 'submit' = 'save'
      try {
        if (running.current) await new Promise<void>((resolve) => runWaiters.current.push(resolve))
        // The last keystrokes must be stored before grading reads them.
        await latest.current.saver.flush()
        stage = 'submit'
        const { compiler, runner } = latest.current
        await submitExam(session.id, by, { compiler, runner }, (done) => setSubmit({ kind: 'grading', done, total }))
        setEnded(true)
      } catch {
        setSubmit({ kind: 'failed', reason: stage })
      } finally {
        working.current = false
      }
    },
    [session.id, total],
  )

  // At the deadline the exam is submitted by the timer, but only once the engine can grade: with no engine every answer
  // would score 0, and a finished session can't be graded again.
  useEffect(() => {
    if (!timerExpired || engineStatus !== 'ready' || autoSubmitted.current) return
    autoSubmitted.current = true
    void submitNow('timer')
  }, [timerExpired, engineStatus, submitNow])

  if (gone) return <Notice kind="gone" />
  if (ended) return <Navigate to={`/exam/${session.id}/report`} replace />

  const unanswered = session.questionKeys.filter((k) => !isAnswered(answers[k])).length
  const available = question !== undefined && text !== null

  return (
    <div className="exercise exam-session">
      <header className="exercise-head">
        <div className="exam-head">
          <h1 className="lesson-title">{t('session.position', { n: index + 1, total })}</h1>
          <ExamTimer deadline={session.deadline} onExpire={() => setTimerExpired(true)} />
          <SubmitControl
            state={submit}
            unanswered={unanswered}
            engineStatus={engineStatus}
            onAsk={() => setSubmit({ kind: 'confirming' })}
            onCancel={() => setSubmit({ kind: 'idle' })}
            onConfirm={() => void submitNow('learner')}
            onRetry={() => void submitNow(lastBy.current)}
          />
        </div>
        <QuestionNav
          items={session.questionKeys.map((k) => ({ key: k, answered: isAnswered(answers[k]) }))}
          current={index}
          disabled={grading || runBusy}
          // The panel is keyed per question, so leaving mid-Run would abandon a Run that still holds the runner.
          reason={runBusy && !grading ? t('session.nav.runWait') : undefined}
          onSelect={(i) => {
            if (i === index) return
            void saver.flush().catch(() => undefined)
            setIndex(i)
          }}
        />
        {timerExpired && !grading && (
          <p className="lesson-note exam-locked" role="status">
            <Lock size={14} aria-hidden="true" />
            {t('session.locked')}
          </p>
        )}
        <p className="ex-small exercise-small-screen">{t('session.largerScreen')}</p>
      </header>

      {available ? (
        <>
          <div className="exercise-brief">
            <section className="ex-block" aria-label={t('session.scenario')}>
              <h2 className="ex-h2">{text.title}</h2>
              {named && <p className="exam-pattern">{t('session.pattern', { name: getCatalogText(question.patternId, lng).value.name })}</p>}
              <div className="scenario">
                {text.scenario
                  .trim()
                  .split(/\n\s*\n/)
                  .map((para, i) => (
                    <p key={i}>{inlineCode(para.replace(/\n/g, ' '))}</p>
                  ))}
              </div>
            </section>
            <ContractView types={question.meta.contract.types} />
            {!named && (
              <IdentificationField
                key={key}
                value={answer.identification}
                disabled={locked}
                onChange={(id) => update(key, { ...answersRef.current[key], identification: id }, true)}
              />
            )}
          </div>

          <div className="exercise-work">
            <CodePanel
              key={key}
              code={answer.code}
              onChange={(code) => update(key, { ...answersRef.current[key], code }, false)}
              fileName={t('session.fileName')}
              ariaLabel={t('session.editorLabel')}
              readOnly={locked}
              runDisabled={locked}
              onRunningChange={onRunningChange}
            />
            {saver.saveError && (
              <p className="lesson-note lesson-note-bad" role="alert">
                <CircleAlert size={14} aria-hidden="true" />
                {t('session.saveError')}
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="exercise-brief">
          <p className="lesson-note" role="note">
            <CircleAlert size={14} aria-hidden="true" />
            {t('session.removedQuestion')}
          </p>
        </div>
      )}
    </div>
  )
}

function SubmitControl({
  state,
  unanswered,
  engineStatus,
  onAsk,
  onCancel,
  onConfirm,
  onRetry,
}: {
  state: SubmitState
  unanswered: number
  engineStatus: CompilerStatus
  onAsk(): void
  onCancel(): void
  onConfirm(): void
  onRetry(): void
}) {
  const { t } = useTranslation('exam')
  const { t: tc } = useTranslation()
  const ask = useRef<HTMLButtonElement>(null)
  const keep = useRef<HTMLButtonElement>(null)
  const was = useRef(false)
  const status = useRef<HTMLParagraphElement>(null)
  const retry = useRef<HTMLButtonElement>(null)
  const alertBox = useRef<HTMLDivElement>(null)
  const confirming = state.kind === 'confirming'
  const engineReady = engineStatus === 'ready'
  // The confirmation takes the button's place: focus goes to the safe choice, and back to the trigger after.
  useEffect(() => {
    if (confirming) keep.current?.focus()
    else if (was.current) ask.current?.focus()
    was.current = confirming
  }, [confirming])

  const kind = state.kind
  useEffect(() => {
    if (kind === 'grading') status.current?.focus()
    else if (kind === 'failed') (retry.current && !retry.current.disabled ? retry.current : alertBox.current)?.focus()
  }, [kind])

  if (state.kind === 'grading') {
    return (
      <p ref={status} tabIndex={-1} className="exam-submit-status" role="status">
        <LoaderCircle size={16} className="spin" aria-hidden="true" />
        <span>{t('session.submit.grading', { done: Math.min(state.done + 1, state.total), total: state.total })}</span>
      </p>
    )
  }
  if (confirming) {
    return (
      <div className="exam-submit-confirm" role="group" aria-labelledby="exam-submit-question">
        <p id="exam-submit-question" className="reset-question">
          {t('session.submit.confirm')}
          {unanswered > 0 && <> {t('session.submit.unanswered', { count: unanswered })}</>}
        </p>
        <div className="reset-actions">
          <button type="button" className="btn btn-primary" disabled={!engineReady} onClick={onConfirm}>
            {t('session.submit.action')}
          </button>
          <button ref={keep} type="button" className="btn btn-quiet" onClick={onCancel}>
            {t('session.submit.keep')}
          </button>
        </div>
      </div>
    )
  }
  const reason = engineStatus === 'starting' ? t('session.submit.engineStarting') : engineStatus === 'failed' ? t('session.submit.engineFailed') : null
  return (
    <div className="exam-submit">
      <button
        ref={ask}
        type="button"
        className="btn btn-primary"
        disabled={!engineReady}
        aria-describedby={reason ? 'exam-submit-reason' : undefined}
        onClick={onAsk}
      >
        <Send size={16} aria-hidden="true" />
        <span>{t('session.submit.action')}</span>
      </button>
      {reason && (
        <p id="exam-submit-reason" className="ex-small exam-submit-note">
          {reason}
          {engineStatus === 'failed' && (
            <>
              {' '}
              <button type="button" className="btn btn-quiet btn-small" onClick={() => window.location.reload()}>
                <RotateCw size={14} aria-hidden="true" />
                <span>{tc('actions.reload')}</span>
              </button>
            </>
          )}
        </p>
      )}
      {state.kind === 'failed' && (
        <div ref={alertBox} tabIndex={-1} className="exam-submit-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <p>{t(state.reason === 'save' ? 'session.submit.saveFailed' : 'session.submit.error')}</p>
          <button ref={retry} type="button" className="btn btn-quiet" disabled={!engineReady} onClick={onRetry}>
            {t('session.submit.retry')}
          </button>
        </div>
      )}
    </div>
  )
}

function Notice({ kind }: { kind: 'loading' | 'error' | 'missing' | 'gone' }) {
  const { t } = useTranslation('exam')
  if (kind === 'loading') {
    return (
      <p className="muted" role="status">
        {t('session.loading')}
      </p>
    )
  }
  if (kind === 'error') {
    return (
      <div className="page-head">
        <p className="lesson-note lesson-note-bad" role="alert">
          <CircleAlert size={14} aria-hidden="true" />
          {t('session.loadError')}
        </p>
      </div>
    )
  }
  return (
    <div className="page-head lesson-soon">
      <h1 className="page-title">{t(kind === 'gone' ? 'session.gone.title' : 'session.notFound.title')}</h1>
      <p className="page-intro">{t(kind === 'gone' ? 'session.gone.body' : 'session.notFound.body')}</p>
      <p>
        <Link className="back-link" to="/exam">
          <ArrowLeft size={14} aria-hidden="true" />
          {t('session.notFound.back')}
        </Link>
      </p>
    </div>
  )
}
