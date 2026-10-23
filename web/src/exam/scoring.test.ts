import { describe, expect, it } from 'vitest'
import { PASS_MARK, isPass, questionScore, scorePercent, sessionScore } from './scoring'

describe('scoring', () => {
  it('weights identification 20% and checks 80%', () => {
    expect(questionScore(false, true, 3, 4)).toBeCloseTo(0.8)
    expect(questionScore(false, false, 4, 4)).toBeCloseTo(0.8)
  })
  it('gives Named mode checks only', () => {
    expect(questionScore(true, false, 3, 4)).toBeCloseTo(0.75)
  })
  it('scores only identification when there are no checks', () => {
    expect(questionScore(false, true, 0, 0)).toBeCloseTo(0.2)
    expect(questionScore(false, false, 0, 0)).toBe(0)
  })
  it('averages the session', () => {
    expect(sessionScore([])).toBe(0)
    expect(sessionScore([1, 0.5])).toBe(0.75)
  })
  it('passes at 70%', () => {
    expect(PASS_MARK).toBe(0.7)
    expect(isPass(0.7)).toBe(true)
    expect(isPass(0.6999)).toBe(false)
  })
})

describe('scorePercent', () => {
  it('floors so 70 always means the pass mark was reached', () => {
    expect(scorePercent(0.6999)).toBe(69)
    expect(scorePercent(0.7)).toBe(70)
    expect(scorePercent(0.8)).toBe(80)
    expect(scorePercent(1)).toBe(100)
    expect(scorePercent(0.1 + 0.2)).toBe(30)
  })
})
