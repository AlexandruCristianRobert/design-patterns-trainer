import { describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { diagnosticMessage } from './diagnosticMessage'

const base = { level: 'error' as const, file: 'user' as const, startLine: 1, startColumn: 9, endLine: 1, endColumn: 10 }

describe('diagnosticMessage', () => {
  it('translates DP0001 and passes CS through', () => {
    const t = i18n.t
    expect(
      diagnosticMessage({ ...base, id: 'DP0001', message: 'english fallback', args: { api: 'System.Console.ReadLine' } }, t),
    ).toBe('Not available in the browser runtime: System.Console.ReadLine')
    expect(
      diagnosticMessage({ ...base, id: 'CS0103', message: "The name 'y' does not exist in the current context" }, t),
    ).toBe("The name 'y' does not exist in the current context")
  })

  it('falls back to the emitted message for an unknown DP id', () => {
    expect(diagnosticMessage({ ...base, id: 'DP9999', message: 'Raw message' }, i18n.t)).toBe('Raw message')
  })
})
