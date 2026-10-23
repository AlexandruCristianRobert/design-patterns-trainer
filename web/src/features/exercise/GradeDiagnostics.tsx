import { CircleX, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ContractViolation, DiagnosticInfo } from '../../compiler/protocol'
import { diagnosticMessage } from '../../editor/diagnosticMessage'
import { contractMessage } from './checkMessage'

/** Why the checks couldn't run: the code doesn't match the Contract. Shared by Exercises and Exam Reports. */
export function ContractViolationList({ violations }: { violations: ContractViolation[] }) {
  const { t } = useTranslation('exercise')
  return (
    <div className="diags">
      <p className="diags-title">{t('results.contractTitle')}</p>
      <ul className="diag-list">
        {violations.map((v, i) => (
          <li key={i} className="diag">
            <TriangleAlert size={16} className="diag-icon" aria-hidden="true" />
            <div className="diag-text">
              <span className="diag-msg">{contractMessage(v, t)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Why the checks couldn't run: the code doesn't compile. Shared by Exercises and Exam Reports. */
export function CompileErrorList({ diagnostics }: { diagnostics: DiagnosticInfo[] }) {
  const { t } = useTranslation('exercise')
  return (
    <div className="diags">
      <p className="diags-title">{t('results.compileTitle')}</p>
      <ul className="diag-list">
        {diagnostics.map((d, i) => (
          <li key={`${d.id}-${d.startLine}-${d.startColumn}-${i}`} className="diag">
            <CircleX size={16} className="diag-icon" aria-hidden="true" />
            <div className="diag-text">
              <span className="diag-msg">{diagnosticMessage(d, t)}</span>
              <span className="diag-meta">
                <span>{t('results.location', { line: d.startLine, column: d.startColumn })}</span>
                <span className="diag-id">{d.id}</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
