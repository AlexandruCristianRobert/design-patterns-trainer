import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSession, getInProgressSession, listSessions } from '../../exam/examStore'
import { ExamWatchContext } from '../../exam/ExamWatchContext'
import type { ExamWatch } from '../../exam/useExamWatcher'
import { resetDbForTests } from '../../progress/db'
import { ExamSetupPage } from './ExamSetupPage'

const stale = { hide: false }
vi.mock('../../exam/examStore', async (orig) => {
  const actual = await orig<typeof import('../../exam/examStore')>()
  return { ...actual, getInProgressSession: () => (stale.hide ? Promise.resolve(undefined) : actual.getInProgressSession()) }
})

function Where() {
  return <output data-testid="path">{useLocation().pathname}</output>
}

const renderPage = (path = '/exam', watch?: ExamWatch) => {
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/exam" element={<ExamSetupPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )
  return render(watch ? <ExamWatchContext.Provider value={watch}>{tree}</ExamWatchContext.Provider> : tree)
}

const waitForForm = () => screen.findByRole('button', { name: 'Start exam' })
const click = (el: HTMLElement) => fireEvent.click(el)
const inProgressSetup = { count: 1, scope: { kind: 'all' as const }, named: true, timed: false }

beforeEach(async () => {
  stale.hide = false
  await resetDbForTests()
})

