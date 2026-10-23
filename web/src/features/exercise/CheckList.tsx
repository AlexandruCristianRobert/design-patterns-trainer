import { CircleAlert, CircleCheck, CircleX, TimerOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CheckResult } from '../../compiler/protocol'
import type { ExerciseText } from '../../content/schema'
import { checkMessage } from './checkMessage'
import { inlineCode } from './inlineCode'

const icons = { passed: CircleCheck, failed: CircleX, errored: CircleAlert, timedOut: TimerOff }

/** `text` is any text with a `checks` map: an Exercise's or an Exam Question's. */
export function CheckList({ results, text }: { results: CheckResult[]; text: Pick<ExerciseText, 'checks'> }) {
  const { t } = useTranslation('exercise')
  return (
    <ul className="check-list" aria-label={t('results.listLabel')}>
      {results.map((r) => {
        const Icon = icons[r.status]
        const ok = r.status === 'passed'
        const message = checkMessage(r, text, t)
        return (
          <li key={r.id} className="check-item">
            <Icon size={16} className={ok ? 'check-icon check-ok' : 'check-icon check-bad'} aria-hidden="true" />
            <div className="check-text">
              <span className="check-title">
                {text.checks[r.id]?.title ?? r.id}
                <span className="sr-only"> — {ok ? t('results.passed') : t('results.failed')}</span>
              </span>
              {message && <span className="check-message">{inlineCode(message)}</span>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
