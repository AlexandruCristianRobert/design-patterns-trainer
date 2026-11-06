import { TriangleAlert } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { getQuizTopics } from '../../content/quiz'
import { useQuizResults } from '../../progress/useProgress'
import { percentOf } from '../../quiz/run'

export function QuizHistory() {
  const { t, i18n } = useTranslation('quiz')
  const id = useId()
  const { data, error } = useQuizResults()
  const titles = new Map(getQuizTopics().map((x) => [x.id, x.title]))
  return (
    <section className="panel prog-panel" aria-labelledby={id}>
      <div className="prog-panel-body">
        <h2 id={id} className="prog-h2">
          {t('history.title')}
        </h2>
        {data === undefined && error ? (
          <div className="prog-error" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <p>{t('history.readError')}</p>
          </div>
        ) : data === undefined ? (
          <p className="prog-muted">{t('history.loading')}</p>
        ) : data.length === 0 ? (
          <p className="prog-muted">{t('history.empty')}</p>
        ) : (
          <ol className="quiz-history">
            {data.map((r) => (
              <li key={r.id} className="quiz-history-row">
                <time dateTime={r.takenAt}>{new Date(r.takenAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                <span className="quiz-history-topics">
                  {r.topics === 'all' ? t('history.all') : r.topics.map((x) => titles.get(x) ?? x).join(', ')}
                </span>
                <span className="quiz-history-score">{t('history.score', { correct: r.correct, total: r.total })}</span>
                <span className="quiz-history-percent">{t('history.percent', { percent: percentOf(r.correct, r.total) })}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
