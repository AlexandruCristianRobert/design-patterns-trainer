import { describe, expect, it } from 'vitest'
import { helperCounts, sessionUsedHelp, withHelp } from './helpUse'
import type { ExamAnswer, ExamSession } from './types'

const answer: ExamAnswer = { code: 'x', identification: null }
const session = (status: ExamSession['status'], answers: Record<string, ExamAnswer>): ExamSession => ({
  id: Math.random().toString(),
  status,
  setup: { count: 1, scope: { kind: 'all' }, named: true, timed: false, helpers: true },
  questionKeys: Object.keys(answers),
  startedAt: '2026-11-11T10:00:00.000Z',
  deadline: null,
  answers,
})

describe('withHelp', () => {
  it('records a use once, in first-use order', () => {
    const a = withHelp(withHelp(withHelp(answer, 'pattern'), 'check'), 'pattern')
    expect(a.help).toEqual(['pattern', 'check'])
    expect(a.code).toBe('x')
  })
  it('returns the same object when the use is already recorded', () => {
    const a = withHelp(answer, 'solution')
    expect(withHelp(a, 'solution')).toBe(a)
  })
  it('does not change the answer it was given', () => {
    withHelp(answer, 'check')
    expect(answer.help).toBeUndefined()
  })
})

describe('sessionUsedHelp', () => {
  it('is true when any answer used a Helper', () => {
    expect(sessionUsedHelp(session('submitted', { a: answer, b: { ...answer, help: ['check'] } }))).toBe(true)
  })
  it('is false for no help, an empty list, or an old session without the field', () => {
    expect(sessionUsedHelp(session('submitted', { a: answer }))).toBe(false)
    expect(sessionUsedHelp(session('submitted', { a: answer, b: { ...answer, help: [] } }))).toBe(false)
  })
})

describe('helperCounts', () => {
  it('counts submitted sessions only, split by help use', () => {
    const helped = { a: { ...answer, help: ['solution' as const] } }
    expect(
      helperCounts([
        session('submitted', helped),
        session('submitted', helped),
        session('submitted', { a: answer }),
        session('abandoned', helped),
        session('inProgress', { a: answer }),
      ]),
    ).toEqual({ withHelp: 2, without: 1 })
  })
})
