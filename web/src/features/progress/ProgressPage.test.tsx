import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExamSession } from '../../exam/types'
import { getDb, resetDbForTests } from '../../progress/db'
import { loadDraft, saveDraft } from '../../progress/drafts'
import * as exportImport from '../../progress/exportImport'
import { exportProgress } from '../../progress/exportImport'
import { getAllProgress, markLessonVisited, recordExerciseEvent } from '../../progress/progressStore'
import { ProgressPage } from './ProgressPage'

vi.mock('../../exam/examStore', async (orig) => {
  const actual = await orig<typeof import('../../exam/examStore')>()
  return { ...actual, listSessions: () => (storeFails.sessions ? Promise.reject(new Error('blocked')) : actual.listSessions()) }
})

vi.mock('../../progress/exportImport', async (orig) => {
  const actual = await orig<typeof import('../../progress/exportImport')>()
  return { ...actual, importProgress: vi.fn(actual.importProgress) }
})

const storeFails = { read: false, sessions: false }
vi.mock('../../progress/progressStore', async (orig) => {
  const actual = await orig<typeof import('../../progress/progressStore')>()
  return { ...actual, getAllProgress: () => (storeFails.read ? Promise.reject(new Error('blocked')) : actual.getAllProgress()) }
})

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
  storeFails.read = false
  storeFails.sessions = false
  await resetDbForTests()
})
afterEach(() => vi.restoreAllMocks())

const session = (id: string, startedAt: string, extra: Partial<ExamSession>): ExamSession => ({
  id,
  status: 'submitted',
  setup: { count: 3, scope: { kind: 'all' }, named: false, timed: true },
  questionKeys: ['observer/a', 'observer/b', 'observer/c'],
  startedAt,
  deadline: null,
  answers: {},
  ...extra,
})