describe('ExamSetupPage form', () => {
  it('renders the defaults: 3 questions, All, Named off, Timer on at 45 minutes', async () => {
    renderPage()
    await waitForForm()
    expect(screen.getByRole('heading', { level: 1, name: 'Exam' })).toBeInTheDocument()
    expect(
      screen.getByText('Closed book: the exam pages show no Hints, solutions or Lessons, so keep them closed too. You can run your code; Checks stay hidden until you submit.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Number of questions')).toHaveValue(3)
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
    expect(screen.getByRole('switch', { name: /Named mode/ })).not.toBeChecked()
    expect(screen.getByRole('switch', { name: /Timer/ })).toBeChecked()
    expect(screen.getByText('45 minutes')).toBeInTheDocument()
    expect(screen.getByText('The Pattern is named and Identification is skipped.')).toBeInTheDocument()
  })

  it('says when the count is capped by the scope, and sizes the timer to the real count', async () => {
    renderPage()
    await waitForForm()
    click(screen.getByRole('radio', { name: 'Patterns' }))
    click(screen.getByRole('checkbox', { name: 'Observer' }))
    fireEvent.change(screen.getByLabelText('Number of questions'), { target: { value: '8' } })
    expect(screen.getByText('Only 3 questions are available in this scope; the exam will have 3.')).toBeInTheDocument()
    expect(screen.getByText('45 minutes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start exam' })).toBeEnabled()
  })

  it('disables Start with the reason when Patterns is chosen and none is selected', async () => {
    renderPage()
    await waitForForm()
    click(screen.getByRole('radio', { name: 'Patterns' }))
    const start = screen.getByRole('button', { name: 'Start exam' })
    expect(start).toBeDisabled()
    expect(screen.getByText('Choose at least one Pattern to start.')).toBeInTheDocument()
    expect(start).toHaveAccessibleDescription(/Choose at least one Pattern to start\./)
    click(screen.getByRole('checkbox', { name: 'Observer' }))
    expect(start).toBeEnabled()
  })

  it('offers the three Categories and disables Start until one is chosen', async () => {
    renderPage()
    await waitForForm()
    click(screen.getByRole('radio', { name: 'Categories' }))
    for (const name of ['Creational', 'Structural', 'Behavioral']) expect(screen.getByRole('checkbox', { name })).toBeInTheDocument()
    expect(screen.getByText('Choose at least one Category to start.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start exam' })).toBeDisabled()
    click(screen.getByRole('checkbox', { name: 'Structural' }))
    expect(screen.getByRole('button', { name: 'Start exam' })).toBeEnabled()
  })

  it('Start exam creates a session and opens it', async () => {
    renderPage()
    click(await waitForForm())
    const s = await waitFor(async () => {
      const cur = await getInProgressSession()
      expect(cur).toBeDefined()
      return cur!
    })
    expect(s.setup).toEqual({ count: 3, scope: { kind: 'all' }, named: false, timed: true })
    expect(s.questionKeys).toHaveLength(3)
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent(`/exam/${s.id}`))
  })

  it('?pattern=observer preselects that Pattern', async () => {
    renderPage('/exam?pattern=observer')
    await waitForForm()
    expect(screen.getByRole('radio', { name: 'Patterns' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Observer' })).toBeChecked()
  })

  it('ignores an unknown ?pattern', async () => {
    renderPage('/exam?pattern=nope')
    await waitForForm()
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
  })

  it('swaps the form for the Resume panel when another tab starts an exam', async () => {
    renderPage()
    await waitForForm()
    await createSession(inProgressSetup, ['observer/build-status'], new Date())
    expect(await screen.findByRole('heading', { name: 'You have an exam in progress' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start exam' })).toBeNull()
  })
})

describe('ExamSetupPage with an exam in progress', () => {
  const seed = () =>
    createSession({ count: 2, scope: { kind: 'all' }, named: false, timed: true }, ['observer/build-status', 'observer/match-score'], new Date())

  it('shows Resume and Abandon instead of the form', async () => {
    const s = await seed()
    renderPage()
    expect(await screen.findByRole('heading', { name: 'You have an exam in progress' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Resume exam' })).toHaveAttribute('href', `/exam/${s.id}`)
    expect(screen.getByText('2 questions')).toBeInTheDocument()
    expect(screen.queryByLabelText('Number of questions')).toBeNull()
  })

  it('Abandon asks first, Keep it backs out, Abandon exam logs it as abandoned', async () => {
    const s = await seed()
    renderPage()
    click(await screen.findByRole('button', { name: 'Abandon exam' }))
    const confirm = screen.getByRole('group', { name: 'Abandon this exam? It will be logged without a score.' })
    expect(within(confirm).getByRole('button', { name: 'Keep it' })).toHaveFocus()

    click(within(confirm).getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByRole('group')).toBeNull()
    expect((await getInProgressSession())?.id).toBe(s.id)

    click(screen.getByRole('button', { name: 'Abandon exam' }))
    click(within(screen.getByRole('group')).getByRole('button', { name: 'Abandon exam' }))
    expect(await waitForForm()).toBeInTheDocument()
    const all = await listSessions()
    expect(all[0]).toMatchObject({ id: s.id, status: 'abandoned' })
    expect(all[0].score).toBeUndefined()
  })
})

describe('ExamSetupPage with an expired exam', () => {
  const seedExpired = () =>
    createSession({ count: 1, scope: { kind: 'all' }, named: false, timed: true }, ['observer/build-status'], new Date(Date.now() - 16 * 60_000))
  const watchOf = (over: Partial<ExamWatch>): ExamWatch => ({ session: undefined, remaining: 0, phase: 'submitting', cause: null, retry: vi.fn(), ...over })

  it('offers no Abandon and shows that the exam is being submitted', async () => {
    const s = await seedExpired()
    renderPage('/exam', watchOf({ session: s }))
    expect(await screen.findByText('Time is up. Submitting your exam…')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Time is up. Submitting your exam…')
    expect(screen.queryByRole('button', { name: 'Abandon exam' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Resume exam' })).toBeNull()
  })

  it('says time is up instead of an exam in progress, with no time left', async () => {
    const s = await seedExpired()
    renderPage('/exam', watchOf({ session: s }))
    expect(await screen.findByRole('heading', { name: 'Time is up' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'You have an exam in progress' })).toBeNull()
    expect(screen.queryByText(/0:00/)).toBeNull()
    expect(screen.queryByText(/left/)).toBeNull()
  })

  it('shows the submitting state even before the watcher has reported', async () => {
    await seedExpired()
    renderPage()
    expect(await screen.findByText('Time is up. Submitting your exam…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abandon exam' })).toBeNull()
  })

  it('offers Try again when the automatic submit failed', async () => {
    const s = await seedExpired()
    const watch = watchOf({ session: s, phase: 'failed', cause: 'storage' })
    renderPage('/exam', watch)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Time is up. Your exam couldn't be submitted automatically. Your answers are saved.")
    click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(watch.retry).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Abandon exam' })).toBeNull()
  })

  it('offers Reload when the engine failed', async () => {
    const s = await seedExpired()
    renderPage('/exam', watchOf({ session: s, phase: 'failed', cause: 'compiler' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Your exam couldn't be graded because the C# engine didn't start.")
    expect(within(alert).getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
  })
})

describe('ExamSetupPage race with another tab', () => {
  it('falls back to the Resume panel, not an error, when Start finds an exam already in progress', async () => {
    stale.hide = true
    renderPage()
    const start = await waitForForm()
    await createSession(inProgressSetup, ['observer/build-status'], new Date())
    stale.hide = false
    click(start)
    expect(await screen.findByRole('heading', { name: 'You have an exam in progress' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
