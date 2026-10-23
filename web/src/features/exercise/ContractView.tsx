import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { ContractType } from '../../compiler/protocol'

/** The types and members the learner's code must provide, as the Contract lists them. */
export function ContractView({ types }: { types: ContractType[] }) {
  const { t } = useTranslation('exercise')
  const titleId = useId()
  if (types.length === 0) return null
  return (
    <section className="ex-block" aria-labelledby={titleId}>
      <h2 id={titleId} className="ex-h2">
        {t('contract.title')}
      </h2>
      <p className="ex-small">{t('contract.intro')}</p>
      <ul className="contract-list">
        {types.map((type) => (
          <li key={type.name} className="contract-type">
            <p className="contract-head">
              <span className="contract-kind">{t(`contract.type.${type.kind}`)}</span>
              <span className="contract-name">{type.name}</span>
            </p>
            {type.members.length > 0 && (
              <ul className="contract-members">
                {type.members.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
