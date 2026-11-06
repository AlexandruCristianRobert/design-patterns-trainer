import { describe, expect, it } from 'vitest'
import { getQuizBank, getQuizFileIds, getQuizTopics, type QuizQuestion } from './quiz'
import { bankProblems, longestCorrectShare, LONGEST_CORRECT_MAX_SHARE, QUIZ_TOPIC_MIN, questionProblems } from './quizRules'

const opt = (text: string, correct = false, explanation = 'Because the runtime does so.') => ({ text, correct, explanation })
const q = (over: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: 'sample',
  topicId: 'testing',
  question: 'Which one?',
  options: [opt('First thing', true), opt('Second one'), opt('Third one'), opt('Fourth one')],
  ...over,
})

describe('questionProblems', () => {
  it('accepts a clean question', () => expect(questionProblems(q())).toEqual([]))
  it('rejects all/none/both of the above', () => {
    const bad = q({ options: [opt('First thing', true), opt('None of the above'), opt('Third one'), opt('Fourth one')] })
    expect(questionProblems(bad)).toContain('sample: option "None of the above" is an all/none/both-of-the-above option')
  })
  it('rejects letter references in explanations', () => {
    for (const e of ['Option B is wrong.', 'As in answer C here.', 'A) is a trap.', 'Unlike B is often said.']) {
      const bad = q({ options: [opt('First thing', true, e), opt('Second one'), opt('Third one'), opt('Fourth one')] })
      expect(questionProblems(bad), e).toEqual(['sample: an explanation refers to an option by letter'])
    }
  })
  it('allows an English "A" at the start of a sentence', () => {
    const ok = q({ options: [opt('First thing', true, 'A struct is copied.'), opt('Second one'), opt('Third one'), opt('Fourth one')] })
    expect(questionProblems(ok)).toEqual([])
  })
  it('rejects emphasis markup in an explanation', () => {
    const bad = q({ options: [opt('First thing', true, 'It resumes *after* the await.'), opt('Second one'), opt('Third one'), opt('Fourth one')] })
    expect(questionProblems(bad)).toEqual(['sample: emphasis markup (*…*) is not supported; use plain text or `code`'])
  })
  it('allows an asterisk inside code spans and fenced blocks', () => {
    const ok = q({
      options: [opt('First thing', true, 'The product `a * b` and `*p` work.\n```\nint x = a * b * c;\n```'), opt('Second one'), opt('Third one'), opt('Fourth one')],
    })
    expect(questionProblems(ok)).toEqual([])
  })
  it('rejects duplicate option texts', () => {
    const bad = q({ options: [opt('Same', true), opt('Same'), opt('Third one'), opt('Fourth one')] })
    expect(questionProblems(bad)).toContain('sample: two options have the same text')
  })
  it('rejects fenced code in option text', () => {
    const bad = q({ options: [opt('```csharp\nx\n```', true), opt('Second one'), opt('Third one'), opt('Fourth one')] })
    expect(questionProblems(bad)).toContain('sample: option text may use inline code only')
  })
})

describe('bankProblems', () => {
  const topics = [{ id: 'testing', title: 'Testing' }]
  it('flags duplicate ids, missing files, stray files and thin topics', () => {
    const problems = bankProblems([q(), q()], [...topics, { id: 'clr-memory', title: 'CLR & memory' }], ['testing', 'stray'], 2)
    expect(problems).toEqual(
      expect.arrayContaining([
        'duplicate question id "sample"',
        'topic "clr-memory" has no file content/quiz/clr-memory.en.yaml',
        'content/quiz/stray.en.yaml is not listed in topics.yaml',
        'topic "clr-memory" has 0 questions, needs at least 2',
      ]),
    )
  })
})

describe('longestCorrectShare', () => {
  it('counts questions whose correct option is strictly the longest', () => {
    const long = q({ options: [opt('The long correct one', true), opt('b'), opt('c'), opt('d')] })
    const tie = q({ options: [opt('same', true), opt('four'), opt('c'), opt('d')] })
    expect(longestCorrectShare([long, tie])).toBe(0.5)
  })
})

describe('the shipped quiz bank', () => {
  const bank = getQuizBank()
  it('passes every content rule', () => {
    expect(bankProblems(bank, getQuizTopics(), getQuizFileIds(), QUIZ_TOPIC_MIN)).toEqual([])
  })
  it('does not give the answer away by length', () => {
    expect(longestCorrectShare(bank)).toBeLessThanOrEqual(LONGEST_CORRECT_MAX_SHARE)
  })
  it('lists the ten Quiz Topics of the spec', () => {
    expect(getQuizTopics().map((t) => t.id)).toEqual([
      'csharp-language', 'clr-memory', 'async-concurrency', 'collections-linq', 'aspnet-core',
      'efcore-data', 'architecture-design', 'testing', 'web-distributed', 'security-performance',
    ])
  })
})
