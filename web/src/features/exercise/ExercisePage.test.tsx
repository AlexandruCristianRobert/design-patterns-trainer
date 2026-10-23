import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CheckResult, CompileResponse } from '../../compiler/protocol'
import type { Timed } from '../../compiler/RunnerHost'
import { getPattern } from '../../content/patterns'
import { loadDraft, saveDraft } from '../../progress/drafts'
import { resetDbForTests } from '../../progress/db'
import { getProgress, recordExerciseEvent } from '../../progress/progressStore'
import { ExercisePage } from './ExercisePage'
import i18n from '../../i18n'

// When set, any non-English text loses its first check entry, as a partly translated locale would.
const dropCheck = { on: false }
vi.mock('../../content/text', async (orig) => {
  const real = await orig<typeof import('../../content/text')>()
  return {
    ...real,
    getExerciseText: (p: string, e: string, lng: string) => {
      const r = real.getExerciseText(p, e, lng)
      if (!dropCheck.on || lng === 'en') return r
      const [, ...rest] = Object.entries(r.value.checks)
      return { ...r, value: { ...r.value, checks: Object.fromEntries(rest) } }
    },
  }
})

const ids = ['every-subscriber-notified', 'unsubscribed-not-notified', 'notified-with-new-value', 'no-subscribers-ok']

const engine = {
  compile: vi.fn(),
  load: vi.fn(),
  runCheck: vi.fn(),
}

// Flip these to make the progress store reject reads or writes, as it does when the browser blocks storage.
const storeFails = { read: false, write: false }
vi.mock('../../progress/progressStore', async (orig) => {
  const real = await orig<typeof import('../../progress/progressStore')>()
  return {
    ...real,
    getProgress: (id: string) => (storeFails.read ? Promise.reject(new Error('blocked')) : real.getProgress(id)),
    recordExerciseEvent: (...a: Parameters<typeof real.recordExerciseEvent>) =>
      storeFails.write ? Promise.reject(new Error('blocked')) : real.recordExerciseEvent(...a),
  }
})

vi.mock('../../compiler/CompilerProvider', () => ({
  useCompiler: () => ({
    status: 'ready',
    compiler: { compile: engine.compile },
    runner: { load: engine.load, runCheck: engine.runCheck, runMain: vi.fn() },
  }),
}))

vi.mock('../../editor/CodeEditor', () => ({
  CodeEditor: (p: { value: string; ariaLabel: string; onChange(v: string): void; readOnly?: boolean }) => (
    <textarea aria-label={p.ariaLabel} value={p.value} readOnly={p.readOnly} onChange={(e) => p.onChange(e.target.value)} />
  ),
}))

const exercise = getPattern('observer')!.exercises[0]

const passed = (id: string): Timed<CheckResult> => ({ kind: 'ok', value: { id, status: 'passed' } })

function engineRuns(results: Record<string, Timed<CheckResult>>, compile: Partial<CompileResponse> = {}) {
  engine.compile.mockResolvedValue({ success: true, diagnostics: [], contractViolations: [], assemblyBase64: 'AAA', ...compile })
  engine.load.mockResolvedValue({ checkIds: ids, hasEntryPoint: false })
  engine.runCheck.mockImplementation(async (id: string) => results[id] ?? passed(id))
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patterns/:patternId/practice/:exerciseId" element={<ExercisePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function open(id = 'complete') {
  renderAt(`/patterns/observer/practice/${id}`)
  const editor = await screen.findByLabelText('C# code')
  await waitFor(() => expect(editor).not.toHaveAttribute('readonly'))
  return editor
}

const check = () => screen.getByRole('button', { name: /^Check/ })

/** Holds the next compile until the returned function is called, so a test can act while a Check runs. */
function holdCompile() {
  let release!: () => void
  engine.compile.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = () => resolve({ success: true, diagnostics: [], contractViolations: [], assemblyBase64: 'AAA' })
      }),
  )
  return () => release()
}

