import { describe, expect, it } from 'vitest'
import type { ExamQuestionContent } from '../content/exam'
import { availableCount, scopePatternIds, selectQuestions } from './selection'
import type { ExamSetup } from './types'

const q = (patternId: string, id: string): ExamQuestionContent => ({
  key: `${patternId}/${id}`,
  patternId,
  id,
  meta: { version: 1, contract: { types: [] } },
  solution: '',
  checks: '',
})
// builder is creational; observer and strategy are behavioral
const pool = [q('builder', 'a'), q('builder', 'b'), q('observer', 'a'), q('observer', 'b'), q('strategy', 'a'), q('strategy', 'b')]
const setup = (count: number, scope: ExamSetup['scope'] = { kind: 'all' }): ExamSetup => ({ count, scope, named: false, timed: true })
const first = () => 0
const patternOf = (key: string) => key.split('/')[0]

describe('selectQuestions', () => {
  it('picks distinct Patterns when it can', () => {
    const keys = selectQuestions(pool, setup(3), {}, Math.random)
    expect(new Set(keys.map(patternOf)).size).toBe(3)
  })
  it('repeats a Pattern only after every Pattern is used, never a question', () => {
    const two = pool.filter((p) => p.patternId !== 'strategy')
    const keys = selectQuestions(two, setup(4), {}, Math.random)
    expect(keys).toHaveLength(4)
    expect(new Set(keys).size).toBe(4)
    expect(keys.slice(0, 2).map(patternOf).sort()).toEqual(['builder', 'observer'])
  })
  it('prefers unseen, then older, questions', () => {
    const lastSeen = {
      'builder/a': '2026-10-22T00:00:00.000Z',
      'builder/b': '2026-10-16T00:00:00.000Z',
      'observer/a': '2026-10-22T00:00:00.000Z',
      'observer/b': '2026-10-22T00:00:00.000Z',
      'strategy/a': '2026-10-22T00:00:00.000Z',
    }
    const keys = selectQuestions(pool, setup(3), lastSeen, first)
    expect(keys[0]).toBe('strategy/b')
    expect(keys[1]).toBe('builder/b')
  })
  it('caps at the available count', () => {
    expect(selectQuestions(pool, setup(10), {}, Math.random)).toHaveLength(6)
  })
  it('returns [] for an empty scope', () => {
    expect(selectQuestions(pool, setup(3, { kind: 'patterns', patternIds: [] }), {}, Math.random)).toEqual([])
    expect(selectQuestions([], setup(3), {}, Math.random)).toEqual([])
  })
  it('filters by categories and patterns', () => {
    const cat = selectQuestions(pool, setup(10, { kind: 'categories', categories: ['creational'] }), {}, first)
    expect(cat.map(patternOf)).toEqual(['builder', 'builder'])
    const pat = selectQuestions(pool, setup(10, { kind: 'patterns', patternIds: ['observer'] }), {}, first)
    expect(pat.map(patternOf)).toEqual(['observer', 'observer'])
    expect(availableCount({ scope: { kind: 'categories', categories: ['behavioral'] } }, pool)).toBe(4)
    expect([...scopePatternIds({ kind: 'all' }, pool)].sort()).toEqual(['builder', 'observer', 'strategy'])
  })
  it('is deterministic for a fixed random', () => {
    const rnd = () => 0.5
    expect(selectQuestions(pool, setup(3), {}, rnd)).toEqual(selectQuestions(pool, setup(3), {}, rnd))
  })
})
