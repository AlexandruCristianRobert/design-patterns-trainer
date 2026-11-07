# Question Visuals M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Quiz Question can carry a steppable Question Visual (Setup before answering; Reality play and Claim plays after) in a wide Quiz layout, shipped with one real visual for `configureawait-false-library`.

**Architecture:** Captions and stage/step structure are content (`content/quiz/visuals/<id>.en.yaml`, zod-validated). Drawings are bespoke React components (`web/src/features/quiz/visuals/drawings/<id>.tsx`), lazy-loaded through `import.meta.glob`. A shared frame (`QuestionVisual.tsx`) owns phases, tabs, synced stepping, playback, keys and captions; `QuizRun` controls which view is open. A pure `visualModel.ts` maps content + the run's shuffled Options to views.

**Tech Stack:** React 19, TypeScript, Vite (`import.meta.glob`, the repo's yaml plugin), zod 4, react-i18next, `motion/react` (`useReducedMotion`), lucide-react, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-question-visuals-design.md` (read §3–§6 and §8–§9 before starting). Glossary: `CONTEXT.md` → Quiz (Question Visual, Setup, Reality play, Claim play).

## Global Constraints

- Work on branch `feat/question-visuals`. All commands below run from `web/` unless stated.
- Quiz Options are shuffled per run (`web/src/quiz/run.ts` `pickRun`): content refers to an Option by its **0-based index in the topic file**; anything shown to the learner uses the **display letter** in this run. Map by Option text (texts are unique per question, enforced by `questionProblems`).
- Content text (titles, captions) never names an Option by letter and uses no `*emphasis*` (same rules as Quiz text, `web/src/content/quizRules.ts`).
- Setup never autoplays. The first post-answer view plays once at 1600 ms per step. Under `prefers-reduced-motion`: no autoplay, no transitions.
- ←/→: after answering, from anywhere; before answering, only with focus inside the visual panel. Never while typing in a text field or with focus on a radio. Space plays/pauses only inside the panel and not on a button. Enter for Next is never blocked.
- While a Quiz runs the page is up to 1600px wide; setup, history and end keep 820px. Question text is capped at 80ch. No horizontal scroll at 390px or 1920px.
- Every visual passes the reviewer loop (spec §8) before M1 is called done.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 0: Branch

- [ ] **Step 1: Create the branch and commit the design docs** (from repo root)

```bash
git switch -c feat/question-visuals
git add CONTEXT.md docs/superpowers/specs/2026-11-07-question-visuals-design.md docs/superpowers/plans/2026-11-07-question-visuals-m1.md
git commit -m "docs(quiz): Question Visuals design, glossary and M1 plan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Visual content — schema, loader, rules, first content file

**Files:**
- Modify: `web/src/content/schema.ts` (after `quizFile`, line ~98; the `schemas` export; types block)
- Create: `web/src/content/quizVisuals.ts`
- Modify: `web/src/content/quizRules.ts` (append `visualProblems`)
- Create: `content/quiz/visuals/configureawait-false-library.en.yaml`
- Test: `web/src/content/quizSchema.test.ts`, `web/src/content/quiz.test.ts`

**Interfaces:**
- Produces: `schemas.quizVisual`; types `QuizVisualMeta`, `QuizVisualStage` (from `schema.ts`); `type QuizVisual`, `getQuizVisuals(): Map<string, QuizVisual>`, `getQuizVisual(id: string): QuizVisual | undefined` (from `quizVisuals.ts`); `visualProblems(v: QuizVisual, q: QuizQuestion | undefined): string[]` (from `quizRules.ts`).

- [ ] **Step 1: Write the failing schema tests** — append to `web/src/content/quizSchema.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/content/quizSchema.test.ts`
Expected: FAIL — `schemas.quizVisual` is undefined.

- [ ] **Step 3: Add the schema** — in `web/src/content/schema.ts`, after `const quizFile = z.array(quizQuestion)`:

```ts
const visualStep = z.strictObject({ id: kebab, caption: z.string().trim().min(1) })
const visualStage = z.strictObject({ id: kebab, title: z.string().trim().min(1), steps: z.array(visualStep).min(1) })
const quizVisual = z.strictObject({
  question: kebab,
  setup: visualStage,
  reality: z.strictObject({ title: z.string().trim().min(1), stages: z.array(visualStage).min(1).max(2) }),
  claims: z.array(z.strictObject({ option: z.number().int().min(0).max(3), claim: visualStage, reality: visualStage })),
})
```

Add `quizVisual` to the `schemas` object, and to the types block:

```ts
export type QuizVisualMeta = z.infer<typeof quizVisual>
export type QuizVisualStage = z.infer<typeof visualStage>
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/content/quizSchema.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing rule tests** — append to `web/src/content/quiz.test.ts` (add `visualProblems` to the `./quizRules` import, and `import { getQuizVisuals } from './quizVisuals'`):

```ts
describe('visualProblems', () => {
  const opt = (text: string, correct = false) => ({ text, correct, explanation: 'Why.' })
  const question = { id: 'x', topicId: 'testing', question: 'Q?', options: [opt('a', true), opt('b'), opt('c'), opt('d')] }
  const stage = (id: string, caption = 'C.') => ({ id, title: 'T', steps: [{ id: 'one', caption }] })
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
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run src/content/quiz.test.ts`
Expected: FAIL — `visualProblems` / `./quizVisuals` do not exist.

- [ ] **Step 7: Write the loader** — create `web/src/content/quizVisuals.ts`:

```ts
import { parseContent, schemas, type QuizVisualMeta } from './schema'

const root = '../../../content/quiz/visuals/'
const files = import.meta.glob('../../../content/quiz/visuals/*.en.yaml', { eager: true, import: 'default' })

export type QuizVisual = QuizVisualMeta

let all: Map<string, QuizVisual> | undefined

/** Every Question Visual, keyed by Quiz Question id. The file name must be the question id. */
export function getQuizVisuals(): Map<string, QuizVisual> {
  if (all) return all
  all = new Map()
  for (const [path, data] of Object.entries(files)) {
    const id = path.slice(root.length).replace(/\.en\.yaml$/, '')
    const file = `content/quiz/visuals/${id}.en.yaml`
    const visual = parseContent(schemas.quizVisual, data, file)
    if (visual.question !== id) throw new Error(`${file}: question "${visual.question}" does not match the file name`)
    all.set(id, visual)
  }
  return all
}

export const getQuizVisual = (questionId: string): QuizVisual | undefined => getQuizVisuals().get(questionId)
```

- [ ] **Step 8: Write the rules** — append to `web/src/content/quizRules.ts` (add `import type { QuizVisual } from './quizVisuals'` at the top):

```ts
/** Problems with one Question Visual (spec §6); an empty list means it is fine. */
export function visualProblems(v: QuizVisual, q: QuizQuestion | undefined): string[] {
  const at = `visual "${v.question}"`
  if (!q) return [`${at}: no Quiz Question has this id`]
  const out: string[] = []
  const claimed = new Set<number>()
  for (const c of v.claims) {
    if (q.options[c.option]?.correct) out.push(`${at}: option ${c.option} is the correct option and cannot have a claim`)
    else if (claimed.has(c.option)) out.push(`${at}: option ${c.option} has two claims`)
    claimed.add(c.option)
  }
  q.options.forEach((o, i) => {
    if (!o.correct && !claimed.has(i)) out.push(`${at}: wrong option ${i} has no claim`)
  })
  const stages = [v.setup, ...v.reality.stages, ...v.claims.flatMap((c) => [c.claim, c.reality])]
  const stageIds = new Set<string>()
  for (const s of stages) {
    if (stageIds.has(s.id)) out.push(`${at}: stage id "${s.id}" is used twice`)
    stageIds.add(s.id)
    const stepIds = new Set<string>()
    for (const step of s.steps) {
      if (stepIds.has(step.id)) out.push(`${at}: stage "${s.id}" uses step id "${step.id}" twice`)
      stepIds.add(step.id)
    }
    const text = [s.title, ...s.steps.map((step) => step.caption)]
    if (text.some((t) => LETTER_REF.test(t))) out.push(`${at}: stage "${s.id}" refers to an option by letter`)
    if (text.some((t) => EMPHASIS.test(outsideCode(t)))) out.push(`${at}: stage "${s.id}" uses emphasis markup`)
  }
  if ([v.reality.title].some((t) => LETTER_REF.test(t))) out.push(`${at}: the reality title refers to an option by letter`)
  return out
}
```

- [ ] **Step 9: Write the first content file** — create `content/quiz/visuals/configureawait-false-library.en.yaml`. Option indexes follow `content/quiz/async-concurrency.en.yaml`: 0 = correct, 1 = "forces ReadAsync to run on a thread-pool thread", 2 = "exceptions ignored", 3 = "required in ASP.NET Core". Step ids are what the drawing (Task 3) keys on.

```yaml
question: configureawait-false-library
setup:
  id: setup
  title: Where does the code after the await run?
  steps:
    - id: caller-calls
      caption: A click handler on the UI thread calls a library method.
    - id: runs-to-await
      caption: The library method runs on the calling thread until it reaches its first await.
    - id: read-pending
      caption: The read is started and has not finished yet.
    - id: where-next
      caption: When the read completes, where does `return Parse(buffer, n)` run? That is what the await's configuration decides.
reality:
  title: 'Why it matters: a caller that blocks'
  stages:
    - id: default-await
      title: await without ConfigureAwait
      steps:
        - id: caller-calls
          caption: The UI thread calls the library, but this caller blocks with `.Result` instead of awaiting.
        - id: runs-to-await
          caption: '`LoadAsync` runs synchronously until the read is pending.'
        - id: caller-blocks
          caption: '`LoadAsync` returns an unfinished `Task`, and `.Result` blocks the UI thread until it finishes.'
        - id: read-completes
          caption: The read completes. The rest of `LoadAsync` has to run somewhere.
        - id: posted-back
          caption: The await captured the UI `SynchronizationContext`, so the continuation is posted back to the UI thread.
        - id: deadlock
          caption: The UI thread waits for the `Task`, and the `Task` waits for the UI thread. Neither can move.
    - id: configure-await-false
      title: await … ConfigureAwait(false)
      steps:
        - id: caller-calls
          caption: The same blocking caller.
        - id: runs-to-await
          caption: '`LoadAsync` runs synchronously until the read is pending.'
        - id: caller-blocks
          caption: '`.Result` blocks the UI thread, exactly as before.'
        - id: read-completes
          caption: The read completes.
        - id: runs-on-pool
          caption: No context was captured, so the continuation runs on any thread-pool thread.
        - id: result-returns
          caption: The `Task` completes and `.Result` returns. No deadlock, and no hop back to the UI thread.
claims:
  - option: 1
    claim:
      id: thread-pool-claim
      title: ReadAsync is moved to the thread pool
      steps:
        - id: caller-calls
          caption: The caller starts the library method.
        - id: moved-to-pool
          caption: 'The claim: `ConfigureAwait(false)` makes `ReadAsync` itself start on a thread-pool thread.'
        - id: pool-waits
          caption: 'The claim: a pool thread is held while the read is in progress.'
    reality:
      id: thread-pool-reality
      title: What really happens
      steps:
        - id: caller-calls
          caption: The caller starts the library method.
        - id: starts-on-caller
          caption: '`ReadAsync` starts on the calling thread. `ConfigureAwait` has not done anything yet.'
        - id: pending-no-thread
          caption: While it is pending, the read uses no thread at all.
        - id: continuation-moves
          caption: '`ConfigureAwait(false)` changes only where the code after the await resumes.'
  - option: 2
    claim:
      id: exceptions-claim
      title: The exception is ignored
      steps:
        - id: caller-awaits
          caption: The caller awaits the library method inside a `try`/`catch`.
        - id: read-throws
          caption: The read fails with an `IOException`.
        - id: swallowed
          caption: 'The claim: the await swallows the exception and `LoadAsync` carries on.'
        - id: catch-skipped
          caption: 'The claim: the caller never sees the failure.'
    reality:
      id: exceptions-reality
      title: What really happens
      steps:
        - id: caller-awaits
          caption: The caller awaits the library method inside a `try`/`catch`.
        - id: read-throws
          caption: The read fails with an `IOException`.
        - id: rethrown
          caption: The continuation resumes on a pool thread and the await rethrows the exception, exactly as it would without `ConfigureAwait`.
        - id: catch-runs
          caption: The faulted `Task` reaches the caller, and its `catch` block handles the exception.
  - option: 3
    claim:
      id: aspnet-core-claim
      title: ASP.NET Core deadlocks without it
      steps:
        - id: action-calls
          caption: An ASP.NET Core action calls the library and blocks on `.Result`.
        - id: action-blocks
          caption: The request thread waits while the read is pending.
        - id: deadlock
          caption: 'The claim: the continuation must return to the request thread, as in a UI app, so it deadlocks.'
    reality:
      id: aspnet-core-reality
      title: What really happens
      steps:
        - id: action-calls
          caption: An ASP.NET Core action calls the library and blocks on `.Result`, which is still bad practice because it ties up a thread.
        - id: action-blocks
          caption: The request thread waits while the read is pending.
        - id: runs-on-pool
          caption: ASP.NET Core has no `SynchronizationContext`, so the continuation runs on the pool even without `ConfigureAwait(false)`.
        - id: result-returns
          caption: '`.Result` returns. No deadlock: here `ConfigureAwait(false)` changes nothing.'
```

- [ ] **Step 10: Run to verify pass**

Run: `npx vitest run src/content`
Expected: PASS (all quiz content tests, including "the shipped question visuals").

- [ ] **Step 11: Commit** (from repo root)

```bash
git add web/src/content content/quiz/visuals
git commit -m "feat(quiz): Question Visual content schema, loader and rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: View model

**Files:**
- Create: `web/src/features/quiz/visuals/visualModel.ts`
- Test: `web/src/features/quiz/visuals/visualModel.test.ts`

**Interfaces:**
- Consumes: `QuizVisual` (Task 1), `QuizOption` from `web/src/content/quiz.ts`, `QuizVisualStage` from `schema.ts`.
- Produces:
  ```ts
  export const LETTERS: readonly ['A', 'B', 'C', 'D']
  export interface View { key: string; kind: 'setup' | 'reality' | 'claim'; stages: QuizVisualStage[]; letter?: string; displayIndex?: number }
  export function setupView(v: QuizVisual): View                     // key 'setup'
  export function answerViews(v: QuizVisual, source: QuizOption[], display: QuizOption[]): View[] // 'reality', then 'claim-<sourceIndex>' in display order
  export function openingKey(views: View[], chosenDisplay: number, correct: boolean): string
  export function stepCount(view: View): number
  export function stepIn(stage: QuizVisualStage, step: number): number   // clamps to the stage's last step
  ```

- [ ] **Step 1: Write the failing tests** — create `web/src/features/quiz/visuals/visualModel.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/quiz/visuals/visualModel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — create `web/src/features/quiz/visuals/visualModel.ts`:

```ts
import type { QuizOption } from '../../../content/quiz'
import type { QuizVisual } from '../../../content/quizVisuals'
import type { QuizVisualStage } from '../../../content/schema'

export const LETTERS = ['A', 'B', 'C', 'D'] as const

/** One tab of a Question Visual: the stages shown side by side and stepped together. */
export interface View {
  key: string
  kind: 'setup' | 'reality' | 'claim'
  stages: QuizVisualStage[]
  /** Claim views: the Option's letter and position in this run (Options are shuffled per run). */
  letter?: string
  displayIndex?: number
}

export const setupView = (v: QuizVisual): View => ({ key: 'setup', kind: 'setup', stages: [v.setup] })

/** The views after answering: the Reality play, then one Claim play per wrong Option in display order. */
export function answerViews(v: QuizVisual, source: QuizOption[], display: QuizOption[]): View[] {
  const claims: View[] = v.claims.map((c) => {
    const displayIndex = display.findIndex((o) => o.text === source[c.option].text)
    return { key: `claim-${c.option}`, kind: 'claim', stages: [c.claim, c.reality], letter: LETTERS[displayIndex], displayIndex }
  })
  claims.sort((a, b) => a.displayIndex! - b.displayIndex!)
  return [{ key: 'reality', kind: 'reality', stages: v.reality.stages }, ...claims]
}

/** The chosen Option's Claim play when wrong, otherwise the Reality play. */
export function openingKey(views: View[], chosenDisplay: number, correct: boolean): string {
  if (correct) return 'reality'
  return views.find((v) => v.displayIndex === chosenDisplay)?.key ?? 'reality'
}

export const stepCount = (view: View): number => Math.max(...view.stages.map((s) => s.steps.length))

/** A shorter stage holds on its last step. */
export const stepIn = (stage: QuizVisualStage, step: number): number => Math.min(step, stage.steps.length - 1)
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/features/quiz/visuals/visualModel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (from repo root)

```bash
git add web/src/features/quiz/visuals
git commit -m "feat(quiz): Question Visual view model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Drawing contract, registry and the ConfigureAwait drawing

**Files:**
- Create: `web/src/features/quiz/visuals/drawing.ts`
- Create: `web/src/features/quiz/visuals/registry.ts`
- Create: `web/src/features/quiz/visuals/drawings/configureawait-false-library.tsx`
- Modify: `web/src/styles/base.css` (append after the Quiz section, i.e. after `.quiz-confirm p { … }` near line 4075)
- Test: `web/src/features/quiz/visuals/drawings.test.tsx`

**Interfaces:**
- Consumes: `getQuizVisuals()` (Task 1).
- Produces:
  ```ts
  // drawing.ts
  export interface StageDrawingProps { stepIds: string[]; stepIndex: number; reduced: boolean }
  export type QuestionDrawing = Record<string, ComponentType<StageDrawingProps>> // key = stage id
  // registry.ts
  export function drawingIds(): string[]
  export function loadDrawing(questionId: string): Promise<QuestionDrawing> | undefined
  ```

- [ ] **Step 1: Write the failing test** — create `web/src/features/quiz/visuals/drawings.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getQuizVisuals } from '../../../content/quizVisuals'
import { drawingIds, loadDrawing } from './registry'

const visuals = getQuizVisuals()

describe('question drawings', () => {
  it('exist exactly for the visuals that have content', () => {
    expect(drawingIds().sort()).toEqual([...visuals.keys()].sort())
  })

  for (const [id, v] of visuals) {
    it(`${id}: draws every stage at every step, and nothing else`, async () => {
      const drawing = await loadDrawing(id)!
      const stages = [v.setup, ...v.reality.stages, ...v.claims.flatMap((c) => [c.claim, c.reality])]
      expect(Object.keys(drawing).sort()).toEqual(stages.map((s) => s.id).sort())
      for (const s of stages) {
        const Stage = drawing[s.id]
        const stepIds = s.steps.map((step) => step.id)
        for (let i = 0; i < stepIds.length; i++) {
          const { unmount } = render(<Stage stepIds={stepIds} stepIndex={i} reduced={false} />)
          unmount()
        }
      }
    })
  }
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/quiz/visuals/drawings.test.tsx`
Expected: FAIL — `./registry` not found.

- [ ] **Step 3: Write the contract and registry**

`web/src/features/quiz/visuals/drawing.ts`:

```ts
import type { ComponentType } from 'react'

/** What a stage drawing gets: the stage's step ids in content order, the step to draw, and the motion preference. */
export interface StageDrawingProps {
  stepIds: string[]
  stepIndex: number
  reduced: boolean
}

/** A question's bespoke drawings, one per stage id in its content file. Drawings hold no captions or controls. */
export type QuestionDrawing = Record<string, ComponentType<StageDrawingProps>>
```

`web/src/features/quiz/visuals/registry.ts`:

```ts
import type { QuestionDrawing } from './drawing'

// Lazy: each question's drawing is its own chunk, so the Quiz bundle does not grow with the number of visuals.
const modules = import.meta.glob<{ default: QuestionDrawing }>('./drawings/*.tsx')
const prefix = './drawings/'

export const drawingIds = (): string[] => Object.keys(modules).map((p) => p.slice(prefix.length, -'.tsx'.length))

export function loadDrawing(questionId: string): Promise<QuestionDrawing> | undefined {
  return modules[`${prefix}${questionId}.tsx`]?.().then((m) => m.default)
}
```

- [ ] **Step 4: Write the drawing** — create `web/src/features/quiz/visuals/drawings/configureawait-false-library.tsx`:

```tsx
import { Fragment, type CSSProperties } from 'react'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

type Lane = 'ui' | 'pool' | 'io' | 'req'
type Kind = 'run' | 'wait' | 'block' | 'dead' | 'ok' | 'q'
interface Block {
  lane: Lane
  kind: Kind
  label: string
  /** Where the work came from, when it moved threads. */
  hop?: string
}
interface LaneSpec {
  lanes: Lane[]
  /** Whether the first lane's thread has a SynchronizationContext. */
  context: boolean
  code: string[]
  /** Per step id: what appears in that step's column, and the code line (0-based) to highlight. */
  steps: Record<string, { blocks: Block[]; line: number }>
}

const LANE: Record<Lane, { name: string; sub: string; tone: string }> = {
  ui: { name: 'UI thread', sub: 'runs the click handler', tone: 'ui' },
  pool: { name: 'Thread pool', sub: 'any free worker', tone: 'pool' },
  io: { name: 'I/O', sub: 'disk or network', tone: 'io' },
  req: { name: 'Request thread', sub: 'ASP.NET Core', tone: 'ui' },
}

const code = (configure: string, caller: string) => [
  'public async Task<int> LoadAsync(Stream stream)',
  '{',
  '    var buffer = new byte[4096];',
  `    int n = await stream.ReadAsync(buffer)${configure};`,
  '    return Parse(buffer, n);',
  '}',
  '',
  caller,
]
const AWAIT = 3
const RETURN = 4
const CALLER = 7
const CAF = '.ConfigureAwait(false)'
const UI_AWAITS = 'async void OnClick(...) => count = await Library.LoadAsync(file);'
const UI_BLOCKS = 'void OnClick(...) => count = Library.LoadAsync(file).Result;'
const UI_TRY = 'try { count = await Library.LoadAsync(file); } catch (IOException) { ... }'
const ACTION_BLOCKS = 'public int Get() => Library.LoadAsync(file).Result; // ASP.NET Core action'

const b = (lane: Lane, kind: Kind, label: string, hop?: string): Block => ({ lane, kind, label, hop })

const blockingStart = {
  'caller-calls': { blocks: [b('ui', 'run', 'OnClick() calls LoadAsync(file)')], line: CALLER },
  'runs-to-await': { blocks: [b('ui', 'run', 'LoadAsync runs up to the await')], line: AWAIT },
  'caller-blocks': { blocks: [b('io', 'wait', 'ReadAsync pending, no thread used'), b('ui', 'block', '.Result blocks the UI thread')], line: CALLER },
  'read-completes': { blocks: [b('io', 'ok', 'Read completes')], line: RETURN },
}

const SPECS: Record<string, LaneSpec> = {
  setup: {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_AWAITS),
    steps: {
      'caller-calls': { blocks: [b('ui', 'run', 'OnClick() calls LoadAsync(file)')], line: CALLER },
      'runs-to-await': { blocks: [b('ui', 'run', 'LoadAsync runs up to the await')], line: AWAIT },
      'read-pending': { blocks: [b('io', 'wait', 'ReadAsync pending')], line: AWAIT },
      'where-next': { blocks: [b('ui', 'q', '?'), b('pool', 'q', '?')], line: RETURN },
    },
  },
  'default-await': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code('', UI_BLOCKS),
    steps: {
      ...blockingStart,
      'posted-back': { blocks: [b('ui', 'dead', 'Continuation queued for the UI thread', '↪ back to the captured context')], line: RETURN },
      deadlock: { blocks: [b('ui', 'dead', 'Deadlock: each waits for the other')], line: RETURN },
    },
  },
  'configure-await-false': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_BLOCKS),
    steps: {
      ...blockingStart,
      'runs-on-pool': { blocks: [b('pool', 'run', 'return Parse(buffer, n)', '↪ no hop back')], line: RETURN },
      'result-returns': { blocks: [b('ui', 'ok', '.Result returns, UI continues')], line: CALLER },
    },
  },
  'thread-pool-claim': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_AWAITS),
    steps: {
      'caller-calls': { blocks: [b('ui', 'run', 'OnClick() calls LoadAsync(file)')], line: CALLER },
      'moved-to-pool': { blocks: [b('pool', 'run', 'ReadAsync starts on a pool thread', '↪ forced off the caller')], line: AWAIT },
      'pool-waits': { blocks: [b('pool', 'block', 'Pool thread waits for the disk')], line: AWAIT },
    },
  },
  'thread-pool-reality': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_AWAITS),
    steps: {
      'caller-calls': { blocks: [b('ui', 'run', 'OnClick() calls LoadAsync(file)')], line: CALLER },
      'starts-on-caller': { blocks: [b('ui', 'run', 'ReadAsync starts on the calling thread')], line: AWAIT },
      'pending-no-thread': { blocks: [b('io', 'wait', 'Pending, no thread held')], line: AWAIT },
      'continuation-moves': { blocks: [b('pool', 'run', 'Only the continuation runs here', '↪ the only thing that moves')], line: RETURN },
    },
  },
  'exceptions-claim': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_TRY),
    steps: {
      'caller-awaits': { blocks: [b('ui', 'run', 'Caller awaits inside try')], line: CALLER },
      'read-throws': { blocks: [b('io', 'dead', 'ReadAsync throws IOException')], line: AWAIT },
      swallowed: { blocks: [b('pool', 'run', 'Exception swallowed, carries on')], line: RETURN },
      'catch-skipped': { blocks: [b('ui', 'run', 'catch never runs')], line: CALLER },
    },
  },
  'exceptions-reality': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_TRY),
    steps: {
      'caller-awaits': { blocks: [b('ui', 'run', 'Caller awaits inside try')], line: CALLER },
      'read-throws': { blocks: [b('io', 'dead', 'ReadAsync throws IOException')], line: AWAIT },
      rethrown: { blocks: [b('pool', 'dead', 'Rethrown at the await', '↪ resumes on the pool, still throws')], line: AWAIT },
      'catch-runs': { blocks: [b('ui', 'ok', 'catch (IOException) runs')], line: CALLER },
    },
  },
  'aspnet-core-claim': {
    lanes: ['req', 'pool', 'io'], context: true, code: code('', ACTION_BLOCKS),
    steps: {
      'action-calls': { blocks: [b('req', 'run', 'Action calls LoadAsync')], line: CALLER },
      'action-blocks': { blocks: [b('io', 'wait', 'ReadAsync pending'), b('req', 'block', '.Result blocks')], line: CALLER },
      deadlock: { blocks: [b('req', 'dead', 'Deadlock', '↪ back to the request context')], line: RETURN },
    },
  },
  'aspnet-core-reality': {
    lanes: ['req', 'pool', 'io'], context: false, code: code('', ACTION_BLOCKS),
    steps: {
      'action-calls': { blocks: [b('req', 'run', 'Action calls LoadAsync')], line: CALLER },
      'action-blocks': { blocks: [b('io', 'wait', 'ReadAsync pending'), b('req', 'block', '.Result blocks')], line: CALLER },
      'runs-on-pool': { blocks: [b('pool', 'run', 'Continuation runs here', '↪ no context to return to')], line: RETURN },
      'result-returns': { blocks: [b('req', 'ok', '.Result returns')], line: CALLER },
    },
  },
}

/** Threads as rows, steps as columns; the library code underneath with the step's line highlighted. */
function LaneStage({ spec, stepIds, stepIndex, reduced }: { spec: LaneSpec } & StageDrawingProps) {
  for (const id of stepIds) if (!spec.steps[id]) throw new Error(`no drawing for step "${id}"`)
  const line = spec.steps[stepIds[stepIndex]].line
  return (
    <div className={`qv-lane-stage${reduced ? ' is-reduced' : ''}`}>
      <div className="qv-lanes" style={{ '--qv-cols': stepIds.length } as CSSProperties}>
        {spec.lanes.map((lane, li) => {
          const info = LANE[lane]
          return (
            <Fragment key={lane}>
              <div className={`qv-lane-name tone-${info.tone}`}>
                {info.name}
                <small>{info.sub}</small>
                {li === 0 && <span className={spec.context ? 'qv-badge' : 'qv-badge is-none'}>{spec.context ? 'SynchronizationContext' : 'no SynchronizationContext'}</span>}
              </div>
              <div className="qv-track">
                {stepIds.map((id, si) => {
                  const block = spec.steps[id].blocks.find((x) => x.lane === lane)
                  if (!block) return <div key={id} className="qv-cell" />
                  const state = si > stepIndex ? '' : si === stepIndex ? ' is-on is-now' : ' is-on'
                  return (
                    <div key={id} className={`qv-cell qv-block is-${block.kind} tone-${info.tone}${state}`} aria-hidden={si > stepIndex || undefined}>
                      {block.hop && <span className="qv-hop">{block.hop}</span>}
                      {block.label}
                    </div>
                  )
                })}
              </div>
            </Fragment>
          )
        })}
      </div>
      <pre className="qv-code">
        {spec.code.map((text, i) => (
          <span key={i} className={i === line ? 'qv-line is-on' : 'qv-line'}>
            {text || ' '}
            {'\n'}
          </span>
        ))}
      </pre>
    </div>
  )
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, spec]) => [stage, (p: StageDrawingProps) => <LaneStage spec={spec} {...p} />]),
)
export default drawing
```

- [ ] **Step 5: Add the drawing CSS** — append to `web/src/styles/base.css` after the Quiz section:

```css
/* ---------- Question Visual drawings: lanes ---------- */

.qv-lane-stage { display: flex; flex-direction: column; gap: var(--space-3); }
.qv-lanes { display: grid; grid-template-columns: 130px minmax(0, 1fr); row-gap: var(--space-2); }
.qv-lane-name { padding: var(--space-2) var(--space-2) var(--space-2) 0; border-right: 3px solid var(--tone-c); font-size: var(--fs-12); font-weight: 600; }
.qv-lane-name small { display: block; color: var(--muted); font-weight: 400; }
.tone-ui { --tone-c: var(--role-contract); }
.tone-pool { --tone-c: var(--role-concrete); }
.tone-io { --tone-c: var(--role-primary); }
.qv-badge { display: inline-block; margin-top: var(--space-1); padding: 0 5px; border-radius: 4px; background: color-mix(in srgb, var(--tone-c) 16%, transparent); color: var(--tone-c); font-size: 10px; font-weight: 600; }
.qv-badge.is-none { background: none; border: 1px dashed var(--muted); color: var(--muted); }
.qv-track { display: grid; grid-template-columns: repeat(var(--qv-cols), minmax(0, 1fr)); gap: var(--space-1); padding: var(--space-1) 0 var(--space-1) var(--space-2); border-bottom: 1px dashed var(--border); min-height: 44px; }
.qv-cell { min-width: 0; }
.qv-block { padding: 5px 7px; border: 1px solid var(--tone-c); border-radius: var(--radius); background: color-mix(in srgb, var(--tone-c) 10%, var(--surface)); font-size: var(--fs-12); line-height: 1.3; overflow-wrap: anywhere; opacity: 0; transform: translateY(4px); transition: opacity 0.25s, transform 0.25s; }
.qv-block.is-on { opacity: 1; transform: none; }
.qv-block.is-now { box-shadow: 0 0 0 2px var(--accent); }
.qv-block.is-wait { border-style: dashed; background: repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--tone-c) 10%, transparent) 6px 12px); }
.qv-block.is-block { --tone-c: var(--warn); }
.qv-block.is-dead { --tone-c: var(--bad); font-weight: 600; }
.qv-block.is-ok { --tone-c: var(--ok); font-weight: 600; }
.qv-block.is-q { --tone-c: var(--muted); border-style: dashed; display: flex; align-items: center; justify-content: center; font-size: var(--fs-17); }
.qv-hop { display: block; color: var(--tone-c); font-size: 10px; font-weight: 600; }
.qv-code { margin: 0; padding: var(--space-2) 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); font-family: var(--font-mono); font-size: var(--fs-12); overflow-x: auto; }
.qv-line { display: block; padding: 0 var(--space-3); white-space: pre; }
.qv-line.is-on { background: var(--line-highlight); }
.qv-lane-stage.is-reduced .qv-block { transition: none; transform: none; }
@media (prefers-reduced-motion: reduce) { .qv-block { transition: none; transform: none; } }
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run src/features/quiz/visuals`
Expected: PASS.

- [ ] **Step 7: Commit** (from repo root)

```bash
git add web/src/features/quiz/visuals web/src/styles/base.css
git commit -m "feat(quiz): drawing registry and the ConfigureAwait drawing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The frame and QuizRun integration

The frame is only reachable through `QuizRun` (it is controlled by it), so they are built and tested together.

**Files:**
- Create: `web/src/features/quiz/typing.ts` (moved out of `QuizRun.tsx`)
- Create: `web/src/features/quiz/visuals/QuestionVisual.tsx`
- Modify: `web/src/features/quiz/QuizRun.tsx`
- Modify: `web/src/features/quiz/QuizPage.tsx:49` (class while running)
- Modify: `web/src/locales/en/quiz.json`
- Modify: `web/src/styles/base.css` (`.quiz-page`, `.quiz-question`, `.quiz-options`; frame styles)
- Test: `web/src/features/quiz/QuizRun.visual.test.tsx`, `web/src/features/quiz/QuizRun.visual.reducedMotion.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–3 (`getQuizVisual`, `answerViews`, `openingKey`, `setupView`, `stepCount`, `stepIn`, `LETTERS`, `loadDrawing`, `QuestionDrawing`).
- Produces:
  ```ts
  // typing.ts
  export function typing(target: EventTarget | null): boolean
  // QuestionVisual.tsx
  export const STEP_MS = 1600
  export interface QuestionVisualProps { visual: QuizVisual; sourceOptions: QuizOption[]; displayOptions: QuizOption[]; answered: boolean; view: string; onView(key: string): void; autoplay: number }
  export function QuestionVisual(props: QuestionVisualProps): JSX.Element
  // QuizRun.tsx — new optional prop
  record?: (questionId: string, correct: boolean, now: Date) => Promise<BoxChange | null>  // defaults to recordAnswer
  ```

- [ ] **Step 1: Write the failing integration tests** — create `web/src/features/quiz/QuizRun.visual.test.tsx`:

```tsx
import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getQuizBank } from '../../content/quiz'
import type { RunQuestion } from '../../quiz/run'
import { QuizRun } from './QuizRun'

const q = getQuizBank().find((x) => x.id === 'configureawait-false-library')!
// display order: [3, 0, 1, 2] — so file option 1 shows as C, 2 as D, 3 as A; the correct one is B
const display = [q.options[3], q.options[0], q.options[1], q.options[2]]
const withVisual: RunQuestion = { question: q, topicTitle: 'Async & concurrency', options: display }
const plain: RunQuestion = {
  question: { id: 'plain', topicId: 'testing', question: 'Plain?', options: [] },
  topicTitle: 'Testing',
  options: ['w1', 'right', 'w2', 'w3'].map((t) => ({ text: t, correct: t === 'right', explanation: `Why ${t}.` })),
}
const record = vi.fn(async () => null)
const key = (k: string, target: Element = document.body) => fireEvent.keyDown(target, { key: k })
const panel = () => screen.getByRole('region', { name: 'Question visual' })

beforeEach(() => record.mockClear())

function setup() {
  render(<QuizRun questions={[withVisual, plain]} onFinish={() => {}} onQuit={() => {}} record={record} />)
}

describe('QuizRun with a Question Visual', () => {
  it('shows the Setup before answering, without tabs or autoplay', async () => {
    setup()
    expect(within(panel()).getByText('Where does the code after the await run?')).toBeInTheDocument()
    expect(within(panel()).queryByRole('group', { name: 'Views' })).not.toBeInTheDocument()
    expect(within(panel()).getByText('Step 1 of 4')).toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(await within(panel()).findByText('runs the click handler')).toBeInTheDocument() // the drawing loaded
  })

  it('a wrong answer opens and autoplays that Option’s Claim play, labelled with its display letter', async () => {
    setup()
    key('3') // display C = file option 1 (thread pool)
    key('Enter')
    const tabs = within(panel()).getByRole('group', { name: 'Views' })
    expect(within(tabs).getAllByRole('button').map((b) => b.textContent)).toEqual(['What really happens', 'What A claims', 'What C claims', 'What D claims'])
    expect(within(tabs).getByRole('button', { name: 'What C claims' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(panel()).getByText('ReadAsync is moved to the thread pool')).toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('a correct answer opens the Reality play', () => {
    setup()
    key('2')
    key('Enter')
    expect(within(panel()).getByRole('button', { name: 'What really happens' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(panel()).getByText('await without ConfigureAwait')).toBeInTheDocument()
  })

  it('“See what A claims” in an Explanation opens that tab', () => {
    setup()
    key('2')
    key('Enter')
    fireEvent.click(screen.getByRole('button', { name: 'See what A claims' }))
    expect(within(panel()).getByRole('button', { name: 'What A claims' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('steps all stages together; the shorter one holds its last caption', () => {
    setup()
    key('2')
    key('Enter')
    fireEvent.click(within(panel()).getByRole('button', { name: 'What A claims' })) // claim 3 steps, reality 4 steps
    const forward = within(panel()).getByRole('button', { name: 'Step forward' })
    for (let i = 0; i < 3; i++) fireEvent.click(forward)
    expect(within(panel()).getByText('Step 4 of 4')).toBeInTheDocument()
    expect(within(panel()).getByText(/the continuation must return to the request thread/)).toBeInTheDocument()
    expect(forward).toBeDisabled()
  })

  it('arrows step after answering from anywhere, stopping playback', () => {
    setup()
    key('2')
    key('Enter')
    key('ArrowRight')
    expect(within(panel()).getByText('Step 2 of 6')).toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: 'Play' })).toBeInTheDocument()
    key('ArrowLeft')
    expect(within(panel()).getByText('Step 1 of 6')).toBeInTheDocument()
  })

  it('before answering, arrows on a radio belong to the radios; inside the panel they step', () => {
    setup()
    key('ArrowRight', screen.getAllByRole('radio')[0])
    expect(within(panel()).getByText('Step 1 of 4')).toBeInTheDocument()
    key('ArrowRight', within(panel()).getByRole('button', { name: 'Play' }))
    expect(within(panel()).getByText('Step 2 of 4')).toBeInTheDocument()
  })

  it('plays once at 1600 ms per step and stops on the last step', () => {
    vi.useFakeTimers()
    try {
      setup()
      key('2')
      key('Enter')
      // one timer per step, each scheduled by the render the previous one caused
      for (let i = 0; i < 5; i++) act(() => vi.advanceTimersByTime(1600))
      expect(within(panel()).getByText('Step 6 of 6')).toBeInTheDocument()
      expect(within(panel()).getByRole('button', { name: 'Play' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('captions are live regions', () => {
    setup()
    expect(within(panel()).getByText('A click handler on the UI thread calls a library method.')).toHaveAttribute('aria-live', 'polite')
  })

  it('Enter moves on mid-play, and a question without a visual has no visual panel', () => {
    setup()
    key('2')
    key('Enter')
    key('Enter')
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Question visual' })).not.toBeInTheDocument()
    expect(screen.getByText('1–4 select · Enter submits · Esc quits')).toBeInTheDocument()
  })

  it('shows the arrow hint only on questions with a visual', () => {
    setup()
    expect(screen.getByText('1–4 select · Enter submits · ←/→ step the visual · Esc quits')).toBeInTheDocument()
  })
})
```

Create `web/src/features/quiz/QuizRun.visual.reducedMotion.test.tsx`:

```tsx
import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { getQuizBank } from '../../content/quiz'
import { QuizRun } from './QuizRun'

// motion reads the preference once per module graph, so this lives in its own file.
beforeAll(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList)
})

describe('Question Visual under prefers-reduced-motion', () => {
  it('does not autoplay after answering', () => {
    const q = getQuizBank().find((x) => x.id === 'configureawait-false-library')!
    render(<QuizRun questions={[{ question: q, topicTitle: 'Async', options: q.options }]} onFinish={() => {}} onQuit={() => {}} record={async () => null} />)
    fireEvent.keyDown(document.body, { key: '2' })
    fireEvent.keyDown(document.body, { key: 'Enter' })
    const panel = screen.getByRole('region', { name: 'Question visual' })
    expect(within(panel).getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(within(panel).getByText('Step 1 of 4')).toBeInTheDocument()
  })
})
```

(File order here: option index 1 is wrong → its Claim play has 3 + 4 steps → "Step 1 of 4".)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/quiz/QuizRun.visual`
Expected: FAIL — no region "Question visual"; `record` prop unknown.

- [ ] **Step 3: Move `typing`** — create `web/src/features/quiz/typing.ts` with the function from `QuizRun.tsx:20-25` (exported, same body and doc comment), delete it from `QuizRun.tsx`, and add `import { typing } from './typing'` there.

- [ ] **Step 4: Add the strings** — in `web/src/locales/en/quiz.json`, inside `"run"` add after `"keys"`:

```json
    "keysVisual": "1–4 select · Enter submits · ←/→ step the visual · Esc quits",
    "seeClaim": "See what {{letter}} claims",
```

and add a top-level `"visual"` object after `"run"`:

```json
  "visual": {
    "label": "Question visual",
    "setup": "Before you answer",
    "explanation": "After you answer",
    "views": "Views",
    "reality": "What really happens",
    "claimTab": "What {{letter}} claims",
    "claimTitle": "Option {{letter}}: what it claims, and what really happens",
    "tagClaim": "Claim",
    "tagReality": "Reality",
    "stepBack": "Step back",
    "play": "Play",
    "pause": "Pause",
    "stepForward": "Step forward",
    "position": "Step {{n}} of {{m}}",
    "loading": "Loading the picture…"
  },
```

- [ ] **Step 5: Write the frame** — create `web/src/features/quiz/visuals/QuestionVisual.tsx`:

```tsx
import { Pause, Play, StepBack, StepForward } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { QuizOption } from '../../../content/quiz'
import type { QuizVisual } from '../../../content/quizVisuals'
import { inlineCode } from '../../exercise/inlineCode'
import { typing } from '../typing'
import type { QuestionDrawing } from './drawing'
import { loadDrawing } from './registry'
import { answerViews, setupView, stepCount, stepIn } from './visualModel'

export const STEP_MS = 1600

export interface QuestionVisualProps {
  visual: QuizVisual
  /** The Options in file order (what content indexes refer to) and in this run's display order. */
  sourceOptions: QuizOption[]
  displayOptions: QuizOption[]
  answered: boolean
  /** The open view's key; QuizRun owns it so the Explanations' "See what X claims" buttons can open a tab. */
  view: string
  onView(key: string): void
  /** Increments when the open view should play once by itself (spec §5.2). */
  autoplay: number
}

/** The shared frame around a question's bespoke drawings: views, synced stepping, playback, keys and captions. */
export function QuestionVisual({ visual, sourceOptions, displayOptions, answered, view, onView, autoplay }: QuestionVisualProps) {
  const { t } = useTranslation('quiz')
  const ids = useId()
  const reduced = useReducedMotion() ?? false
  const panel = useRef<HTMLElement>(null)
  const views = useMemo(
    () => (answered ? answerViews(visual, sourceOptions, displayOptions) : [setupView(visual)]),
    [answered, visual, sourceOptions, displayOptions],
  )
  const current = views.find((v) => v.key === view) ?? views[0]
  const count = stepCount(current)

  // Step and play state belong to one view; another view starts at step 1, stopped.
  const [shown, setShown] = useState({ key: current.key, step: 0, playing: false })
  const state = shown.key === current.key ? shown : { key: current.key, step: 0, playing: false }
  const go = (n: number) => setShown({ key: current.key, step: Math.max(0, Math.min(count - 1, n)), playing: false })
  const toggle = () =>
    setShown(state.playing ? { ...state, playing: false } : { key: current.key, step: state.step >= count - 1 ? 0 : state.step, playing: true })

  const seenAutoplay = useRef(autoplay)
  useEffect(() => {
    if (autoplay === seenAutoplay.current) return
    seenAutoplay.current = autoplay
    if (!reduced) setShown({ key: current.key, step: 0, playing: true })
  }, [autoplay, reduced, current.key])

  // One timeout per step, restarted whenever the step or play state changes; stops on the last step.
  useEffect(() => {
    if (!state.playing) return
    if (state.step >= count - 1) {
      setShown({ key: state.key, step: state.step, playing: false })
      return
    }
    const id = setTimeout(() => setShown({ key: state.key, step: state.step + 1, playing: true }), STEP_MS)
    return () => clearTimeout(id)
  }, [state.key, state.step, state.playing, count])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target
      if (typing(target)) return
      if (target instanceof HTMLInputElement && target.type === 'radio') return // the Options own ←/→
      const inside = target instanceof Node && panel.current?.contains(target) === true
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!answered && !inside) return
        e.preventDefault()
        go(state.step + (e.key === 'ArrowRight' ? 1 : -1))
      } else if (e.key === ' ' && inside && !(target instanceof HTMLButtonElement)) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const [drawing, setDrawing] = useState<{ id: string; stages: QuestionDrawing } | null>(null)
  useEffect(() => {
    let live = true
    loadDrawing(visual.question)?.then((stages) => live && setDrawing({ id: visual.question, stages }))
    return () => {
      live = false
    }
  }, [visual.question])
  const stages = drawing?.id === visual.question ? drawing.stages : null

  const title = current.kind === 'setup' ? visual.setup.title : current.kind === 'reality' ? visual.reality.title : t('visual.claimTitle', { letter: current.letter })
  const tag = (i: number) => (current.kind !== 'claim' ? null : i === 0 ? ['is-claim', t('visual.tagClaim')] : ['is-reality', t('visual.tagReality')])

  return (
    <section ref={panel} className="panel quiz-visual" aria-label={t('visual.label')}>
      <div className="prog-panel-body">
        <div className="qv-head">
          <div>
            <p className="qv-phase">{answered ? t('visual.explanation') : t('visual.setup')}</p>
            <h2 className="qv-title" id={`${ids}-title`}>{title}</h2>
          </div>
          {answered && (
            <div className="qv-tabs" role="group" aria-label={t('visual.views')}>
              {views.map((v) => (
                <button key={v.key} type="button" className={`qv-tab is-${v.kind}`} aria-pressed={v.key === current.key} onClick={() => onView(v.key)}>
                  {v.kind === 'reality' ? t('visual.reality') : t('visual.claimTab', { letter: v.letter })}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={current.stages.length > 1 ? 'qv-stages is-pair' : 'qv-stages'}>
          {current.stages.map((s, i) => {
            const at = stepIn(s, state.step)
            const Stage = stages?.[s.id]
            const tg = tag(i)
            return (
              <figure key={s.id} className="qv-stage">
                <figcaption className="qv-stage-title">
                  {s.title}
                  {tg && <span className={`qv-tag ${tg[0]}`}>{tg[1]}</span>}
                </figcaption>
                {Stage ? <Stage stepIds={s.steps.map((x) => x.id)} stepIndex={at} reduced={reduced} /> : <p className="prog-hint">{t('visual.loading')}</p>}
                <p className="qv-caption" aria-live="polite">{inlineCode(s.steps[at].caption)}</p>
              </figure>
            )
          })}
        </div>
        <div className="qv-player">
          <button type="button" className="btn btn-quiet btn-small" onClick={() => go(state.step - 1)} disabled={state.step === 0}>
            <StepBack size={14} aria-hidden="true" /> {t('visual.stepBack')}
          </button>
          <button type="button" className="btn btn-quiet btn-small" onClick={toggle}>
            {state.playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />} {state.playing ? t('visual.pause') : t('visual.play')}
          </button>
          <button type="button" className="btn btn-quiet btn-small" onClick={() => go(state.step + 1)} disabled={state.step >= count - 1}>
            <StepForward size={14} aria-hidden="true" /> {t('visual.stepForward')}
          </button>
          <span className="qv-pos">{t('visual.position', { n: state.step + 1, m: count })}</span>
        </div>
      </div>
    </section>
  )
}
```

Captions render `` `code` `` through `inlineCode`, like the rest of the Quiz.

- [ ] **Step 6: Wire it into `QuizRun.tsx`**

1. Imports: `import { getQuizVisual } from '../../content/quizVisuals'`, `import { QuestionVisual } from './visuals/QuestionVisual'`, `import { answerViews, openingKey } from './visuals/visualModel'`. Keep the file's own `LETTERS`; `BoxChange` is already imported.
2. Signature: add `record = recordAnswer` to the destructured props, typed `record?: (questionId: string, correct: boolean, now: Date) => Promise<BoxChange | null>`. In `submit`, call `record(...)` instead of `recordAnswer(...)`. `Locked.change` stays `BoxChange | null`.
3. State, after `const [confirming, …]`:

```ts
  const [visualView, setVisualView] = useState('setup')
  const [autoplay, setAutoplay] = useState(0)
```

   and after `const last = …`: `const visual = getQuizVisual(current.question.id)`.
4. In `submit`, after `setLocked(...)`:

```ts
    if (visual) {
      setVisualView(openingKey(answerViews(visual, current.question.options, current.options), selected, correct))
      setAutoplay((n) => n + 1)
    }
```

5. In `next`, next to `setLocked(null)`: `setVisualView('setup')`.
6. Inside the Explanation block, after `<QuizText text={o.explanation} />`:

```tsx
                    {visual && !o.correct && (
                      <button
                        type="button"
                        className="btn btn-quiet btn-small quiz-see-claim"
                        onClick={() => setVisualView(`claim-${current.question.options.findIndex((s) => s.text === o.text)}`)}
                      >
                        {t('run.seeClaim', { letter: LETTERS[i] })}
                      </button>
                    )}
```

7. Key hint: `{t(visual ? 'run.keysVisual' : 'run.keys')}`.
8. Return a fragment: wrap the existing `<section …>…</section>` as `<>…</>` and after it add:

```tsx
      {visual && (
        <QuestionVisual
          key={index}
          visual={visual}
          sourceOptions={current.question.options}
          displayOptions={current.options}
          answered={locked !== null}
          view={visualView}
          onView={setVisualView}
          autoplay={autoplay}
        />
      )}
```

- [ ] **Step 7: Wide layout and frame CSS** — in `web/src/features/quiz/QuizPage.tsx:49` use `className={phase.kind === 'run' ? 'quiz-page is-running' : 'quiz-page'}`. In `web/src/styles/base.css`:

   - After the `.quiz-page { … }` rule add `.quiz-page.is-running { max-width: 1600px; }`.
   - In `.quiz-question { … }` add `max-width: 80ch;`.
   - After the `.quiz-options { … }` rule add:

```css
@media (min-width: 900px) {
  .quiz-page.is-running .quiz-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
}
.quiz-see-claim { margin-top: var(--space-1); }
```

   - Append the frame styles after the drawing styles from Task 3:

```css
/* ---------- Question Visual frame ---------- */

.qv-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: var(--space-3); }
.qv-phase { margin: 0; color: var(--muted); font-size: var(--fs-12); text-transform: uppercase; letter-spacing: 0.05em; }
.qv-title { margin: 0; font-size: var(--fs-17); }
.qv-tabs { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.qv-tab { padding: 4px 12px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); font: inherit; font-size: var(--fs-13); cursor: pointer; }
.qv-tab[aria-pressed='true'] { background: var(--text); color: var(--surface); border-color: var(--text); }
.qv-tab:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.qv-stages { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-4); }
@media (min-width: 1100px) { .qv-stages.is-pair { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.qv-stage { margin: 0; min-width: 0; padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius); background: var(--code-bg); display: flex; flex-direction: column; gap: var(--space-3); }
.qv-stage-title { display: flex; align-items: center; gap: var(--space-2); font-weight: 600; font-size: var(--fs-14); }
.qv-tag { padding: 0 8px; border: 1px solid currentColor; border-radius: 999px; font-size: var(--fs-12); }
.qv-tag.is-claim { color: var(--bad); }
.qv-tag.is-reality { color: var(--ok); }
.qv-caption { margin: 0; font-size: var(--fs-14); min-height: 2.8em; }
.qv-player { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); padding-top: var(--space-3); border-top: 1px solid var(--border); }
.qv-pos { margin-left: auto; color: var(--muted); font-size: var(--fs-13); }
```

- [ ] **Step 8: Run the new and existing Quiz tests**

Run: `npx vitest run src/features/quiz src/content`
Expected: PASS — the new visual tests and every existing `QuizRun`/`QuizPage` test (the test questions there have no visual, so they keep the old key hint and render no panel).

- [ ] **Step 9: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 10: Commit** (from repo root)

```bash
git add web/src
git commit -m "feat(quiz): Question Visual frame in a wide Quiz layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Dev harness and e2e

**Files:**
- Create: `web/src/features/dev/DevQuizVisualPage.tsx`
- Modify: `web/src/App.tsx` (import near line 12; route after line 100)
- Create: `web/e2e/quiz-visual.spec.ts`
- Create: `web/e2e/visual-shots.spec.ts`

**Interfaces:**
- Consumes: `QuizRun` with `record` (Task 4), `getQuizVisuals`/`getQuizVisual` (Task 1), `getQuizBank`/`getQuizTopics`.
- Produces: dev route `/dev/quiz-visual` (list) and `/dev/quiz-visual/:id` (the question unshuffled, then one question without a visual; answers are not recorded; `data-testid="dev-correct"` holds the correct Option's file index). Screenshots in `web/test-results/visual-shots/<id>/<width>/<view>-<step>.png`.

- [ ] **Step 1: Write the harness** — create `web/src/features/dev/DevQuizVisualPage.tsx`:

```tsx
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { getQuizBank, getQuizTopics, type QuizQuestion } from '../../content/quiz'
import { getQuizVisual, getQuizVisuals } from '../../content/quizVisuals'
import type { RunQuestion } from '../../quiz/run'
import { QuizRun } from '../quiz/QuizRun'

// Dev-only harness (registered only when import.meta.env.DEV) for reviewing one Question Visual: its question with
// Options in file order, then a question without a visual. Answers are not recorded, so Boxes stay untouched.
const asRun = (q: QuizQuestion): RunQuestion => ({ question: q, topicTitle: getQuizTopics().find((t) => t.id === q.topicId)?.title ?? q.topicId, options: q.options })

export function DevQuizVisualPage() {
  const { id } = useParams()
  const [round, setRound] = useState(0)
  if (!id) {
    return (
      <ul>
        {[...getQuizVisuals().keys()].map((v) => (
          <li key={v}><Link to={`/dev/quiz-visual/${v}`}>{v}</Link></li>
        ))}
      </ul>
    )
  }
  const bank = getQuizBank()
  const q = bank.find((x) => x.id === id)
  if (!q || !getQuizVisual(id)) return <p>No Question Visual for “{id}”.</p>
  const plain = bank.find((x) => !getQuizVisual(x.id))!
  return (
    <div className="quiz-page is-running">
      <p hidden data-testid="dev-correct">{q.options.findIndex((o) => o.correct)}</p>
      <QuizRun key={round} questions={[asRun(q), asRun(plain)]} onFinish={() => setRound((r) => r + 1)} onQuit={() => setRound((r) => r + 1)} record={async () => null} />
    </div>
  )
}
```

In `web/src/App.tsx` add `import { DevQuizVisualPage } from './features/dev/DevQuizVisualPage'` and, after the `/dev/visuals` route:

```tsx
      {import.meta.env.DEV && <Route path="/dev/quiz-visual/:id?" element={<DevQuizVisualPage />} />}
```

- [ ] **Step 2: Write the e2e test** — create `web/e2e/quiz-visual.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

const url = '/dev/quiz-visual/configureawait-false-library'
const overflow = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test('a wrong answer autoplays its Claim play; arrows step; Enter moves on mid-play', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(url)
  const panel = page.getByRole('region', { name: 'Question visual' })
  await expect(panel.getByText('Step 1 of 4')).toBeVisible()

  // before answering, ←/→ on a radio move the selection and leave the Setup alone
  await page.getByRole('radio').first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio').nth(1)).toBeChecked()
  await expect(panel.getByText('Step 1 of 4')).toBeVisible()

  await page.keyboard.press('2') // file order in the harness: index 1 is wrong
  await page.keyboard.press('Enter')
  await expect(panel.getByRole('button', { name: 'What B claims' })).toHaveAttribute('aria-pressed', 'true')
  await expect(panel.getByRole('button', { name: 'Pause' })).toBeVisible()
  expect(await overflow(page)).toBeLessThanOrEqual(0)

  await panel.getByRole('button', { name: 'What really happens' }).click()
  await page.getByRole('button', { name: 'Next question' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(panel.getByText('Step 2 of 6')).toBeVisible()

  await panel.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'Next question' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Question 2 of 2')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Question visual' })).toHaveCount(0)
})

test('the visual fits a 390px screen without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(url)
  await page.keyboard.press('2')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Question visual' }).getByRole('button', { name: 'Pause' })).toBeVisible()
  expect(await overflow(page)).toBeLessThanOrEqual(0)
})
```

- [ ] **Step 3: Write the review-screenshot spec** — create `web/e2e/visual-shots.spec.ts`:

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { readdirSync } from 'node:fs'

// Review screenshots (spec §8), not a test: run with SHOTS=1, optionally VISUAL=<question-id>.
const dir = new URL('../../content/quiz/visuals/', import.meta.url)
const ids = readdirSync(dir).filter((f) => f.endsWith('.en.yaml')).map((f) => f.replace(/\.en\.yaml$/, ''))

test.skip(!process.env.SHOTS, 'set SHOTS=1 to capture review screenshots')

async function shootSteps(page: Page, panel: Locator, out: string) {
  const pos = panel.getByText(/^Step \d+ of \d+$/)
  const total = Number((await pos.textContent())!.match(/of (\d+)/)![1])
  for (let i = 1; i <= total; i++) {
    await expect(pos).toHaveText(`Step ${i} of ${total}`)
    await page.screenshot({ path: `${out}-${i}.png`, fullPage: true })
    if (i < total) await panel.getByRole('button', { name: 'Step forward' }).click()
  }
}

for (const id of ids.filter((i) => !process.env.VISUAL || i === process.env.VISUAL)) {
  for (const width of [1920, 390]) {
    test(`${id} @${width}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' }) // no autoplay, no fades: every shot is a settled step
      await page.setViewportSize({ width, height: 1080 })
      await page.goto(`/dev/quiz-visual/${id}`)
      const panel = page.getByRole('region', { name: 'Question visual' })
      await expect(panel.getByRole('figure').first()).not.toContainText('Loading the picture')
      const out = `test-results/visual-shots/${id}/${width}`
      await shootSteps(page, panel, `${out}/setup`)
      const correct = Number(await page.getByTestId('dev-correct').textContent())
      await page.getByRole('radio').nth(correct).check()
      await page.getByRole('button', { name: 'Submit' }).click()
      const tabs = panel.getByRole('group', { name: 'Views' }).getByRole('button')
      for (let t = 0; t < (await tabs.count()); t++) {
        const name = (await tabs.nth(t).textContent())!.replace(/\W+/g, '-').toLowerCase()
        await tabs.nth(t).click()
        await shootSteps(page, panel, `${out}/${t + 1}-${name}`)
      }
    })
  }
}
```

- [ ] **Step 4: Run e2e**

Run: `npx playwright test quiz-visual quiz.spec`
Expected: PASS (the new spec and the existing Quiz e2e, whose 390px test must still have no horizontal scroll).

- [ ] **Step 5: Capture the screenshots once** (bash)

Run: `SHOTS=1 npx playwright test visual-shots`
Expected: PASS, and `web/test-results/visual-shots/configureawait-false-library/{1920,390}/` holds setup-1…4, 1-what-really-happens-1…6, and one set per claim tab.

- [ ] **Step 6: Commit** (from repo root)

```bash
git add web/src web/e2e
git commit -m "test(quiz): Question Visual dev harness, e2e and review screenshots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Review loop, learner try-out, close M1

- [ ] **Step 1: Review** — dispatch a fresh reviewer subagent (same model as the Quiz reviews). Give it: the question block of `configureawait-false-library` from `content/quiz/async-concurrency.en.yaml`, `content/quiz/visuals/configureawait-false-library.en.yaml`, the screenshot folder from Task 5 Step 5, and the rubric from spec §8 verbatim. Ask for `OK` or `NOT OK` with reasons. It may check Microsoft Learn.
- [ ] **Step 2: Iterate** — on NOT OK, fix the content and/or drawing, rerun `npx vitest run src/content src/features/quiz` and `SHOTS=1 VISUAL=configureawait-false-library npx playwright test visual-shots`, and resubmit to a fresh reviewer until OK. Commit each fix (`fix(quiz): …` + the Co-Authored-By line).
- [ ] **Step 3: Full verification**

Run: `npx vitest run && npx tsc -b && npm run lint && npx playwright test`
Expected: everything passes.

- [ ] **Step 4: Learner try-out** — ask the learner to open `/quiz` (or `/dev/quiz-visual/configureawait-false-library`) on their own screen and try the flow. Any frame changes they ask for are made now, before M2.
- [ ] **Step 5: Close M1** — in the spec header set `**Status:** accepted · M1 complete, M2 not started.` and commit (`docs(quiz): Question Visuals M1 complete`). Then use superpowers:finishing-a-development-branch.
