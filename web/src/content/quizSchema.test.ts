import { describe, expect, it } from 'vitest'
import { parseContent, schemas } from './schema'

const opt = (text: string, correct = false) => ({ text, correct, explanation: 'Why.' })
const base = { id: 'x', question: 'Q?', options: [opt('a', true), opt('b'), opt('c'), opt('d')] }
const parse = (q: unknown) => () => parseContent(schemas.quizFile, [q], 'f.yaml')

describe('quizFile schema', () => {
  it('accepts a valid question', () => expect(parse(base)).not.toThrow())
  it('rejects two correct options', () => expect(parse({ ...base, options: [opt('a', true), opt('b', true), opt('c'), opt('d')] })).toThrow(/exactly one option/))
  it('rejects no correct option', () => expect(parse({ ...base, options: [opt('a'), opt('b'), opt('c'), opt('d')] })).toThrow(/exactly one option/))
  it('rejects three options', () => expect(parse({ ...base, options: [opt('a', true), opt('b'), opt('c')] })).toThrow())
  it('rejects code without expectedOutput', () => expect(parse({ ...base, code: 'x' })).toThrow(/go together/))
  it('rejects expectedOutput without code', () => expect(parse({ ...base, expectedOutput: 'x' })).toThrow(/go together/))
  it('rejects unknown keys', () => expect(parse({ ...base, difficulty: 2 })).toThrow())
  it('rejects a non-kebab id', () => expect(parse({ ...base, id: 'Not_Kebab' })).toThrow(/kebab/))
})

const stage = (id: string) => ({ id, title: 'T', steps: [{ id: 'one', caption: 'C.' }] })
const visual = {
  question: 'x',
  setup: stage('setup'),
  reality: { title: 'R', stages: [stage('real')] },
  claims: [{ option: 1, claim: stage('c1'), reality: stage('r1') }],
}
const parseVisual = (v: unknown) => () => parseContent(schemas.quizVisual, v, 'v.yaml')

describe('quizVisual schema', () => {
  it('accepts a valid visual', () => expect(parseVisual(visual)).not.toThrow())
  it('rejects a stage without steps', () => expect(parseVisual({ ...visual, setup: { ...stage('setup'), steps: [] } })).toThrow())
  it('rejects three reality stages', () => expect(parseVisual({ ...visual, reality: { title: 'R', stages: [stage('a'), stage('b'), stage('c')] } })).toThrow())
  it('rejects an option index past D', () => expect(parseVisual({ ...visual, claims: [{ ...visual.claims[0], option: 4 }] })).toThrow())
  it('rejects unknown keys', () => expect(parseVisual({ ...visual, autoplay: true })).toThrow())
  it('rejects a non-kebab step id', () => expect(parseVisual({ ...visual, setup: { ...stage('setup'), steps: [{ id: 'Step_1', caption: 'C.' }] } })).toThrow(/kebab/))
})
