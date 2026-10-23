import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, CircleX, History } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router'
import { getCatalog, getCatalogText } from '../../content/catalog'
import { getExamQuestion } from '../../content/exam'
import { getExamQuestionText } from '../../content/text'
import { getSession } from '../../exam/examStore'
import { PASS_MARK, isPass, scorePercent } from '../../exam/scoring'
import type { ExamSession, QuestionResult } from '../../exam/types'
import { CheckList } from '../exercise/CheckList'
import { CompileErrorList, ContractViolationList } from '../exercise/GradeDiagnostics'

type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'missing' } | { kind: 'ready'; session: ExamSession }

export function ExamReportPage() {
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
  if (current.kind !== 'ready') return <Notice kind={current.kind} />
  if (current.session.status === 'inProgress') return <Navigate to={`/exam/${sessionId}`} replace />
  return <Report session={current.session} />
}

function Notice({ kind }: { kind: 'loading' | 'error' | 'missing' }) {
  const { t } = useTranslation('exam')
  if (kind === 'loading') return <p className="muted">{t('report.loading')}</p>
  if (kind === 'error')
    return (
      <p className="lesson-note lesson-note-bad" role="alert">
        <CircleAlert size={14} aria-hidden="true" />
        {t('report.loadError')}
      </p>
    )
  return (
    <div className="page-head lesson-soon">
      <h1 className="page-title">{t('report.notFound.title')}</h1>
      <p className="page-intro">{t('report.notFound.body')}</p>
      <p>
        <Link className="back-link" to="/exam">
          <ArrowLeft size={14} aria-hidden="true" />
          {t('report.notFound.back')}
        </Link>
      </p>
    </div>
  )
}

