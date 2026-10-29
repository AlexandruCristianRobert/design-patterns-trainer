import { Check, X } from 'lucide-react'
import { Children, isValidElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/** One line that says "do this" or "avoid this", in words as well as colour. A div, so MDX blocks may sit inside. */
export function Verdict({ ok, children }: { ok: boolean; children: ReactNode }) {
  const { t } = useTranslation('lesson')
  const Icon = ok ? Check : X
  return (
    <div className="verdict" data-tone={ok ? 'ok' : 'bad'}>
      <span className="verdict-badge" aria-hidden="true">
        <Icon size={12} strokeWidth={3} />
      </span>
      <span className="sr-only">{t(ok ? 'visual.good' : 'visual.avoid')}</span> {children}
    </div>
  )
}

/** A list of verdict rows, announced as a list. */
export function Checklist({ children }: { children: ReactNode }) {
  return (
    <div className="checklist" role="list">
      {Children.toArray(children)
        .filter(isValidElement)
        .map((row) => (
          <div key={row.key} role="listitem" className="checklist-row">
            {row}
          </div>
        ))}
    </div>
  )
}

/** A bad and a good snippet side by side, each under its verdict. */
export function CodePair({
  bad,
  good,
  badLabel,
  goodLabel,
}: {
  bad: string
  good: string
  badLabel: string
  goodLabel: string
}) {
  return (
    <div className="code-pair">
      <div className="code-pair-panel" data-tone="bad">
        <Verdict ok={false}>{badLabel}</Verdict>
        <pre>
          <code>{bad}</code>
        </pre>
      </div>
      <div className="code-pair-panel" data-tone="ok">
        <Verdict ok>{goodLabel}</Verdict>
        <pre>
          <code>{good}</code>
        </pre>
      </div>
    </div>
  )
}
