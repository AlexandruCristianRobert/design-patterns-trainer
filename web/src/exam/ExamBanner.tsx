import { Timer, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, matchPath, useLocation } from 'react-router'
import { formatRemaining } from './formatTime'
import type { ExamWatch } from './useExamWatcher'

/** Shell banner while an exam is in progress. Nothing is locked; this is the way back. */
export function ExamBanner({ watch }: { watch: ExamWatch }) {
  const { t } = useTranslation('exam')
  const { t: tc } = useTranslation()
  const { pathname } = useLocation()
  const { session, remaining, phase, cause, retry } = watch
  // The setup page's panel shows this state itself, errors included, so it is never said twice. The session page says
  // it too, except for an error from this watcher.
  if (!session || pathname === '/exam') return null
  if (matchPath('/exam/:sessionId', pathname) !== null && phase !== 'failed') return null
  const expired = remaining === 0
  return (
    <aside className="exam-banner" aria-label={t('banner.label')}>
      <Timer size={16} aria-hidden="true" />
      <p className="exam-banner-text">
        {expired && phase !== 'failed'
          ? t('banner.submitting')
          : remaining === null
            ? t('banner.untimed')
            : t('banner.timed', { time: formatRemaining(remaining) })}
      </p>
      {/* An expired exam is being submitted: there is nothing left to return to. */}
      {phase === 'failed' || expired || phase === 'submitting' ? null : (
        <Link className="btn btn-quiet" to={`/exam/${session.id}`}>
          {t('banner.return')}
        </Link>
      )}
      {phase === 'failed' && (
        <div className="exam-banner-error" role="alert">
          <TriangleAlert size={16} aria-hidden="true" />
          <p>{cause === 'compiler' ? t('banner.compilerError') : t('banner.error')}</p>
          {cause === 'compiler' ? (
            <button type="button" className="btn btn-quiet" onClick={() => window.location.reload()}>
              {tc('actions.reload')}
            </button>
          ) : (
            <button type="button" className="btn btn-quiet" onClick={retry}>
              {t('banner.retry')}
            </button>
          )}
        </div>
      )}
    </aside>
  )
}
