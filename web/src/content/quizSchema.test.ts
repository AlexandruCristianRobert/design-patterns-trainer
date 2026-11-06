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