const outdated = 'These results are for an earlier version of your code. Check again.'
const headerStatus = (name: string) => screen.findByText(name, { selector: '.exercise-status span' })

beforeEach(async () => {
  storeFails.read = false
  storeFails.write = false
  await resetDbForTests()
  vi.resetAllMocks()
  engineRuns({})
})

describe('ExercisePage', () => {
  it('shows the header, scenario with inline code, and the Contract', async () => {
    await open()
    expect(screen.getByRole('heading', { level: 1, name: 'Finish the weather station' })).toBeInTheDocument()
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(crumbs).getByRole('link', { name: 'Catalog' })).toHaveAttribute('href', '/')
    expect(within(crumbs).getByRole('link', { name: 'Observer' })).toHaveAttribute('href', '/patterns/observer')
    expect(within(crumbs).getByText('Exercise 1')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Complete the code')).toBeInTheDocument()
    expect(screen.getAllByText('WeatherStation', { selector: 'code' }).length).toBeGreaterThan(0)
    const contract = screen.getByRole('region', { name: 'Contract' })
    expect(within(contract).getByText('Your code must provide:')).toBeInTheDocument()
    expect(within(contract).getByText('void Update(int temperature)')).toBeInTheDocument()
    expect(within(contract).getByText('interface')).toBeInTheDocument()
  })

  it('Check shows each check and the summary', async () => {
    engineRuns({
      'every-subscriber-notified': {
        kind: 'ok',
        value: { id: 'every-subscriber-notified', status: 'failed', reason: 'wrongCallCount', args: { subscriber: 'A', calls: '2' } },
      },
    })
    await open()
    fireEvent.click(check())
    expect(await screen.findByText('3 of 4 checks passed')).toBeInTheDocument()
    const items = within(screen.getByRole('list', { name: 'Checks' })).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items[0]).toHaveTextContent('Every subscriber is notified once per change')
    expect(items[0]).toHaveTextContent('Subscriber A received 2 updates for a single temperature change. Expected exactly 1.')
    expect(screen.queryByText(/^Solved/)).toBeNull()
    await waitFor(async () => expect((await getProgress('observer')).exercises.complete.status).toBe('attempted'))
  })

  it('shows Solved when every check passes', async () => {
    await open()
    fireEvent.click(check())
    expect(await screen.findByText('Solved — every check passed.')).toBeInTheDocument()
    expect(screen.getByText('4 of 4 checks passed')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Next exercise' })).toHaveAttribute('href', '/patterns/observer/practice/refactor')
    await waitFor(async () => expect((await getProgress('observer')).exercises.complete.status).toBe('solved'))
  })

  it('shows Solved with help after a hint', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Show hint 1 of 3' }))
    expect(await screen.findByText(/Everything the station needs/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show hint 2 of 3' })).toBeInTheDocument()
    fireEvent.click(check())
    expect(await screen.findByText('Solved with help — every check passed.')).toBeInTheDocument()
    expect((await getProgress('observer')).exercises.complete.hintsRevealed).toBe(1)
  })

  it('keeps revealed hints across visits and removes the button after the last one', async () => {
    for (let i = 0; i < 3; i++) await recordExerciseEvent('observer', 'complete', { type: 'hintRevealed' })
    await open()
    expect(await screen.findByText(/List<T>/, { selector: 'code' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Show hint/ })).toBeNull()
  })

  it('disables Reveal solution until the first Check, then shows it read-only and copies it into the editor', async () => {
    const editor = await open()
    const reveal = screen.getByRole('button', { name: 'Reveal solution' })
    expect(reveal).toBeDisabled()
    expect(reveal).toHaveAccessibleDescription('Press Check once first. The solution unlocks after your first attempt.')
    fireEvent.click(check())
    await screen.findByText('Solved — every check passed.')
    await waitFor(() => expect(reveal).toBeEnabled())
    fireEvent.click(reveal)
    const panel = await screen.findByRole('region', { name: 'Solution' })
    expect(panel).toHaveTextContent('class WeatherStation')
    fireEvent.click(within(panel).getByRole('button', { name: 'Copy into editor' }))
    expect(editor).toHaveValue(exercise.solution)
    await waitFor(async () => expect((await getProgress('observer')).exercises.complete.solutionRevealed).toBe(true))
  })

  it('asks for confirmation inline before resetting, and reset clears code, draft and status', async () => {
    const editor = await open()
    fireEvent.change(editor, { target: { value: 'my work' } })
    fireEvent.click(check())
    await screen.findByText('Solved — every check passed.')
    await saveDraft('exercise:observer/complete', 'my work', 1)

    fireEvent.click(screen.getByRole('button', { name: 'Reset exercise' }))
    expect(screen.getByText('Reset this exercise? Your code and progress for it will be cleared.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Keep working' }))
    expect(screen.queryByText(/Reset this exercise/)).toBeNull()
    expect(editor).toHaveValue('my work')

    fireEvent.click(screen.getByRole('button', { name: 'Reset exercise' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(editor).toHaveValue(exercise.starter))
    await waitFor(async () => expect((await getProgress('observer')).exercises.complete.status).toBe('notStarted'))
    await waitFor(async () => expect(await loadDraft('exercise:observer/complete', 1)).toBeUndefined())
    expect(screen.queryByText('Solved — every check passed.')).toBeNull()
  })

  it('flags a Draft from an older version and starts from the new version on request', async () => {
    await saveDraft('exercise:observer/complete', 'old code', 0)
    const editor = await open()
    await waitFor(() => expect(editor).toHaveValue('old code'))
    expect(screen.getByText('This exercise was updated since you last worked on it. Your code is kept.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start from the new version' }))
    expect(editor).toHaveValue(exercise.starter)
    expect(screen.queryByText(/was updated since/)).toBeNull()
  })

  it('shows contract violations in plain language and records the attempt', async () => {
    engineRuns(
      {},
      { success: false, contractViolations: [{ code: 'missingMember', type: 'WeatherStation', member: 'void Subscribe(IObserver observer)' }] },
    )
    await open()
    fireEvent.click(check())
    expect(await screen.findByText('WeatherStation needs a public member: void Subscribe(IObserver observer)')).toBeInTheDocument()
    expect(engine.load).not.toHaveBeenCalled()
    await waitFor(async () => expect((await getProgress('observer')).exercises.complete.checkedOnce).toBe(true))
  })

  it('lists compile errors from the learner code', async () => {
    engineRuns(
      {},
      {
        success: false,
        diagnostics: [{ id: 'CS1002', level: 'error', message: '; expected', file: 'user', startLine: 3, startColumn: 5, endLine: 3, endColumn: 6 }],
      },
    )
    await open()
    fireEvent.click(check())
    expect(await screen.findByText('; expected')).toBeInTheDocument()
    expect(screen.getByText('Line 3, column 5')).toBeInTheDocument()
  })

  it('recovers when the engine fails mid-check: inline error, attempt recorded, Check again works', async () => {
    await open()
    engine.load.mockRejectedValueOnce(new Error('runner crashed'))
    fireEvent.click(check())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("The checks couldn't run this time. Your code is safe.")
    expect(alert).not.toHaveTextContent('runner crashed')
    await waitFor(async () => expect((await getProgress('observer')).exercises.complete.checkedOnce).toBe(true))
    expect((await getProgress('observer')).exercises.complete.status).toBe('attempted')
    fireEvent.click(within(alert).getByRole('button', { name: 'Check again' }))
    expect(await screen.findByText('Solved — every check passed.')).toBeInTheDocument()
  })

  it('disables Reset and Show hint while a Check runs', async () => {
    const release = holdCompile()
    await open()
    fireEvent.click(check())
    expect(await screen.findByRole('button', { name: /Checking/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset exercise' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Show hint 1 of 3' })).toBeDisabled()
    release()
    await screen.findByText('Solved — every check passed.')
    expect(screen.getByRole('button', { name: 'Reset exercise' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Show hint 1 of 3' })).toBeEnabled()
  })

  it('keeps an open Reset confirmation from firing while a Check runs', async () => {
    const release = holdCompile()
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Reset exercise' }))
    fireEvent.click(check())
    expect(await screen.findByRole('button', { name: /Checking/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
    release()
    await screen.findByText('Solved — every check passed.')
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled()
  })

  it('flags results as out of date once the code changes, without touching the status', async () => {
    const editor = await open()
    fireEvent.click(check())
    await screen.findByText('Solved — every check passed.')
    expect(screen.queryByText(outdated)).toBeNull()
    fireEvent.change(editor, { target: { value: 'edited' } })
    expect(screen.getByText(outdated)).toBeInTheDocument()
    expect(await headerStatus('Solved')).toBeInTheDocument()
    fireEvent.change(editor, { target: { value: exercise.starter } })
    expect(screen.queryByText(outdated)).toBeNull()
    expect((await getProgress('observer')).exercises.complete.status).toBe('solved')
  })

  it('keeps hints, the solution and status working on this page when progress cannot load', async () => {
    storeFails.read = true
    await open()
    expect(await screen.findByText(/Progress can't be saved in this browser/)).toBeInTheDocument()
    expect(await headerStatus('Not started')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show hint 1 of 3' }))
    expect(await screen.findByText(/Everything the station needs/)).toBeInTheDocument()
    fireEvent.click(check())
    expect(await screen.findByText('Solved with help — every check passed.')).toBeInTheDocument()
    expect(await headerStatus('Solved with help')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reveal solution' })).toBeEnabled()
  })

  it('keeps progress on this page and says so when saving it fails', async () => {
    await open()
    await headerStatus('Not started')
    storeFails.write = true
    fireEvent.click(screen.getByRole('button', { name: 'Show hint 1 of 3' }))
    expect(await screen.findByText(/Everything the station needs/)).toBeInTheDocument()
    expect(screen.getByText(/Your latest progress couldn't be saved/)).toBeInTheDocument()
    expect(screen.queryByText(/Progress can't be saved in this browser/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Show hint 2 of 3' })).toBeEnabled()
  })

  it('shows a recoverable error, not a pass, when no checks are found', async () => {
    engine.load.mockResolvedValueOnce({ checkIds: [], hasEntryPoint: false })
    await open()
    fireEvent.click(check())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("The checks couldn't run this time.")
    expect(screen.queryByText(/^Solved/)).toBeNull()
    await waitFor(async () => expect((await getProgress('observer')).exercises.complete.status).toBe('attempted'))
  })

  it('grades against the English check ids even when the locale text lacks one', async () => {
    dropCheck.on = true
    try {
      await i18n.changeLanguage('de')
      await open()
      fireEvent.click(check())
      await waitFor(async () => expect((await getProgress('observer')).exercises.complete.status).toBe('solved'))
      expect(screen.queryByRole('alert')).toBeNull()
    } finally {
      dropCheck.on = false
      await i18n.changeLanguage('en')
    }
  })

  it('shows the larger-screen note in the header', async () => {
    await open()
    expect(screen.getByText('This exercise works best on a larger screen.')).toHaveClass('exercise-small-screen')
  })

  it('navigates between exercises', async () => {
    await open('refactor')
    expect(screen.getByRole('link', { name: /Previous: Finish the weather station/ })).toHaveAttribute(
      'href',
      '/patterns/observer/practice/complete',
    )
    expect(screen.getByRole('link', { name: /^Next: / })).toHaveAttribute('href', '/patterns/observer/practice/build')
  })

  it.each([
    ['/patterns/observer/practice/nope', "This exercise doesn't exist", 'Back to the Lesson'],
    ['/patterns/strategy/practice/x', 'This pattern is coming soon', 'Back to the Catalog'],
    ['/patterns/no-such/practice/x', 'There is no exercise at this address', 'Back to the Catalog'],
  ])('shows an unavailable state for %s', (path, title, back) => {
    renderAt(path)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: back })).toBeInTheDocument()
  })
})
