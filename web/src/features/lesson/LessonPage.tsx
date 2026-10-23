import { ArrowLeft, ArrowRight, CircleAlert, Languages, RotateCw } from 'lucide-react'
import type { MDXContent } from 'mdx/types'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { getCatalog, getCatalogText } from '../../content/catalog'
import { loadLesson } from '../../content/lessons'
import { getPattern, type PatternContent } from '../../content/patterns'
import { getExerciseText, getPatternText } from '../../content/text'
import { markLessonVisited, type ExerciseStatus } from '../../progress/progressStore'
import { usePatternProgress } from '../../progress/useProgress'
import { LessonProvider } from './LessonContext'
import { LessonDataContext, type LessonData } from './lessonData'
import { LessonToc } from './LessonToc'
import { LessonContent } from './mdxComponents'

type Loaded =
  | { key: string; state: 'ready'; Component: MDXContent; untranslated: boolean }
  | { key: string; state: 'failed' }

export function LessonPage() {
  const { patternId = '' } = useParams()
  const pattern = getPattern(patternId)
  if (!pattern) return <ComingSoon patternId={patternId} />
  // Keyed: a different Pattern starts from a fresh page (scene position, TOC, Draft).
  return <Lesson key={patternId} patternId={patternId} pattern={pattern} />
}

function Lesson({ patternId, pattern }: { patternId: string; pattern: PatternContent }) {
  const { t, i18n } = useTranslation('lesson')
  const lng = i18n.language
  const text = useMemo(() => getPatternText(patternId, lng), [patternId, lng])
  const catalogText = useMemo(() => getCatalogText(patternId, lng), [patternId, lng])
  const data = useMemo<LessonData>(() => ({ patternId, pattern, text: text.value, lng }), [patternId, pattern, text, lng])
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const key = `${patternId}@${lng}`
  const lesson = loaded?.key === key ? loaded : null

  useEffect(() => {
    void markLessonVisited(patternId).catch(() => {})
  }, [patternId])

  useEffect(() => {
    let active = true
    loadLesson(patternId, lng).then(
      (r) => active && setLoaded(r ? { key, state: 'ready', ...r } : { key, state: 'failed' }),
      () => active && setLoaded({ key, state: 'failed' }),
    )
    return () => {
      active = false
    }
  }, [patternId, lng, key])

  const untranslated =
    text.untranslated || catalogText.untranslated || (lesson?.state === 'ready' && lesson.untranslated)

  return (
    <div className="lesson">
      <header className="lesson-head">
        <p className="lesson-eyebrow">
          {t('eyebrow', {
            category: t(`catalog:category.${pattern.meta.category}`),
            tier: t(`catalog:tier.${pattern.meta.tier}`),
          })}
        </p>
        <h1 className="lesson-title">{catalogText.value.name}</h1>
        <p className="lesson-intent">{text.value.intent}</p>
        {untranslated && (
          <p className="badge">
            <Languages size={14} aria-hidden="true" />
            {t('untranslated')}
          </p>
        )}
      </header>
      <LessonToc ready={lesson?.state === 'ready'} />
      <div className="lesson-main">
        {lesson?.state === 'ready' && (
          <LessonDataContext value={data}>
            <LessonProvider>
              <article className="lesson-body">
                <LessonContent Component={lesson.Component} />
              </article>
            </LessonProvider>
          </LessonDataContext>
        )}
        {lesson?.state === 'failed' && (
          <div className="lesson-failed" role="alert">
            <p>
              <CircleAlert size={16} aria-hidden="true" />
              {t('loadFailed')}
            </p>
            <button type="button" className="btn btn-quiet" onClick={() => location.reload()}>
              <RotateCw size={14} aria-hidden="true" />
              <span>{t('common:actions.reload')}</span>
            </button>
          </div>
        )}
        {/* Held back until the Lesson is in, so it doesn't jump down the page when the text arrives. */}
        {lesson && <Practice patternId={patternId} pattern={pattern} lng={lng} />}
      </div>
    </div>
  )
}

function Practice({ patternId, pattern, lng }: { patternId: string; pattern: PatternContent; lng: string }) {
  const { t } = useTranslation('lesson')
  const progress = usePatternProgress(patternId)
  return (
    <section className="practice" aria-labelledby="practice-heading">
      <h2 id="practice-heading" className="lesson-h2">
        {t('practice.title')}
      </h2>
      <p className="practice-intro">{t('practice.intro')}</p>
      <ol className="practice-list">
        {pattern.exercises.map((ex, i) => {
          const status: ExerciseStatus | undefined = progress && (progress.exercises[ex.id]?.status ?? 'notStarted')
          return (
            <li key={ex.id}>
              <Link className="practice-row" to={`/patterns/${patternId}/practice/${ex.id}`}>
                <span className="practice-index">{t('practice.exercise', { index: i + 1 })}</span>
                <span className="practice-main">
                  <span className="practice-title">{getExerciseText(patternId, ex.id, lng).value.title}</span>
                  <span className="practice-kind">{t(`practice.kind.${ex.meta.kind}`)}</span>
                </span>
                {/* Hidden until progress loads, so a returning learner never sees a wrong status flash. */}
                <span className="practice-status">
                  {status && (
                    <>
                      <span className={`dot dot-${status}`} aria-hidden="true" />
                      <span>{t(`catalog:exercise.status.${status}`)}</span>
                    </>
                  )}
                </span>
                <ArrowRight size={16} aria-hidden="true" className="practice-arrow" />
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function ComingSoon({ patternId }: { patternId: string }) {
  const { t, i18n } = useTranslation('lesson')
  const known = getCatalog().some((c) => c.id === patternId)
  const name = known ? getCatalogText(patternId, i18n.language).value.name : null
  return (
    <div className="page-head lesson-soon">
      <h1 className="page-title">{t('comingSoon.title')}</h1>
      <p className="page-intro">{name ? t('comingSoon.body', { name }) : t('comingSoon.unknown')}</p>
      <p>
        <Link className="back-link" to="/">
          <ArrowLeft size={14} aria-hidden="true" />
          {t('comingSoon.back')}
        </Link>
      </p>
    </div>
  )
}