function useFormatDate() {
  const { i18n } = useTranslation()
  return (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
}

function Report({ session }: { session: ExamSession }) {
  const { t } = useTranslation('exam')
  const date = useFormatDate()
  const abandoned = session.status === 'abandoned'
  const score = session.score ?? 0
  const passed = session.passed ?? isPass(score)
  const when = date(session.endedAt ?? session.startedAt)

  return (
    <div className="exam-report">
      <header className="exam-report-head">
        <h1 className="lesson-title">{t('report.title')}</h1>
      </header>

      {abandoned ? (
        <section className="report-abandoned" aria-label={t('report.status.label')}>
          <p className="report-abandoned-msg">
            <History size={18} aria-hidden="true" />
            <span>{t('report.abandoned')}</span>
          </p>
          <p className="muted">{when}</p>
        </section>
      ) : (
        <>
          <section className="report-summary" aria-label={t('report.summary.label')}>
            <div className="report-score">
              <p className="report-score-value">
                <span className="sr-only">{t('report.summary.score')}: </span>{scorePercent(score)}%</p>
              <p className={passed ? 'report-verdict report-verdict-ok' : 'report-verdict report-verdict-bad'}>
                {passed ? <CircleCheck size={16} aria-hidden="true" /> : <CircleX size={16} aria-hidden="true" />}
                <span>{passed ? t('report.summary.passed') : t('report.summary.failed')}</span>
              </p>
              <p className="ex-small">{t('report.summary.passMark', { percent: scorePercent(PASS_MARK) })}</p>
            </div>
            <dl className="report-facts">
              <div>
                <dt>{t('report.summary.date')}</dt>
                <dd>{when}</dd>
              </div>
              <div>
                <dt>{t('report.summary.mode')}</dt>
                <dd>{session.setup.named ? t('report.summary.named') : t('report.summary.unnamed')}</dd>
              </div>
              <div>
                <dt>{t('report.summary.questions')}</dt>
                <dd>{session.questionKeys.length}</dd>
              </div>
              <div>
                <dt>{t('report.summary.submittedBy')}</dt>
                <dd>{session.submittedBy === 'timer' ? t('report.summary.byTimer') : t('report.summary.byLearner')}</dd>
              </div>
            </dl>
          </section>

          {session.questionKeys.map((key, i) => (
            <QuestionSection
              key={key}
              n={i + 1}
              questionKey={key}
              result={session.results?.find((r) => r.questionKey === key)}
              code={session.answers[key]?.code ?? ''}
              named={session.setup.named}
            />
          ))}
        </>
      )}

      <nav className="report-actions" aria-label={t('report.actions.label')}>
        <Link className="btn btn-primary" to="/exam">
          <span>{t('report.actions.another')}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link className="btn btn-quiet" to="/progress#exam-history">
          <History size={16} aria-hidden="true" />
          <span>{t('report.actions.history')}</span>
        </Link>
      </nav>
    </div>
  )
}

/** A Pattern's display name, falling back to the id for a Pattern that has since left the catalog. */
function patternName(id: string, lng: string): string {
  return getCatalog().some((c) => c.id === id) ? getCatalogText(id, lng).value.name : id
}

function QuestionSection({
  n,
  questionKey,
  result,
  code,
  named,
}: {
  n: number
  questionKey: string
  result: QuestionResult | undefined
  code: string
  named: boolean
}) {
  const { t, i18n } = useTranslation('exam')
  const lng = i18n.language
  const headingId = useId()
  const yoursId = useId()
  const referenceId = useId()
  const question = getExamQuestion(questionKey)
  const text = useMemo(() => (question ? getExamQuestionText(questionKey, lng).value : undefined), [question, questionKey, lng])
  const patternId = result?.patternId ?? questionKey.split('/')[0]
  const name = patternName(patternId, lng)
  const built = getCatalog().some((c) => c.id === patternId && c.built)
  const grade = result?.grade
  const total = result?.checksTotal ?? 0
  const passed = result?.checksPassed ?? 0

  return (
    <section className="report-question" aria-labelledby={headingId}>
      <h2 id={headingId} className="report-question-title">
        {text ? t('report.question.heading', { n, title: text.title }) : t('report.question.removedHeading', { n })}
      </h2>
      <p className="report-pattern">{t('report.question.pattern', { name })}</p>

      {!named && result && (
        <div className="report-identification">
          <h3 className="ex-h3">{t('report.identification.label')}</h3>
          <p className={result.identifiedCorrectly ? 'report-id-line report-id-ok' : 'report-id-line report-id-bad'}>
            {result.identifiedCorrectly ? <CircleCheck size={16} aria-hidden="true" /> : <CircleX size={16} aria-hidden="true" />}
            <span>
              {result.identification
                ? t('report.identification.chose', { chosen: patternName(result.identification, lng) })
                : t('report.identification.none')}
            </span>
            <span className="report-id-verdict">{result.identifiedCorrectly ? t('report.identification.right') : t('report.identification.wrong')}</span>
          </p>
          {!result.identifiedCorrectly && <p className="report-id-correct">{t('report.identification.correct', { name })}</p>}
        </div>
      )}

      {result && (
        <p className="results-summary">{t('report.score', { passed, total, score: scorePercent(result.score) })}</p>
      )}

      {grade?.kind === 'checked' && text && <CheckList results={grade.results} text={text} />}
      {grade?.kind === 'checked' && !text && <p className="muted">{t('report.checksGone')}</p>}
      {grade?.kind === 'compileErrors' && <CompileErrorList diagnostics={grade.diagnostics} />}
      {grade?.kind === 'contractViolations' && <ContractViolationList violations={grade.violations} />}
      {grade?.kind === 'error' && (
        <p className="note note-bad">
          <span className="note-icon" aria-hidden="true">
            <CircleAlert size={16} />
          </span>
          <span>{t('report.gradeError')}</span>
        </p>
      )}

      <div className="report-code">
        <figure className="report-code-block">
          <figcaption id={yoursId} className="ex-h3">{t('report.code.yours')}</figcaption>
          <pre className="solution-code" tabIndex={0} role="region" aria-labelledby={yoursId}>
            <code>{code}</code>
          </pre>
        </figure>
        <figure className="report-code-block">
          <figcaption id={referenceId} className="ex-h3">{t('report.code.reference')}</figcaption>
          {question ? (
            <pre className="solution-code" tabIndex={0} role="region" aria-labelledby={referenceId}>
              <code>{question.solution}</code>
            </pre>
          ) : (
            <p className="muted report-removed">{t('report.question.removed')}</p>
          )}
        </figure>
      </div>

      {built && (
        <p>
          <Link className="back-link" to={`/patterns/${patternId}`}>
            {t('report.lesson', { name })}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </p>
      )}
    </section>
  )
}
