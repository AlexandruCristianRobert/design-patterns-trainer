import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDbForTests } from '../progress/db'
import { createSession, getSession, saveAnswer } from './examStore'
import type { ExamSession, QuestionResult } from './types'

const grading = vi.hoisted(() => ({ during: async (_s: ExamSession) => {} }))
vi.mock('./gradeSession', () => ({
  gradeSession: async (s: ExamSession): Promise<QuestionResult[]> => {
    await grading.during(s)
    return s.questionKeys.map((k) => ({
      questionKey: k,
      patternId: 'observer',
      identification: s.answers[k].identification,
      identifiedCorrectly: false,
      grade: { kind: 'error' },
      checksPassed: 0,
      checksTotal: 0,
      score: 0,
    }))
  },
}))

const { submitExam } = await import('./submitExam')
const engine = { compiler: { compile: vi.fn() }, runner: { exclusive: vi.fn(), load: vi.fn(), runCheck: vi.fn() } } as never

beforeEach(async () => {
  await resetDbForTests()
})

describe('submitExam', () => {
  it('stores the answers it graded, even when an answer is written while grading runs', async () => {
    const s = await createSession({ count: 1, scope: { kind: 'all' }, named: false, timed: false }, ['observer/a'], new Date())
    await saveAnswer(s.id, 'observer/a', { code: 'graded', identification: 'observer' })
    grading.during = async (graded) => {
      expect(graded.answers['observer/a'].code).toBe('graded')
      await saveAnswer(s.id, 'observer/a', { code: 'late', identification: null })
    }
    const done = await submitExam(s.id, 'learner', engine)
    expect(done?.status).toBe('submitted')
    expect((await getSession(s.id))!.answers).toEqual({ 'observer/a': { code: 'graded', identification: 'observer' } })
  })
})
