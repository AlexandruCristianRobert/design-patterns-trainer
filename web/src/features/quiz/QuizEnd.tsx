import { TriangleAlert } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getQuizTopics } from '../../content/quiz'
import { topicBreakdown, type AnswerRecord } from '../../quiz/run'

export const percentOf = (correct: number, total: number) => (total === 0 ? 0 : Math.round((correct / total) * 100))

export function QuizEnd({ answers, saveFailed, onNew, onBack }: { answers: AnswerRecord[]; saveFailed: boolean; onNew(): void; onBack(): void }) {
  const { t } = useTranslation('quiz')
  const id = useId()
  const newRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    newRef.current?.focus()
  }, [])
  const correct = answers.filter((a) => a.correct).length
  const rows = topicBreakdown(answers, getQuizTopics())
  return (
    <section className="panel quiz-end" aria-labelledby={id}>
      <div className="prog-panel-body">
        <h2 id={id} className="prog-h2">
          {t('end.title')}
        </h2>
        <p className="quiz-score">{t('end.score', { correct, total: answers.length, percent: percentOf(correct, answers.length) })}</p>
        {saveFailed && (
          <div className="prog-error" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <p>{t('end.saveFailed')}</p>
          </div>
        )}
        <h3 className="quiz-h3">{t('end.byTopic')}</h3>
        <ul className="quiz-breakdown">
          {rows.map((r) => (
            <li key={r.topicId} data-topic={r.topicId}>
              <span>{r.title}</span>
              <span>{t('end.topicScore', { correct: r.correct, total: r.total })}</span>
            </li>
          ))}
        </ul>
        <div className="reset-actions">
          <button ref={newRef} type="button" className="btn btn-primary" onClick={onNew}>
            {t('end.newQuiz')}
          </button>
          <button type="button" className="btn btn-quiet" onClick={onBack}>
            {t('end.back')}
          </button>
        </div>
      </div>
    </section>
  )
}
