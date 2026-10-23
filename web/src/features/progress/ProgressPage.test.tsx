import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDbForTests } from '../../progress/db'
import { loadDraft, saveDraft } from '../../progress/drafts'
import { exportProgress } from '../../progress/exportImport'
import { getAllProgress, markLessonVisited, recordExerciseEvent } from '../../progress/progressStore'
import { ProgressPage } from './ProgressPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <ProgressPage />
    </MemoryRouter>,
  )

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(blob)
  })
}

const chooseFile = async (content: string, name = 'backup.json') => {
  const input = screen.getByLabelText('Import progress') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File([content], name, { type: 'application/json' })] } })
  await screen.findByRole('group', { name: /Importing replaces/ })
}

async function seed() {
  await markLessonVisited('observer')
  await recordExerciseEvent('observer', 'complete', { type: 'checked', allPassed: true })
  await recordExerciseEvent('observer', 'refactor', { type: 'checked', allPassed: false })
}

beforeEach(async () => {
  await resetDbForTests()
})
afterEach(() => vi.restoreAllMocks())

describe('ProgressPage', () => {
  it('shows an empty state with a Catalog link when nothing is started', async () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Progress' })).toBeInTheDocument()
    expect(await screen.findByText('Nothing here yet — open a pattern in the Catalog to start.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the Catalog' })).toHaveAttribute('href', '/')
    expect(screen.getByText('Exam history arrives with the exam.')).toBeInTheDocument()
  })

  it('renders lesson, totals, exercise statuses with links and the Next Step', async () => {
    await seed()
    renderPage()
    const row = (await screen.findByRole('link', { name: 'Observer' })).closest('li') as HTMLElement
    expect(screen.getByRole('link', { name: 'Observer' })).toHaveAttribute('href', '/patterns/observer')
    expect(within(row).getByText('Lesson visited')).toBeInTheDocument()
    expect(within(row).getByText('1 of 3 exercises solved')).toBeInTheDocument()
    const items = within(row).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(within(items[0]).getByText('Solved')).toBeInTheDocument()
    expect(within(items[1]).getByText('Attempted')).toBeInTheDocument()
    expect(within(items[2]).getByText('Not started')).toBeInTheDocument()
    expect(within(items[1]).getByRole('link')).toHaveAttribute('href', '/patterns/observer/practice/refactor')
    expect(within(row).getByRole('link', { name: 'Exercise 2' })).toHaveAttribute('href', '/patterns/observer/practice/refactor')
    expect(screen.queryByText('Nothing here yet — open a pattern in the Catalog to start.')).toBeNull()
  })

  it('exports a download with the export shape and a dated filename', async () => {
    await seed()
    renderPage()
    await screen.findByRole('link', { name: 'Observer' })
    let blob: Blob | undefined
    URL.createObjectURL = vi.fn((b: Blob) => ((blob = b), 'blob:x'))
    URL.revokeObjectURL = vi.fn()
    let download = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      download = this.download
    })
    fireEvent.click(screen.getByRole('button', { name: 'Export progress' }))
    await waitFor(() => expect(blob).toBeDefined())
    const data = JSON.parse(await readBlob(blob!))
    expect(data.app).toBe('design-patterns-trainer')
    expect(data.schemaVersion).toBe(1)
    expect(data.progress[0].patternId).toBe('observer')
    expect(download).toMatch(/^design-patterns-progress-\d{4}-\d{2}-\d{2}\.json$/)
  })

  it('shows a recoverable error for a bad file and leaves data untouched', async () => {
    await seed()
    renderPage()
    await screen.findByRole('link', { name: 'Observer' })
    await chooseFile('not json')
    expect(screen.getByText(/Importing replaces your current progress and saved code on this device\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("That file isn't valid JSON.")
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull()
    expect((await getAllProgress())[0].lessonVisited).toBe(true)
  })

  it.each([
    [JSON.stringify({ hello: 1 }), "That file isn't a Design Patterns Trainer export."],
    [JSON.stringify({ app: 'design-patterns-trainer', schemaVersion: 2 }), 'That export comes from a newer version of the app.'],
  ])('maps import reasons to copy: %s', async (content, message) => {
    renderPage()
    await screen.findByText(/Nothing here yet/)
    await chooseFile(content)
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('cancel discards the chosen file without touching data', async () => {
    await seed()
    renderPage()
    await screen.findByRole('link', { name: 'Observer' })
    await chooseFile('{}')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull()
    expect((await getAllProgress())).toHaveLength(1)
  })

  it('a confirmed import replaces progress and drafts and refreshes the page', async () => {
    await seed()
    await saveDraft('exercise:observer/complete', 'old code', 1)
    const backup = await exportProgress()
    backup.progress = [{ patternId: 'observer', lessonVisited: true, exercises: {} }]
    backup.drafts = [{ key: 'lesson:observer', code: 'from backup', contentVersion: 1, updatedAt: new Date().toISOString() }]
    renderPage()
    await screen.findByText('1 of 3 exercises solved')
    await chooseFile(JSON.stringify(backup))
    expect(screen.getByText('backup.json', { exact: false })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Imported progress for 1 patterns and 1 saved files.')
    await waitFor(() => expect(screen.getByText('0 of 3 exercises solved')).toBeInTheDocument())
    expect(await loadDraft('exercise:observer/complete', 1)).toBeUndefined()
    expect((await loadDraft('lesson:observer', 1))?.draft.code).toBe('from backup')
  })
})
