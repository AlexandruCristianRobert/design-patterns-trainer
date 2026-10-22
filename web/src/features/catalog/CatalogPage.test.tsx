import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '../../progress/db'
import { markLessonVisited, recordExerciseEvent } from '../../progress/progressStore'
import { CatalogPage } from './CatalogPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <CatalogPage />
    </MemoryRouter>,
  )

const observerRow = () => screen.getByRole('link', { name: 'Observer' }).closest('li') as HTMLElement

beforeEach(async () => {
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

  it('shows "Ready for the exam" as text, not a link, once every Exercise is solved', async () => {
    await markLessonVisited('observer')
    await recordExerciseEvent('observer', 'complete', { type: 'checked', allPassed: true })
    await recordExerciseEvent('observer', 'refactor', { type: 'hintRevealed' })
    await recordExerciseEvent('observer', 'refactor', { type: 'checked', allPassed: true })
    await recordExerciseEvent('observer', 'build', { type: 'checked', allPassed: true })
    renderPage()
    const ready = await screen.findByText('Ready for the exam')
    expect(ready.closest('a')).toBeNull()
    expect(ready).toHaveAccessibleDescription('The exam arrives in a later update.')
    expect(within(observerRow()).getByRole('img', { name: 'Exercise 2: Solved with help' })).toBeInTheDocument()
  })
})
