import { expect, it } from 'vitest'
import { quizSummary } from './summary'

it('weights the average by questions and counts only seen questions still in the bank', () => {
  const results = [
    { id: '1', takenAt: 'x', topics: 'all' as const, total: 5, correct: 5 },
    { id: '2', takenAt: 'y', topics: 'all' as const, total: 15, correct: 5 },
  ]
  const boxes = new Map([
    ['a', { questionId: 'a', box: 2 as const, lastAnsweredAt: 'x' }],
    ['gone', { questionId: 'gone', box: 1 as const, lastAnsweredAt: 'x' }],
  ])
  expect(quizSummary(results, boxes, ['a', 'b', 'c'])).toEqual({ quizzes: 2, averagePercent: 50, seen: 1, total: 3 })
  expect(quizSummary([], new Map(), ['a']).averagePercent).toBeNull()
})
