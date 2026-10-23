import { ClipboardPaste } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

/** The reference solution, read-only. */
export function SolutionPanel({ solution, copied, onCopy }: { solution: string; copied: boolean; onCopy(): void }) {
  const { t } = useTranslation('exercise')
  const titleId = useId()
  return (
    <section className="solution" aria-labelledby={titleId}>
      <div className="solution-head">
        <h3 id={titleId} className="ex-h3">
          {t('solution.title')}
        </h3>
        <button type="button" className="btn btn-quiet btn-small" onClick={onCopy}>
          <ClipboardPaste size={14} aria-hidden="true" />
          <span>{t('solution.copy')}</span>
        </button>
      </div>
      {/* Focusable so a keyboard user can scroll a long solution. */}
      <pre className="solution-code" tabIndex={0}>
        <code>{solution}</code>
      </pre>
      <p className="ex-small" role="status">
        {copied ? t('solution.copied') : t('solution.note')}
      </p>
    </section>
  )
}
