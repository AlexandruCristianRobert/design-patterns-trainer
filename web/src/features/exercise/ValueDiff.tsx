import { useTranslation } from 'react-i18next'
import { diffValues, showWhitespace, type DiffPart } from './diffValues'

function Side({ parts, kind }: { parts: DiffPart[]; kind: 'expected' | 'actual' }) {
  const { t } = useTranslation('exercise')
  if (parts.every((p) => p.text === '')) {
    return <span className="value-diff-empty">{t('results.emptyValue')}</span>
  }
  return (
    <>
      {parts.map((p, i) =>
        !p.changed ? (
          p.text
        ) : p.text === '' ? (
          <span
            key={i}
            className={`value-diff-gap value-diff-gap-${kind}`}
            style={{ width: `${p.width ?? 1}ch` }}
            aria-hidden="true"
          />
        ) : (
          <mark key={i} className={`value-diff-changed value-diff-${kind}`} style={{ minWidth: `${p.width ?? 0}ch` }}>
            {showWhitespace(p.text)}
          </mark>
        ),
      )}
    </>
  )
}

/** Expected and actual one above the other, in monospace, with each differing run marked. */
export function ValueDiff({ expected, actual }: { expected: string; actual: string }) {
  const { t } = useTranslation('exercise')
  const diff = diffValues(expected, actual)
  return (
    <dl className="value-diff">
      <dt>{t('results.expected')}</dt>
      <dd>
        <Side parts={diff.expected} kind="expected" />
      </dd>
      <dt>{t('results.actual')}</dt>
      <dd>
        <Side parts={diff.actual} kind="actual" />
      </dd>
    </dl>
  )
}
