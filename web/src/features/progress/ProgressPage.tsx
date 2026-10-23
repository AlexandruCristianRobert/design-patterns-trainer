import { ArrowRight, Circle, CircleCheck, Download, TriangleAlert, Upload } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { getCatalog, getCatalogText } from '../../content/catalog'
import { getPattern } from '../../content/patterns'
import { getExerciseText } from '../../content/text'
import { exportProgress, importProgress, type ImportResult } from '../../progress/exportImport'
import type { ExerciseStatus, PatternProgress } from '../../progress/progressStore'
import { useAllProgress } from '../../progress/useProgress'
import { NextStepCell } from '../catalog/CatalogPage'

const isSolved = (s: ExerciseStatus | undefined) => s === 'solved' || s === 'solvedWithHelp'

function PatternRow({ patternId, progress }: { patternId: string; progress: PatternProgress }) {
  const { t, i18n } = useTranslation('progress')
  const { t: tc } = useTranslation('catalog')
  const pattern = getPattern(patternId)!
  const name = getCatalogText(patternId, i18n.language).value.name
  const solved = pattern.meta.exercises.filter((id) => isSolved(progress.exercises[id]?.status)).length
  return (
    <li className="prog-pattern" data-pattern={patternId}>
      <div className="prog-pattern-head">
        <h3 className="prog-pattern-name">
          <Link to={`/patterns/${patternId}`}>{name}</Link>
        </h3>
        <span className={`prog-lesson${progress.lessonVisited ? ' is-done' : ''}`}>
          {progress.lessonVisited ? <CircleCheck size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
          {progress.lessonVisited ? t('lesson.visited') : t('lesson.notVisited')}
        </span>
        <span className="prog-total">{t('solved', { solved, total: pattern.meta.exercises.length })}</span>
        <NextStepCell patternId={patternId} progress={progress} />
      </div>
      <ul className="prog-exercises" aria-label={t('exercises', { pattern: name })}>
        {pattern.meta.exercises.map((id) => {
          const status: ExerciseStatus = progress.exercises[id]?.status ?? 'notStarted'
          return (
            <li key={id} className="prog-exercise">
              <span className={`dot dot-${status}`} aria-hidden="true" />
              <Link to={`/patterns/${patternId}/practice/${id}`}>{getExerciseText(patternId, id, i18n.language).value.title}</Link>
              <span className="prog-status">{tc(`exercise.status.${status}`)}</span>
            </li>
          )
        })}
      </ul>
    </li>
  )
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(file)
  })
}

function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

type ErrorReason = 'readError' | 'exportError' | 'saveFailed' | Extract<ImportResult, { ok: false }>['reason']
type Notice = { kind: 'success'; patterns: number; drafts: number } | { kind: 'error'; reason: ErrorReason }

