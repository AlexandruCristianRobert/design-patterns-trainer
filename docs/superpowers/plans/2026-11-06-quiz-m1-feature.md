# Quiz M1 (the feature + 20 seed questions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a keyboard-driven multiple-choice Quiz on senior .NET interview topics. It has Leitner spaced repetition, remembered settings and a Quiz History, and ships with 20 reviewed seed questions.

**Architecture:**
- **Content:** YAML in `content/quiz/`, loaded by an eager `import.meta.glob`, parsed with zod and validated by vitest rules. `expectedOutput` questions are also compiled and run by the C# content tests.
- **Logic:** pure modules in `web/src/quiz/` (`leitner.ts`, `run.ts`, `summary.ts`).
- **Storage:** two new IndexedDB stores (DB v3) plus export v3. Settings go in `localStorage`.
- **UI:** one route, `/quiz`, whose page switches between three phases (setup → run → end), held in memory.

**Tech Stack:** React 19, TypeScript, Vite, zod 4, idb, react-i18next, vitest + Testing Library + fake-indexeddb, Playwright, .NET 10 xUnit (`DesignPatterns.Content.Tests`).

**Spec:** `docs/superpowers/specs/2026-11-06-dotnet-quiz-design.md`. Glossary: `CONTEXT.md` → "Quiz". Read both before starting.

## Global Constraints

- Every Quiz Question has exactly 4 Options and exactly 1 correct one. Options are shuffled at display time.
- Explanations never mention a letter (A–D). All/none/both-of-the-above Options are banned. Option `text` has inline code only, with no fenced blocks.
- Box waits are **1, 3, 7, 16, 35 days** for Boxes 1–5. A New question answered correctly goes to Box 2, answered wrongly to Box 1. After that, correct is +1 (max 5) and wrong is → 1.
- Selection order: Due (most overdue first), then New (random), then waiting (closest to Due first). The chosen set is then shuffled.
- Length presets are **5 · 10 · 25 · Custom**. Custom ranges from 1 to min(100, available).
- Settings key `localStorage['dpt.quiz.settings']`. IndexedDB `DB_VERSION = 3`, stores `quizBoxes` (keyPath `questionId`) and `quizResults` (keyPath `id`). Export `schemaVersion: 3`.
- Never rename `DB_NAME` (`design-patterns-trainer`) or the export `app` id.
- UI strings go in i18n namespace `quiz` (`web/src/locales/en/quiz.json`). Content text comes from YAML.
- Layout works at 390 px; tap targets are ≥ 44 px. ✓/✗ always carry an icon and a text label, never colour alone. Use the `DESIGN.md` tokens.
- Seed questions (Task 1) go through the **reviewer loop** of spec §9 before they are committed.
- Commit messages follow the repo style (`feat(quiz): …`, `test(quiz): …`, `content(quiz): …`) and end with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Work on a branch `feat/quiz-m1`, created from `main`.

Commands (run from `web/` unless stated otherwise):
- unit tests: `npx vitest run <path>`
- types: `npx tsc -b`
- lint: `npm run lint`
- C#: from the repo root, `dotnet test tests/DesignPatterns.Content.Tests`
- e2e: `npx playwright test e2e/quiz.spec.ts`

---

## File map

| File | Responsibility |
|---|---|
| `content/quiz/topics.yaml` | the fixed Quiz Topic list (id, title, order) |
| `content/quiz/<topic>.en.yaml` ×10 | the questions of one topic |
| `web/src/content/schema.ts` (modify) | zod schemas `quizTopics`, `quizFile` |
| `web/src/content/quiz.ts` | loads topics and the bank |
| `web/src/content/quizRules.ts` | pure content-rule checks used by the tests |
| `web/src/content/quiz.test.ts` | rule unit tests plus "the shipped bank passes" |
| `web/src/quiz/leitner.ts` | Box transitions, Due, selection, shuffle |
| `web/src/quiz/run.ts` | builds a run (questions plus shuffled Options), per-topic breakdown |
| `web/src/quiz/summary.ts` | the Progress summary numbers |
| `web/src/quiz/quizStore.ts` | IndexedDB access for Boxes and Quiz Results |
| `web/src/quiz/settings.ts` | `localStorage` settings and the `useQuizSettings` hook |
| `web/src/progress/db.ts` (modify) | DB v3 stores |
| `web/src/progress/exportImport.ts` (modify) | export/import v3 |
| `web/src/progress/useProgress.ts` (modify) | `useQuizResults`, `useQuizBoxes` |
| `web/src/features/quiz/QuizText.tsx` | prose with inline and fenced code |
| `web/src/features/quiz/QuizRun.tsx` | one question at a time, keys, lock and reveal, quit |
| `web/src/features/quiz/QuizEnd.tsx` | score plus per-topic breakdown |
| `web/src/features/quiz/QuizSetup.tsx` | length, topics, Start |
| `web/src/features/quiz/QuizHistory.tsx` | the list of Quiz Results |
| `web/src/features/quiz/QuizPage.tsx` | the phase switch, saving the Quiz Result |
| `web/src/locales/en/quiz.json`, `web/src/i18n/index.ts` (modify) | strings |
| `web/src/App.tsx`, `web/src/locales/en/common.json` (modify) | route and nav tab |
| `web/src/features/progress/ProgressPage.tsx`, `web/src/locales/en/progress.json` (modify) | Quiz summary panel |
| `web/src/styles/base.css` (modify) | `quiz-*` styles |
| `tests/DesignPatterns.Content.Tests/QuizOutputTests.cs` | compiles and runs `expectedOutput` questions |
| `web/e2e/quiz.spec.ts` | keyboard-only end to end |

---

### Task 1: Quiz content: schema, loader, rules and the 20 seed questions

**Files:**
- Create: `content/quiz/topics.yaml`, `content/quiz/{csharp-language,clr-memory,async-concurrency,collections-linq,aspnet-core,efcore-data,architecture-design,testing,web-distributed,security-performance}.en.yaml`
- Modify: `web/src/content/schema.ts`
- Create: `web/src/content/quiz.ts`, `web/src/content/quizRules.ts`
- Test: `web/src/content/quiz.test.ts`

**Interfaces:**
- Produces:
  - `getQuizTopics(): QuizTopic[]`, `getQuizBank(): QuizQuestion[]`, `getQuizFileIds(): string[]`
  - types `QuizTopic { id; title }`, `QuizOption { text; correct; explanation }`, `QuizQuestion { id; topicId; question; options: QuizOption[]; code?; expectedOutput? }`
  - `questionProblems(q): string[]`, `bankProblems(bank, topics, fileIds, minPerTopic): string[]`, `longestCorrectShare(bank): number`
  - constants `QUIZ_TOPIC_MIN = 2`, `LONGEST_CORRECT_MAX_SHARE = 0.4`

- [ ] **Step 1: Add the schemas.** In `web/src/content/schema.ts`, before `export const schemas`:

```ts
const kebab = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case id')
const quizTopics = z.array(z.strictObject({ id: kebab, title: z.string().min(1) })).min(1)
const quizOption = z.strictObject({
  text: z.string().trim().min(1),
  correct: z.boolean().default(false),
  explanation: z.string().trim().min(1),
})
const quizQuestion = z
  .strictObject({
    id: kebab,
    question: z.string().trim().min(1),
    options: z.array(quizOption).length(4),
    code: z.string().min(1).optional(),
    expectedOutput: z.string().optional(),
  })
  .refine((q) => q.options.filter((o) => o.correct).length === 1, 'exactly one option must be correct')
  .refine((q) => (q.code === undefined) === (q.expectedOutput === undefined), 'code and expectedOutput go together')
const quizFile = z.array(quizQuestion)
```

Add `quizTopics, quizFile` to the `schemas` object, and add the types:

```ts
export type QuizTopicMeta = z.infer<typeof quizTopics>[number]
export type QuizQuestionMeta = z.infer<typeof quizQuestion>
```

- [ ] **Step 2: Write the loader** `web/src/content/quiz.ts`:

```ts
import { parseContent, schemas, type QuizQuestionMeta, type QuizTopicMeta } from './schema'

const root = '../../../content/quiz/'
const topicsFile = import.meta.glob('../../../content/quiz/topics.yaml', { eager: true, import: 'default' })
const topicFiles = import.meta.glob('../../../content/quiz/*.en.yaml', { eager: true, import: 'default' })

export type QuizTopic = QuizTopicMeta
export type QuizOption = QuizQuestionMeta['options'][number]
export type QuizQuestion = QuizQuestionMeta & { topicId: string }

let topics: QuizTopic[] | undefined
let bank: QuizQuestion[] | undefined

/** The fixed Quiz Topic list, in display order. */
export function getQuizTopics(): QuizTopic[] {
  topics ??= parseContent(schemas.quizTopics, topicsFile[`${root}topics.yaml`], 'content/quiz/topics.yaml')
  return topics
}

/** Topic ids that have a `<id>.en.yaml` file (the validator compares these with topics.yaml). */
export function getQuizFileIds(): string[] {
  return Object.keys(topicFiles).map((f) => f.slice(root.length).replace(/\.en\.yaml$/, ''))
}

/** Every Quiz Question, in topic order, then file order. A topic without a file has no questions. */
export function getQuizBank(): QuizQuestion[] {
  if (bank) return bank
  bank = getQuizTopics().flatMap((t) => {
    const path = `${root}${t.id}.en.yaml`
    if (!(path in topicFiles)) return []
    return parseContent(schemas.quizFile, topicFiles[path], `content/quiz/${t.id}.en.yaml`).map((q) => ({ ...q, topicId: t.id }))
  })
  return bank
}
```

- [ ] **Step 3: Write the failing rule tests** `web/src/content/quiz.test.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to see them fail**

Run: `npx vitest run src/content/quiz.test.ts`
Expected: FAIL. `./quizRules` cannot be resolved.

- [ ] **Step 5: Write `web/src/content/quizRules.ts`**

```ts
import type { QuizQuestion, QuizTopic } from './quiz'

/** M1 floor per topic; M2 raises it to each topic's target (spec §3.1). */
export const QUIZ_TOPIC_MIN = 2
export const LONGEST_CORRECT_MAX_SHARE = 0.4

const ALL_NONE = /\b(all|none|both) of the (above|others)\b/i
// Letters are shuffled at display time, so explanations must not name one. Case-sensitive: "A struct is…" stays legal.
const LETTER_REF = /\b(?:[Oo]ption|[Aa]nswer|[Cc]hoice)\s+[A-D]\b|\b[A-D]\)\s|\b[A-D] is\b/

/** Problems with one question; an empty list means it is fine. */
export function questionProblems(q: QuizQuestion): string[] {
  const out: string[] = []
  for (const o of q.options) {
    if (ALL_NONE.test(o.text)) out.push(`${q.id}: option "${o.text}" is an all/none/both-of-the-above option`)
    if (o.text.includes('```')) out.push(`${q.id}: option text may use inline code only`)
  }
  if (q.options.some((o) => LETTER_REF.test(o.explanation))) out.push(`${q.id}: an explanation refers to an option by letter`)
  if (new Set(q.options.map((o) => o.text.trim())).size !== q.options.length) out.push(`${q.id}: two options have the same text`)
  return out
}

