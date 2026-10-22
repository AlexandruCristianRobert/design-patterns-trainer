import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

/** Stand-in for pages that later tasks build (Lesson, Exercise, Progress). */
export function PlaceholderPage({ page }: { page: 'lesson' | 'exercise' | 'progress' }) {
  const { t } = useTranslation()
  return (
    <div className="page-head">
      <h1 className="page-title">{t(`placeholder.${page}`)}</h1>
      <p className="page-intro">{t('placeholder.body')}</p>
      <p>
        <Link className="back-link" to="/">
          <ArrowLeft size={14} aria-hidden="true" />
          {t('placeholder.back')}
        </Link>
      </p>
    </div>
  )
}
