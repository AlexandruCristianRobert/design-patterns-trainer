import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { getCatalog, getCatalogText } from '../../content/catalog'
import type { Category } from '../../content/schema'

const CATEGORIES: Category[] = ['creational', 'structural', 'behavioral']

/** All 23 GoF names, built or not, grouped by Category in catalog order. */
export function IdentificationField({ value, disabled, onChange }: { value: string | null; disabled: boolean; onChange(id: string | null): void }) {
  const { t, i18n } = useTranslation('exam')
  const id = useId()
  const catalog = getCatalog()
  return (
    <div className="ex-block">
      <label htmlFor={id} className="ex-h2">
        {t('session.identification.label')}
      </label>
      <select id={id} className="exam-select" value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{t('session.identification.none')}</option>
        {CATEGORIES.map((c) => (
          <optgroup key={c} label={t(`catalog:category.${c}`)}>
            {catalog
              .filter((p) => p.category === c)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {getCatalogText(p.id, i18n.language).value.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