/** Problems with the whole bank: per-question rules, unique ids, file/topic agreement, per-topic floor. */
export function bankProblems(bank: QuizQuestion[], topics: QuizTopic[], fileIds: string[], minPerTopic: number): string[] {
  const out = bank.flatMap(questionProblems)
  const seen = new Set<string>()
  for (const q of bank) {
    if (seen.has(q.id)) out.push(`duplicate question id "${q.id}"`)
    seen.add(q.id)
  }
  const topicIds = new Set(topics.map((t) => t.id))
  for (const t of topics) {
    if (!fileIds.includes(t.id)) out.push(`topic "${t.id}" has no file content/quiz/${t.id}.en.yaml`)
    const n = bank.filter((q) => q.topicId === t.id).length
    if (n < minPerTopic) out.push(`topic "${t.id}" has ${n} questions, needs at least ${minPerTopic}`)
  }
  for (const f of fileIds) if (!topicIds.has(f)) out.push(`content/quiz/${f}.en.yaml is not listed in topics.yaml`)
  return out
}

/** Share of questions whose correct option is strictly longer than each of the other three. */
export function longestCorrectShare(bank: QuizQuestion[]): number {
  if (bank.length === 0) return 0
  const longest = bank.filter((q) => {
    const c = q.options.find((o) => o.correct)!.text.length
    return q.options.every((o) => o.correct || o.text.length < c)
  }).length
  return longest / bank.length
}
```

- [ ] **Step 6: Run the rule tests.**

Run: `npx vitest run src/content/quiz.test.ts -t "questionProblems|bankProblems|longestCorrectShare"`
Expected: PASS. The "shipped bank" tests still fail because there is no content yet.

- [ ] **Step 7: Write `content/quiz/topics.yaml`**

```yaml
- id: csharp-language
  title: C# language
- id: clr-memory
  title: CLR & memory
- id: async-concurrency
  title: Async & concurrency
- id: collections-linq
  title: Collections & LINQ
- id: aspnet-core
  title: ASP.NET Core
- id: efcore-data
  title: EF Core & data
- id: architecture-design
  title: Architecture & design
- id: testing
  title: Testing
- id: web-distributed
  title: Web APIs & distributed systems
- id: security-performance
  title: Security & performance
```

- [ ] **Step 8: Author the 20 seed questions**, 2 per topic file. They follow the shape and rules of spec §3.2, at senior level for .NET 8/10. **At least 2 must be `expectedOutput` questions**, in different topics. Good candidates are `csharp-language` (closure capture in a `for` loop vs `foreach`) and `clr-memory` (a mutable `struct` copied out of a `List<T>`). Output questions must be deterministic, single-threaded console programs, with no timing, no `Thread.Sleep`, and no hash-order dependence. Keep the correct Option *not* the longest in most questions (at most 8 of the 20). Example of the expected quality and shape (`content/quiz/async-concurrency.en.yaml`):

```yaml
- id: configureawait-false-library
  question: |
    In a general-purpose library method, why is `await stream.ReadAsync(buffer).ConfigureAwait(false)` usually recommended?
  options:
    - text: The continuation does not need the caller's synchronization context, so it avoids marshalling back to it and the deadlocks that can cause.
      correct: true
      explanation: |
        `ConfigureAwait(false)` tells the awaiter not to capture the current `SynchronizationContext` (or non-default `TaskScheduler`). Library code rarely needs the UI thread or a legacy ASP.NET request context, so skipping the capture removes a hop and prevents the classic deadlock when a caller blocks with `.Result` on a single-threaded context.
    - text: It forces `ReadAsync` to run on a thread-pool thread instead of the calling thread.
      explanation: |
        `ConfigureAwait` affects only where the code *after* the `await` resumes. It does not change how or where the awaited operation itself runs. I/O like `ReadAsync` usually uses no thread at all while pending.
    - text: It makes exceptions from `ReadAsync` be ignored instead of rethrown.
      explanation: |
        Exceptions still propagate from the `await` exactly as before. `ConfigureAwait(false)` has no effect on error handling.
    - text: It is required in ASP.NET Core, which deadlocks without it.
      explanation: |
        ASP.NET Core has no `SynchronizationContext`, so awaits there already resume on the thread pool. The advice is aimed at libraries that may be called from UI apps or legacy ASP.NET, not at ASP.NET Core itself.
```

Note how each Explanation stands alone and names no letter. An `expectedOutput` question puts the program in `code` and asks "What does this program print?". The `expectedOutput` value is the exact stdout, e.g. `"3\n3\n3"` written as a YAML block scalar:

```yaml
  code: |
    var actions = new List<Action>();
    for (var i = 0; i < 3; i++) actions.Add(() => Console.WriteLine(i));
    foreach (var a in actions) a();
  expectedOutput: |
    3
    3
    3
```

- [ ] **Step 9: Run the reviewer loop (spec §9) on all 20 questions.** Dispatch a fresh-context reviewer subagent (same model). Give it **only**: the 10 YAML files, and the rubric from spec §9 copied verbatim. Ask it for one line per question id, `OK` or `NOT OK: <reason>`, and allow it to check Microsoft Learn on the web when it is unsure. Rewrite each NOT OK question and send back **only those**. Repeat until every id is OK. Record the final round's verdict list in the commit message body (one line: `review: 20/20 OK after N rounds`).

- [ ] **Step 10: Run the content tests.**

Run: `npx vitest run src/content/quiz.test.ts`
Expected: PASS, every test.

- [ ] **Step 11: Commit**

```bash
git add content/quiz web/src/content/schema.ts web/src/content/quiz.ts web/src/content/quizRules.ts web/src/content/quiz.test.ts
git commit -m "content(quiz): topics, schema, content rules and 20 reviewed seed questions"
```

---

### Task 2: Leitner and run logic (pure)

**Files:**
- Create: `web/src/quiz/leitner.ts`, `web/src/quiz/run.ts`
- Test: `web/src/quiz/leitner.test.ts`, `web/src/quiz/run.test.ts`

**Interfaces:**
- Consumes: `QuizQuestion`, `QuizOption`, `QuizTopic` from `web/src/content/quiz.ts` (Task 1).
- Produces:
  - `type Box = 1|2|3|4|5`; `interface BoxRecord { questionId: string; box: Box; lastAnsweredAt: string }`
  - `BOX_WAIT_DAYS: Record<Box, number>`; `nextBox(prev: Box | undefined, correct: boolean): Box`
  - `dueAtMs(r: BoxRecord): number`; `type QuestionState = 'new'|'due'|'waiting'`; `stateOf(r: BoxRecord | undefined, now: Date): QuestionState`
  - `shuffle<T>(xs: readonly T[], rng: () => number): T[]`
  - `selectQuiz(ids: readonly string[], boxes: ReadonlyMap<string, BoxRecord>, count: number, now: Date, rng: () => number): string[]`
  - `run.ts`: `interface RunQuestion { question: QuizQuestion; topicTitle: string; options: QuizOption[] }`; `type TopicSelection = 'all' | string[]`; `interface StartedRun { questions: RunQuestion[]; topics: TopicSelection }`; `interface AnswerRecord { questionId: string; topicId: string; correct: boolean }`
  - `poolFor(bank: QuizQuestion[], topics: TopicSelection): QuizQuestion[]`
  - `pickRun(bank, topics: TopicSelection, count: number, boxes, now: Date, rng): StartedRun`
  - `topicBreakdown(answers: AnswerRecord[], topics: QuizTopic[]): { topicId: string; title: string; correct: number; total: number }[]`

- [ ] **Step 1: Write the failing tests** `web/src/quiz/leitner.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BOX_WAIT_DAYS, dueAtMs, nextBox, selectQuiz, shuffle, stateOf, type BoxRecord } from './leitner'

const DAY = 86_400_000
const NOW = new Date('2026-11-06T12:00:00.000Z')
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString()
const rec = (questionId: string, box: BoxRecord['box'], daysAgo: number): BoxRecord => ({ questionId, box, lastAnsweredAt: ago(daysAgo) })
const zero = () => 0

describe('nextBox', () => {
  it('puts a New question in Box 2 when right and Box 1 when wrong', () => {
    expect(nextBox(undefined, true)).toBe(2)
    expect(nextBox(undefined, false)).toBe(1)
  })
  it('moves up one when right, capped at 5, and back to 1 when wrong', () => {
    expect(nextBox(1, true)).toBe(2)
    expect(nextBox(4, true)).toBe(5)
    expect(nextBox(5, true)).toBe(5)
    expect(nextBox(5, false)).toBe(1)
  })
})

describe('stateOf', () => {
  it('waits 1, 3, 7, 16, 35 days', () => expect(BOX_WAIT_DAYS).toEqual({ 1: 1, 2: 3, 3: 7, 4: 16, 5: 35 }))
  it('is new without a record', () => expect(stateOf(undefined, NOW)).toBe('new'))
  it('is due exactly when the wait has passed, waiting just before', () => {
    expect(stateOf(rec('q', 3, 7), NOW)).toBe('due')
    expect(stateOf({ questionId: 'q', box: 3, lastAnsweredAt: new Date(NOW.getTime() - 7 * DAY + 1).toISOString() }, NOW)).toBe('waiting')
  })
  it('computes the due time from the Box wait', () => {
    expect(dueAtMs(rec('q', 1, 0))).toBe(NOW.getTime() + DAY)
  })
})

describe('shuffle', () => {
  it('returns a permutation and leaves the input alone', () => {
    const xs = [1, 2, 3, 4, 5]
    const out = shuffle(xs, Math.random)
    expect([...out].sort()).toEqual(xs)
    expect(xs).toEqual([1, 2, 3, 4, 5])
  })
})

describe('selectQuiz', () => {
  const ids = ['due-old', 'due-new', 'fresh-1', 'fresh-2', 'wait-soon', 'wait-late']
  const boxes = new Map<string, BoxRecord>([
    ['due-old', rec('due-old', 1, 10)], // 9 days overdue
    ['due-new', rec('due-new', 1, 2)], // 1 day overdue
    ['wait-soon', rec('wait-soon', 2, 2)], // due in 1 day
    ['wait-late', rec('wait-late', 5, 0)], // due in 35 days
  ])
  const pick = (count: number) => [...selectQuiz(ids, boxes, count, NOW, zero)].sort()

  it('takes Due questions first, most overdue first', () => expect(pick(1)).toEqual(['due-old']))
  it('then New ones', () => expect(pick(4)).toEqual(['due-new', 'due-old', 'fresh-1', 'fresh-2']))
  it('then the waiting ones closest to Due', () => expect(pick(5)).toEqual(['due-new', 'due-old', 'fresh-1', 'fresh-2', 'wait-soon']))
  it('never returns more than exist', () => expect(selectQuiz(ids, boxes, 50, NOW, zero)).toHaveLength(6))
  it('ignores records for ids that are not in the pool', () => {
    const extra = new Map(boxes).set('gone', rec('gone', 1, 99))
    expect(selectQuiz(ids, extra, 6, NOW, zero)).not.toContain('gone')
  })
})
```

`web/src/quiz/run.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/quiz`
Expected: FAIL. The modules don't exist.

- [ ] **Step 3: Write `web/src/quiz/leitner.ts`**

```ts
export type Box = 1 | 2 | 3 | 4 | 5
export interface BoxRecord {
  questionId: string
  box: Box
  /** ISO timestamp of the last submitted answer. */
  lastAnsweredAt: string
}
export type QuestionState = 'new' | 'due' | 'waiting'

