# Exam Helpers (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An optional **Helpers** switch on the Exam setup page that, during an Exam Session, offers *Check my answer*, *Show pattern* and *Reveal solution* per question, records which ones were used, and shows that in the Report and exam history, without changing the score.

**Architecture:** A pure module `web/src/exam/helpUse.ts` owns the help-use record (add, ask, count). `ExamSetup.helpers` and `ExamAnswer.help` are optional fields (missing = off / none), so stored and exported sessions from before need no migration. A new `HelpersPanel` component renders the three Helpers inside the session page. The session page owns persistence (through its existing `update` path) and runner exclusivity (Run, Check and Submit never overlap).

**Tech Stack:** React 19 + TypeScript, react-i18next, Vitest + Testing Library + fake-indexeddb, Playwright, zod, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-11-exam-helpers-design.md` (Phase 1 sections only; Phase 2 hints are a later plan).

## Global Constraints

- All work happens in the worktree `E:\Projects\Claude\design-patterns-trainer-exam-helpers` on branch `feat/exam-helpers`. Run every web command from its `web/` folder.
- Unit tests: `npx vitest run <path>`. Lint: `npm run lint`. Types and build: `npm run build`.
- With Helpers off, the Exam must behave exactly as before: no new UI on the session page, same grading.
- Helped sessions count normally: `gradeSession`, `scoring.ts` and `bestExamScores` are not touched.
- Help-use values are exactly `'check' | 'pattern' | 'solution' | 'hint1' | 'hint2' | 'hint3'` (the hints are Phase 2, but the type and import schema accept them now).
- The remembered switch is `localStorage` key `exam.helpers`, holding `'true'` or `'false'`. Every access is wrapped in try/catch, and the default is off.
- All user-visible text goes through i18n (`web/src/locales/en/*.json`). Plain, short English.
- No browser `alert`/`confirm`/`prompt`. Confirmations happen inline in the page.
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

---

### Task 1: Help-use record, storage and import

**Files:**
- Modify: `web/src/exam/types.ts`
- Create: `web/src/exam/helpUse.ts`
- Create: `web/src/exam/helpUse.test.ts`
- Modify: `web/src/exam/examStore.ts` (`saveAnswer`)
- Modify: `web/src/exam/examStore.test.ts` (add tests to `describe('answers')`)
- Modify: `web/src/progress/exportImport.ts` (zod `answer` and `examSetup`)

**Interfaces:**
- Produces:
  - `type HelpUse = 'check' | 'pattern' | 'solution' | 'hint1' | 'hint2' | 'hint3'` exported from `exam/types.ts`
  - `ExamSetup.helpers?: boolean`, `ExamAnswer.help?: HelpUse[]`
  - `withHelp(answer: ExamAnswer, use: HelpUse): ExamAnswer`: returns the *same object* when `use` is already recorded
  - `sessionUsedHelp(session: ExamSession): boolean`
  - `helperCounts(sessions: ExamSession[]): { withHelp: number; without: number }`: submitted sessions only

- [ ] **Step 1: Add the types** in `web/src/exam/types.ts`

```ts
/** A Helper the learner used on one Exam Question. */
export type HelpUse = 'check' | 'pattern' | 'solution' | 'hint1' | 'hint2' | 'hint3'

export interface ExamSetup {
  count: number
  scope: ExamScope
  named: boolean
  timed: boolean
  /** Helpers are offered during the session. Missing (sessions from before Helpers) means off. */
  helpers?: boolean
}

export interface ExamAnswer {
  code: string
  /** Pattern id, or null when not chosen. */
  identification: string | null
  /** The Helpers used on this question, each once, in first-use order. Missing means none. */
  help?: HelpUse[]
}
```

- [ ] **Step 2: Write the failing tests** `web/src/exam/helpUse.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { helperCounts, sessionUsedHelp, withHelp } from './helpUse'
import type { ExamAnswer, ExamSession } from './types'

const answer: ExamAnswer = { code: 'x', identification: null }
const session = (status: ExamSession['status'], answers: Record<string, ExamAnswer>): ExamSession => ({
  id: Math.random().toString(),
  status,
  setup: { count: 1, scope: { kind: 'all' }, named: true, timed: false, helpers: true },
  questionKeys: Object.keys(answers),
  startedAt: '2026-11-11T10:00:00.000Z',
  deadline: null,
  answers,
})

describe('withHelp', () => {
  it('records a use once, in first-use order', () => {
    const a = withHelp(withHelp(withHelp(answer, 'pattern'), 'check'), 'pattern')
    expect(a.help).toEqual(['pattern', 'check'])
    expect(a.code).toBe('x')
  })
  it('returns the same object when the use is already recorded', () => {
    const a = withHelp(answer, 'solution')
    expect(withHelp(a, 'solution')).toBe(a)
  })
  it('does not change the answer it was given', () => {
    withHelp(answer, 'check')
    expect(answer.help).toBeUndefined()
  })
})