describe('ProgressPage', () => {
  it('lists exam history newest first with outcome and report links', async () => {
    const db = await getDb()
    await db.put('examSessions', session('old', '2026-03-01T10:00:00.000Z', { status: 'abandoned', endedAt: '2026-03-01T10:05:00.000Z' }))
    await db.put('examSessions', session('new', '2026-03-02T10:00:00.000Z', { score: 0.8, passed: true, results: [], endedAt: '2026-03-02T10:20:00.000Z' }))
    renderPage()
    const section = (await screen.findByRole('region', { name: 'Exam history' })) as HTMLElement
    expect(section.id).toBe('exam-history')
    const rows = await within(section).findAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('3 questions')
    expect(rows[0]).toHaveTextContent('Unnamed')
    expect(rows[0]).toHaveTextContent('80%')
    expect(rows[0]).toHaveTextContent('Passed')
    expect(within(rows[0]).getByRole('link', { name: /^View report/ })).toHaveAttribute('href', '/exam/new/report')
    expect(rows[1]).toHaveTextContent('Abandoned')
    expect(rows[1]).not.toHaveTextContent('%')
    expect(within(rows[1]).getByRole('link', { name: /^View report/ })).toHaveAttribute('href', '/exam/old/report')
    expect(within(section).queryByText('No exams yet.')).toBeNull()
  })

  it('shows Not passed and Named mode, flooring the percent', async () => {
    const db = await getDb()
    await db.put('examSessions', session('f', '2026-03-02T10:00:00.000Z', { score: 0.699, passed: false, results: [], setup: { count: 3, scope: { kind: 'all' }, named: true, timed: false } }))
    renderPage()
    const row = (await screen.findByText('Not passed')).closest('li') as HTMLElement
    expect(row).toHaveTextContent('Named')
    expect(row).toHaveTextContent('69%')
  })

  it('offers a way back to a session still in progress', async () => {
    await (await getDb()).put('examSessions', session('p', '2026-03-02T10:00:00.000Z', { status: 'inProgress' }))
    renderPage()
    const row = (await screen.findByText('In progress')).closest('li') as HTMLElement
    expect(within(row).getByRole('link', { name: /^Return to exam/ })).toHaveAttribute('href', '/exam/p')
  })

  it('gives each history link a distinct accessible name that starts with its visible text', async () => {
    const db = await getDb()
    await db.put('examSessions', session('a', '2026-03-01T10:00:00.000Z', { score: 0.8, passed: true, results: [], endedAt: '2026-03-01T10:20:00.000Z' }))
    await db.put('examSessions', session('b', '2026-03-02T10:00:00.000Z', { score: 0.8, passed: true, results: [], endedAt: '2026-03-02T10:20:00.000Z' }))
    renderPage()
    const links = await screen.findAllByRole('link', { name: /^View report/ })
    const names = links.map((l) => l.getAttribute('aria-label'))
    expect(new Set(names).size).toBe(2)
    names.forEach((n) => expect(n).toMatch(/^View report, /))
    expect(document.querySelector('#exam-history time')?.getAttribute('datetime')).toBe('2026-03-02T10:00:00.000Z')
  })

  it('shows its own error, not an endless loader, when exam history cannot be read', async () => {
    storeFails.sessions = true
    renderPage()
    expect(await screen.findByText(/Exam history can't be read in this browser/)).toBeInTheDocument()
    expect(screen.queryByText('Loading your exams…')).toBeNull()
  })

  it('scrolls to the exam history when the URL has the hash', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    render(
      <MemoryRouter initialEntries={['/progress#exam-history']}>
        <ProgressPage />
      </MemoryRouter>,
    )
    await screen.findByText('No exams yet.')
    await waitFor(() => expect(scroll).toHaveBeenCalled())
    expect((scroll.mock.contexts[0] as HTMLElement).id).toBe('exam-history')
  })

  it('shows an error state instead of loading forever when progress cannot be read', async () => {
    storeFails.read = true
    renderPage()
    expect(await screen.findByText(/Progress can't be read in this browser/)).toBeInTheDocument()
    expect(screen.queryByText('Loading your progress…')).toBeNull()
  })

  it('shows an empty state with a Catalog link when nothing is started', async () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Progress' })).toBeInTheDocument()
    expect(await screen.findByText('Nothing here yet — open a pattern in the Catalog to start.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the Catalog' })).toHaveAttribute('href', '/')
    expect(await screen.findByText('No exams yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Take an exam' })).toHaveAttribute('href', '/exam')
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
    expect(data.schemaVersion).toBe(2)
    expect(data.progress[0].patternId).toBe('observer')
    expect(download).toMatch(/^design-patterns-progress-\d{4}-\d{2}-\d{2}\.json$/)
  })

  it('warns that an exam in progress will be discarded by an import', async () => {
    const db = await getDb()
    await db.put('examSessions', session('live', '2026-10-20T10:00:00Z', { status: 'inProgress' }))
    renderPage()
    await screen.findByText(/Nothing here yet/)
    await chooseFile('{}')
    const group = screen.getByRole('group', { name: /Importing replaces/ })
    expect(group).toHaveTextContent('Importing replaces your current progress, saved code and exam history on this device. Your exam in progress will be discarded.')
  })

  it('shows a recoverable error for a bad file and leaves data untouched', async () => {
    await seed()
    renderPage()
    await screen.findByRole('link', { name: 'Observer' })
    await chooseFile('not json')
    expect(screen.getByText('Importing replaces your current progress, saved code and exam history on this device.')).toBeInTheDocument()
    expect(screen.queryByText(/exam in progress will be discarded/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("That file isn't valid JSON.")
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull()
    expect((await getAllProgress())[0].lessonVisited).toBe(true)
  })

  it.each([
    [JSON.stringify({ hello: 1 }), "That file isn't a Design Patterns Trainer export."],
    [JSON.stringify({ app: 'design-patterns-trainer', schemaVersion: 3 }), 'That export comes from a newer version of the app.'],
  ])('maps import reasons to copy: %s', async (content, message) => {
    renderPage()
    await screen.findByText(/Nothing here yet/)
    await chooseFile(content)
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('reports a storage failure as its own recoverable error, not as a bad file', async () => {
    await seed()
    vi.mocked(exportImport.importProgress).mockRejectedValueOnce(new Error('QuotaExceededError'))
    renderPage()
    await screen.findByRole('link', { name: 'Observer' })
    await chooseFile('{}')
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("The import couldn't be saved. Your current progress is unchanged. Try again.")
    expect(alert).not.toHaveTextContent('export')
    expect((await getAllProgress())[0].lessonVisited).toBe(true)
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
    backup.examSessions = [session('imp', '2026-03-02T10:00:00.000Z', { score: 1, passed: true, results: [], endedAt: '2026-03-02T10:20:00.000Z', questionKeys: [] })]
    backup.drafts = [{ key: 'lesson:observer', code: 'from backup', contentVersion: 1, updatedAt: new Date().toISOString() }]
    renderPage()
    await screen.findByText('1 of 3 exercises solved')
    await chooseFile(JSON.stringify(backup))
    expect(screen.getByText('backup.json', { exact: false })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Imported progress for 1 pattern, 1 saved file and 1 exam.')
    await waitFor(() => expect(screen.queryByText('1 of 3 exercises solved')).toBeNull())
    expect(await loadDraft('exercise:observer/complete', 1)).toBeUndefined()
    expect((await loadDraft('lesson:observer', 1))?.draft.code).toBe('from backup')
  })
})
