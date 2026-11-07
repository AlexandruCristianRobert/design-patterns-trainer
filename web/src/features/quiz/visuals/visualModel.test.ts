import { describe, expect, it } from 'vitest'
import type { QuizVisual } from '../../../content/quizVisuals'
import { answerViews, openingKey, setupView, stepCount, stepIn } from './visualModel'

const opt = (text: string, correct = false) => ({ text, correct, explanation: 'Why.' })
const source = [opt('right', true), opt('w1'), opt('w2'), opt('w3')]
const display = [source[3], source[0], source[1], source[2]] // shuffled: w3, right, w1, w2
const stage = (id: string, n: number) => ({ id, title: id, steps: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, caption: `${id} ${i}` })) })
const visual: QuizVisual = {
  question: 'x',
  setup: stage('setup', 3),
  reality: { title: 'R', stages: [stage('a', 2), stage('b', 5)] },
  claims: [1, 2, 3].map((option) => ({ option, claim: stage(`c${option}`, 2), reality: stage(`r${option}`, 4) })),
}

describe('visualModel', () => {
  it('has a single setup view', () => {
    expect(setupView(visual)).toMatchObject({ key: 'setup', kind: 'setup', stages: [{ id: 'setup' }] })
  })
  it('lists reality first, then one claim per wrong option in display order with display letters', () => {
    const views = answerViews(visual, source, display)
    expect(views.map((v) => [v.key, v.letter])).toEqual([['reality', undefined], ['claim-3', 'A'], ['claim-1', 'C'], ['claim-2', 'D']])
    expect(views[1].stages.map((s) => s.id)).toEqual(['c3', 'r3'])
  })
  it('opens the chosen wrong option, or reality when correct', () => {
    const views = answerViews(visual, source, display)
    expect(openingKey(views, 2, false)).toBe('claim-1')
    expect(openingKey(views, 1, true)).toBe('reality')
  })
  it('counts steps by the longest stage and clamps shorter ones', () => {
    const [reality] = answerViews(visual, source, display)
    expect(stepCount(reality)).toBe(5)
    expect(stepIn(reality.stages[0], 4)).toBe(1)
    expect(stepIn(reality.stages[1], 4)).toBe(4)
  })
})
