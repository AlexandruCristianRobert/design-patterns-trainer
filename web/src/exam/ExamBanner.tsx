import { Timer, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, matchPath, useLocation } from 'react-router'
import { formatRemaining } from './formatTime'
import type { ExamWatch } from './useExamWatcher'

/** Shell banner while an exam is in progress. Nothing is locked; this is the way back. */
export function ExamBanner({ watch }: { watch: ExamWatch }) {
  const { t } = useTranslation('exam')
  const { pathname } = useLocation()
  const { session, remaining, phase, retry } = watch
  if (!session || matchPath('/exam/:sessionId', pathname)) return null
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
      {phase === 'failed' ? null : (
        <Link className="btn btn-quiet" to={`/exam/${session.id}`}>
          {t('banner.return')}
        </Link>
      )}
      {phase === 'failed' && (
        <div className="exam-banner-error" role="alert">
          <TriangleAlert size={16} aria-hidden="true" />
          <p>{t('banner.error')}</p>
          <button type="button" className="btn btn-quiet" onClick={retry}>
            {t('banner.retry')}
          </button>
        </div>
      )}
    </aside>
  )
}
