import { Circle, CircleCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface QuestionNavItem {
  key: string
  answered: boolean
}

export function QuestionNav({
  items,
  current,
  disabled,
  reason,
  onSelect,
}: {
  items: QuestionNavItem[]
  current: number
  disabled: boolean
  /** Why the buttons are disabled, when it isn't obvious. */
  reason?: string
  onSelect(index: number): void
}) {
  const { t } = useTranslation('exam')
  return (
    <nav aria-label={t('session.nav.label')}>
      {reason && (
        <p id="question-nav-reason" className="ex-small">
          {reason}
        </p>
      )}
      <ol className="question-nav">
        {items.map((item, i) => (
          <li key={item.key}>
            <button
              type="button"
              className="question-nav-btn"
              aria-current={i === current ? 'step' : undefined}
              disabled={disabled}
              aria-describedby={reason ? 'question-nav-reason' : undefined}
              onClick={() => onSelect(i)}
            >
              <span aria-hidden="true">{i + 1}</span>
              {item.answered ? <CircleCheck size={14} className="question-answered" aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
              <span className="sr-only">
                {t('session.nav.item', { n: i + 1 })}, {t(item.answered ? 'session.nav.answered' : 'session.nav.unanswered')}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
