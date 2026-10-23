import { describe, expect, it } from 'vitest'
import observerYaml from '../../../content/patterns/observer/pattern.yaml'
import { getExamPool, getExamQuestion } from './exam'
import { schemas } from './schema'

describe('exam content', () => {
  it('has an empty pool until questions are authored', () => {
    expect(getExamPool()).toEqual([])
    expect(getExamQuestion('observer/x')).toBeUndefined()
  })
})

describe('exam schemas', () => {
  it('accepts the current Observer pattern.yaml and defaults the exam fields to []', () => {
    const raw = observerYaml
    const p = schemas.pattern.parse(raw)
    expect(p.examQuestions).toEqual([])
    expect(p.roleNames).toEqual([])
  })
  it('rejects an unknown key in examQuestionText', () => {
    const base = { title: 't', scenario: 's', checks: { a: { title: 'A' } } }
    expect(schemas.examQuestionText.safeParse(base).success).toBe(true)
    expect(schemas.examQuestionText.safeParse({ ...base, hints: [] }).success).toBe(false)
  })
  it('rejects a Contract type with an unknown kind', () => {
    const q = (kind: string) => ({ version: 1, contract: { types: [{ name: 'X', kind, members: [] }] } })
    expect(schemas.examQuestion.safeParse(q('class')).success).toBe(true)
    expect(schemas.examQuestion.safeParse(q('struct')).success).toBe(false)
  })
})