describe('sessionUsedHelp', () => {
  it('is true when any answer used a Helper', () => {
    expect(sessionUsedHelp(session('submitted', { a: answer, b: { ...answer, help: ['check'] } }))).toBe(true)
  })
  it('is false for no help, an empty list, or an old session without the field', () => {
    expect(sessionUsedHelp(session('submitted', { a: answer, b: { ...answer, help: [] } }))).toBe(false)
  })
})

describe('helperCounts', () => {
  it('counts submitted sessions only, split by help use', () => {
    const helped = { a: { ...answer, help: ['solution' as const] } }
    expect(
      helperCounts([
        session('submitted', helped),
        session('submitted', helped),
        session('submitted', { a: answer }),
        session('abandoned', helped),
        session('inProgress', { a: answer }),
      ]),
    ).toEqual({ withHelp: 2, without: 1 })
  })
})
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/exam/helpUse.test.ts`
Expected: FAIL, cannot resolve `./helpUse`.

- [ ] **Step 4: Implement** `web/src/exam/helpUse.ts`

```ts
import type { ExamAnswer, ExamSession, HelpUse } from './types'

/** The answer with `use` recorded; the same object when it already was. */
export function withHelp(answer: ExamAnswer, use: HelpUse): ExamAnswer {
  const help = answer.help ?? []
  return help.includes(use) ? answer : { ...answer, help: [...help, use] }
}

/** Some Helper was used on some question of the session. */
export function sessionUsedHelp(session: ExamSession): boolean {
  return Object.values(session.answers).some((a) => (a.help?.length ?? 0) > 0)
}

