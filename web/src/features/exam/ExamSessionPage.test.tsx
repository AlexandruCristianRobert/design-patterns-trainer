import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCatalog, getCatalogText } from '../../content/catalog'
import { getExamPool } from '../../content/exam'
import { getExamQuestionText } from '../../content/text'
import { abandonSession, createSession, getSession, saveAnswer } from '../../exam/examStore'
import { submitExam } from '../../exam/submitExam'
import type { ExamSetup } from '../../exam/types'
import { resetDbForTests } from '../../progress/db'
import { ExamSessionPage } from './ExamSessionPage'

const saveFails = { keys: new Set<string>() }
vi.mock('../../exam/examStore', async (orig) => {
  const actual = await orig<typeof import('../../exam/examStore')>()
  return {
    ...actual,
    saveAnswer: (id: string, key: string, a: Parameters<typeof actual.saveAnswer>[2]) =>
      saveFails.keys.has(key) ? Promise.reject(new Error('blocked')) : actual.saveAnswer(id, key, a),
  }
})
vi.mock('../../exam/submitExam', async (orig) => {
  const actual = await orig<typeof import('../../exam/submitExam')>()
  return { submitExam: vi.fn(actual.submitExam) }
})
const submitSpy = vi.mocked(submitExam)
const realSubmit = submitSpy.getMockImplementation()!

const engine = { status: 'ready' as 'starting' | 'ready' | 'failed', compile: vi.fn(), load: vi.fn(), runCheck: vi.fn() }
vi.mock('../../compiler/CompilerProvider', () => ({
  useCompiler: () => ({
    status: engine.status,
    compiler: { compile: engine.compile },
    runner: { exclusive: (job: () => Promise<unknown>) => job(), load: engine.load, runCheck: engine.runCheck, runMain: vi.fn() },
  }),
}))

vi.mock('../../editor/CodeEditor', () => ({
  CodeEditor: (p: { value: string; ariaLabel: string; onChange(v: string): void; readOnly?: boolean }) => (
    <textarea aria-label={p.ariaLabel} value={p.value} readOnly={p.readOnly} onChange={(e) => p.onChange(e.target.value)} />
  ),
}))

const keys = getExamPool()
  .filter((q) => q.patternId === 'observer')
  .map((q) => q.key)
const setupOf = (over: Partial<ExamSetup> = {}): ExamSetup => ({ count: 3, scope: { kind: 'all' }, named: false, timed: false, ...over })

function Where() {
  return <output data-testid="path">{useLocation().pathname}</output>
}

