import { describe, expect, it } from 'vitest'
import { BOX_WAIT_DAYS, dueAtMs, nextBox, selectQuiz, shuffle, stateOf, type BoxRecord } from './leitner'

const DAY = 86_400_000
const NOW = new Date('2026-11-06T12:00:00.000Z')
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString()
const rec = (questionId: string, box: BoxRecord['box'], daysAgo: number): BoxRecord => ({ questionId, box, lastAnsweredAt: ago(daysAgo) })
const zero = () => 0

describe('nextBox', () => {
  it('puts a New question in Box 2 when right and Box 1 when wrong', () => {
    expect(nextBox(undefined, true)).toBe(2)
    expect(nextBox(undefined, false)).toBe(1)
  })
  it('moves up one when right, capped at 5, and back to 1 when wrong', () => {
    expect(nextBox(1, true)).toBe(2)
    expect(nextBox(4, true)).toBe(5)
    expect(nextBox(5, true)).toBe(5)
    expect(nextBox(5, false)).toBe(1)
  })
})

describe('stateOf', () => {
  it('waits 1, 3, 7, 16, 35 days', () => expect(BOX_WAIT_DAYS).toEqual({ 1: 1, 2: 3, 3: 7, 4: 16, 5: 35 }))
  it('is new without a record', () => expect(stateOf(undefined, NOW)).toBe('new'))
  it('is due exactly when the wait has passed, waiting just before', () => {
    expect(stateOf(rec('q', 3, 7), NOW)).toBe('due')
    expect(stateOf({ questionId: 'q', box: 3, lastAnsweredAt: new Date(NOW.getTime() - 7 * DAY + 1).toISOString() }, NOW)).toBe('waiting')
  })
  it('computes the due time from the Box wait', () => {
    expect(dueAtMs(rec('q', 1, 0))).toBe(NOW.getTime() + DAY)
  })
})

describe('shuffle', () => {
  it('returns a permutation and leaves the input alone', () => {
    const xs = [1, 2, 3, 4, 5]
    const out = shuffle(xs, Math.random)
    expect([...out].sort()).toEqual(xs)
    expect(xs).toEqual([1, 2, 3, 4, 5])
  })
})

describe('selectQuiz', () => {
  const ids = ['due-old', 'due-new', 'fresh-1', 'fresh-2', 'wait-soon', 'wait-late']
  const boxes = new Map<string, BoxRecord>([
    ['due-old', rec('due-old', 1, 10)], // 9 days overdue
    ['due-new', rec('due-new', 1, 2)], // 1 day overdue
    ['wait-soon', rec('wait-soon', 2, 2)], // due in 1 day
    ['wait-late', rec('wait-late', 5, 0)], // due in 35 days
  ])
  const pick = (count: number) => [...selectQuiz(ids, boxes, count, NOW, zero)].sort()

  it('takes Due questions first, most overdue first', () => expect(pick(1)).toEqual(['due-old']))
  it('then New ones', () => expect(pick(4)).toEqual(['due-new', 'due-old', 'fresh-1', 'fresh-2']))
  it('then the waiting ones closest to Due', () => expect(pick(5)).toEqual(['due-new', 'due-old', 'fresh-1', 'fresh-2', 'wait-soon']))
  it('never returns more than exist', () => expect(selectQuiz(ids, boxes, 50, NOW, zero)).toHaveLength(6))
  it('ignores records for ids that are not in the pool', () => {
    const extra = new Map(boxes).set('gone', rec('gone', 1, 99))
    expect(selectQuiz(ids, extra, 6, NOW, zero)).not.toContain('gone')
  })
})
