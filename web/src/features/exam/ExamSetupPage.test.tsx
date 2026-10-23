import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSession, getInProgressSession, listSessions } from '../../exam/examStore'
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

const renderPage = (path = '/exam') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/exam" element={<ExamSetupPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

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

  it('offers the three Categories and disables Start until one with questions is chosen', async () => {
    renderPage()
    await waitForForm()
    click(screen.getByRole('radio', { name: 'Categories' }))
    for (const name of ['Creational', 'Structural', 'Behavioral']) expect(screen.getByRole('checkbox', { name })).toBeInTheDocument()
    expect(screen.getByText('Choose at least one Category to start.')).toBeInTheDocument()
    click(screen.getByRole('checkbox', { name: 'Structural' }))
    expect(screen.getByText('No questions are available in this scope.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start exam' })).toBeDisabled()
    click(screen.getByRole('checkbox', { name: 'Behavioral' }))
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
