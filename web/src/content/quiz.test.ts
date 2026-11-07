import { describe, expect, it } from 'vitest'
import { getQuizBank, getQuizFileIds, getQuizTopics, type QuizQuestion } from './quiz'
import {
  bankProblems, longestCorrectShare, LONGEST_CORRECT_MAX_SHARE, QUIZ_TOPIC_MIN, QUIZ_TOPIC_TARGETS,
  questionProblems, SHORTEST_CORRECT_MAX_SHARE, shortestCorrectShare, visualProblems,
} from './quizRules'
import { getQuizVisuals } from './quizVisuals'

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
  it('rejects more all/none/neither phrasings', () => {
    for (const t of ['All of these', 'None of the others', 'Neither of the above', 'Both of these are right']) {
      const bad = q({ options: [opt('First thing', true), opt(t), opt('Third one'), opt('Fourth one')] })
      expect(questionProblems(bad), t).toContain(`sample: option "${t}" is an all/none/both-of-the-above option`)
    }
  })
  it('rejects more letter-reference shapes', () => {
    for (const e of ['Pick (B) instead.', 'B. is wrong.', 'Unlike option b, this works.', 'Choice d fails.']) {
      const bad = q({ options: [opt('First thing', true, e), opt('Second one'), opt('Third one'), opt('Fourth one')] })
      expect(questionProblems(bad), e).toEqual(['sample: an explanation refers to an option by letter'])
    }
  })
  it('still allows ordinary English with capital letters', () => {
    for (const e of ['A task is hot.', 'Plan A works; C# 12 adds it.', 'The answer a reviewer expects.']) {
      const ok = q({ options: [opt('First thing', true, e), opt('Second one'), opt('Third one'), opt('Fourth one')] })
      expect(questionProblems(ok), e).toEqual([])
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
    const problems = bankProblems([q(), q()], [...topics, { id: 'clr-memory', title: 'CLR & memory' }], ['testing', 'stray'], () => 2)
    expect(problems).toEqual(
      expect.arrayContaining([
        'duplicate question id "sample"',
        'topic "clr-memory" has no file content/quiz/clr-memory.en.yaml',
        'content/quiz/stray.en.yaml is not listed in topics.yaml',
        'topic "clr-memory" has 0 questions, needs at least 2',
      ]),
    )
  })
  it('flags duplicate topic ids and uses the per-topic minimum', () => {
    const problems = bankProblems([q()], [...topics, ...topics], ['testing'], (id) => (id === 'testing' ? 3 : 0))
    expect(problems).toEqual(expect.arrayContaining(['duplicate topic id "testing" in topics.yaml', 'topic "testing" has 1 questions, needs at least 3']))
  })
})

describe('longestCorrectShare', () => {
  it('counts questions whose correct option is strictly the longest', () => {
    const long = q({ options: [opt('The long correct one', true), opt('b'), opt('c'), opt('d')] })
    const tie = q({ options: [opt('same', true), opt('four'), opt('c'), opt('d')] })
    expect(longestCorrectShare([long, tie])).toBe(0.5)
  })
})

describe('shortestCorrectShare', () => {
  it('counts questions whose correct option is strictly the shortest', () => {
    const short = q({ options: [opt('ok', true), opt('bbbb'), opt('cccc'), opt('dddd')] })
    const tie = q({ options: [opt('ok', true), opt('bb'), opt('cccc'), opt('dddd')] })
    expect(shortestCorrectShare([short, tie])).toBe(0.5)
  })
})
describe('QUIZ_TOPIC_TARGETS', () => {
  it('has a target for every topic, summing to 400', () => {
    expect(Object.keys(QUIZ_TOPIC_TARGETS).sort()).toEqual(getQuizTopics().map((t) => t.id).sort())
    expect(Object.values(QUIZ_TOPIC_TARGETS).reduce((a, b) => a + b, 0)).toBe(400)
  })
})

describe('the shipped quiz bank', () => {
  const bank = getQuizBank()
  it('passes every content rule', () => {
    expect(bankProblems(bank, getQuizTopics(), getQuizFileIds(), (id) => QUIZ_TOPIC_TARGETS[id] ?? QUIZ_TOPIC_MIN)).toEqual([])
  })
  it('does not give the answer away by length', () => {
    expect(longestCorrectShare(bank)).toBeLessThanOrEqual(LONGEST_CORRECT_MAX_SHARE)
  })
  it('does not give the answer away by brevity', () => expect(shortestCorrectShare(bank)).toBeLessThanOrEqual(SHORTEST_CORRECT_MAX_SHARE))
  it('lists the ten Quiz Topics of the spec', () => {
    expect(getQuizTopics().map((t) => t.id)).toEqual([
      'csharp-language', 'clr-memory', 'async-concurrency', 'collections-linq', 'aspnet-core',
      'efcore-data', 'architecture-design', 'testing', 'web-distributed', 'security-performance',
    ])
  })
})

describe('visualProblems', () => {
  const opt = (text: string, correct = false) => ({ text, correct, explanation: 'Why.' })
  const question = { id: 'x', topicId: 'testing', question: 'Q?', options: [opt('a', true), opt('b'), opt('c'), opt('d')] }
  const stage = (id: string, caption = 'Plain text.') => ({ id, title: 'T', steps: [{ id: 'one', caption }] })
  const claim = (option: number) => ({ option, claim: stage(`c${option}`), reality: stage(`r${option}`) })
  const ok = { question: 'x', setup: stage('setup'), reality: { title: 'R', stages: [stage('real')] }, claims: [claim(1), claim(2), claim(3)] }

  it('accepts a complete visual', () => expect(visualProblems(ok, question)).toEqual([]))
  it('needs an existing question', () => expect(visualProblems(ok, undefined)).toEqual(['visual "x": no Quiz Question has this id']))
  it('needs one claim per wrong option, never the correct one', () => {
    const problems = visualProblems({ ...ok, claims: [claim(0), claim(1), claim(1)] }, question)
    expect(problems).toContain('visual "x": option 0 is the correct option and cannot have a claim')
    expect(problems).toContain('visual "x": option 1 has two claims')
    expect(problems).toContain('visual "x": wrong option 2 has no claim')
    expect(problems).toContain('visual "x": wrong option 3 has no claim')
  })
  it('needs unique stage ids and unique step ids', () => {
    const twice = { id: 'setup', title: 'T', steps: [{ id: 'one', caption: 'C.' }, { id: 'one', caption: 'D.' }] }
    const problems = visualProblems({ ...ok, setup: twice, reality: { title: 'R', stages: [stage('setup')] } }, question)
    expect(problems).toContain('visual "x": stage id "setup" is used twice')
    expect(problems).toContain('visual "x": stage "setup" uses step id "one" twice')
  })
  it('rejects letters and emphasis in captions', () => {
    const problems = visualProblems({ ...ok, setup: stage('setup', 'Option B is *wrong*.') }, question)
    expect(problems).toContain('visual "x": stage "setup" refers to an option by letter')
    expect(problems).toContain('visual "x": stage "setup" uses emphasis markup')
  })
})

describe('the shipped question visuals', () => {
  it('pass every content rule', () => {
    const byId = new Map(getQuizBank().map((q) => [q.id, q]))
    const problems = [...getQuizVisuals().values()].flatMap((v) => visualProblems(v, byId.get(v.question)))
    expect(problems).toEqual([])
  })
})
