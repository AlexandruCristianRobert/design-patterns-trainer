import 'fake-indexeddb/auto'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDbForTests } from '../progress/db'
import { ExamBanner } from './ExamBanner'
import { abandonSession, createSession } from './examStore'
import { submitExam } from './submitExam'
import type { ExamSetup } from './types'
import { useExamWatcher } from './useExamWatcher'

vi.mock('./submitExam', () => ({ submitExam: vi.fn() }))
const engine = { status: 'ready' as 'starting' | 'ready' | 'failed' }
vi.mock('../compiler/CompilerProvider', () => ({ useCompiler: () => ({ status: engine.status, compiler: {}, runner: {} }) }))

const submit = vi.mocked(submitExam)
const setup: ExamSetup = { count: 1, scope: { kind: 'all' }, named: false, timed: true }

function Probe() {
  const watch = useExamWatcher()
  const { pathname } = useLocation()
  return (
    <>
      <ExamBanner watch={watch} />
      <output data-testid="path">{pathname}</output>
    </>
  )
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Probe />
    </MemoryRouter>,
  )

/** Lets IndexedDB and promise callbacks settle while fake timers are installed. */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 40)) })

beforeEach(async () => {
  engine.status = 'ready'
  submit.mockReset()
  submit.mockResolvedValue(undefined)
  vi.useRealTimers()
  await resetDbForTests()
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(new Date('2026-10-23T10:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('useExamWatcher', () => {
  it('submits an expired session found at mount, by the timer', async () => {
    const s = await createSession(setup, ['observer/build-status'], new Date('2026-10-23T09:00:00Z'))
    renderAt('/')
    await settle()
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledWith(s.id, 'timer', expect.anything())
  })

  it('leaves an unexpired session alone', async () => {
    await createSession(setup, ['observer/build-status'], new Date())
    renderAt('/')
    await settle()
    expect(submit).not.toHaveBeenCalled()
  })

  it('submits when the clock passes the deadline, and goes to the report from the session page', async () => {
    const s = await createSession(setup, ['observer/build-status'], new Date())
    renderAt(`/exam/${s.id}`)
    await settle()
    expect(submit).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(15 * 60_000 + 1000) })
    expect(submit).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('path')).toHaveTextContent(`/exam/${s.id}/report`)
  })

  it('does not navigate when the learner is on another page', async () => {
    await createSession(setup, ['observer/build-status'], new Date('2026-10-23T09:00:00Z'))
    renderAt('/progress')
    await settle()
    expect(screen.getByTestId('path')).toHaveTextContent('/progress')
  })

  it('does nothing and sets no timer when no session is in progress', async () => {
    renderAt('/')
    await settle()
    expect(submit).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    expect(screen.queryByText(/Exam in progress/)).toBeNull()
  })

  it('shows a recoverable error when submitting fails, retries no sooner than 30 s, and offers Try again', async () => {
    const s = await createSession(setup, ['observer/build-status'], new Date('2026-10-23T09:00:00Z'))
    submit.mockRejectedValue(new Error('storage'))
    renderAt('/')
    await settle()
    expect(submit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toHaveTextContent("Your exam couldn't be submitted automatically. Your answers are saved.")

    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(submit).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(11_000) })
    expect(submit).toHaveBeenCalledTimes(2)

    submit.mockResolvedValue(undefined)
    await act(async () => { screen.getByRole('button', { name: 'Try again' }).click() })
    await settle()
    expect(submit).toHaveBeenCalledTimes(3)
    expect(submit).toHaveBeenLastCalledWith(s.id, 'timer', expect.anything())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('useExamWatcher: other states', () => {
  it('picks up a session created after mount', async () => {
    renderAt('/')
    await settle()
    expect(screen.queryByText(/Exam in progress/)).toBeNull()
    await act(async () => {
      await createSession(setup, ['observer/build-status'], new Date())
    })
    await settle()
    expect(screen.getByText('Exam in progress — 15:00 left.')).toBeInTheDocument()
  })

  it('submits nothing and shows no error while the compiler is still starting', async () => {
    await createSession(setup, ['observer/build-status'], new Date('2026-10-23T09:00:00Z'))
    engine.status = 'starting'
    renderAt('/')
    await settle()
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(submit).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Time is up. Submitting your exam…')).toBeInTheDocument()
  })

  it('says the engine did not start, with a reload action, when an expired session meets a failed compiler', async () => {
    await createSession(setup, ['observer/build-status'], new Date('2026-10-23T09:00:00Z'))
    engine.status = 'failed'
    renderAt('/')
    await settle()
    expect(submit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Your exam couldn't be graded because the C# engine didn't start. Your answers are saved — reload the page to try again.",
    )
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(screen.queryByText('Time is up. Submitting your exam…')).toBeNull()
  })

  it('does not carry a failure over to the next exam', async () => {
    const first = await createSession(setup, ['observer/build-status'], new Date('2026-10-23T09:00:00Z'))
    submit.mockRejectedValue(new Error('storage'))
    renderAt('/')
    await settle()
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await act(async () => {
      await abandonSession(first.id, new Date())
    })
    await settle()
    expect(screen.queryByRole('alert')).toBeNull()

    // A new exam that has already run out is submitted at once, not held back by the old failure's 30 s wait.
    submit.mockReset()
    submit.mockResolvedValue(undefined)
    const second = await createSession(setup, ['observer/match-score'], new Date('2026-10-23T09:00:00Z'))
    await settle()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledWith(second.id, 'timer', expect.anything())
  })
})

describe('ExamBanner', () => {
  it('is hidden on the setup page, which has its own Resume panel', async () => {
    await createSession(setup, ['observer/build-status'], new Date())
    renderAt('/exam')
    await settle()
    expect(screen.queryByText(/Exam in progress/)).toBeNull()
  })

  it('still shows an error on the setup page', async () => {
    await createSession(setup, ['observer/build-status'], new Date('2026-10-23T09:00:00Z'))
    submit.mockRejectedValue(new Error('storage'))
    renderAt('/exam')
    await settle()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('is hidden on the session page', async () => {
    const s = await createSession(setup, ['observer/build-status'], new Date())
    renderAt(`/exam/${s.id}`)
    await settle()
    expect(screen.queryByText(/Exam in progress/)).toBeNull()
  })

  it('is shown elsewhere with the time left and a way back', async () => {
    const s = await createSession(setup, ['observer/build-status'], new Date())
    renderAt('/')
    await settle()
    expect(screen.getByText('Exam in progress — 15:00 left.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to exam' })).toHaveAttribute('href', `/exam/${s.id}`)
  })

  it('omits the time for an untimed session', async () => {
    await createSession({ ...setup, timed: false }, ['observer/build-status'], new Date())
    renderAt('/')
    await settle()
    expect(screen.getByText('Exam in progress.')).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)
  })
})
