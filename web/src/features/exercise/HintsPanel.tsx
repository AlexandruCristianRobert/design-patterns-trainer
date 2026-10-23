import { Lightbulb } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { inlineCode } from './inlineCode'

/** Hints appear one at a time; the ones already revealed stay open. */
export function HintsPanel({
  hints,
  revealed,
  disabled,
  onReveal,
}: {
  hints: string[]
  revealed: number
  disabled: boolean
  onReveal(): void
}) {
  const { t } = useTranslation('exercise')
  const titleId = useId()
  if (hints.length === 0) return null
  const shown = Math.min(revealed, hints.length)
  return (
    <section className="ex-block" aria-labelledby={titleId}>
      <h2 id={titleId} className="ex-h2">
        {t('hints.title')}
      </h2>
      {shown > 0 && (
        <ol className="hint-list">
          {hints.slice(0, shown).map((h, i) => (
            <li key={i} className="hint">
              <span className="hint-index">{t('hints.label', { index: i + 1 })}</span>
              <span>{inlineCode(h)}</span>
            </li>
          ))}
        </ol>
      )}
      {shown < hints.length && (
        <button type="button" className="btn btn-quiet" disabled={disabled} onClick={onReveal}>
          <Lightbulb size={16} aria-hidden="true" />
          <span>{t('hints.show', { index: shown + 1, total: hints.length })}</span>
        </button>
      )}
    </section>
  )
}
