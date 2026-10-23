import { describe, expect, it } from 'vitest'
import observerYaml from '../../../content/patterns/observer/pattern.yaml'
import { getExamPool, getExamQuestion, getExamQuestionText } from './exam'
import { schemas } from './schema'

const observerQuestions = ['build-status', 'parcel-tracking', 'match-score']

describe('exam content', () => {
  it('pools the Observer questions in examQuestions order', () => {
    const observer = getExamPool().filter((q) => q.patternId === 'observer')
    expect(observer.map((q) => q.id)).toEqual(observerQuestions)
    expect(observer.map((q) => q.key)).toEqual(observerQuestions.map((id) => `observer/${id}`))
    for (const q of observer) {
      expect(q.solution.length).toBeGreaterThan(0)
      expect(q.checks).toContain('[Check(')
      expect(q.meta.contract.types.length).toBeGreaterThan(0)
    }
    expect(getExamQuestion('observer/build-status')?.id).toBe('build-status')
    expect(getExamQuestion('observer/x')).toBeUndefined()
  })

  it('falls back to en text, marked untranslated', () => {
    const en = getExamQuestionText('observer/build-status', 'en')
    const de = getExamQuestionText('observer/build-status', 'de')
    expect(en.untranslated).toBe(false)
    expect(de.untranslated).toBe(true)
    expect(de.value).toEqual(en.value)
  })
})

describe('exam schemas', () => {
  it('accepts the Observer pattern.yaml with its exam fields', () => {
    const p = schemas.pattern.parse(observerYaml)
    expect(p.examQuestions).toEqual(observerQuestions)
    expect(p.roleNames).toEqual(['Observer', 'Subject', 'Subscriber', 'Publisher', 'Notify', 'Attach', 'Detach'])
  })
  it('defaults the exam fields to []', () => {
    const p = schemas.pattern.parse({ ...(observerYaml as object), examQuestions: undefined, roleNames: undefined })
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
