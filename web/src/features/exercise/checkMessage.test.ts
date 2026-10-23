import { describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { checkMessage, contractMessage } from './checkMessage'
import type { ExerciseText } from '../../content/schema'

const t = i18n.t.bind(i18n)
const text = {
  title: '', scenario: '', hints: [],
  checks: { a: { title: 'A', failures: { notEqual: 'Want {{expected}} got {{actual}}' } }, b: { title: 'B' } },
} as ExerciseText

describe('checkMessage', () => {
  it('is undefined when passed', () => {
    expect(checkMessage({ id: 'a', status: 'passed' }, text, t)).toBeUndefined()
  })
  it('prefers custom text and interpolates', () => {
    expect(checkMessage({ id: 'a', status: 'failed', reason: 'notEqual', args: { expected: '1', actual: '2' } }, text, t)).toBe('Want 1 got 2')
  })
  it('falls back to generic', () => {
    expect(checkMessage({ id: 'b', status: 'failed', reason: 'notEqual', args: { expected: '1', actual: '2' } }, text, t)).toBe('Expected 1, but got 2.')
    expect(checkMessage({ id: 'b', status: 'timedOut', reason: 'timedOut' }, text, t)).toContain('5 seconds')
  })
  it('appends the exception message for threw', () => {
    expect(checkMessage({ id: 'b', status: 'errored', reason: 'threw', args: { type: 'X', message: 'boom' } }, text, t)).toBe('Your code threw X. boom')
    expect(checkMessage({ id: 'b', status: 'errored', reason: 'threw', args: { type: 'X' } }, text, t)).toBe('Your code threw X.')
  })
  it('explains a crash with no exception type', () => {
    expect(checkMessage({ id: 'b', status: 'errored', reason: 'crashed' }, text, t)).toBe('Your code stopped the check runner unexpectedly.')
  })
})
describe('contractMessage', () => {
  it('formats violations', () => {
    expect(contractMessage({ code: 'missingType', type: 'T' }, t)).toBe('Your code needs a public type named T.')
    expect(contractMessage({ code: 'missingMember', type: 'T', member: 'M()' }, t)).toBe('T needs a public member: M()')
  })
})