export const BOX_WAIT_DAYS: Record<Box, number> = { 1: 1, 2: 3, 3: 7, 4: 16, 5: 35 }
const DAY_MS = 86_400_000

/** Spec §4: a New question goes to Box 2 when right, Box 1 when wrong; then +1 (max 5) when right, 1 when wrong. */
export function nextBox(prev: Box | undefined, correct: boolean): Box {
  if (!correct) return 1
  if (prev === undefined) return 2
  return Math.min(5, prev + 1) as Box
}

export function dueAtMs(r: BoxRecord): number {
  return Date.parse(r.lastAnsweredAt) + BOX_WAIT_DAYS[r.box] * DAY_MS
}

export function stateOf(r: BoxRecord | undefined, now: Date): QuestionState {
  if (!r) return 'new'
  return now.getTime() >= dueAtMs(r) ? 'due' : 'waiting'
}

/** Fisher–Yates on a copy. */
export function shuffle<T>(xs: readonly T[], rng: () => number): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Spec §4 selection: Due (most overdue first), then New (random), then waiting (closest to Due first); the result is shuffled. */
export function selectQuiz(
  ids: readonly string[],
  boxes: ReadonlyMap<string, BoxRecord>,
  count: number,
  now: Date,
  rng: () => number,
): string[] {
  const due: BoxRecord[] = []
  const waiting: BoxRecord[] = []
  const fresh: string[] = []
  for (const id of ids) {
    const r = boxes.get(id)
    const s = stateOf(r, now)
    if (s === 'new') fresh.push(id)
    else (s === 'due' ? due : waiting).push(r!)
  }
  const byDue = (a: BoxRecord, b: BoxRecord) => dueAtMs(a) - dueAtMs(b)
  const ordered = [
    ...due.sort(byDue).map((r) => r.questionId),
    ...shuffle(fresh, rng),
    ...waiting.sort(byDue).map((r) => r.questionId),
  ]
  return shuffle(ordered.slice(0, Math.max(0, count)), rng)
}
```

- [ ] **Step 4: Write `web/src/quiz/run.ts`**

```ts
import type { QuizOption, QuizQuestion, QuizTopic } from '../content/quiz'
import { getQuizTopics } from '../content/quiz'
import { selectQuiz, shuffle, type BoxRecord } from './leitner'

export type TopicSelection = 'all' | string[]
export interface RunQuestion {
  question: QuizQuestion
  topicTitle: string
  /** The four Options in display order (A–D). */
  options: QuizOption[]
}
export interface StartedRun {
  questions: RunQuestion[]
  topics: TopicSelection
}
export interface AnswerRecord {
  questionId: string
  topicId: string
  correct: boolean
}

export function poolFor(bank: QuizQuestion[], topics: TopicSelection): QuizQuestion[] {
  return topics === 'all' ? bank : bank.filter((q) => topics.includes(q.topicId))
}

/** Picks `count` questions from the selected topics (spec §4) and shuffles each one's Options. */
export function pickRun(
  bank: QuizQuestion[],
  topics: TopicSelection,
  count: number,
  boxes: ReadonlyMap<string, BoxRecord>,
  now: Date,
  rng: () => number,
  topicList: QuizTopic[] = getQuizTopics(),
): StartedRun {
  const pool = poolFor(bank, topics)
  const byId = new Map(pool.map((q) => [q.id, q]))
  const titles = new Map(topicList.map((t) => [t.id, t.title]))
  const questions = selectQuiz([...byId.keys()], boxes, count, now, rng).map((id) => {
    const question = byId.get(id)!
    return { question, topicTitle: titles.get(question.topicId) ?? question.topicId, options: shuffle(question.options, rng) }
  })
  return { questions, topics }
}

