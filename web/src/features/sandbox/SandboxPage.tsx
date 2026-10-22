import { useTranslation } from 'react-i18next'
import { CodePanel } from '../../code/CodePanel'
import { useDraft } from '../../code/useDraft'

export function SandboxPage() {
  const { t } = useTranslation('sandbox')
  // The Sandbox is scratch space: nothing is persisted (key null).
  const { code, setCode } = useDraft(null, t('defaultCode'), 0)

  return (
    <div className="sandbox">
      <header className="page-head">
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-intro">{t('intro')}</p>
      </header>
      <CodePanel code={code} onChange={setCode} fileName={t('fileName')} ariaLabel={t('editorLabel')} />
    </div>
  )
}
