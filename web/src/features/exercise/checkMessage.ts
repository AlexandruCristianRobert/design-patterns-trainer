import type { TFunction } from 'i18next'
import type { CheckResult, ContractViolation } from '../../compiler/protocol'
import type { ExerciseText } from '../../content/schema'

function interpolate(template: string, args: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => args[k] ?? m)
}

/** The learner-facing explanation of a check result; undefined when it passed. */
export function checkMessage(result: CheckResult, text: ExerciseText, t: TFunction): string | undefined {
  if (result.status === 'passed') return undefined
  const reason = result.reason ?? 'isFalse'
  const args = result.args ?? {}
  const custom = text.checks[result.id]?.failures?.[reason]
  if (custom !== undefined) return interpolate(custom, args)
  const generic = t(`checks:reasons.${reason}`, args) as string
  return reason === 'threw' && args.message ? `${generic} ${args.message}` : generic
}

export function contractMessage(v: ContractViolation, t: TFunction): string {
  return t(`contract:${v.code}`, { type: v.type, member: v.member }) as string
}
