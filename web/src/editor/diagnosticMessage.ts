import type { TFunction } from 'i18next'
import type { DiagnosticInfo } from '../compiler/protocol'

/** App diagnostics (DP*) are translated; Roslyn (CS*) messages are shown as the compiler emits them. */
export function diagnosticMessage(d: DiagnosticInfo, t: TFunction): string {
  if (!d.id.startsWith('DP')) return d.message
  return t(`diagnostics:${d.id}`, { ...d.args, defaultValue: d.message })
}