/** Submitted sessions, split by whether any Helper was used. */
export function helperCounts(sessions: ExamSession[]): { withHelp: number; without: number } {
  let withHelp = 0
  let without = 0
  for (const s of sessions) {
    if (s.status !== 'submitted') continue
    if (sessionUsedHelp(s)) withHelp++
    else without++
  }
  return { withHelp, without }
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `npx vitest run src/exam/helpUse.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Write the failing store and import tests.** In `web/src/exam/examStore.test.ts`, inside `describe('answers', …)`, add the following. `setup`, `createSession`, `saveAnswer`, `getSession`, `exportProgress`, `importProgress` and `t` are already imported or defined in that file. Read the file's existing tests first and copy their style for creating a session with its keys.

```ts
  it('persists the Helpers used on a question', async () => {
    const s = await createSession({ ...setup, helpers: true }, ['observer/a', 'observer/b'], t(0))
    await saveAnswer(s.id, 'observer/a', { code: 'c', identification: null, help: ['pattern', 'check'] })
    const stored = await getSession(s.id)
    expect(stored?.setup.helpers).toBe(true)
    expect(stored?.answers['observer/a']).toEqual({ code: 'c', identification: null, help: ['pattern', 'check'] })
    expect(stored?.answers['observer/b'].help).toBeUndefined()
  })

  it('exports and re-imports Helpers and help use', async () => {
    const s = await createSession({ ...setup, helpers: true }, ['observer/a', 'observer/b'], t(0))
    await saveAnswer(s.id, 'observer/a', { code: 'c', identification: null, help: ['solution'] })
    const file = await exportProgress()
    const outcome = await importProgress(JSON.stringify(file))
    expect(outcome.ok).toBe(true)
    const back = await getSession(s.id)
    expect(back?.setup.helpers).toBe(true)
    expect(back?.answers['observer/a'].help).toEqual(['solution'])
  })
```

Check the actual signatures of `exportProgress` and `importProgress` in `web/src/progress/exportImport.ts` and adapt the two calls (the result shape is `{ ok: true, … } | { ok: false, reason }`). Keep the assertions.

- [ ] **Step 7: Run them to see them fail**

Run: `npx vitest run src/exam/examStore.test.ts`
Expected: the first new test fails (`help` is dropped by `saveAnswer`); the second fails because the strict zod schema rejects `helpers`/`help`.

- [ ] **Step 8: Keep `help` in `saveAnswer`** (`web/src/exam/examStore.ts`). Replace the stored answer object:

```ts
export async function saveAnswer(id: string, questionKey: string, answer: ExamAnswer): Promise<void> {
  const stored: ExamAnswer = { code: answer.code, identification: answer.identification }
  if (answer.help && answer.help.length > 0) stored.help = [...answer.help]
  await mutate(id, (s) => (!(questionKey in s.answers) ? s : { ...s, answers: { ...s.answers, [questionKey]: stored } }), true)
}
```

- [ ] **Step 9: Accept the fields on import** (`web/src/progress/exportImport.ts`):

```ts
const answer = z.strictObject({
  code: z.string(),
  identification: z.string().nullable(),
  help: z.array(z.enum(['check', 'pattern', 'solution', 'hint1', 'hint2', 'hint3'])).optional(),
})
```

and add `helpers: z.boolean().optional(),` to `examSetup` after `timed`. Do not change `schemaVersion`.

- [ ] **Step 10: Run the store, import and progress tests**

Run: `npx vitest run src/exam src/progress`
Expected: all PASS.

- [ ] **Step 11: Commit**

```bash
git add web/src/exam/types.ts web/src/exam/helpUse.ts web/src/exam/helpUse.test.ts web/src/exam/examStore.ts web/src/exam/examStore.test.ts web/src/progress/exportImport.ts
git commit -m "feat(exam): record Helper use per Exam Question"
```

---

### Task 2: Helpers switch on the setup page

**Files:**
- Modify: `web/src/features/exam/ExamSetupPage.tsx` (`SetupForm`)
- Modify: `web/src/locales/en/exam.json` (`setup.intro`, new `setup.helpers`)
- Modify: `web/src/features/exam/ExamSetupPage.test.tsx`

**Interfaces:**
- Consumes: `helperCounts` from `web/src/exam/helpUse.ts`; `ExamSetup.helpers`; `useExamSessions()` from `web/src/progress/useProgress.ts` (returns `{ data: ExamSession[] | undefined; error: boolean }`).
- Produces: sessions created with `setup.helpers` set to the switch value.

- [ ] **Step 1: Write the failing tests.** In `ExamSetupPage.test.tsx`:
  - Update the intro assertion in `'renders the defaults…'` to the new intro text (Step 3), and add `expect(screen.getByRole('switch', { name: /Helpers/ })).not.toBeChecked()`.
  - Add `localStorage.clear()` to the `beforeEach`.
  - Add a new `describe`:

```tsx
describe('Helpers', () => {
  it('starts a session with Helpers on and remembers the choice', async () => {
    const view = renderPage()
    await waitForForm()
    click(screen.getByRole('switch', { name: /Helpers/ }))
    click(screen.getByRole('button', { name: 'Start exam' }))
    await waitFor(() => expect(screen.getByTestId('path').textContent).toMatch(/^\/exam\/.+/))
    expect((await getInProgressSession())?.setup.helpers).toBe(true)
    expect(localStorage.getItem('exam.helpers')).toBe('true')
    view.unmount()
  })

  it('starts with the remembered choice', async () => {
    localStorage.setItem('exam.helpers', 'true')
    renderPage()
    await waitForForm()
    expect(screen.getByRole('switch', { name: /Helpers/ })).toBeChecked()
  })

  it('starts a session with Helpers off by default', async () => {
    renderPage()
    await waitForForm()
    click(screen.getByRole('button', { name: 'Start exam' }))
    await waitFor(() => expect(screen.getByTestId('path').textContent).toMatch(/^\/exam\/.+/))
    expect((await getInProgressSession())?.setup.helpers).toBe(false)
  })

  it('shows how many submitted exams used Helpers', async () => {
    renderPage()
    await waitForForm()
    expect(await screen.findByText('Exams so far: 0 with helpers, 0 without.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/features/exam/ExamSetupPage.test.tsx`
Expected: FAIL (no Helpers switch, old intro).

- [ ] **Step 3: Add the text** to `web/src/locales/en/exam.json`. Replace `setup.intro` and add `setup.helpers` after `setup.timer`:

```json
"intro": "Closed book by default: no Hints, solutions or Lessons, and Checks stay hidden until you submit. Turn on Helpers to practise with them. You can always run your code.",
```

```json
"helpers": {
  "label": "Helpers",
  "hint": "Check my answer, show pattern and reveal solution while you work. They don't change your score.",
  "counts": "Exams so far: {{withHelp}} with helpers, {{without}} without."
},
```

- [ ] **Step 4: Implement in `SetupForm`** (`ExamSetupPage.tsx`):

Module level, next to the other constants:

```ts
const HELPERS_KEY = 'exam.helpers'

/** The learner's last Helpers choice. A convenience only: storage may be blocked, so it falls back to off. */
function readHelpersChoice(): boolean {
  try {
    return localStorage.getItem(HELPERS_KEY) === 'true'
  } catch {
    return false
  }
}

function storeHelpersChoice(on: boolean) {
  try {
    localStorage.setItem(HELPERS_KEY, String(on))
  } catch {
    // Not remembered; the switch still works for this session.
  }
}
```

Imports: `import { helperCounts } from '../../exam/helpUse'` and `import { useExamSessions } from '../../progress/useProgress'`.

Inside `SetupForm`, after the `timed` state:

```ts
const [helpers, setHelpers] = useState(readHelpersChoice)
const { data: sessions } = useExamSessions()
const counts = sessions ? helperCounts(sessions) : null
```

In `onStart`: `const setup: ExamSetup = { count: effective, scope, named, timed, helpers }`.

After the Timer `<Switch …/>`:

```tsx
<div className="exam-field">
  <Switch
    label={t('setup.helpers.label')}
    hint={t('setup.helpers.hint')}
    hintId={`${ids}-helpers`}
    checked={helpers}
    onChange={(on) => {
      setHelpers(on)
      storeHelpersChoice(on)
    }}
  />
  {counts && <p className="prog-muted">{t('setup.helpers.counts', counts)}</p>}
</div>
```

- [ ] **Step 5: Run the setup tests**

Run: `npx vitest run src/features/exam/ExamSetupPage.test.tsx`
Expected: all PASS. If the wrapping `exam-field` div breaks the form's spacing in the browser later, drop the wrapper and put the `<p>` straight after the switch.

- [ ] **Step 6: Commit**

```bash
git add web/src/features/exam/ExamSetupPage.tsx web/src/features/exam/ExamSetupPage.test.tsx web/src/locales/en/exam.json
git commit -m "feat(exam): Helpers switch on the setup page"
```

---

### Task 3: Helpers panel on the session page

**Files:**
- Create: `web/src/features/exam/HelpersPanel.tsx`
- Modify: `web/src/features/exam/ExamSessionPage.tsx`
- Modify: `web/src/locales/en/exam.json` (`session.helpers`, `session.nav.checkWait`)
- Modify: `web/src/styles/base.css` (a few `.exam-helpers*` rules next to the other `.exam-*` rules)
- Modify: `web/src/features/exam/ExamSessionPage.test.tsx`

**Interfaces:**
- Consumes: `withHelp`, `HelpUse`, `ExamSetup.helpers`; `gradeExercise(source, item, expectedIds, compiler, runner)` from `web/src/features/exercise/gradeExercise.ts`; `CheckList` (`features/exercise/CheckList.tsx`); `CompileErrorList`, `ContractViolationList` (`features/exercise/GradeDiagnostics.tsx`); `StructureDiagram` (`visuals/StructureDiagram.tsx`, props `structure`, `descriptions`); `getPattern(id)` (`content/patterns.ts`, `.structure`); `getPatternText(id, lng).value.structure` (`content/text.ts`); `getCatalogText(id, lng).value.name`; `ExamQuestionContent` (`content/exam.ts`); `ExamQuestionText` (`content/schema.ts`); `useCompiler()` (`compiler/CompilerProvider`).
- Produces: `HelpersPanel` with the props below.

- [ ] **Step 1: Write the failing tests.** In `ExamSessionPage.test.tsx` add the following. `start`, `mount`, `type`, `editor`, `engine`, `keys` and `getSession` already exist in that file.

```tsx
describe('Helpers', () => {
  it('shows no Helpers when the session has them off', async () => {
    const s = await start({ helpers: false })
    mount(s.id)
    await editor()
    expect(screen.queryByRole('region', { name: 'Helpers' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check my answer' })).not.toBeInTheDocument()
  })

  it('shows the pattern with its diagram and a Lesson link, and records it', async () => {
    const s = await start({ helpers: true })
    mount(s.id)
    fireEvent.click(await screen.findByRole('button', { name: 'Show pattern' }))
    expect(screen.getByText('Pattern: Observer')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Observer Lesson/ })
    expect(link).toHaveAttribute('href', '/patterns/observer')
    expect(link).toHaveAttribute('target', '_blank')
    await waitFor(async () => expect((await getSession(s.id))?.answers[keys[0]].help).toEqual(['pattern']))
  })

  it('reveals the solution and copies it into the editor only after confirming', async () => {
    const s = await start({ helpers: true })
    mount(s.id)
    fireEvent.click(await screen.findByRole('button', { name: 'Reveal solution' }))
    const solution = getExamPool().find((q) => q.key === keys[0])!.solution
    fireEvent.click(screen.getByRole('button', { name: 'Copy into editor' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(await editor()).not.toHaveValue(solution)
    fireEvent.click(screen.getByRole('button', { name: 'Copy into editor' }))
    fireEvent.click(screen.getByRole('button', { name: 'Replace my code' }))
    await waitFor(async () => expect(await editor()).toHaveValue(solution))
    await waitFor(async () => {
      const a = (await getSession(s.id))?.answers[keys[0]]
      expect(a?.help).toEqual(['solution'])
      expect(a?.code).toBe(solution)
    })
  })

  it('checks the current answer and shows the Check results, dropped when the code changes', async () => {
    const s = await start({ helpers: true })
    mount(s.id)
    await type('class Mine {}')
    fireEvent.click(await screen.findByRole('button', { name: 'Check my answer' }))
    const total = Object.keys(getExamQuestionText(keys[0], 'en').value.checks).length
    expect(await screen.findByText(`${total} of ${total} Checks pass`)).toBeInTheDocument()
    expect(engine.compile).toHaveBeenCalledWith(expect.objectContaining({ source: 'class Mine {}', purpose: 'check' }))
    await waitFor(async () => expect((await getSession(s.id))?.answers[keys[0]].help).toEqual(['check']))
    await type('class Mine { }')
    expect(screen.queryByText(`${total} of ${total} Checks pass`)).not.toBeInTheDocument()
  })

  it('keeps the help record when the code changes afterwards', async () => {
    const s = await start({ helpers: true })
    mount(s.id)
    fireEvent.click(await screen.findByRole('button', { name: 'Show pattern' }))
    await type('class Later {}')
    await waitFor(async () => {
      const a = (await getSession(s.id))?.answers[keys[0]]
      expect(a?.code).toBe('class Later {}')
      expect(a?.help).toEqual(['pattern'])
    })
  })
})
```

If `Pattern: Observer` matches more than one element (Named mode also prints it), start these sessions with `named: false`, which is the `setupOf` default.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/features/exam/ExamSessionPage.test.tsx -t Helpers`
Expected: FAIL (no Helpers UI).

- [ ] **Step 3: Add the text** to `web/src/locales/en/exam.json`. In `session.nav` add `"checkWait": "Wait for the check to finish."`. In `session` add:

```json
"helpers": {
  "title": "Helpers",
  "intro": "Use only what you need. Helpers don't change your score.",
  "check": {
    "action": "Check my answer",
    "running": "Checking…",
    "summary": "{{passed}} of {{total}} Checks pass",
    "error": "The Checks couldn't run. Try again."
  },
  "pattern": {
    "show": "Show pattern",
    "hide": "Hide pattern",
    "name": "Pattern: {{name}}",
    "lesson": "Open the {{name}} Lesson in a new tab"
  },
  "solution": {
    "show": "Reveal solution",
    "hide": "Hide solution",
    "title": "Reference solution",
    "copy": "Copy into editor",
    "confirm": "Replace your code with the solution?",
    "replace": "Replace my code",
    "cancel": "Cancel",
    "copied": "Solution copied into the editor."
  }
}
```

- [ ] **Step 4: Create `web/src/features/exam/HelpersPanel.tsx`**

```tsx
import { ClipboardPaste, ExternalLink, Eye, EyeOff, ListChecks, LoaderCircle, Shapes } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCompiler } from '../../compiler/CompilerProvider'
import { getCatalogText } from '../../content/catalog'
import type { ExamQuestionContent } from '../../content/exam'
import { getPattern } from '../../content/patterns'
import type { ExamQuestionText } from '../../content/schema'
import { getExamQuestionText, getPatternText } from '../../content/text'
import type { HelpUse } from '../../exam/types'
import { StructureDiagram } from '../../visuals/StructureDiagram'
import { CheckList } from '../exercise/CheckList'
import { CompileErrorList, ContractViolationList } from '../exercise/GradeDiagnostics'
import { gradeExercise, type GradeResult } from '../exercise/gradeExercise'

export interface HelpersPanelProps {
  question: ExamQuestionContent
  text: ExamQuestionText
  /** The answer's code as it is now. */
  code: string
  /** Nothing may change: grading has started or the time is up. */
  locked: boolean
  /** A Run holds the runner, so Check must wait. */
  runBusy: boolean
  /** Told the first time each Helper is used; the page records it. */
  onUse(use: HelpUse): void
  onCopySolution(): void
  /** Told when a check starts and ends, so Run, Submit and the question list wait for it. */
  onCheckingChange(checking: boolean): void
}

type Check = { code: string; result: GradeResult | 'error' }

/** The Helpers for one Exam Question. Keyed per question by the page, so nothing carries over to the next one. */
export function HelpersPanel({ question, text, code, locked, runBusy, onUse, onCopySolution, onCheckingChange }: HelpersPanelProps) {
  const { t } = useTranslation('exam')
  const titleId = useId()
  return (
    <section className="ex-block exam-helpers" aria-labelledby={titleId}>
      <h2 id={titleId} className="ex-h2">
        {t('session.helpers.title')}
      </h2>
      <p className="ex-small">{t('session.helpers.intro')}</p>
      <CheckHelper question={question} text={text} code={code} locked={locked} runBusy={runBusy} onUse={onUse} onCheckingChange={onCheckingChange} />
      <PatternHelper patternId={question.patternId} onUse={onUse} />
      <SolutionHelper solution={question.solution} locked={locked} onUse={onUse} onCopy={onCopySolution} />
    </section>
  )
}

function CheckHelper({
  question,
  text,
  code,
  locked,
  runBusy,
  onUse,
  onCheckingChange,
}: Pick<HelpersPanelProps, 'question' | 'text' | 'code' | 'locked' | 'runBusy' | 'onUse' | 'onCheckingChange'>) {
  const { t } = useTranslation('exam')
  const { status, compiler, runner } = useCompiler()
  const [checking, setChecking] = useState(false)
  const [check, setCheck] = useState<Check | null>(null)
  const inFlight = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  async function run() {
    if (inFlight.current) return
    inFlight.current = true
    const source = code
    onUse('check')
    setChecking(true)
    onCheckingChange(true)
    try {
      // The `en` text names the checks (never a translation's keys), as in grading.
      const ids = Object.keys(getExamQuestionText(question.key, 'en').value.checks)
      const result = await gradeExercise(source, question, ids, compiler, runner)
      if (alive.current) setCheck({ code: source, result })
    } catch {
      if (alive.current) setCheck({ code: source, result: 'error' })
    } finally {
      inFlight.current = false
      if (alive.current) setChecking(false)
      onCheckingChange(false)
    }
  }

  // A result belongs to the code it checked: once the code changes it is out of date and goes.
  const shown = check && check.code === code ? check.result : null
  return (
    <div className="exam-helper">
      <button type="button" className="btn btn-quiet" disabled={locked || runBusy || checking || status !== 'ready'} onClick={() => void run()}>
        {checking ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <ListChecks size={16} aria-hidden="true" />}
        <span>{checking ? t('session.helpers.check.running') : t('session.helpers.check.action')}</span>
      </button>
      <div aria-live="polite">
        {shown === 'error' && <p className="ex-small exam-bad">{t('session.helpers.check.error')}</p>}
        {shown !== null && shown !== 'error' && shown.kind === 'checked' && (
          <>
            <p className="results-summary">
              {t('session.helpers.check.summary', { passed: shown.results.filter((r) => r.status === 'passed').length, total: shown.results.length })}
            </p>
            <CheckList results={shown.results} text={text} />
          </>
        )}
        {shown !== null && shown !== 'error' && shown.kind === 'compileErrors' && <CompileErrorList diagnostics={shown.diagnostics} />}
        {shown !== null && shown !== 'error' && shown.kind === 'contractViolations' && <ContractViolationList violations={shown.violations} />}
      </div>
    </div>
  )
}

function PatternHelper({ patternId, onUse }: { patternId: string; onUse(use: HelpUse): void }) {
  const { t, i18n } = useTranslation('exam')
  const lng = i18n.language
  const [open, setOpen] = useState(false)
  const pattern = getPattern(patternId)
  // Memoized: new descriptions would rebuild the diagram's nodes (see DevVisualsPage).
  const descriptions = useMemo(() => (pattern ? getPatternText(patternId, lng).value.structure : {}), [pattern, patternId, lng])
  const name = getCatalogText(patternId, lng).value.name
  return (
    <div className="exam-helper">
      <button
        type="button"
        className="btn btn-quiet"
        aria-expanded={open}
        onClick={() => {
          if (!open) onUse('pattern')
          setOpen(!open)
        }}
      >
        {open ? <EyeOff size={16} aria-hidden="true" /> : <Shapes size={16} aria-hidden="true" />}
        <span>{open ? t('session.helpers.pattern.hide') : t('session.helpers.pattern.show')}</span>
      </button>
      {open && (
        <div className="exam-helper-body">
          <p className="exam-pattern">{t('session.helpers.pattern.name', { name })}</p>
          {pattern && <StructureDiagram structure={pattern.structure} descriptions={descriptions} />}
          <p>
            <Link className="back-link" to={`/patterns/${patternId}`} target="_blank" rel="noopener">
              {t('session.helpers.pattern.lesson', { name })}
              <ExternalLink size={14} aria-hidden="true" />
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}

function SolutionHelper({ solution, locked, onUse, onCopy }: { solution: string; locked: boolean; onUse(use: HelpUse): void; onCopy(): void }) {
  const { t } = useTranslation('exam')
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)
  return (
    <div className="exam-helper">
      <button
        type="button"
        className="btn btn-quiet"
        aria-expanded={open}
        onClick={() => {
          if (!open) onUse('solution')
          setOpen(!open)
          setConfirming(false)
        }}
      >
        {open ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        <span>{open ? t('session.helpers.solution.hide') : t('session.helpers.solution.show')}</span>
      </button>
      {open && (
        <section className="solution" aria-labelledby={titleId}>
          <div className="solution-head">
            <h3 id={titleId} className="ex-h3">
              {t('session.helpers.solution.title')}
            </h3>
            {!confirming && (
              <button type="button" className="btn btn-quiet btn-small" disabled={locked} onClick={() => setConfirming(true)}>
                <ClipboardPaste size={14} aria-hidden="true" />
                <span>{t('session.helpers.solution.copy')}</span>
              </button>
            )}
          </div>
          {confirming && (
            <div className="prog-confirm" role="group" aria-label={t('session.helpers.solution.confirm')}>
              <p className="prog-confirm-q">{t('session.helpers.solution.confirm')}</p>
              <div className="reset-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  disabled={locked}
                  onClick={() => {
                    onCopy()
                    setConfirming(false)
                    setCopied(true)
                  }}
                >
                  {t('session.helpers.solution.replace')}
                </button>
                <button type="button" className="btn btn-quiet btn-small" onClick={() => setConfirming(false)}>
                  {t('session.helpers.solution.cancel')}
                </button>
              </div>
            </div>
          )}
          {/* Focusable so a keyboard user can scroll a long solution. */}
          <pre className="solution-code" tabIndex={0}>
            <code>{solution}</code>
          </pre>
          {copied && (
            <p className="ex-small" role="status">
              {t('session.helpers.solution.copied')}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
```

If the `Link` component rejects `target`/`rel` in this react-router version, use a plain `<a href=…>` with the same attributes. Check that `ListChecks`, `Shapes` and `ExternalLink` exist in the installed lucide-react; if one is missing, pick a nearby icon that does.

- [ ] **Step 5: Wire it into `ExamSessionPage.tsx`** (`Session` component):

1. Imports: `import { withHelp } from '../../exam/helpUse'`, `import type { HelpUse } from '../../exam/types'` (merge with the existing `ExamAnswer, ExamSession` import), `import { HelpersPanel } from './HelpersPanel'`.
2. Replace the `running` ref, `runBusy` state and `onRunningChange` with one busy record that covers Run and Check:

```ts
// A Run or a Check holds the runner, which grading also needs: submit waits for both.
const busy = useRef({ run: false, check: false })
const [runBusy, setRunBusy] = useState(false)
const [checkBusy, setCheckBusy] = useState(false)
const busyWaiters = useRef<(() => void)[]>([])
const isBusy = () => busy.current.run || busy.current.check

const onRunningChange = useCallback((now: boolean) => {
  busy.current.run = now
  setRunBusy(now)
  if (!busy.current.run && !busy.current.check) busyWaiters.current.splice(0).forEach((resolve) => resolve())
}, [])

const onCheckingChange = useCallback((now: boolean) => {
  busy.current.check = now
  setCheckBusy(now)
  if (!busy.current.run && !busy.current.check) busyWaiters.current.splice(0).forEach((resolve) => resolve())
}, [])
```

   In `submitNow`, change the wait line to `if (isBusy()) await new Promise<void>((resolve) => busyWaiters.current.push(resolve))`. (`isBusy` reads only a ref, so it doesn't need to be in the `useCallback` deps.)

3. Add next to `update`:

```ts
const helpers = session.setup.helpers === true

const recordHelp = useCallback(
  (use: HelpUse) => {
    const cur = answersRef.current[key] ?? { code: EXAM_STARTER, identification: null }
    const next = withHelp(cur, use)
    if (next !== cur) update(key, next, true)
  },
  [key, update],
)
```

4. `QuestionNav`: `disabled={grading || runBusy || checkBusy}` and
   `reason={grading ? undefined : runBusy ? t('session.nav.runWait') : checkBusy ? t('session.nav.checkWait') : undefined}`.
5. `CodePanel`: `runDisabled={locked || checkBusy}`.
6. Inside `exercise-brief`, after the `IdentificationField` block:

```tsx
{helpers && (
  <HelpersPanel
    key={key}
    question={question}
    text={text}
    code={answer.code}
    locked={locked}
    runBusy={runBusy}
    onUse={recordHelp}
    onCopySolution={() => update(key, { ...answersRef.current[key], code: question.solution }, true)}
    onCheckingChange={onCheckingChange}
  />
)}
```

- [ ] **Step 6: Styles.** In `web/src/styles/base.css`, next to the other `.exam-*` rules, using existing tokens only (copy spacing values from neighbouring `.exam-*` rules):

```css
.exam-helpers {
  display: grid;
  gap: var(--space-3);
}
.exam-helper {
  display: grid;
  gap: var(--space-2);
  justify-items: start;
}
.exam-helper-body,
.exam-helper .solution {
  width: 100%;
}
```

If `--space-2`/`--space-3` aren't defined in `tokens.css`, use the spacing tokens the file actually defines.

- [ ] **Step 7: Run the session tests**

Run: `npx vitest run src/features/exam`
Expected: all PASS, including the older session tests (Run/Submit gating unchanged when Helpers are off).

- [ ] **Step 8: Commit**

```bash
git add web/src/features/exam/HelpersPanel.tsx web/src/features/exam/ExamSessionPage.tsx web/src/features/exam/ExamSessionPage.test.tsx web/src/locales/en/exam.json web/src/styles/base.css
git commit -m "feat(exam): Helpers panel: check my answer, show pattern, reveal solution"
```

---

### Task 4: Help use in the Report and exam history

**Files:**
- Modify: `web/src/features/exam/ExamReportPage.tsx` (`QuestionSection`)
- Modify: `web/src/features/exam/ExamReportPage.test.tsx`
- Modify: `web/src/features/progress/ProgressPage.tsx` (`ExamRow`)
- Modify: `web/src/features/progress/ProgressPage.test.tsx`
- Modify: `web/src/locales/en/exam.json`, `web/src/locales/en/progress.json`

**Interfaces:**
- Consumes: `ExamAnswer.help`, `HelpUse`, `sessionUsedHelp(session)`.

- [ ] **Step 1: Write the failing tests.** Read how each test file builds a submitted session (look for `finishSession` or a stored `ExamSession` literal) and add:
  - `ExamReportPage.test.tsx`: a submitted session where question 1's answer has `help: ['pattern', 'solution', 'check']` and question 2 has none. Expect `screen.getByText('Helpers used: show pattern, solution, check my answer')` exactly once, and no other `Helpers used` text (`screen.getAllByText(/Helpers used/)` has length 1).
  - `ProgressPage.test.tsx`: two submitted sessions, one with an answer that has `help: ['check']` and one without. Expect exactly one `with helpers` text in the exam history (`within(historySection).getAllByText(/with helpers/)` has length 1).

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/features/exam/ExamReportPage.test.tsx src/features/progress/ProgressPage.test.tsx`
Expected: the new tests FAIL.

- [ ] **Step 3: Text.** `exam.json`, inside `report`:

```json
"help": "Helpers used: {{list}}",
"helpUse": {
  "check": "check my answer",
  "pattern": "show pattern",
  "solution": "solution",
  "hint1": "hint 1",
  "hint2": "hint 2",
  "hint3": "hint 3"
}
```

`progress.json`, inside `exam`: `"withHelpers": "with helpers"`.

- [ ] **Step 4: Report.** In `ExamReportPage.tsx`, pass `help={session.answers[key]?.help ?? []}` to `QuestionSection`, add `help: HelpUse[]` to its props (import `HelpUse` from `../../exam/types`), and render right after the `report-pattern` paragraph:

```tsx
{help.length > 0 && <p className="report-help ex-small">{t('report.help', { list: help.map((u) => t(`report.helpUse.${u}`)).join(', ') })}</p>}
```

- [ ] **Step 5: History.** In `ProgressPage.tsx` `ExamRow`, import `sessionUsedHelp` from `../../exam/helpUse` and extend the meta line:

```tsx
{t('exam.questions', { count: session.questionKeys.length })} · {session.setup.named ? t('exam.named') : t('exam.unnamed')}
{sessionUsedHelp(session) && <> · {t('exam.withHelpers')}</>}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/features/exam src/features/progress`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/features/exam/ExamReportPage.tsx web/src/features/exam/ExamReportPage.test.tsx web/src/features/progress/ProgressPage.tsx web/src/features/progress/ProgressPage.test.tsx web/src/locales/en/exam.json web/src/locales/en/progress.json
git commit -m "feat(exam): show Helper use in the Report and exam history"
```

---

### Task 5: Language, end-to-end test, full verification

**Files:**
- Modify: `CONTEXT.md` (Exam section)
- Create: `web/e2e/exam-helpers.spec.ts`

**Interfaces:**
- Consumes: every earlier task. e2e helpers from `web/e2e/helpers.ts`: `waitReady(page)`, `getCode(page)`, `questionTitle(page)`, `examSolutions()` (title → solution source).

- [ ] **Step 1: CONTEXT.md.** In `### Exam`, change the Exam Session sentence "Checks stay hidden until the session is submitted." to "Checks stay hidden until the session is submitted, unless Helpers are on." Then add after **Named mode**:

```markdown
**Helpers**:
Optional aids in an Exam Session, turned on at setup: Check my answer (run the Checks before submitting), Show pattern (its name, Structure Diagram and Lesson link) and Reveal solution. Which ones were used is recorded per Exam Question and shown in the Exam Report. They never change the score.
_Avoid_: Cheats, assists, practice mode
```

- [ ] **Step 2: Write `web/e2e/exam-helpers.spec.ts`**

```ts
import { expect, test } from '@playwright/test'
import { examSolutions, getCode, questionTitle, waitReady } from './helpers'

test('practises a one-question exam with Helpers', async ({ page }) => {
  const bySolution = examSolutions()
  await page.goto('/exam')
  await page.getByLabel('Number of questions').fill('1')
  await page.getByRole('switch', { name: /Named mode/ }).check()
  await page.getByRole('switch', { name: /Helpers/ }).check()
  await page.getByRole('button', { name: 'Start exam' }).click()
  await expect(page).toHaveURL(/\/exam\/[0-9a-f-]+$/)
  await waitReady(page)
  const title = await questionTitle(page)

  await page.getByRole('button', { name: 'Show pattern' }).click()
  await expect(page.getByRole('link', { name: /Lesson in a new tab/ })).toBeVisible()

  await page.getByRole('button', { name: 'Reveal solution' }).click()
  await page.getByRole('button', { name: 'Copy into editor' }).click()
  await page.getByRole('button', { name: 'Replace my code' }).click()
  await expect.poll(() => getCode(page)).toBe(bySolution[title])

  await page.getByRole('button', { name: 'Check my answer' }).click()
  await expect(page.getByText(/^(\d+) of \1 Checks pass$/)).toBeVisible({ timeout: 120_000 })

  await page.getByRole('button', { name: 'Submit exam' }).click()
  await page.getByRole('group', { name: /Submit your exam/ }).getByRole('button', { name: 'Submit exam' }).click()
  await expect(page).toHaveURL(/\/report$/, { timeout: 120_000 })
  await expect(page.getByText('Helpers used: show pattern, solution, check my answer')).toBeVisible()
  await expect(page.getByText('Passed', { exact: true })).toBeVisible()

  await page.goto('/progress')
  await expect(page.getByText(/with helpers/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
```

If `getCode` reads a different Monaco model than the exam editor (it takes model 0), compare against `bySolution[title]` after normalising line endings, the same way the other e2e specs do.

- [ ] **Step 3: Run the full checks**

Run, in order, from `web/`:
- `npx vitest run`: all PASS
- `npm run lint`: no errors
- `npm run build`: succeeds
- `npx playwright test e2e/exam-helpers.spec.ts e2e/exam-session.spec.ts e2e/exam-setup.spec.ts e2e/exam.spec.ts`: all PASS. `exam-setup.spec.ts`/`exam.spec.ts` may assert the old setup intro; update those assertions to the new text from Task 2.

- [ ] **Step 4: Look at it in the browser.** Start the dev server (`npm run dev`), open `/exam` at 1440px and 390px wide, and take screenshots of: the setup page with the Helpers switch and counts; a session with all three Helpers open; the Report with *Helpers used*. Check: no horizontal scroll at 390px, the diagram fits the panel, light and dark themes both readable. Fix what's off.

- [ ] **Step 5: Commit**

```bash
git add CONTEXT.md web/e2e/exam-helpers.spec.ts web/e2e
git commit -m "docs, test(exam): Helpers in CONTEXT and an end-to-end test"
```
