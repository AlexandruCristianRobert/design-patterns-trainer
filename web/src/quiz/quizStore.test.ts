import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '../progress/db'
import { getBoxes, listQuizResults, recordAnswer, saveQuizResult } from './quizStore'

beforeEach(async () => {
  await resetDbForTests()
})

describe('quizStore', () => {
  it('moves a question through Boxes and reports each change', async () => {
    const t = new Date('2026-11-06T10:00:00.000Z')
    expect(await recordAnswer('q1', true, t)).toEqual({ from: undefined, to: 2 })
    expect(await recordAnswer('q1', true, t)).toEqual({ from: 2, to: 3 })
    expect(await recordAnswer('q1', false, t)).toEqual({ from: 3, to: 1 })
    expect((await getBoxes()).get('q1')).toEqual({ questionId: 'q1', box: 1, lastAnsweredAt: t.toISOString() })
  })
  it('lists Quiz Results newest first', async () => {
    await saveQuizResult({ takenAt: '2026-11-01T00:00:00.000Z', topics: 'all', total: 5, correct: 3 })
    const later = await saveQuizResult({ takenAt: '2026-11-02T00:00:00.000Z', topics: ['testing'], total: 10, correct: 9 })
    const list = await listQuizResults()
    expect(list.map((r) => r.takenAt)).toEqual(['2026-11-02T00:00:00.000Z', '2026-11-01T00:00:00.000Z'])
    expect(list[0]).toEqual(later)
    expect(later.id).toMatch(/.+/)
  })
})
