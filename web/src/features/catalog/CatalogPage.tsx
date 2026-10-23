import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { getCatalog, getCatalogText, type CatalogItem } from '../../content/catalog'
import { getPattern } from '../../content/patterns'
import type { Category } from '../../content/schema'
import { scorePercent } from '../../exam/scoring'
import type { ExerciseStatus, PatternProgress } from '../../progress/progressStore'
import { useAllProgress, useBestExamScores } from '../../progress/useProgress'
import { NextStepCell } from './NextStepCell'
import { StructureThumbnail } from './StructureThumbnail'

const categories: Category[] = ['creational', 'structural', 'behavioral']

function BuiltMeta({ item, progress, best }: { item: CatalogItem; progress: PatternProgress | undefined; best: number | undefined }) {
  const { t } = useTranslation('catalog')
  const exercises = getPattern(item.id)!.meta.exercises
  return (
    <div className="cat-meta">
      <span className={`tier tier-${item.tier}`}>{t(`tier.${item.tier}`)}</span>
      <span className="dots" role="group" aria-label={t('exercises')}>
        {exercises.map((id, i) => {
          const status: ExerciseStatus = progress?.exercises[id]?.status ?? 'notStarted'
          const label = t('exercise.label', { index: i + 1, status: t(`exercise.status.${status}`) })
          return <span key={id} className={`dot dot-${status}`} role="img" aria-label={label} title={label} />
        })}
      </span>
      <span className="score" title={best === undefined ? t('noExam') : undefined}>
        <span className="score-label">{t('bestExam')}</span>
        <span className="score-value">{best === undefined ? '—' : t('score', { score: scorePercent(best) })}</span>
      </span>
      {/* Hidden until progress loads, so a returning learner never sees a wrong step flash. */}
      {progress && <NextStepCell patternId={item.id} progress={progress} />}
    </div>
  )
}

function CatalogRow({ item, progress, best }: { item: CatalogItem; progress: PatternProgress | undefined; best: number | undefined }) {
  const { t, i18n } = useTranslation('catalog')
  const text = getCatalogText(item.id, i18n.language).value
  const pattern = item.built ? getPattern(item.id) : undefined
  return (
    <li className="cat-row" data-pattern={item.id} data-built={item.built}>
      {pattern ? <StructureThumbnail structure={pattern.structure} /> : <span className="thumb-empty" aria-hidden="true" />}
      <div className="cat-main">
        <h3 className="cat-name">{pattern ? <Link to={`/patterns/${item.id}`}>{text.name}</Link> : text.name}</h3>
        <p className="cat-intent">{text.intent}</p>
      </div>
      {pattern ? (
        <BuiltMeta item={item} progress={progress} best={best} />
      ) : (
        <div className="cat-meta">
          <span className="soon">{t('comingSoon')}</span>
        </div>
      )}
    </li>
  )
}

export function CatalogPage() {
  const { t } = useTranslation('catalog')
  const catalog = getCatalog()
  const { data: all } = useAllProgress()
  const { data: best } = useBestExamScores()
  const progressFor = (id: string): PatternProgress | undefined =>
    all && (all.find((p) => p.patternId === id) ?? { patternId: id, lessonVisited: false, exercises: {} })
  return (
    <div className="catalog">
      <header className="page-head">
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-intro">{t('intro')}</p>
      </header>
      {categories.map((c) => {
        // Built Patterns first, so what you can open now isn't buried under "Coming soon" rows.
        const items = catalog.filter((i) => i.category === c).sort((a, b) => Number(b.built) - Number(a.built))
        const headingId = `cat-${c}`
        return (
          <section key={c} className="panel cat-group" aria-labelledby={headingId}>
            <div className="cat-group-head">
              <h2 id={headingId}>{t(`category.${c}`)}</h2>
              <span className="cat-count">
                {t('available', { built: items.filter((i) => i.built).length, total: items.length })}
              </span>
            </div>
            <ul className="cat-list">
              {items.map((item) => (
                <CatalogRow key={item.id} item={item} progress={progressFor(item.id)} best={best?.[item.id]} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