function mount(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/exam/${id}`]}>
      <Routes>
        <Route path="/exam/:sessionId" element={<ExamSessionPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

const start = (over: Partial<ExamSetup> = {}, now = new Date()) => createSession(setupOf(over), keys, now)

const editor = () => screen.findByLabelText('C# code')
const type = async (v: string) => fireEvent.change(await editor(), { target: { value: v } })
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const okCompile = { success: true, diagnostics: [], contractViolations: [], assemblyBase64: 'AAA' }
// Only the clock and the tick: Testing Library and fake-indexeddb keep real timers.
const fake = ['setInterval', 'clearInterval', 'Date'] as const

beforeEach(async () => {
  engine.status = 'ready'
  saveFails.keys.clear()
  engine.compile.mockReset().mockResolvedValue(okCompile)
  engine.load.mockReset().mockImplementation(async () => ({ checkIds: Object.keys(getExamQuestionText(keys[0], 'en').value.checks), hasEntryPoint: false }))
  engine.runCheck.mockReset().mockImplementation(async (id: string) => ({ kind: 'ok', value: { id, status: 'passed' } }))
  submitSpy.mockReset().mockImplementation(realSubmit)
  await resetDbForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('content per mode', () => {
  it('shows the first question with its scenario and Contract', async () => {
    const s = await start()
    mount(s.id)
    const text = getExamQuestionText(keys[0], 'en').value
    expect(await screen.findByRole('heading', { level: 1, name: 'Question 1 of 3' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: text.title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Contract' })).toBeInTheDocument()
    expect(await editor()).toHaveValue('// Write your solution here.\n')
  })

  it('hides the Pattern name, Lessons, Hints and the solution in unnamed mode', async () => {
    const s = await start()
    mount(s.id)
    await editor()
    const name = getCatalogText('observer', 'en').value.name
    // The Identification list has to offer every name, so look everywhere except inside it.
    const clone = document.body.cloneNode(true) as HTMLElement
    clone.querySelectorAll('select').forEach((el) => el.remove())
    expect(clone.textContent ?? '').not.toContain(name)
    for (const el of clone.querySelectorAll('[aria-label], [title]')) {
      expect(el.getAttribute('aria-label') ?? '').not.toContain(name)
      expect(el.getAttribute('title') ?? '').not.toContain(name)
    }
    expect(screen.queryByText(/^Pattern:/)).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByText(/hint|lesson/i)).toBeNull()
    expect(screen.queryByRole('heading', { name: /hint|solution/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /hint|solution/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /check/i })).toBeNull()
    expect(screen.getByRole('button', { name: /^Run/ })).toBeInTheDocument()
  })

  it('shows "Pattern: name" and no Identification in Named mode', async () => {
    const s = await start({ named: true })
    mount(s.id)
    expect(await screen.findByText('Pattern: Observer')).toBeInTheDocument()
    expect(screen.queryByLabelText('Which pattern does this call for?')).toBeNull()
  })

  it('lists all 23 names, grouped by Category, plus "Not sure yet"', async () => {
    const s = await start()
    mount(s.id)
    const select = await screen.findByLabelText('Which pattern does this call for?')
    const options = within(select).getAllByRole('option')
    expect(options[0]).toHaveTextContent('Not sure yet')
    expect(options).toHaveLength(24)
    const byCategory = (c: string) => getCatalog().filter((p) => p.category === c)
    const expected = ['creational', 'structural', 'behavioral'].flatMap(byCategory).map((p) => getCatalogText(p.id, 'en').value.name)
    expect(options.slice(1).map((o) => o.textContent)).toEqual(expected)
    expect(select.querySelectorAll('optgroup')).toHaveLength(3)
  })
})

describe('saving and navigation', () => {
  it('saves typed code after 500 ms and restores it on a remount', async () => {
    const s = await start()
    const first = mount(s.id)
    await type('class A {}')
    await wait(600)
    expect((await getSession(s.id))!.answers[keys[0]].code).toBe('class A {}')
    first.unmount()
    mount(s.id)
    expect(await editor()).toHaveValue('class A {}')
  })

  it('does not write on every keystroke', async () => {
    const s = await start()
    mount(s.id)
    await type('a')
    await type('ab')
    expect((await getSession(s.id))!.answers[keys[0]].code).not.toBe('ab')
    await wait(600)
    expect((await getSession(s.id))!.answers[keys[0]].code).toBe('ab')
  })

  it('saves a chosen Identification at once', async () => {
    const s = await start()
    mount(s.id)
    fireEvent.change(await screen.findByLabelText('Which pattern does this call for?'), { target: { value: 'observer' } })
    await waitFor(async () => expect((await getSession(s.id))!.answers[keys[0]].identification).toBe('observer'))
  })

  it('marks a question answered in the nav, with text and not only an icon', async () => {
    const s = await start()
    mount(s.id)
    const nav = await screen.findByRole('navigation', { name: 'Questions' })
    expect(within(nav).getByRole('button', { name: /Question 1, not answered/ })).toBeInTheDocument()
    await type('class A {}')
    expect(within(nav).getByRole('button', { name: /Question 1, answered/ })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: /Question 2, not answered/ })).toBeInTheDocument()
  })

  it("moves freely to question 3 and back, keeping each question's code", async () => {
    const s = await start()
    mount(s.id)
    await type('code one')
    fireEvent.click(screen.getByRole('button', { name: /Question 3/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Question 3 of 3' })).toBeInTheDocument()
    expect(await editor()).not.toHaveValue('code one')
    await type('code three')
    fireEvent.click(screen.getByRole('button', { name: /Question 1/ }))
    expect(await editor()).toHaveValue('code one')
    fireEvent.click(screen.getByRole('button', { name: /Question 3/ }))
    expect(await editor()).toHaveValue('code three')
    await waitFor(async () => {
      const a = (await getSession(s.id))!.answers
      expect(a[keys[0]].code).toBe('code one')
      expect(a[keys[2]].code).toBe('code three')
    })
  })

  it('restores saved answers on resume', async () => {
    const s = await start()
    await saveAnswer(s.id, keys[1], { code: 'class Two {}', identification: 'observer' })
    mount(s.id)
    fireEvent.click(await screen.findByRole('button', { name: /Question 2/ }))
    expect(await editor()).toHaveValue('class Two {}')
    expect(screen.getByLabelText('Which pattern does this call for?')).toHaveValue('observer')
  })
})

describe('submit', () => {
  const ask = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Submit exam' }))
    return screen.getByRole('group', { name: /Submit your exam/ })
  }

  it('asks inline and counts the unanswered questions', async () => {
    const s = await start()
    mount(s.id)
    await type('class A {}')
    const group = await ask()
    expect(group).toHaveTextContent("Submit your exam? You can't change your answers afterwards.")
    expect(group).toHaveTextContent('2 questions are still unanswered.')
    expect(screen.getByRole('button', { name: 'Keep working' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Keep working' }))
    expect(screen.queryByRole('group', { name: /Submit your exam/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Submit exam' })).toHaveFocus()
  })

  it('grades with the engine and opens the report, flushing the last keystrokes first', async () => {
    const s = await start()
    mount(s.id)
    await type('class Last {}')
    fireEvent.click(within(await ask()).getByRole('button', { name: 'Submit exam' }))
    expect(await screen.findByTestId('path')).toHaveTextContent(`/exam/${s.id}/report`)
    expect(submitSpy).toHaveBeenCalledWith(s.id, 'learner', expect.anything(), expect.any(Function))
    expect(engine.compile).toHaveBeenCalledWith(expect.objectContaining({ source: 'class Last {}' }))
    expect((await getSession(s.id))!.status).toBe('submitted')
  })

  it('shows progress while grading and disables the page', async () => {
    const s = await start()
    let release: () => void = () => undefined
    engine.compile.mockImplementationOnce(() => new Promise((r) => (release = () => r(okCompile))))
    mount(s.id)
    fireEvent.click(within(await ask()).getByRole('button', { name: 'Submit exam' }))
    expect((await screen.findByText('Grading question 1 of 3…')).closest('[role="status"]')).not.toBeNull()
    expect(screen.getByLabelText('Which pattern does this call for?')).toBeDisabled()
    expect(screen.getByRole('button', { name: /Question 2/ })).toBeDisabled()
    expect(await editor()).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: /^Run/ })).toBeDisabled()
    expect(screen.getByText('Grading question 1 of 3…').closest('[role="status"]')).toHaveFocus()
    await waitFor(() => expect(engine.compile).toHaveBeenCalled())
    release()
    expect(await screen.findByTestId('path')).toHaveTextContent('/report')
  })

  it('recovers when submitting fails: says so, keeps the answers and lets the learner try again', async () => {
    const s = await start()
    mount(s.id)
    await type('class Kept {}')
    submitSpy.mockRejectedValueOnce(new Error('storage'))
    fireEvent.click(within(await ask()).getByRole('button', { name: 'Submit exam' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Your exam couldn't be submitted. Your answers are saved.")
    expect(within(alert).getByRole('button', { name: 'Try again' })).toHaveFocus()
    expect(screen.queryByText(/Grading question/)).toBeNull()
    expect(await editor()).not.toHaveAttribute('readonly')
    expect(await editor()).toHaveValue('class Kept {}')
    expect(screen.getByRole('button', { name: /Question 2/ })).toBeEnabled()
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('path')).toHaveTextContent(`/exam/${s.id}/report`)
  })

  it('does not grade, and does not claim the answers are saved, when an answer cannot be stored', async () => {
    const s = await start()
    mount(s.id)
    saveFails.keys.add(keys[0])
    await type('class Lost {}')
    fireEvent.click(await screen.findByRole('button', { name: /Question 2/ }))
    await type('class Fine {}')
    fireEvent.click(within(await ask()).getByRole('button', { name: 'Submit exam' }))
    const msg = await screen.findByText(/so the exam wasn't submitted/, {}, { timeout: 3000 })
    const alert = msg.closest('[role="alert"]') as HTMLElement
    expect(alert).toHaveTextContent("Your latest changes couldn't be saved, so the exam wasn't submitted. Try again.")
    expect(alert).not.toHaveTextContent('Your answers are saved')
    expect(submitSpy).not.toHaveBeenCalled()
    saveFails.keys.clear()
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('path')).toHaveTextContent('/report')
    expect((await getSession(s.id))!.answers[keys[0]].code).toBe('class Lost {}')
  })

  it('waits for a Run in flight before grading', async () => {
    const s = await start()
    let finishRun: () => void = () => undefined
    engine.compile.mockImplementationOnce(() => new Promise((r) => (finishRun = () => r(okCompile))))
    engine.load.mockResolvedValueOnce({ hasEntryPoint: false, checkIds: [] })
    mount(s.id)
    fireEvent.click(await screen.findByRole('button', { name: /^Run/ }))
    await waitFor(() => expect(engine.compile).toHaveBeenCalledTimes(1))
    fireEvent.click(within(await ask()).getByRole('button', { name: 'Submit exam' }))
    await wait(100)
    expect(submitSpy).not.toHaveBeenCalled()
    finishRun()
    expect(await screen.findByTestId('path')).toHaveTextContent('/report')
    expect(submitSpy).toHaveBeenCalledTimes(1)
  })

  it('cannot leave the question while a Run is in flight, and can again after it ends', async () => {
    const s = await start()
    let finishRun: () => void = () => undefined
    engine.compile.mockImplementationOnce(() => new Promise((r) => (finishRun = () => r(okCompile))))
    engine.load.mockResolvedValueOnce({ hasEntryPoint: false, checkIds: [] })
    mount(s.id)
    fireEvent.click(await screen.findByRole('button', { name: /^Run/ }))
    await waitFor(() => expect(engine.compile).toHaveBeenCalledTimes(1))
    const q2 = await screen.findByRole('button', { name: /Question 2/ })
    await waitFor(() => expect(q2).toBeDisabled())
    expect(q2).toHaveAccessibleDescription('Wait for your code to finish running.')
    expect(screen.getByRole('button', { name: /Question 1/ })).toBeDisabled()
    fireEvent.click(q2)
    expect(screen.getByRole('heading', { level: 1, name: 'Question 1 of 3' })).toBeInTheDocument()
    finishRun()
    await waitFor(() => expect(q2).toBeEnabled())
    expect(q2).not.toHaveAccessibleDescription('Wait for your code to finish running.')
    fireEvent.click(q2)
    expect(await screen.findByRole('heading', { level: 1, name: 'Question 2 of 3' })).toBeInTheDocument()
  })

  it('moves focus to the alert when Try again is disabled because the engine is not ready', async () => {
    const s = await start()
    mount(s.id)
    submitSpy.mockImplementationOnce(async () => {
      engine.status = 'starting'
      throw new Error('storage')
    })
    fireEvent.click(within(await ask()).getByRole('button', { name: 'Submit exam' }))
    const msg = await screen.findByText(/couldn't be submitted/)
    const alert = msg.closest('[role="alert"]') as HTMLElement
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeDisabled()
    await waitFor(() => expect(alert).toHaveFocus())
  })

  it('disables Submit with the reason while the engine starts', async () => {
    engine.status = 'starting'
    const s = await start()
    mount(s.id)
    const submit = await screen.findByRole('button', { name: 'Submit exam' })
    expect(submit).toBeDisabled()
    expect(submit).toHaveAccessibleDescription('The C# engine is still starting…')
  })

  it('shows reload guidance when the engine failed', async () => {
    engine.status = 'failed'
    const s = await start()
    mount(s.id)
    expect(await screen.findByRole('button', { name: 'Submit exam' })).toBeDisabled()
    expect(screen.getByText(/The C# engine didn't start/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Reload page' }).length).toBeGreaterThan(0)
  })
})

describe('timer', () => {
  const quarter = 15 * 60_000

  it('shows the time left from the wall clock', async () => {
    vi.useFakeTimers({ toFake: [...fake] })
    // Started 40 minutes ago, of a 45-minute exam.
    const s = await start({ timed: true }, new Date(Date.now() - 40 * 60_000))
    mount(s.id)
    const timer = await screen.findByRole('timer')
    expect(timer).toHaveTextContent('5:00')
    await act(() => vi.advanceTimersByTimeAsync(61_000))
    expect(timer).toHaveTextContent('3:59')
  })

  it('announces at 5:00 and at 1:00, once each', async () => {
    vi.useFakeTimers({ toFake: [...fake] })
    const s = await start({ timed: true }, new Date(Date.now() - 3 * quarter + 5 * 60_000 + 2000))
    const { container } = mount(s.id)
    await screen.findByRole('timer')
    const live = () => container.querySelector('[aria-live="polite"]')!.textContent
    expect(live()).toBe('')
    await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(live()).toBe('5 minutes left.')
    await act(() => vi.advanceTimersByTimeAsync(4 * 60_000))
    expect(live()).toBe('1 minute left.')
  })

  it('reaching zero auto-submits by the timer and opens the report', async () => {
    vi.useFakeTimers({ toFake: [...fake] })
    const s = await start({ timed: true }, new Date(Date.now() - 3 * quarter + 3000))
    mount(s.id)
    await screen.findByRole('timer')
    await act(() => vi.advanceTimersByTimeAsync(4000))
    await waitFor(() => expect(submitSpy).toHaveBeenCalledWith(s.id, 'timer', expect.anything(), expect.any(Function)))
    vi.useRealTimers()
    expect(await screen.findByTestId('path', {}, { timeout: 3000 })).toHaveTextContent(`/exam/${s.id}/report`)
  })

  it('reads the real clock after a jump, not the number of ticks', async () => {
    vi.useFakeTimers({ toFake: [...fake] })
    const s = await start({ timed: true }, new Date(Date.now() - 40 * 60_000))
    mount(s.id)
    const timer = await screen.findByRole('timer')
    expect(timer).toHaveTextContent('5:00')
    // The laptop slept for two minutes: no interval ran, but the next tick must show the real time.
    vi.setSystemTime(Date.now() + 2 * 60_000)
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(timer).toHaveTextContent('2:59')
  })

  it('has no timer without a limit', async () => {
    const s = await start({ timed: false })
    mount(s.id)
    await editor()
    expect(screen.queryByRole('timer')).toBeNull()
    expect(screen.getByText('No time limit')).toBeInTheDocument()
  })
})

describe('timer expiry and the engine', () => {
  const expiredStart = () => start({ timed: true }, new Date(Date.now() - 3 * 15 * 60_000 - 5000))
  const page = (id: string) => (
    <MemoryRouter initialEntries={[`/exam/${id}`]}>
      <Routes>
        <Route path="/exam/:sessionId" element={<ExamSessionPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )

  it('does not submit, and shows the reload guidance, when the engine failed', async () => {
    engine.status = 'failed'
    const s = await expiredStart()
    mount(s.id)
    expect(await screen.findByText(/The C# engine didn't start/)).toBeInTheDocument()
    await wait(150)
    expect(submitSpy).not.toHaveBeenCalled()
    expect((await getSession(s.id))!.status).toBe('inProgress')
    expect(screen.getAllByRole('button', { name: 'Reload page' }).length).toBeGreaterThan(0)
  })

  it('waits for the engine to become ready, then submits once by the timer', async () => {
    engine.status = 'starting'
    const s = await expiredStart()
    const view = mount(s.id)
    await screen.findByRole('timer')
    await wait(150)
    expect(submitSpy).not.toHaveBeenCalled()
    engine.status = 'ready'
    view.rerender(page(s.id))
    expect(await screen.findByTestId('path')).toHaveTextContent('/report')
    expect(submitSpy).toHaveBeenCalledTimes(1)
    expect(submitSpy).toHaveBeenCalledWith(s.id, 'timer', expect.anything(), expect.any(Function))
  })

  it('keeps the timer as the reason when Try again follows a failed timer submit', async () => {
    const s = await expiredStart()
    submitSpy.mockRejectedValueOnce(new Error('storage'))
    mount(s.id)
    const alert = await screen.findByRole('alert')
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('path')).toHaveTextContent('/report')
    expect(submitSpy).toHaveBeenCalledTimes(2)
    expect(submitSpy).toHaveBeenLastCalledWith(s.id, 'timer', expect.anything(), expect.any(Function))
  })
})

describe('other session states', () => {
  it('redirects a submitted session to its report', async () => {
    const s = await start()
    await realSubmit(s.id, 'learner', { compiler: { compile: engine.compile }, runner: { exclusive: (job) => job(), load: engine.load, runCheck: engine.runCheck } })
    mount(s.id)
    expect(await screen.findByTestId('path')).toHaveTextContent(`/exam/${s.id}/report`)
  })

  it('redirects an abandoned session to its report', async () => {
    const s = await start()
    await abandonSession(s.id, new Date())
    mount(s.id)
    expect(await screen.findByTestId('path')).toHaveTextContent(`/exam/${s.id}/report`)
  })

  it('shows a not-found state with a link back to /exam', async () => {
    mount('nope')
    expect(await screen.findByRole('heading', { name: "This exam doesn't exist" })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Exam' })).toHaveAttribute('href', '/exam')
  })
})
