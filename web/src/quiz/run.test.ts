import { describe, expect, it } from 'vitest'
import type { QuizQuestion } from '../content/quiz'
import { pickRun, poolFor, topicBreakdown } from './run'

const opt = (text: string, correct = false) => ({ text, correct, explanation: 'x' })
const question = (id: string, topicId: string): QuizQuestion => ({
  id,
  topicId,
  question: id,
  options: [opt('a', true), opt('b'), opt('c'), opt('d')],
})
const bank = [question('q1', 'testing'), question('q2', 'testing'), question('q3', 'clr-memory')]
const topics = [{ id: 'clr-memory', title: 'CLR & memory' }, { id: 'testing', title: 'Testing' }]

describe('poolFor', () => {
  it('is the whole bank for "all", else only the chosen topics', () => {
    expect(poolFor(bank, 'all')).toHaveLength(3)
    expect(poolFor(bank, ['clr-memory']).map((q) => q.id)).toEqual(['q3'])
  })
})

describe('pickRun', () => {
  it('builds count questions with all four options shuffled, keeping one correct, and the topic title', () => {
    const run = pickRun(bank, ['testing'], 2, new Map(), new Date(), Math.random, topics)
    expect(run.topics).toEqual(['testing'])
    expect(run.questions.map((r) => r.question.id).sort()).toEqual(['q1', 'q2'])
    for (const r of run.questions) {
      expect(r.options.map((o) => o.text).sort()).toEqual(['a', 'b', 'c', 'd'])
      expect(r.options.filter((o) => o.correct)).toHaveLength(1)
      expect(r.topicTitle).toBe('Testing')
    }
  })
})

describe('topicBreakdown', () => {
  it('counts per topic in topic order, skipping topics not in the quiz', () => {
    const rows = topicBreakdown(
      [
        { questionId: 'q1', topicId: 'testing', correct: true },
        { questionId: 'q2', topicId: 'testing', correct: false },
        { questionId: 'q3', topicId: 'clr-memory', correct: true },
      ],
      topics,
    )
    expect(rows).toEqual([
      { topicId: 'clr-memory', title: 'CLR & memory', correct: 1, total: 1 },
      { topicId: 'testing', title: 'Testing', correct: 1, total: 2 },
    ])
  })
})
