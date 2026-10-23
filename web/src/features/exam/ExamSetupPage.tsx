import { ArrowRight, LoaderCircle, Play, RotateCw, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { getCatalog, getCatalogText } from '../../content/catalog'
import { getExamPool } from '../../content/exam'
import type { Category } from '../../content/schema'
import { remainingMs, MINUTES_PER_QUESTION } from '../../exam/deadline'
import { useExamWatch } from '../../exam/ExamWatchContext'
import { abandonSession, createSession, ExamInProgressError, getInProgressSession, lastSeenByQuestion } from '../../exam/examStore'
import { formatRemaining } from '../../exam/formatTime'
import { availableCount, selectQuestions } from '../../exam/selection'
import type { ExamScope, ExamSession, ExamSetup } from '../../exam/types'
import { subscribeProgress } from '../../progress/progressStore'

const now = () => new Date()
const MIN_COUNT = 1
const MAX_COUNT = 10
const DEFAULT_COUNT = 3
const CATEGORIES: Category[] = ['creational', 'structural', 'behavioral']

/** The in-progress session, read on mount and whenever progress changes (another tab, Abandon, auto-submit). */
function useInProgress() {
  const [state, setState] = useState<{ loaded: boolean; session: ExamSession | undefined }>({ loaded: false, session: undefined })
  const reload = useRef<() => Promise<void>>(() => Promise.resolve())
  useEffect(() => {
    let live = true
    const load = () =>
      getInProgressSession().then(
        (session) => {
          if (live) setState({ loaded: true, session })
        },
        () => {
          // Unreadable storage: show the form; Start reports its own failure.
          if (live) setState((s) => ({ loaded: true, session: s.session }))
        },
      )
    reload.current = load
    void load()
    const off = subscribeProgress(() => void load())
    return () => {
      live = false
      off()
    }
  }, [])
  return { ...state, reload: () => reload.current() }
}

/**
 * Spec §6: an expired session is auto-submitted on return, so it can't be resumed or abandoned. This mirrors the Shell
 * watcher (which does the submit), and its recovery when the submit fails.
 */
function ExpiredStatus({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation('exam')
  const { t: tc } = useTranslation()
  const { session, phase, cause, retry } = useExamWatch()
  if (session?.id === sessionId && phase === 'failed') {
    return (
      <div className="exam-expired-error" role="alert">
        <div className="prog-error">
          <TriangleAlert size={16} aria-hidden="true" />
          <p>{cause === 'compiler' ? t('banner.compilerError') : t('banner.error')}</p>
        </div>
        <div className="reset-actions">
          {cause === 'compiler' ? (
            <button type="button" className="btn btn-quiet" onClick={() => window.location.reload()}>
              <RotateCw size={16} aria-hidden="true" />
              {tc('actions.reload')}
            </button>
          ) : (
            <button type="button" className="btn btn-quiet" onClick={retry}>
              {t('banner.retry')}
            </button>
          )}
        </div>
      </div>
    )
  }
  return (
    <p className="exam-submit-status" role="status">
      <LoaderCircle size={16} className="spin" aria-hidden="true" />
      <span>{t('banner.submitting')}</span>
    </p>
  )
}

function ResumePanel({ session }: { session: ExamSession }) {
  const { t } = useTranslation('exam')
  const [confirming, setConfirming] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const keep = useRef<HTMLButtonElement>(null)
  const abandon = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)

  useEffect(() => {
    if (session.deadline === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [session.deadline])

  // The confirmation appears in place: focus the safe choice, and give focus back to Abandon when it is dismissed.
  useEffect(() => {
    if (confirming) keep.current?.focus()
    else if (wasConfirming.current) abandon.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  const remaining = remainingMs(session, now)
  const expired = remaining === 0

  async function onAbandon() {
    setBusy(true)
    setFailed(false)
    try {
      await abandonSession(session.id, new Date())
    } catch {
      setFailed(true)
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel exam-panel" aria-labelledby="exam-resume-title">
      <div className="prog-panel-body">
        <h2 id="exam-resume-title" className="prog-h2">
          {expired ? t('resume.expiredTitle') : t('resume.title')}
        </h2>
        <p className="prog-muted">
          <span>{t('resume.questions', { count: session.questionKeys.length })}</span>
          {!expired && ' · '}
          {expired ? null : remaining === null ? t('resume.untimed') : t('resume.timeLeft', { time: formatRemaining(remaining) })}
        </p>
        {expired ? (
          <ExpiredStatus sessionId={session.id} />
        ) : confirming ? (
          <div className="prog-confirm" role="group" aria-labelledby="exam-abandon-q">
            <p id="exam-abandon-q" className="prog-confirm-q">
              {t('resume.confirm')}
            </p>
            <div className="reset-actions">
              <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void onAbandon()}>
                {t('resume.confirmAction')}
              </button>
              <button ref={keep} type="button" className="btn btn-quiet" onClick={() => setConfirming(false)}>
                {t('resume.keep')}
              </button>
            </div>
          </div>
        ) : (
          <div className="reset-actions">
            <Link className="btn btn-primary" to={`/exam/${session.id}`}>
              {t('resume.resume')}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <button ref={abandon} type="button" className="btn btn-quiet" onClick={() => setConfirming(true)}>
              {t('resume.abandon')}
            </button>
          </div>
        )}
        {failed && !expired && (
          <div className="prog-error" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <p>{t('resume.abandonError')}</p>
          </div>
        )}
      </div>
    </section>
  )
}

function Switch({ label, hint, checked, onChange, hintId }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; hintId: string }) {
  const labelId = useId()
  return (
    <label className="exam-switch">
      <span className="exam-switch-text">
        <span id={labelId} className="exam-label">
          {label}
        </span>
        <span id={hintId} className="prog-hint">
          {hint}
        </span>
      </span>
      <input type="checkbox" role="switch" checked={checked} aria-labelledby={labelId} aria-describedby={hintId} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function parseCount(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null
  const n = Number(text)
  return n >= MIN_COUNT && n <= MAX_COUNT ? n : null
}

function SetupForm({ onBlocked }: { onBlocked: () => Promise<void> }) {
  const { t, i18n } = useTranslation('exam')
  const { t: tc } = useTranslation('catalog')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const pool = useMemo(() => getExamPool(), [])
  const builtPatterns = useMemo(
    () => getCatalog().filter((c) => c.built).map((c) => ({ id: c.id, name: getCatalogText(c.id, i18n.language).value.name })),
    [i18n.language],
  )

  const [countText, setCountText] = useState(String(DEFAULT_COUNT))
  const [scopeKind, setScopeKind] = useState<ExamScope['kind']>(() => {
    const p = params.get('pattern')
    return p && builtPatterns.some((b) => b.id === p) ? 'patterns' : 'all'
  })
  const [categories, setCategories] = useState<Category[]>([])
  const [patternIds, setPatternIds] = useState<string[]>(() => {
    const p = params.get('pattern')
    return p && builtPatterns.some((b) => b.id === p) ? [p] : []
  })
  const [named, setNamed] = useState(false)
  const [timed, setTimed] = useState(true)
  const [busy, setBusy] = useState(false)
  const [startFailed, setStartFailed] = useState(false)

  const ids = useId()
  const scope: ExamScope =
    scopeKind === 'all' ? { kind: 'all' } : scopeKind === 'categories' ? { kind: 'categories', categories } : { kind: 'patterns', patternIds }
  const available = availableCount({ scope }, pool)
  const requested = parseCount(countText)
  const effective = requested === null ? null : Math.min(requested, available)
  const capped = requested !== null && available > 0 && requested > available

  const reason =
    requested === null
      ? t('setup.count.invalid')
      : available > 0
        ? null
        : scopeKind === 'categories' && categories.length === 0
          ? t('setup.chooseCategory')
          : scopeKind === 'patterns' && patternIds.length === 0
            ? t('setup.choosePattern')
            : t('setup.none')

  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v))

  async function onStart(e: React.FormEvent) {
    e.preventDefault()
    if (busy || effective === null || reason !== null) return
    setBusy(true)
    setStartFailed(false)
    try {
      const setup: ExamSetup = { count: effective, scope, named, timed }
      const keys = selectQuestions(pool, setup, await lastSeenByQuestion(), Math.random)
      const session = await createSession(setup, keys, now())
      void navigate(`/exam/${session.id}`)
    } catch (err) {
      if (err instanceof ExamInProgressError) await onBlocked()
      else setStartFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const countId = `${ids}-count`
  const reasonId = `${ids}-reason`
  return (
    <form className="panel exam-panel" onSubmit={(e) => void onStart(e)} noValidate>
      <div className="prog-panel-body exam-fields">
        <div className="exam-field">
          <label htmlFor={countId} className="exam-label">
            {t('setup.count.label')}
          </label>
          <input
            id={countId}
            className="exam-number"
            type="number"
            inputMode="numeric"
            min={MIN_COUNT}
            max={MAX_COUNT}
            value={countText}
            aria-describedby={`${countId}-hint`}
            aria-invalid={requested === null}
            onChange={(e) => setCountText(e.target.value)}
            onBlur={() => {
              if (requested === null) {
                const n = Number(countText)
                setCountText(String(Number.isFinite(n) && countText.trim() !== '' ? Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(n))) : DEFAULT_COUNT))
              }
            }}
          />
          <span id={`${countId}-hint`} className={requested === null ? 'prog-hint exam-bad' : 'prog-hint'}>
            {requested === null ? t('setup.count.invalid') : t('setup.count.hint')}
          </span>
        </div>

        <fieldset className="exam-field exam-group">
          <legend className="exam-label">{t('setup.scope.label')}</legend>
          <div className="exam-options">
            {(['all', 'categories', 'patterns'] as const).map((k) => (
              <label key={k} className="exam-option">
                <input type="radio" name={`${ids}-scope`} checked={scopeKind === k} onChange={() => setScopeKind(k)} />
                {t(`setup.scope.${k}`)}
              </label>
            ))}
          </div>
          {scopeKind === 'categories' && (
            <fieldset className="exam-sub">
              <legend className="sr-only">{t('setup.scope.categories')}</legend>
              {CATEGORIES.map((c) => (
                <label key={c} className="exam-option">
                  <input type="checkbox" checked={categories.includes(c)} onChange={(e) => setCategories(toggle(categories, c, e.target.checked))} />
                  {tc(`category.${c}`)}
                </label>
              ))}
            </fieldset>
          )}
          {scopeKind === 'patterns' && (
            <fieldset className="exam-sub">
              <legend className="sr-only">{t('setup.scope.patterns')}</legend>
              {builtPatterns.map((p) => (
                <label key={p.id} className="exam-option">
                  <input type="checkbox" checked={patternIds.includes(p.id)} onChange={(e) => setPatternIds(toggle(patternIds, p.id, e.target.checked))} />
                  {p.name}
                </label>
              ))}
            </fieldset>
          )}
        </fieldset>

        <Switch label={t('setup.named.label')} hint={t('setup.named.hint')} hintId={`${ids}-named`} checked={named} onChange={setNamed} />
        <Switch
          label={t('setup.timer.label')}
          hint={timed ? t('setup.timer.minutes', { minutes: (effective ?? requested ?? DEFAULT_COUNT) * MINUTES_PER_QUESTION }) : t('setup.timer.off')}
          hintId={`${ids}-timer`}
          checked={timed}
          onChange={setTimed}
        />

        {capped && (
          <p className="prog-muted" role="status">
            {t('setup.capped', { count: available })}
          </p>
        )}
        {startFailed && (
          <div className="prog-error" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <p>{t('setup.startError')}</p>
          </div>
        )}
        <div className="exam-actions">
          <button type="submit" className="btn btn-primary" disabled={busy || reason !== null} aria-describedby={reason ? reasonId : undefined}>
            <Play size={16} aria-hidden="true" />
            {busy ? t('setup.starting') : t('setup.start')}
          </button>
          {reason && (
            <p id={reasonId} className="prog-hint">
              {reason}
            </p>
          )}
        </div>
      </div>
    </form>
  )
}

export function ExamSetupPage() {
  const { t } = useTranslation('exam')
  const { loaded, session, reload } = useInProgress()
  const title = useRef<HTMLHeadingElement>(null)
  const hadSession = useRef(false)

  // After Abandon the form replaces the panel the learner was using; keep their place at the top of the page.
  useEffect(() => {
    if (hadSession.current && !session) title.current?.focus()
    hadSession.current = session !== undefined
  }, [session])

  return (
    <div className="exam-page">
      <header className="page-head">
        <h1 ref={title} tabIndex={-1} className="page-title">
          {t('setup.title')}
        </h1>
        <p className="page-intro">{t('setup.intro')}</p>
      </header>
      {!loaded ? (
        <p className="prog-muted" role="status">
          {t('setup.loading')}
        </p>
      ) : session ? (
        <ResumePanel session={session} />
      ) : (
        <SetupForm onBlocked={reload} />
      )}
    </div>
  )
}