function Backup() {
  const { t } = useTranslation('progress')
  const [pending, setPending] = useState<{ name: string; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const wasPending = useRef(false)
  const inputId = useId()
  const hintId = useId()

  // The confirmation appears in place: focus the safe choice, and return to the file field afterwards.
  useEffect(() => {
    if (pending) cancel.current?.focus()
    else if (wasPending.current) input.current?.focus()
    wasPending.current = pending !== null
  }, [pending])

  const clearInput = () => {
    if (input.current) input.current.value = ''
  }

  async function onExport() {
    setNotice(null)
    try {
      const data = await exportProgress()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `design-patterns-progress-${localDate()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setNotice({ kind: 'error', reason: 'exportError' })
    }
  }

  async function onPick(file: File | undefined) {
    setNotice(null)
    if (!file) return
    try {
      setPending({ name: file.name, text: await readFile(file) })
    } catch {
      clearInput()
      setNotice({ kind: 'error', reason: 'readError' })
    }
  }

  async function onConfirm() {
    if (!pending) return
    setBusy(true)
    const result = await importProgress(pending.text).catch((): { ok: false; reason: 'saveFailed' } => ({ ok: false, reason: 'saveFailed' }))
    setBusy(false)
    setPending(null)
    clearInput()
    setNotice(result.ok ? { kind: 'success', patterns: result.patterns, drafts: result.drafts } : { kind: 'error', reason: result.reason })
  }

  const errorText = (r: ErrorReason) => (r === 'exportError' || r === 'readError' || r === 'saveFailed' ? t(`backup.${r}`) : t(`backup.error.${r}`))

  return (
    <section className="panel prog-panel" aria-labelledby="backup-title">
      <div className="prog-panel-body">
        <h2 id="backup-title" className="prog-h2">
          {t('backup.title')}
        </h2>
        <p className="prog-muted">{t('backup.intro')}</p>
        <div className="prog-backup">
          <div className="prog-field">
            <button type="button" className="btn btn-quiet" onClick={() => void onExport()}>
              <Download size={16} aria-hidden="true" />
              <span>{t('backup.export')}</span>
            </button>
          </div>
          <div className="prog-field">
            <label htmlFor={inputId} className="prog-label">
              <Upload size={16} aria-hidden="true" />
              {t('backup.import')}
            </label>
            <input
              ref={input}
              id={inputId}
              className="prog-file"
              type="file"
              accept=".json,application/json"
              aria-describedby={hintId}
              disabled={pending !== null || busy}
              onChange={(e) => void onPick(e.target.files?.[0])}
            />
            <span id={hintId} className="prog-hint">
              {t('backup.importHint')}
            </span>
          </div>
        </div>

        {pending && (
          <div className="prog-confirm" role="group" aria-labelledby="import-question">
            <p id="import-question" className="prog-confirm-q">
              {t('backup.confirm')}
            </p>
            <p className="prog-hint">{t('backup.file', { name: pending.name })}</p>
            <div className="reset-actions">
              <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void onConfirm()}>
                {t('backup.confirmAction')}
              </button>
              <button
                ref={cancel}
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  setPending(null)
                  clearInput()
                }}
              >
                {t('backup.cancel')}
              </button>
            </div>
          </div>
        )}

        {notice?.kind === 'success' && (
          <p className="prog-ok" role="status">
            <CircleCheck size={16} aria-hidden="true" />
            {t('backup.success', {
              patterns: t('backup.patternCount', { count: notice.patterns }),
              drafts: t('backup.draftCount', { count: notice.drafts }),
            })}
          </p>
        )}
        {notice?.kind === 'error' && (
          <div className="prog-error" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <div>
              <p>{errorText(notice.reason)}</p>
              {!['exportError', 'readError', 'saveFailed'].includes(notice.reason) && <p className="prog-hint">{t('backup.recover')}</p>}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export function ProgressPage() {
  const { t } = useTranslation('progress')
  const all = useAllProgress()
  const built = getCatalog().filter((i) => i.built)
  const started = all?.some((p) => p.lessonVisited || Object.values(p.exercises).some((e) => e.status !== 'notStarted')) ?? false
  return (
    <div className="progress-page">
      <header className="page-head">
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-intro">{t('intro')}</p>
      </header>

      <section className="panel prog-panel" aria-labelledby="patterns-title">
        <div className="prog-panel-body">
          <h2 id="patterns-title" className="prog-h2">
            {t('patterns')}
          </h2>
          {all === undefined ? (
            <p className="prog-muted" role="status">
              {t('loading')}
            </p>
          ) : started ? (
            <ul className="prog-list">
              {built.map((i) => (
                <PatternRow
                  key={i.id}
                  patternId={i.id}
                  progress={all.find((p) => p.patternId === i.id) ?? { patternId: i.id, lessonVisited: false, exercises: {} }}
                />
              ))}
            </ul>
          ) : (
            <div className="prog-empty">
              <p>{t('empty.title')}</p>
              <Link className="back-link" to="/">
                {t('empty.action')}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </section>

      <Backup />

      <section className="panel prog-panel" aria-labelledby="exam-title">
        <div className="prog-panel-body">
          <h2 id="exam-title" className="prog-h2">
            {t('exam.title')}
          </h2>
          <p className="prog-muted">{t('exam.empty')}</p>
        </div>
      </section>
    </div>
  )
}