/** This Quiz's score per Quiz Topic, in topic order; topics without answers are left out. Shown, never stored. */
export function topicBreakdown(answers: AnswerRecord[], topics: QuizTopic[]) {
  return topics
    .map((t) => {
      const mine = answers.filter((a) => a.topicId === t.id)
      return { topicId: t.id, title: t.title, correct: mine.filter((a) => a.correct).length, total: mine.length }
    })
    .filter((r) => r.total > 0)
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/quiz`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/quiz
git commit -m "feat(quiz): Leitner boxes, question selection and run building"
```

---

### Task 3: Storage: DB v3, quizStore, export/import v3, hooks

**Files:**
- Modify: `web/src/progress/db.ts`, `web/src/progress/exportImport.ts`, `web/src/progress/useProgress.ts`, `web/src/locales/en/progress.json` (the `backup.confirm` text)
- Create: `web/src/quiz/quizStore.ts`
- Test: `web/src/quiz/quizStore.test.ts`, and add to `web/src/progress/progress.test.ts`

**Interfaces:**
- Consumes: `Box`, `BoxRecord`, `nextBox` (Task 2); `TopicSelection` (Task 2).
- Produces:
  - `interface QuizResult { id: string; takenAt: string; topics: TopicSelection; total: number; correct: number }`
  - `interface BoxChange { from: Box | undefined; to: Box }`
  - `getBoxes(): Promise<Map<string, BoxRecord>>`
  - `recordAnswer(questionId: string, correct: boolean, now: Date): Promise<BoxChange>`
  - `saveQuizResult(r: Omit<QuizResult, 'id'>): Promise<QuizResult>`
  - `listQuizResults(): Promise<QuizResult[]>` (newest first)
  - hooks `useQuizResults(): Stored<QuizResult[]>`, `useQuizBoxes(): Stored<Map<string, BoxRecord>>`

- [ ] **Step 1: Write the failing tests** `web/src/quiz/quizStore.test.ts`:

```ts
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '../progress/db'
import { getBoxes, listQuizResults, recordAnswer, saveQuizResult } from './quizStore'

beforeEach(async () => {
  await resetDbForTests()
})

describe('quizStore', () => {
  it('moves a question through Boxes and reports each change', async () => {
    const t = new Date('2026-11-06T10:00:00.000Z')
    expect(await recordAnswer('q1', true, t)).toEqual({ from: undefined, to: 2 })
    expect(await recordAnswer('q1', true, t)).toEqual({ from: 2, to: 3 })
    expect(await recordAnswer('q1', false, t)).toEqual({ from: 3, to: 1 })
    expect((await getBoxes()).get('q1')).toEqual({ questionId: 'q1', box: 1, lastAnsweredAt: t.toISOString() })
  })
  it('lists Quiz Results newest first', async () => {
    await saveQuizResult({ takenAt: '2026-11-01T00:00:00.000Z', topics: 'all', total: 5, correct: 3 })
    const later = await saveQuizResult({ takenAt: '2026-11-02T00:00:00.000Z', topics: ['testing'], total: 10, correct: 9 })
    const list = await listQuizResults()
    expect(list.map((r) => r.takenAt)).toEqual(['2026-11-02T00:00:00.000Z', '2026-11-01T00:00:00.000Z'])
    expect(list[0]).toEqual(later)
    expect(later.id).toMatch(/.+/)
  })
})
```

Append to `web/src/progress/progress.test.ts` (inside the file, as a new `describe`; add `recordAnswer, saveQuizResult, getBoxes, listQuizResults` to the imports from `'../quiz/quizStore'`):

```ts
describe('export/import of quiz data', () => {
  it('round-trips Boxes and Quiz Results in a v3 export', async () => {
    await recordAnswer('q1', true, new Date('2026-11-06T10:00:00.000Z'))
    await saveQuizResult({ takenAt: '2026-11-06T10:05:00.000Z', topics: 'all', total: 5, correct: 4 })
    const file = await exportProgress()
    expect(file.schemaVersion).toBe(3)
    await resetDbForTests()
    expect((await importProgress(JSON.stringify(file))).ok).toBe(true)
    expect((await getBoxes()).get('q1')?.box).toBe(2)
    expect((await listQuizResults())[0]).toMatchObject({ total: 5, correct: 4, topics: 'all' })
  })
  it('clears quiz data when importing a v2 file', async () => {
    await recordAnswer('q1', true, new Date())
    const v2 = { app: 'design-patterns-trainer', schemaVersion: 2, exportedAt: T, progress: [], drafts: [], examSessions: [] }
    expect((await importProgress(JSON.stringify(v2))).ok).toBe(true)
    expect((await getBoxes()).size).toBe(0)
  })
  it('rejects a v3 file without its quiz arrays', async () => {
    const bad = { app: 'design-patterns-trainer', schemaVersion: 3, exportedAt: T, progress: [], drafts: [], examSessions: [] }
    expect(await importProgress(JSON.stringify(bad))).toEqual({ ok: false, reason: 'notAnExport' })
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/quiz/quizStore.test.ts src/progress/progress.test.ts`
Expected: FAIL. `./quizStore` is missing.

- [ ] **Step 3: DB v3.** In `web/src/progress/db.ts`:
  - set `export const DB_VERSION = 3`;
  - add `import type { BoxRecord } from '../quiz/leitner'` and `import type { QuizResult } from '../quiz/quizStore'`;
  - extend `TrainerDB` with:

```ts
  quizBoxes: { key: string; value: BoxRecord }
  quizResults: { key: string; value: QuizResult }
```

  and in `upgrade` add after the `oldVersion < 2` line:

```ts
        if (oldVersion < 3) {
          db.createObjectStore('quizBoxes', { keyPath: 'questionId' })
          db.createObjectStore('quizResults', { keyPath: 'id' })
        }
```

- [ ] **Step 4: Write `web/src/quiz/quizStore.ts`**

```ts
import { getDb } from '../progress/db'
import { notifyProgressChanged } from '../progress/progressStore'
import { nextBox, type Box, type BoxRecord } from './leitner'
import type { TopicSelection } from './run'

export interface QuizResult {
  id: string
  takenAt: string
  topics: TopicSelection
  total: number
  correct: number
}
export interface BoxChange {
  from: Box | undefined
  to: Box
}

export async function getBoxes(): Promise<Map<string, BoxRecord>> {
  const all = await (await getDb()).getAll('quizBoxes')
  return new Map(all.map((r) => [r.questionId, r]))
}

/** Applies one submitted answer to the question's Box (spec §4), in one transaction. */
export async function recordAnswer(questionId: string, correct: boolean, now: Date): Promise<BoxChange> {
  const db = await getDb()
  const tx = db.transaction('quizBoxes', 'readwrite')
  const prev = await tx.store.get(questionId)
  const to = nextBox(prev?.box, correct)
  await tx.store.put({ questionId, box: to, lastAnsweredAt: now.toISOString() })
  await tx.done
  notifyProgressChanged()
  return { from: prev?.box, to }
}

export async function saveQuizResult(r: Omit<QuizResult, 'id'>): Promise<QuizResult> {
  const result: QuizResult = { id: crypto.randomUUID(), ...r }
  await (await getDb()).put('quizResults', result)
  notifyProgressChanged()
  return result
}

/** Newest first. */
export async function listQuizResults(): Promise<QuizResult[]> {
  const all = await (await getDb()).getAll('quizResults')
  return all.sort((a, b) => b.takenAt.localeCompare(a.takenAt))
}
```

- [ ] **Step 5: Export/import v3.** In `web/src/progress/exportImport.ts`:
  - Imports: add `import type { BoxRecord } from '../quiz/leitner'` and `import type { QuizResult } from '../quiz/quizStore'`.
  - `ProgressExport`: `schemaVersion: 3`, and add `quizBoxes: BoxRecord[]` and `quizResults: QuizResult[]`.
  - Add the schemas after `examSessions`:

```ts
const quizBox = z.strictObject({ questionId: z.string().min(1), box: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]), lastAnsweredAt: isoString })
const quizResult = z.strictObject({
  id: z.string().min(1),
  takenAt: isoString,
  topics: z.union([z.literal('all'), z.array(z.string())]),
  total: z.number().int().min(1),
  correct: z.number().int().min(0),
}).refine((r) => r.correct <= r.total, 'correct cannot exceed total')
```

  - `exportSchema`: `schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)])`, plus `quizBoxes: z.array(quizBox).optional()` and `quizResults: z.array(quizResult).optional()`.
  - `exportProgress`: open the transaction on `['progress', 'drafts', 'examSessions', 'quizBoxes', 'quizResults']`, read all five, and return `schemaVersion: 3` with `quizBoxes` and `quizResults`.
  - `importProgress`:
    - accept `version !== 1 && version !== 2 && version !== 3` → `unsupportedVersion`;
    - change the session rule to `if (version >= 2 && parsed.data.examSessions === undefined) return notAnExport`;
    - add `if (version === 3 && (parsed.data.quizBoxes === undefined || parsed.data.quizResults === undefined)) return { ok: false, reason: 'notAnExport' }`;
    - set `const quizBoxes = version === 3 ? parsed.data.quizBoxes! : []` (and the same for `quizResults`), and set `examSessions` from `version >= 2`;
    - the write transaction covers all five stores: clear all five, then put all five;
    - update the doc comment to "Accepts v1, v2 and v3; v1/v2 files clear the Quiz stores."

  In `web/src/locales/en/progress.json`, set `backup.confirm` to `"Importing replaces your current progress, saved code, exam history and quiz history on this device."`.

- [ ] **Step 6: Hooks.** In `web/src/progress/useProgress.ts` add:

```ts
import { getBoxes, listQuizResults, type QuizResult } from '../quiz/quizStore'
import type { BoxRecord } from '../quiz/leitner'

export function useQuizResults(): Stored<QuizResult[]> {
  return useStored(listQuizResults, 'quizResults')
}

export function useQuizBoxes(): Stored<Map<string, BoxRecord>> {
  return useStored(getBoxes, 'quizBoxes')
}
```

- [ ] **Step 7: Run the tests and fix any existing assertion of `schemaVersion: 2` or of the old confirm text.**

Run: `npx vitest run src/quiz src/progress src/features/progress`
Expected: PASS. Where an existing test expected `schemaVersion: 2` from `exportProgress` or the old `backup.confirm` text, update it to `3` or to the new text. Do not change what those tests check otherwise.

- [ ] **Step 8: Commit**

```bash
git add web/src/progress web/src/quiz/quizStore.ts web/src/quiz/quizStore.test.ts web/src/locales/en/progress.json
git commit -m "feat(quiz): store Boxes and Quiz Results (DB v3, export v3)"
```

---

### Task 4: Quiz settings in localStorage

**Files:**
- Create: `web/src/quiz/settings.ts`
- Test: `web/src/quiz/settings.test.ts`

**Interfaces:**
- Consumes: `TopicSelection` (Task 2).
- Produces:
  - `QUIZ_SETTINGS_KEY = 'dpt.quiz.settings'`, `PRESET_LENGTHS = [5, 10, 25] as const`, `MAX_QUIZ_LENGTH = 100`
  - `type QuizLength = 5 | 10 | 25 | 'custom'`; `interface QuizSettings { length: QuizLength; custom: number; topics: TopicSelection }`; `DEFAULT_QUIZ_SETTINGS`
  - `loadQuizSettings(topicIds: ReadonlySet<string>): QuizSettings`, `saveQuizSettings(s: QuizSettings): void`, `requestedLength(s: QuizSettings): number`
  - `useQuizSettings(topicIds: ReadonlySet<string>): [QuizSettings, (s: QuizSettings) => void]`

- [ ] **Step 1: Write the failing test** `web/src/quiz/settings.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_QUIZ_SETTINGS, loadQuizSettings, QUIZ_SETTINGS_KEY, requestedLength, saveQuizSettings } from './settings'

const topics = new Set(['testing', 'clr-memory'])
beforeEach(() => localStorage.clear())

describe('quiz settings', () => {
  it('defaults to 10 questions from all topics', () => {
    expect(loadQuizSettings(topics)).toEqual(DEFAULT_QUIZ_SETTINGS)
    expect(DEFAULT_QUIZ_SETTINGS).toEqual({ length: 10, custom: 15, topics: 'all' })
  })
  it('round-trips through localStorage', () => {
    saveQuizSettings({ length: 'custom', custom: 42, topics: ['testing'] })
    expect(loadQuizSettings(topics)).toEqual({ length: 'custom', custom: 42, topics: ['testing'] })
    expect(requestedLength(loadQuizSettings(topics))).toBe(42)
  })
  it('drops unknown topics and falls back to all when none are left', () => {
    saveQuizSettings({ length: 5, custom: 15, topics: ['gone'] })
    expect(loadQuizSettings(topics).topics).toBe('all')
  })
  it('ignores garbage and out-of-range values', () => {
    localStorage.setItem(QUIZ_SETTINGS_KEY, '{not json')
    expect(loadQuizSettings(topics)).toEqual(DEFAULT_QUIZ_SETTINGS)
    localStorage.setItem(QUIZ_SETTINGS_KEY, JSON.stringify({ length: 7, custom: 500, topics: 'all' }))
    expect(loadQuizSettings(topics)).toEqual(DEFAULT_QUIZ_SETTINGS)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/quiz/settings.test.ts`
Expected: FAIL. The module is missing.

- [ ] **Step 3: Write `web/src/quiz/settings.ts`**

```ts
import { useCallback, useState } from 'react'
import { z } from 'zod'
import type { TopicSelection } from './run'

export const QUIZ_SETTINGS_KEY = 'dpt.quiz.settings'
export const PRESET_LENGTHS = [5, 10, 25] as const
export const MAX_QUIZ_LENGTH = 100

export type QuizLength = (typeof PRESET_LENGTHS)[number] | 'custom'
export interface QuizSettings {
  length: QuizLength
  /** The Custom count, kept even while a preset is chosen. */
  custom: number
  topics: TopicSelection
}
export const DEFAULT_QUIZ_SETTINGS: QuizSettings = { length: 10, custom: 15, topics: 'all' }

const stored = z.strictObject({
  length: z.union([z.literal(5), z.literal(10), z.literal(25), z.literal('custom')]),
  custom: z.number().int().min(1).max(MAX_QUIZ_LENGTH),
  topics: z.union([z.literal('all'), z.array(z.string())]),
})

/** The remembered settings (a device preference, like the theme). Unknown topics are dropped. */
export function loadQuizSettings(topicIds: ReadonlySet<string>): QuizSettings {
  try {
    const raw = localStorage.getItem(QUIZ_SETTINGS_KEY)
    if (raw === null) return DEFAULT_QUIZ_SETTINGS
    const s = stored.safeParse(JSON.parse(raw))
    if (!s.success) return DEFAULT_QUIZ_SETTINGS
    const topics = s.data.topics === 'all' ? 'all' : s.data.topics.filter((t) => topicIds.has(t))
    return { ...s.data, topics: topics === 'all' || topics.length === 0 ? 'all' : topics }
  } catch {
    return DEFAULT_QUIZ_SETTINGS
  }
}

export function saveQuizSettings(s: QuizSettings): void {
  try {
    localStorage.setItem(QUIZ_SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // storage full or blocked: the setting just isn't remembered
  }
}

export function requestedLength(s: QuizSettings): number {
  return s.length === 'custom' ? s.custom : s.length
}

export function useQuizSettings(topicIds: ReadonlySet<string>): [QuizSettings, (s: QuizSettings) => void] {
  const [settings, setState] = useState(() => loadQuizSettings(topicIds))
  const set = useCallback((s: QuizSettings) => {
    setState(s)
    saveQuizSettings(s)
  }, [])
  return [settings, set]
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/quiz/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/quiz/settings.ts web/src/quiz/settings.test.ts
git commit -m "feat(quiz): remember length and topics on this device"
```

---

### Task 5: QuizText and QuizRun (the answering flow)

**Files:**
- Create: `web/src/features/quiz/QuizText.tsx`, `web/src/features/quiz/QuizRun.tsx`, `web/src/locales/en/quiz.json`
- Modify: `web/src/i18n/index.ts`, `web/src/styles/base.css`
- Test: `web/src/features/quiz/QuizText.test.tsx`, `web/src/features/quiz/QuizRun.test.tsx`

**Interfaces:**
- Consumes: `RunQuestion`, `AnswerRecord` (Task 2); `recordAnswer`, `BoxChange` (Task 3); `inlineCode` from `web/src/features/exercise/inlineCode.tsx`.
- Produces:
  - `QuizText({ text }: { text: string })`, `QuizCode({ code }: { code: string })`
  - `QuizRun({ questions, onFinish, onQuit }: { questions: RunQuestion[]; onFinish(answers: AnswerRecord[]): void; onQuit(): void })`
  - the whole `quiz` i18n namespace (later tasks use its `setup.*`, `history.*` and `end.*` keys)

- [ ] **Step 1: Write the strings** `web/src/locales/en/quiz.json`:

```json
{
  "title": "Quiz",
  "intro": "Senior .NET interview questions. The ones you miss come back sooner.",
  "setup": {
    "length": "Length",
    "custom": "Custom",
    "customLabel": "Number of questions",
    "customHint": "1 to {{max}}",
    "customInvalid": "Enter a whole number from 1 to {{max}}.",
    "topics": "Topics",
    "allTopics": "All topics",
    "chooseTopics": "Choose topics",
    "topicCounts": "{{due}} due · {{fresh}} new",
    "noTopic": "Choose at least one topic.",
    "capped": "These topics have {{count}} questions, so the quiz uses all of them.",
    "start": "Start quiz",
    "loading": "Loading your question history…",
    "boxesError": "Your question history can't be read in this browser, so questions are picked at random."
  },
  "history": {
    "title": "Quiz history",
    "loading": "Loading your quizzes…",
    "readError": "Quiz history can't be read in this browser. Reload the page to try again.",
    "empty": "No quizzes yet.",
    "all": "All topics",
    "score": "{{correct}} / {{total}}",
    "percent": "{{percent}}%"
  },
  "run": {
    "progress": "Question {{index}} of {{total}}",
    "options": "Options",
    "submit": "Submit",
    "next": "Next question",
    "finish": "See results",
    "correct": "Correct.",
    "wrong": "Not quite.",
    "yourAnswerCorrect": "Your answer · correct",
    "yourAnswerWrong": "Your answer · wrong",
    "correctAnswer": "Correct answer",
    "boxNew": "New → Box {{to}}",
    "boxMove": "Box {{from}} → {{to}}",
    "saveFailed": "This answer couldn't be saved, so it won't change when the question comes back.",
    "keys": "1–4 select · Enter submits · Esc quits",
    "quit": "Quit quiz",
    "quitConfirm": "Quit this quiz? Your answers so far still count toward when questions come back, but no result is saved.",
    "quitYes": "Quit",
    "quitNo": "Keep going"
  },
  "end": {
    "title": "Quiz complete",
    "score": "{{correct}} / {{total}} ({{percent}}%)",
    "byTopic": "By topic",
    "topicScore": "{{correct}} / {{total}}",
    "newQuiz": "New quiz",
    "back": "Back",
    "saveFailed": "This result couldn't be saved to your quiz history."
  }
}
```

In `web/src/i18n/index.ts`: add `import quiz from '../locales/en/quiz.json'`, append `'quiz'` to `namespaces`, and add `quiz` to `resources.en`.

- [ ] **Step 2: Write the failing tests.** `web/src/features/quiz/QuizText.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { QuizText } from './QuizText'

it('renders paragraphs, inline code and fenced code blocks', () => {
  const { container } = render(<QuizText text={'First `x` here.\n\nSecond.\n\n```csharp\nvar a = 1;\n```\nAfter.'} />)
  expect(container.querySelectorAll('p')).toHaveLength(3)
  expect(screen.getByText('x').tagName).toBe('CODE')
  expect(container.querySelector('pre.quiz-code code')?.textContent).toBe('var a = 1;')
})
```

`web/src/features/quiz/QuizRun.test.tsx`:

```tsx
import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDbForTests } from '../../progress/db'
import type { RunQuestion } from '../../quiz/run'
import { QuizRun } from './QuizRun'

const rq = (id: string): RunQuestion => ({
  question: { id, topicId: 'testing', question: `Question ${id}?`, options: [] },
  topicTitle: 'Testing',
  options: [
    { text: `${id} wrong one`, correct: false, explanation: `Why ${id} one is wrong.` },
    { text: `${id} right`, correct: true, explanation: `Why ${id} right is right.` },
    { text: `${id} wrong two`, correct: false, explanation: `Why ${id} two is wrong.` },
    { text: `${id} wrong three`, correct: false, explanation: `Why ${id} three is wrong.` },
  ],
})
const key = (k: string, target: Element = document.body) => fireEvent.keyDown(target, { key: k })

beforeEach(async () => {
  await resetDbForTests()
})

function setup() {
  const onFinish = vi.fn()
  const onQuit = vi.fn()
  render(<QuizRun questions={[rq('q1'), rq('q2')]} onFinish={onFinish} onQuit={onQuit} />)
  return { onFinish, onQuit }
}

describe('QuizRun', () => {
  it('selects with 1–4, ignores Enter with nothing selected, then locks and reveals all four explanations', async () => {
    setup()
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
    key('Enter')
    expect(screen.queryByText(/Why q1/)).not.toBeInTheDocument()
    key('3')
    expect(screen.getByRole('radio', { name: /q1 wrong two/ })).toBeChecked()
    key('2')
    expect(screen.getByRole('radio', { name: /q1 right/ })).toBeChecked()
    key('Enter')
    expect(await screen.findByText('Correct.')).toBeInTheDocument()
    expect(screen.getAllByText(/^Why q1/)).toHaveLength(4)
    expect(screen.getByText('Your answer · correct')).toBeInTheDocument()
    expect(await screen.findByText('New → Box 2')).toBeInTheDocument()
    key('1')
    expect(screen.getByRole('radio', { name: /q1 right/ })).toBeChecked()
    for (const r of screen.getAllByRole('radio')) expect(r).toBeDisabled()
  })

  it('marks a wrong answer and shows the correct one', async () => {
    setup()
    key('1')
    key('Enter')
    expect(await screen.findByText('Not quite.')).toBeInTheDocument()
    expect(screen.getByText('Your answer · wrong')).toBeInTheDocument()
    expect(screen.getByText('Correct answer')).toBeInTheDocument()
  })

  it('moves on with Enter and reports every answer at the end', async () => {
    const { onFinish } = setup()
    key('2')
    key('Enter')
    await screen.findByText('Correct.')
    key('Enter')
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
    key('1')
    key('Enter')
    await screen.findByText('Not quite.')
    key('Enter')
    expect(onFinish).toHaveBeenCalledWith([
      { questionId: 'q1', topicId: 'testing', correct: true },
      { questionId: 'q2', topicId: 'testing', correct: false },
    ])
  })

  it('asks before quitting on Esc', () => {
    const { onQuit } = setup()
    key('Escape')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    key('Escape')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    key('Escape')
    fireEvent.click(screen.getByRole('button', { name: 'Quit' }))
    expect(onQuit).toHaveBeenCalled()
  })

  it('ignores the number keys while typing in a text field', () => {
    setup()
    const input = document.createElement('input')
    document.body.append(input)
    key('2', input)
    expect(screen.getByRole('radio', { name: /q1 right/ })).not.toBeChecked()
    input.remove()
  })
})
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/features/quiz`
Expected: FAIL. The components are missing.

- [ ] **Step 4: Write `web/src/features/quiz/QuizText.tsx`**

```tsx
import type { ReactNode } from 'react'
import { inlineCode } from '../exercise/inlineCode'

const FENCE = /```[\w#+-]*\n([\s\S]*?)```/g

export function QuizCode({ code }: { code: string }) {
  return (
    <pre className="quiz-code">
      <code>{code.replace(/\n$/, '')}</code>
    </pre>
  )
}

/** Quiz content prose: blank-line paragraphs with `inline code`, plus fenced code blocks shown read-only. */
export function QuizText({ text }: { text: string }) {
  const out: ReactNode[] = []
  let key = 0
  const prose = (s: string) => {
    for (const para of s.split(/\n\s*\n/)) {
      const p = para.trim()
      if (p) out.push(<p key={key++}>{inlineCode(p)}</p>)
    }
  }
  let last = 0
  for (const m of text.matchAll(FENCE)) {
    prose(text.slice(last, m.index))
    out.push(<QuizCode key={key++} code={m[1]} />)
    last = m.index + m[0].length
  }
  prose(text.slice(last))
  return <>{out}</>
}
```

- [ ] **Step 5: Write `web/src/features/quiz/QuizRun.tsx`**

```tsx
import { Check, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { recordAnswer, type BoxChange } from '../../quiz/quizStore'
import type { AnswerRecord, RunQuestion } from '../../quiz/run'
import { inlineCode } from '../exercise/inlineCode'
import { QuizCode, QuizText } from './QuizText'

const LETTERS = ['A', 'B', 'C', 'D'] as const

interface Locked {
  index: number
  chosen: number
  correct: boolean
  change: BoxChange | null
  saveFailed: boolean
}

/** Keys belong to a text field while one has focus (radios are fine: they are the options). */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLInputElement) return target.type !== 'radio' && target.type !== 'checkbox'
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}

export function QuizRun({ questions, onFinish, onQuit }: { questions: RunQuestion[]; onFinish(answers: AnswerRecord[]): void; onQuit(): void }) {
  const { t } = useTranslation('quiz')
  const ids = useId()
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [locked, setLocked] = useState<Locked | null>(null)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [confirming, setConfirming] = useState(false)
  const finished = useRef(false)

  const current = questions[index]
  const last = index === questions.length - 1

  function submit() {
    if (selected === null || locked) return
    const i = index
    const correct = current.options[selected].correct
    setLocked({ index: i, chosen: selected, correct, change: null, saveFailed: false })
    setAnswers((a) => [...a, { questionId: current.question.id, topicId: current.question.topicId, correct }])
    recordAnswer(current.question.id, correct, new Date()).then(
      (change) => setLocked((l) => (l?.index === i ? { ...l, change } : l)),
      () => setLocked((l) => (l?.index === i ? { ...l, saveFailed: true } : l)),
    )
  }

  function next() {
    if (!locked) return
    if (last) {
      if (!finished.current) {
        finished.current = true
        onFinish(answers)
      }
      return
    }
    setIndex(index + 1)
    setSelected(null)
    setLocked(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      if (e.key === 'Escape') {
        e.preventDefault()
        setConfirming((c) => !c)
        return
      }
      if (confirming || typing(e.target)) return
      if (/^[1-4]$/.test(e.key)) {
        if (!locked) {
          e.preventDefault()
          setSelected(Number(e.key) - 1)
        }
        return
      }
      if (e.key === 'Enter') {
        // also stops a focused button from clicking a second time
        e.preventDefault()
        if (locked) next()
        else submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const qid = `${ids}-q`
  const boxText = (c: BoxChange) => (c.from === undefined ? t('run.boxNew', { to: c.to }) : t('run.boxMove', { from: c.from, to: c.to }))

  return (
    <section className="panel quiz-run" aria-labelledby={qid}>
      <div className="prog-panel-body">
        <div className="quiz-meta">
          <span>{t('run.progress', { index: index + 1, total: questions.length })}</span>
          <span className="quiz-topic">{current.topicTitle}</span>
        </div>
        <div id={qid} className="quiz-question">
          <QuizText text={current.question.question} />
          {current.question.code && <QuizCode code={current.question.code} />}
        </div>

        <div role="radiogroup" aria-labelledby={qid} className="quiz-options">
          {current.options.map((o, i) => {
            const state = !locked ? (selected === i ? 'selected' : 'open') : o.correct ? 'correct' : locked.chosen === i ? 'wrong' : 'other'
            return (
              <div key={`${index}-${i}`} className={`quiz-option is-${state}`} data-letter={LETTERS[i]}>
                <label className="quiz-choice">
                  <input
                    type="radio"
                    name={`${ids}-option`}
                    checked={locked ? locked.chosen === i : selected === i}
                    disabled={locked !== null}
                    onChange={() => setSelected(i)}
                  />
                  <span className="quiz-letter" aria-hidden="true">
                    {LETTERS[i]}
                  </span>
                  <span className="quiz-option-text">{inlineCode(o.text)}</span>
                  {locked && (o.correct || locked.chosen === i) && (
                    <span className={`quiz-verdict ${o.correct ? 'is-correct' : 'is-wrong'}`}>
                      {o.correct ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
                      {locked.chosen === i ? (o.correct ? t('run.yourAnswerCorrect') : t('run.yourAnswerWrong')) : t('run.correctAnswer')}
                    </span>
                  )}
                </label>
                {locked && (
                  <div className="quiz-explanation">
                    <QuizText text={o.explanation} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {locked && (
          <p className={`quiz-outcome ${locked.correct ? 'is-correct' : 'is-wrong'}`} role="status">
            {locked.correct ? t('run.correct') : t('run.wrong')}
            {locked.change && <span className="quiz-box">{boxText(locked.change)}</span>}
          </p>
        )}
        {locked?.saveFailed && <p className="prog-hint exam-bad">{t('run.saveFailed')}</p>}

        {confirming ? (
          <div className="quiz-confirm" role="alertdialog" aria-labelledby={`${ids}-quit`}>
            <p id={`${ids}-quit`}>{t('run.quitConfirm')}</p>
            <div className="reset-actions">
              <button type="button" className="btn btn-quiet" autoFocus onClick={() => setConfirming(false)}>
                {t('run.quitNo')}
              </button>
              <button type="button" className="btn btn-primary" onClick={onQuit}>
                {t('run.quitYes')}
              </button>
            </div>
          </div>
        ) : (
          <div className="quiz-actions">
            {locked ? (
              <button type="button" className="btn btn-primary" onClick={next}>
                {last ? t('run.finish') : t('run.next')}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={selected === null} onClick={submit}>
                {t('run.submit')}
              </button>
            )}
            <button type="button" className="btn btn-quiet" onClick={() => setConfirming(true)}>
              {t('run.quit')}
            </button>
            <span className="prog-hint quiz-keys">{t('run.keys')}</span>
          </div>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Styles.** Append to `web/src/styles/base.css`:

```css
/* ---------- Quiz ---------- */

.quiz-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 820px;
}

.quiz-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--muted);
  font-size: var(--fs-13);
}

.quiz-question {
  font-size: var(--fs-17);
  margin: var(--space-3) 0 var(--space-4);
}

.quiz-question p,
.quiz-explanation p {
  margin: 0 0 var(--space-2);
}

.quiz-code {
  margin: 0 0 var(--space-3);
  padding: var(--space-3);
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-family: var(--font-mono);
  font-size: var(--fs-13);
  overflow-x: auto;
}

.quiz-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.quiz-option {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.quiz-option.is-selected {
  border-color: var(--accent);
}

.quiz-option.is-correct {
  border-color: var(--ok);
  border-width: 2px;
}

.quiz-option.is-wrong {
  border-color: var(--bad);
  border-width: 2px;
}

.quiz-choice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
}

.quiz-choice input {
  margin: 0;
}

.quiz-letter {
  font-family: var(--font-mono);
  font-weight: 600;
  min-width: 1.5em;
}

.quiz-option-text {
  flex: 1 1 240px;
  min-width: 0;
}

.quiz-verdict {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--fs-13);
  font-weight: 600;
}

.quiz-verdict.is-correct,
.quiz-outcome.is-correct {
  color: var(--ok);
}

.quiz-verdict.is-wrong,
.quiz-outcome.is-wrong {
  color: var(--bad);
}

.quiz-explanation {
  padding: 0 var(--space-3) var(--space-2) calc(var(--space-3) + 2.5em);
  color: var(--text);
  font-size: var(--fs-14);
}

.quiz-outcome {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin: var(--space-3) 0 0;
  font-weight: 600;
}

.quiz-box {
  color: var(--muted);
  font-weight: 400;
}

.quiz-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  margin-top: var(--space-4);
}

.quiz-actions .btn,
.quiz-confirm .btn,
.quiz-end .btn {
  min-height: 44px;
}

.quiz-confirm {
  margin-top: var(--space-4);
  padding: var(--space-3);
  border: 1px solid var(--warn);
  border-radius: var(--radius);
  background: var(--surface-2);
}

.quiz-confirm p {
  margin: 0 0 var(--space-3);
}

@media (hover: none) {
  .quiz-keys {
    display: none;
  }
}

@media (max-width: 480px) {
  .quiz-explanation {
    padding-left: var(--space-3);
  }
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/features/quiz`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add web/src/features/quiz web/src/locales/en/quiz.json web/src/i18n/index.ts web/src/styles/base.css
git commit -m "feat(quiz): answering flow with 1-4/Enter/Esc keys and full explanations"
```

---

### Task 6: QuizEnd, QuizSetup, QuizHistory, QuizPage, route and nav

**Files:**
- Create: `web/src/features/quiz/QuizEnd.tsx`, `QuizSetup.tsx`, `QuizHistory.tsx`, `QuizPage.tsx`
- Modify: `web/src/App.tsx`, `web/src/locales/en/common.json`, `web/src/styles/base.css`
- Test: `web/src/features/quiz/QuizPage.test.tsx`

**Interfaces:**
- Consumes:
  - `getQuizBank`, `getQuizTopics` (Task 1);
  - `stateOf`, `pickRun`, `poolFor`, `topicBreakdown`, `StartedRun`, `AnswerRecord` (Task 2);
  - `saveQuizResult`, `getBoxes` and the hooks `useQuizBoxes`, `useQuizResults` (Task 3);
  - `useQuizSettings`, `requestedLength`, `PRESET_LENGTHS`, `MAX_QUIZ_LENGTH` (Task 4);
  - `QuizRun` (Task 5).
- Produces: `QuizPage` mounted at `/quiz`, and the nav link "Quiz".

- [ ] **Step 1: Write the failing test** `web/src/features/quiz/QuizPage.test.tsx`:

```tsx
import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '../../progress/db'
import { QUIZ_SETTINGS_KEY } from '../../quiz/settings'
import { QuizPage } from './QuizPage'

beforeEach(async () => {
  localStorage.clear()
  await resetDbForTests()
})

async function answerAll(n: number) {
  for (let i = 1; i <= n; i++) {
    await screen.findByText(`Question ${i} of ${n}`)
    fireEvent.keyDown(document.body, { key: '1' })
    fireEvent.keyDown(document.body, { key: 'Enter' })
    await screen.findByRole('status')
    fireEvent.keyDown(document.body, { key: 'Enter' })
  }
}

describe('QuizPage', () => {
  it('remembers the chosen length', async () => {
    const { unmount } = render(<QuizPage />)
    fireEvent.click(await screen.findByRole('button', { name: '25' }))
    expect(JSON.parse(localStorage.getItem(QUIZ_SETTINGS_KEY)!).length).toBe(25)
    unmount()
    render(<QuizPage />)
    expect(await screen.findByRole('button', { name: '25' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows due and new counts per topic and needs at least one chosen topic', async () => {
    render(<QuizPage />)
    fireEvent.click(await screen.findByRole('radio', { name: 'Choose topics' }))
    expect(screen.getByText('Choose at least one topic.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeDisabled()
    const row = screen.getByRole('checkbox', { name: /Testing/ })
    expect(row.closest('label')).toHaveTextContent('0 due · 2 new')
    fireEvent.click(row)
    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeEnabled()
  })

  it('runs a 5-question quiz, shows the score and adds it to the history', async () => {
    render(<QuizPage />)
    fireEvent.click(await screen.findByRole('button', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start quiz' }))
    await answerAll(5)
    expect(await screen.findByRole('heading', { name: 'Quiz complete' })).toBeInTheDocument()
    expect(screen.getByText(/^\d \/ 5 \(\d+%\)$/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    const history = await screen.findByRole('region', { name: 'Quiz history' })
    expect(await within(history).findByText(/^\d \/ 5$/)).toBeInTheDocument()
    expect(within(history).getByText('All topics')).toBeInTheDocument()
  })

  it('caps the length at the questions available in the chosen topics', async () => {
    render(<QuizPage />)
    fireEvent.click(await screen.findByRole('button', { name: '10' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Choose topics' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Testing/ }))
    expect(screen.getByText('These topics have 2 questions, so the quiz uses all of them.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/features/quiz/QuizPage.test.tsx`
Expected: FAIL. `./QuizPage` is missing.

- [ ] **Step 3: Write `web/src/features/quiz/QuizEnd.tsx`**

```tsx
import { TriangleAlert } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { getQuizTopics } from '../../content/quiz'
import { topicBreakdown, type AnswerRecord } from '../../quiz/run'

export const percentOf = (correct: number, total: number) => (total === 0 ? 0 : Math.round((correct / total) * 100))

export function QuizEnd({ answers, saveFailed, onNew, onBack }: { answers: AnswerRecord[]; saveFailed: boolean; onNew(): void; onBack(): void }) {
  const { t } = useTranslation('quiz')
  const id = useId()
  const correct = answers.filter((a) => a.correct).length
  const rows = topicBreakdown(answers, getQuizTopics())
  return (
    <section className="panel quiz-end" aria-labelledby={id}>
      <div className="prog-panel-body">
        <h2 id={id} className="prog-h2">
          {t('end.title')}
        </h2>
        <p className="quiz-score">{t('end.score', { correct, total: answers.length, percent: percentOf(correct, answers.length) })}</p>
        {saveFailed && (
          <div className="prog-error" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <p>{t('end.saveFailed')}</p>
          </div>
        )}
        <h3 className="quiz-h3">{t('end.byTopic')}</h3>
        <ul className="quiz-breakdown">
          {rows.map((r) => (
            <li key={r.topicId} data-topic={r.topicId}>
              <span>{r.title}</span>
              <span>{t('end.topicScore', { correct: r.correct, total: r.total })}</span>
            </li>
          ))}
        </ul>
        <div className="reset-actions">
          <button type="button" className="btn btn-primary" autoFocus onClick={onNew}>
            {t('end.newQuiz')}
          </button>
          <button type="button" className="btn btn-quiet" onClick={onBack}>
            {t('end.back')}
          </button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Write `web/src/features/quiz/QuizSetup.tsx`**

```tsx
import { Play, TriangleAlert } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getQuizBank, getQuizTopics, type QuizQuestion } from '../../content/quiz'
import { useQuizBoxes } from '../../progress/useProgress'
import { stateOf } from '../../quiz/leitner'
import { pickRun, poolFor, type StartedRun } from '../../quiz/run'
import { MAX_QUIZ_LENGTH, PRESET_LENGTHS, requestedLength, useQuizSettings } from '../../quiz/settings'

function parseCustom(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null
  const n = Number(text)
  return n >= 1 && n <= MAX_QUIZ_LENGTH ? n : null
}

export function QuizSetup({ onStart }: { onStart(run: StartedRun): void }) {
  const { t } = useTranslation('quiz')
  const ids = useId()
  const topics = useMemo(() => getQuizTopics(), [])
  const bank = useMemo(() => getQuizBank(), [])
  const topicIds = useMemo(() => new Set(topics.map((x) => x.id)), [topics])
  const [settings, setSettings] = useQuizSettings(topicIds)
  const [customText, setCustomText] = useState(String(settings.custom))
  const { data: boxes, error: boxesError } = useQuizBoxes()
  const loading = boxes === undefined && !boxesError

  const now = new Date()
  const counts = (pool: QuizQuestion[]) => {
    let due = 0
    let fresh = 0
    for (const q of pool) {
      const s = stateOf(boxes?.get(q.id), now)
      if (s === 'due') due++
      else if (s === 'new') fresh++
    }
    return { due, fresh }
  }

  const choosing = settings.topics !== 'all'
  const chosen = settings.topics === 'all' ? [] : settings.topics
  const pool = poolFor(bank, settings.topics)
  const customInvalid = settings.length === 'custom' && parseCustom(customText) === null
  const effective = Math.min(requestedLength(settings), pool.length, MAX_QUIZ_LENGTH)
  const noTopic = choosing && chosen.length === 0
  const capped = !noTopic && pool.length > 0 && requestedLength(settings) > pool.length
  const canStart = !loading && !noTopic && !customInvalid && effective > 0

  function start(e: React.FormEvent) {
    e.preventDefault()
    if (!canStart) return
    onStart(pickRun(bank, settings.topics, effective, boxes ?? new Map(), new Date(), Math.random))
  }

  const toggle = (id: string, on: boolean) => setSettings({ ...settings, topics: on ? [...chosen, id] : chosen.filter((x) => x !== id) })

  return (
    <form className="panel exam-panel" onSubmit={start} noValidate>
      <div className="prog-panel-body exam-fields">
        <div className="exam-field">
          <span id={`${ids}-length`} className="exam-label">
            {t('setup.length')}
          </span>
          <div className="seg quiz-seg" role="group" aria-labelledby={`${ids}-length`}>
            {[...PRESET_LENGTHS, 'custom' as const].map((l) => (
              <button key={l} type="button" aria-pressed={settings.length === l} onClick={() => setSettings({ ...settings, length: l })}>
                {l === 'custom' ? t('setup.custom') : l}
              </button>
            ))}
          </div>
          {settings.length === 'custom' && (
            <>
              <label htmlFor={`${ids}-custom`} className="sr-only">
                {t('setup.customLabel')}
              </label>
              <input
                id={`${ids}-custom`}
                className="exam-number"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_QUIZ_LENGTH}
                value={customText}
                aria-invalid={customInvalid}
                aria-describedby={`${ids}-custom-hint`}
                onChange={(e) => {
                  setCustomText(e.target.value)
                  const n = parseCustom(e.target.value)
                  if (n !== null) setSettings({ ...settings, custom: n })
                }}
              />
              <span id={`${ids}-custom-hint`} className={customInvalid ? 'prog-hint exam-bad' : 'prog-hint'}>
                {customInvalid ? t('setup.customInvalid', { max: MAX_QUIZ_LENGTH }) : t('setup.customHint', { max: MAX_QUIZ_LENGTH })}
              </span>
            </>
          )}
        </div>

        <fieldset className="exam-field exam-group">
          <legend className="exam-label">{t('setup.topics')}</legend>
          <div className="exam-options">
            <label className="exam-option">
              <input type="radio" name={`${ids}-topics`} checked={!choosing} onChange={() => setSettings({ ...settings, topics: 'all' })} />
              {t('setup.allTopics')}
              <span className="prog-hint">{t('setup.topicCounts', counts(bank))}</span>
            </label>
            <label className="exam-option">
              <input type="radio" name={`${ids}-topics`} checked={choosing} onChange={() => setSettings({ ...settings, topics: [] })} />
              {t('setup.chooseTopics')}
            </label>
          </div>
          {choosing && (
            <fieldset className="exam-sub">
              <legend className="sr-only">{t('setup.chooseTopics')}</legend>
              {topics.map((topic) => (
                <label key={topic.id} className="exam-option">
                  <input type="checkbox" checked={chosen.includes(topic.id)} onChange={(e) => toggle(topic.id, e.target.checked)} />
                  {topic.title}
                  <span className="prog-hint">{t('setup.topicCounts', counts(poolFor(bank, [topic.id])))}</span>
                </label>
              ))}
            </fieldset>
          )}
        </fieldset>

        {noTopic && <p className="prog-hint exam-bad">{t('setup.noTopic')}</p>}
        {capped && <p className="prog-hint">{t('setup.capped', { count: pool.length })}</p>}
        {loading && (
          <p className="prog-hint" role="status">
            {t('setup.loading')}
          </p>
        )}
        {boxesError && (
          <div className="prog-error" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <p>{t('setup.boxesError')}</p>
          </div>
        )}

        <div className="reset-actions">
          <button type="submit" className="btn btn-primary" disabled={!canStart} autoFocus>
            <Play size={16} aria-hidden="true" />
            {t('setup.start')}
          </button>
        </div>
      </div>
    </form>
  )
}
```

Note: `counts` returns `{ due, fresh }`, which matches the `{{due}}` / `{{fresh}}` placeholders in `setup.topicCounts`.

- [ ] **Step 5: Write `web/src/features/quiz/QuizHistory.tsx`**

```tsx
import { TriangleAlert } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { getQuizTopics } from '../../content/quiz'
import { useQuizResults } from '../../progress/useProgress'
import { percentOf } from './QuizEnd'

export function QuizHistory() {
  const { t, i18n } = useTranslation('quiz')
  const id = useId()
  const { data, error } = useQuizResults()
  const titles = new Map(getQuizTopics().map((x) => [x.id, x.title]))
  return (
    <section className="panel prog-panel" aria-labelledby={id}>
      <div className="prog-panel-body">
        <h2 id={id} className="prog-h2">
          {t('history.title')}
        </h2>
        {data === undefined && error ? (
          <div className="prog-error" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <p>{t('history.readError')}</p>
          </div>
        ) : data === undefined ? (
          <p className="prog-muted">{t('history.loading')}</p>
        ) : data.length === 0 ? (
          <p className="prog-muted">{t('history.empty')}</p>
        ) : (
          <ol className="quiz-history">
            {data.map((r) => (
              <li key={r.id} className="quiz-history-row">
                <time dateTime={r.takenAt}>{new Date(r.takenAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                <span className="quiz-history-topics">
                  {r.topics === 'all' ? t('history.all') : r.topics.map((x) => titles.get(x) ?? x).join(', ')}
                </span>
                <span className="quiz-history-score">{t('history.score', { correct: r.correct, total: r.total })}</span>
                <span className="quiz-history-percent">{t('history.percent', { percent: percentOf(r.correct, r.total) })}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Write `web/src/features/quiz/QuizPage.tsx`**

```tsx
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getQuizBank } from '../../content/quiz'
import { getBoxes, saveQuizResult } from '../../quiz/quizStore'
import { pickRun, type AnswerRecord, type StartedRun } from '../../quiz/run'
import { QuizEnd } from './QuizEnd'
import { QuizHistory } from './QuizHistory'
import { QuizRun } from './QuizRun'
import { QuizSetup } from './QuizSetup'

type Phase =
  | { kind: 'setup' }
  | { kind: 'run'; run: StartedRun; key: number }
  | { kind: 'end'; run: StartedRun; answers: AnswerRecord[]; saveFailed: boolean }

/** Setup → run → end, held in memory: leaving or reloading ends a Quiz (spec §5). */
export function QuizPage() {
  const { t } = useTranslation('quiz')
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' })
  const runs = useRef(0)

  const begin = (run: StartedRun) => setPhase({ kind: 'run', run, key: ++runs.current })

  async function finish(run: StartedRun, answers: AnswerRecord[]) {
    let saveFailed = false
    try {
      await saveQuizResult({ takenAt: new Date().toISOString(), topics: run.topics, total: answers.length, correct: answers.filter((a) => a.correct).length })
    } catch {
      saveFailed = true
    }
    setPhase({ kind: 'end', run, answers, saveFailed })
  }

  async function again(run: StartedRun) {
    const boxes = await getBoxes().catch(() => new Map())
    begin(pickRun(getQuizBank(), run.topics, run.questions.length, boxes, new Date(), Math.random))
  }

  return (
    <div className="quiz-page">
      <header className="page-head">
        <h1 className="page-title">{t('title')}</h1>
        {phase.kind === 'setup' && <p className="page-intro">{t('intro')}</p>}
      </header>
      {phase.kind === 'setup' && (
        <>
          <QuizSetup onStart={begin} />
          <QuizHistory />
        </>
      )}
      {phase.kind === 'run' && (
        <QuizRun key={phase.key} questions={phase.run.questions} onFinish={(a) => void finish(phase.run, a)} onQuit={() => setPhase({ kind: 'setup' })} />
      )}
      {phase.kind === 'end' && (
        <QuizEnd answers={phase.answers} saveFailed={phase.saveFailed} onNew={() => void again(phase.run)} onBack={() => setPhase({ kind: 'setup' })} />
      )}
    </div>
  )
}
```

- [ ] **Step 7: Route and nav.**
  - In `web/src/App.tsx`, import `QuizPage` from `./features/quiz/QuizPage`. Add `<Route path="/quiz" element={<QuizPage />} />` after the exam routes.
  - In `MainNav`, add between the Exam and Progress links:

```tsx
      <NavLink to="/quiz" className={navClass}>
        {t('nav.quiz')}
      </NavLink>
```

  - In `web/src/locales/en/common.json`, add `"quiz": "Quiz"` to `nav`.

- [ ] **Step 8: Styles.** Append to `web/src/styles/base.css`:

```css
.quiz-score {
  margin: var(--space-2) 0 var(--space-3);
  font-size: var(--fs-24);
  font-weight: 600;
}

.quiz-h3 {
  margin: var(--space-3) 0 var(--space-2);
  font-size: var(--fs-14);
  font-weight: 600;
}

.quiz-breakdown,
.quiz-history {
  list-style: none;
  margin: 0 0 var(--space-3);
  padding: 0;
}

.quiz-breakdown li,
.quiz-history-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-1) var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border);
}

.quiz-history-topics {
  flex: 1 1 160px;
  color: var(--muted);
}

.quiz-history-score {
  font-weight: 600;
}

.quiz-seg button {
  min-height: 44px;
  min-width: 44px;
}
```

- [ ] **Step 9: Run the tests, types and lint**

Run: `npx vitest run src/features/quiz src/App.test.tsx && npx tsc -b && npm run lint`
Expected: PASS. If `App.test.tsx` lists the nav links exactly, add "Quiz" between "Exam" and "Progress" in that expectation.

- [ ] **Step 10: Commit**

```bash
git add web/src/features/quiz web/src/App.tsx web/src/App.test.tsx web/src/locales/en/common.json web/src/styles/base.css
git commit -m "feat(quiz): setup, end screen, quiz history and the Quiz tab"
```

---

### Task 7: Quiz summary on the Progress page

**Files:**
- Create: `web/src/quiz/summary.ts`
- Modify: `web/src/features/progress/ProgressPage.tsx`, `web/src/locales/en/progress.json`
- Test: `web/src/quiz/summary.test.ts`, `web/src/features/progress/ProgressPage.test.tsx` (add one test)

**Interfaces:**
- Consumes: `QuizResult` (Task 3), `BoxRecord` (Task 2), the hooks `useQuizResults` and `useQuizBoxes` (Task 3), `getQuizBank` (Task 1).
- Produces: `quizSummary(results: QuizResult[], boxes: ReadonlyMap<string, BoxRecord>, bankIds: readonly string[]): { quizzes: number; averagePercent: number | null; seen: number; total: number }`

- [ ] **Step 1: Write the failing tests.** `web/src/quiz/summary.test.ts`:

```ts
import { expect, it } from 'vitest'
import { quizSummary } from './summary'

it('weights the average by questions and counts only seen questions still in the bank', () => {
  const results = [
    { id: '1', takenAt: 'x', topics: 'all' as const, total: 5, correct: 5 },
    { id: '2', takenAt: 'y', topics: 'all' as const, total: 15, correct: 5 },
  ]
  const boxes = new Map([
    ['a', { questionId: 'a', box: 2 as const, lastAnsweredAt: 'x' }],
    ['gone', { questionId: 'gone', box: 1 as const, lastAnsweredAt: 'x' }],
  ])
  expect(quizSummary(results, boxes, ['a', 'b', 'c'])).toEqual({ quizzes: 2, averagePercent: 50, seen: 1, total: 3 })
  expect(quizSummary([], new Map(), ['a']).averagePercent).toBeNull()
})
```

In `web/src/features/progress/ProgressPage.test.tsx`, add a test following the file's existing render setup (it renders `ProgressPage` inside a router with fake-indexeddb). Before rendering, call `await saveQuizResult({ takenAt: '2026-11-06T10:00:00.000Z', topics: 'all', total: 5, correct: 4 })` and `await recordAnswer('<the id of any seed question>', true, new Date())`. Read the id at test time with `getQuizBank()[0].id`. Then assert:

```tsx
expect(await screen.findByText(`1 quiz · 80% average · 1 / ${getQuizBank().length} questions seen`)).toBeInTheDocument()
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/quiz/summary.test.ts src/features/progress/ProgressPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `web/src/quiz/summary.ts`**

```ts
import type { BoxRecord } from './leitner'
import type { QuizResult } from './quizStore'

export function quizSummary(results: QuizResult[], boxes: ReadonlyMap<string, BoxRecord>, bankIds: readonly string[]) {
  const total = results.reduce((s, r) => s + r.total, 0)
  const correct = results.reduce((s, r) => s + r.correct, 0)
  return {
    quizzes: results.length,
    averagePercent: total === 0 ? null : Math.round((correct / total) * 100),
    seen: bankIds.filter((id) => boxes.has(id)).length,
    total: bankIds.length,
  }
}
```

- [ ] **Step 4: Strings.** In `web/src/locales/en/progress.json` add:

```json
  "quiz": {
    "title": "Quiz",
    "summary": "{{quizzes}} · {{average}}% average · {{seen}} / {{total}} questions seen",
    "count_one": "{{count}} quiz",
    "count_other": "{{count}} quizzes",
    "empty": "No quizzes yet.",
    "take": "Take a quiz"
  }
```

- [ ] **Step 5: The panel.** In `web/src/features/progress/ProgressPage.tsx`, import `getQuizBank` from `'../../content/quiz'`, `quizSummary` from `'../../quiz/summary'`, and `useQuizBoxes, useQuizResults` from `'../../progress/useProgress'`. Add:

```tsx
function QuizSummaryPanel() {
  const { t } = useTranslation('progress')
  const { data: results } = useQuizResults()
  const { data: boxes } = useQuizBoxes()
  if (results === undefined || boxes === undefined) return null
  const s = quizSummary(results, boxes, getQuizBank().map((q) => q.id))
  return (
    <section className="panel prog-panel" aria-labelledby="quiz-summary-title">
      <div className="prog-panel-body">
        <h2 id="quiz-summary-title" className="prog-h2">
          {t('quiz.title')}
        </h2>
        {s.quizzes === 0 ? (
          <div className="prog-empty">
            <p>{t('quiz.empty')}</p>
            <Link className="back-link" to="/quiz">
              {t('quiz.take')}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <p>{t('quiz.summary', { quizzes: t('quiz.count', { count: s.quizzes }), average: s.averagePercent, seen: s.seen, total: s.total })}</p>
        )}
      </div>
    </section>
  )
}
```

Render `<QuizSummaryPanel />` in `ProgressPage` between the Patterns section and `<Backup … />`.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/quiz src/features/progress`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/quiz/summary.ts web/src/quiz/summary.test.ts web/src/features/progress web/src/locales/en/progress.json
git commit -m "feat(quiz): quiz summary on the Progress page"
```

---

### Task 8: Compile-verified output questions (C#)

**Files:**
- Create: `tests/DesignPatterns.Content.Tests/QuizOutputTests.cs`

**Interfaces:**
- Consumes: the `content/quiz/*.en.yaml` files (Task 1); `ContentLocator.Root` and `ContentLocator.Yaml`, and the compile/run calls used in `ExampleTests.cs`.

- [ ] **Step 1: Write the test** `tests/DesignPatterns.Content.Tests/QuizOutputTests.cs`:

```csharp
using DesignPatterns.Core.Execution;
using DesignPatterns.Core.Protocol;

namespace DesignPatterns.Content.Tests;

/// <summary>Spec §3.3: every Quiz Question with expectedOutput must print exactly that when compiled and run.</summary>
[Collection(ConsoleCaptureCollection.Name)]
public class QuizOutputTests
{
    internal sealed class QuizQuestionYaml
    {
        public string Id { get; set; } = "";
        public string? Code { get; set; }
        public string? ExpectedOutput { get; set; }
    }

    private static string QuizDir => Path.Combine(ContentLocator.Root, "quiz");

    private static List<QuizQuestionYaml> Read(string file) =>
        ContentLocator.Yaml.Deserialize<List<QuizQuestionYaml>>(File.ReadAllText(Path.Combine(QuizDir, file))) ?? [];

    public static IEnumerable<object?[]> OutputQuestions()
    {
        var rows = Directory.Exists(QuizDir)
            ? Directory.GetFiles(QuizDir, "*.en.yaml").Order()
                .SelectMany(f => Read(Path.GetFileName(f)).Where(q => q.ExpectedOutput is not null)
                    .Select(q => new object?[] { Path.GetFileName(f), q.Id }))
                .ToList()
            : [];
        if (rows.Count == 0) rows.Add([null, null]); // xUnit fails a Theory with no data
        return rows;
    }

    [Theory, MemberData(nameof(OutputQuestions))]
    public async Task Code_PrintsExpectedOutput(string? file, string? id)
    {
        if (file is null) return;
        var q = Read(file).Single(x => x.Id == id);
        Assert.False(string.IsNullOrWhiteSpace(q.Code), $"{id}: expectedOutput needs code");

        var compiled = CompilerService.Compile(new CompileRequest(q.Code!, CompilePurpose.Run));
        var errors = compiled.Diagnostics.Where(d => d.Level == Core.Compilation.DiagnosticLevel.Error)
            .Select(d => $"{d.Id} {d.StartLine}:{d.StartColumn} {d.Message}");
        Assert.True(compiled.Success, $"{id}: " + string.Join("; ", errors));

        var outcome = await LoadedProgram.Load(Convert.FromBase64String(compiled.AssemblyBase64!), q.Code!).RunMainAsync();
        Assert.True(outcome.HasEntryPoint, $"{id}: code must be a runnable program");
        Assert.Null(outcome.Exception);
        Assert.Equal(Normalize(q.ExpectedOutput!), Normalize(outcome.Stdout));
    }

    private static string Normalize(string s) =>
        string.Join('\n', s.Replace("\r\n", "\n").Split('\n').Select(l => l.TrimEnd())).TrimEnd();
}
```

- [ ] **Step 2: Prove it can fail.** Temporarily change one seed's `expectedOutput` (e.g. `3` → `2` in the first line). Then run:

Run (repo root): `dotnet test tests/DesignPatterns.Content.Tests --filter FullyQualifiedName~QuizOutputTests`
Expected: FAIL on that question with an `Assert.Equal` diff. Revert the change.

- [ ] **Step 3: Run it for real**

Run (repo root): `dotnet test tests/DesignPatterns.Content.Tests --filter FullyQualifiedName~QuizOutputTests`
Expected: PASS, with at least 2 test cases (one per output question).

If a seed fails because the runtime's `ApiPolicy` rejects an API it uses, rewrite that question so it is deterministic and policy-clean. Otherwise remove its `code`/`expectedOutput` and pick another output question. Put any rewritten question through the reviewer loop again.

- [ ] **Step 4: Commit**

```bash
git add tests/DesignPatterns.Content.Tests/QuizOutputTests.cs
git commit -m "test(quiz): compile and run every expectedOutput question"
```

---

### Task 9: End-to-end and final verification

**Files:**
- Create: `web/e2e/quiz.spec.ts`

**Interfaces:**
- Consumes: the whole feature at `/quiz`.

- [ ] **Step 1: Write the e2e** `web/e2e/quiz.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('a keyboard-only 5-question quiz lands in the history, and the length is remembered', async ({ page }) => {
  await page.goto('/quiz')
  await expect(page.getByRole('heading', { level: 1, name: 'Quiz' })).toBeVisible()
  await page.getByRole('button', { name: '5', exact: true }).click()
  await page.getByRole('button', { name: 'Start quiz' }).focus()
  await page.keyboard.press('Enter')

  for (let i = 1; i <= 5; i++) {
    await expect(page.getByText(`Question ${i} of 5`)).toBeVisible()
    await page.keyboard.press(String(((i - 1) % 4) + 1))
    await page.keyboard.press('Enter')
    await expect(page.locator('.quiz-outcome')).toBeVisible()
    await expect(page.locator('.quiz-explanation')).toHaveCount(4)
    await page.keyboard.press('Enter')
  }

  await expect(page.getByRole('heading', { name: 'Quiz complete' })).toBeVisible()
  await expect(page.getByText(/^\d \/ 5 \(\d+%\)$/)).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('region', { name: 'Quiz history' }).getByText(/^\d \/ 5$/)).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'Quiz history' }).getByText(/^\d \/ 5$/)).toBeVisible()
})

test('the quiz fits a 390px screen without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/quiz')
  await page.getByRole('button', { name: 'Start quiz' }).click()
  await page.keyboard.press('1')
  await page.keyboard.press('Enter')
  await expect(page.locator('.quiz-explanation')).toHaveCount(4)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
```

- [ ] **Step 2: Run the e2e**

Run: `npx playwright test e2e/quiz.spec.ts`
Expected: PASS (2 tests). If the 390px test overflows, the usual cause is a long `inline code` token in an Option or a `.quiz-code` block. Fix it in CSS (`overflow-wrap: anywhere` on `.quiz-option-text`), not in the test.

- [ ] **Step 3: Full verification**

Run, from `web/`: `npx vitest run && npx tsc -b && npm run lint && npx playwright test`
Run, from the repo root: `dotnet test`
Expected: everything passes. Report any failure with its output; don't mark the task done over a red run.

- [ ] **Step 4: Check it by hand in the browser.** Run `npm run dev` and take a 10-question Quiz in both themes. Check that:
  - an output question renders its code block;
  - ✓/✗ carry a label;
  - Esc → "Keep going" returns to the question;
  - the Quiz tab is highlighted.

- [ ] **Step 5: Commit**

```bash
git add web/e2e/quiz.spec.ts web/src/styles/base.css
git commit -m "test(quiz): keyboard-only e2e and 390px layout check"
```

---

## After M1

M2 (the bank) gets its own plan. It covers each topic up to its target count through the spec §9 review loop, and raises `QUIZ_TOPIC_MIN` to per-topic targets in `quizRules.ts`.
