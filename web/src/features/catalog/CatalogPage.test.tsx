import 'fake-indexeddb/auto'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb, resetDbForTests } from '../../progress/db'
import { markLessonVisited, recordExerciseEvent } from '../../progress/progressStore'
import { CatalogPage } from './CatalogPage'

const storeFails = { read: false, rejected: false, best: false, bestRejected: false }
vi.mock('../../exam/examStore', async (orig) => {
  const actual = await orig<typeof import('../../exam/examStore')>()
  return {
    ...actual,
    bestExamScores: () => {
      if (!storeFails.best) return actual.bestExamScores()
      storeFails.bestRejected = true
      return Promise.reject(new Error('blocked'))
    },
  }
})

vi.mock('../../progress/progressStore', async (orig) => {
  const actual = await orig<typeof import('../../progress/progressStore')>()
  return {
    ...actual,
    getAllProgress: () => {
      if (!storeFails.read) return actual.getAllProgress()
      storeFails.rejected = true
      return Promise.reject(new Error('blocked'))
    },
  }
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <CatalogPage />
    </MemoryRouter>,
  )

const observerRow = () => screen.getByRole('link', { name: 'Observer' }).closest('li') as HTMLElement

beforeEach(async () => {
  storeFails.read = false
  storeFails.rejected = false
  storeFails.best = false
  storeFails.bestRejected = false
  await resetDbForTests()
})

describe('CatalogPage', () => {
  it('lists 23 Patterns in three Category groups with availability counts', async () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Catalog' })).toBeInTheDocument()
    const groups = screen.getAllByRole('region')
    expect(groups.map((g) => within(g).getByRole('heading', { level: 2 }).textContent)).toEqual([
      'Creational',
      'Structural',
      'Behavioral',
    ])
    expect(within(groups[0]).getByText('0 of 5 available')).toBeInTheDocument()
    expect(within(groups[1]).getByText('0 of 7 available')).toBeInTheDocument()
    expect(within(groups[2]).getByText('1 of 11 available')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').filter((li) => li.dataset.pattern)).toHaveLength(23)
    expect(await screen.findByRole('link', { name: 'Read the Lesson' })).toBeInTheDocument()
  })

  it('links the Observer row to its Lesson and shows one labelled dot per Exercise', async () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Observer' })).toHaveAttribute('href', '/patterns/observer')
    const row = observerRow()
    expect(within(row).getByText('Standard')).toBeInTheDocument()
    expect(within(row).getByText('—')).toBeInTheDocument()
    const dots = within(row).getAllByRole('img', { name: /^Exercise \d: / })
    expect(dots.map((d) => d.getAttribute('aria-label'))).toEqual([
      'Exercise 1: Not started',
      'Exercise 2: Not started',
      'Exercise 3: Not started',
    ])
    expect(row.querySelector('svg.thumb rect')).not.toBeNull()
  })

  it('shows unbuilt Patterns as "Coming soon" without links', () => {
    renderPage()
    const row = screen.getByText('Strategy').closest('li') as HTMLElement
    expect(within(row).queryByRole('link')).toBeNull()
    expect(within(row).getByText('Coming soon')).toBeInTheDocument()
    expect(within(row).getByText('Swap interchangeable algorithms behind a common interface.')).toBeInTheDocument()
  })

  it('reflects stored progress in dots and the Next Step', async () => {
    await markLessonVisited('observer')
    await recordExerciseEvent('observer', 'complete', { type: 'checked', allPassed: true })
    await recordExerciseEvent('observer', 'refactor', { type: 'checked', allPassed: false })
    renderPage()
    const next = await screen.findByRole('link', { name: 'Exercise 2' })
    expect(next).toHaveAttribute('href', '/patterns/observer/practice/refactor')
    const row = observerRow()
    expect(within(row).getByRole('img', { name: 'Exercise 1: Solved' })).toBeInTheDocument()
    expect(within(row).getByRole('img', { name: 'Exercise 2: Attempted' })).toBeInTheDocument()
  })

  it('falls back to "Not started" with no Next Step when progress cannot be read', async () => {
    await recordExerciseEvent('observer', 'complete', { type: 'checked', allPassed: true })
    storeFails.read = true
    renderPage()
    await waitFor(() => expect(storeFails.rejected).toBe(true))
    const row = observerRow()
    expect(within(row).getByRole('img', { name: 'Exercise 1: Not started' })).toBeInTheDocument()
    expect(within(row).queryByRole('link', { name: /Read the Lesson|Exercise \d/ })).toBeNull()
  })

  it('still renders "—" without the "No exam taken yet" title when best scores cannot be read', async () => {
    storeFails.best = true
    renderPage()
    await screen.findByRole('link', { name: 'Read the Lesson' })
    await waitFor(() => expect(storeFails.bestRejected).toBe(true))
    const dash = within(observerRow()).getByText('—')
    // The title is present while loading, so its absence proves the error branch rendered.
    await waitFor(() => expect(dash.closest('.score')).not.toHaveAttribute('title'))
  })

  it('shows the best exam score per Pattern', async () => {
    await (await getDb()).put('examSessions', {
      id: 's',
      status: 'submitted',
      setup: { count: 1, scope: { kind: 'all' }, named: false, timed: false },
      questionKeys: ['observer/a'],
      startedAt: '2026-03-02T10:00:00.000Z',
      deadline: null,
      answers: {},
      results: [{ questionKey: 'observer/a', patternId: 'observer', identification: 'observer', identifiedCorrectly: true, grade: { kind: 'error' }, checksPassed: 0, checksTotal: 0, score: 0.8 }],
      score: 0.8,
      passed: true,
    })
    renderPage()
    expect(await within(observerRow()).findByText('80%')).toBeInTheDocument()
    expect(within(observerRow()).queryByText('—')).toBeNull()
  })

  it('links "Take the exam" to the exam preset to the Pattern once every Exercise is solved', async () => {
    await markLessonVisited('observer')
    await recordExerciseEvent('observer', 'complete', { type: 'checked', allPassed: true })
    await recordExerciseEvent('observer', 'refactor', { type: 'hintRevealed' })
    await recordExerciseEvent('observer', 'refactor', { type: 'checked', allPassed: true })
    await recordExerciseEvent('observer', 'build', { type: 'checked', allPassed: true })
    renderPage()
    const ready = await screen.findByRole('link', { name: 'Take the exam' })
    expect(ready).toHaveAttribute('href', '/exam?pattern=observer')
    expect(within(observerRow()).getByRole('img', { name: 'Exercise 2: Solved with help' })).toBeInTheDocument()
  })
})
