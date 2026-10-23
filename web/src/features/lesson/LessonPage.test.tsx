import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import { getPattern } from '../../content/patterns'
import { resetDbForTests } from '../../progress/db'
import { getProgress, recordExerciseEvent } from '../../progress/progressStore'
import { LessonPage } from './LessonPage'

vi.mock('../../compiler/CompilerProvider', () => ({
  useCompiler: () => ({ status: 'starting', compiler: { compile: vi.fn() }, runner: { exclusive: (job: () => Promise<unknown>) => job(), load: vi.fn(), runMain: vi.fn() } }),
}))

vi.mock('../../editor/CodeEditor', () => ({
  CodeEditor: (p: {
    value: string
    ariaLabel: string
    onChange(v: string): void
    readOnly?: boolean
    highlightedLines?: [number, number] | null
  }) => (
    <textarea
      aria-label={p.ariaLabel}
      value={p.value}
      readOnly={p.readOnly}
      data-highlighted={p.highlightedLines ? p.highlightedLines.join('-') : ''}
      onChange={(e) => p.onChange(e.target.value)}
    />
  ),
}))

// jsdom has no IntersectionObserver; this one lets a test say which sections are in view.
let observers: { callback: IntersectionObserverCallback; targets: Element[] }[] = []
class FakeIntersectionObserver {
  private entry: { callback: IntersectionObserverCallback; targets: Element[] }
  constructor(callback: IntersectionObserverCallback) {
    this.entry = { callback, targets: [] }
    observers.push(this.entry)
  }
  observe(el: Element) {
    this.entry.targets.push(el)
  }
  unobserve() {}
  disconnect() {
    observers = observers.filter((o) => o !== this.entry)
  }
}

function scrollInto(id: string, visible: boolean) {
  act(() => {
    for (const o of observers) {
      const target = o.targets.find((t) => t.id === id)
      if (target)
        o.callback([{ target, isIntersecting: visible } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
    }
  })
}

const example = getPattern('observer')!.example

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patterns/:patternId" element={<LessonPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const sectionHeadings = ['Problem', 'Analogy', 'Structure', 'How it runs', 'C# example', 'When to use it']

beforeEach(async () => {
  await resetDbForTests()
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
})

afterEach(async () => {
  vi.unstubAllGlobals()
  observers = []
  await i18n.changeLanguage('en')
})

describe('LessonPage', () => {
  it('shows the header, then all six sections in order with headings and TOC entries', async () => {
    renderAt('/patterns/observer')
    expect(screen.getByRole('heading', { level: 1, name: 'Observer' })).toBeInTheDocument()
    expect(screen.getByText('Behavioral · Standard')).toBeInTheDocument()
    expect(
      screen.getByText('Let an object notify a changing set of dependents when its state changes, without knowing their concrete types.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Not yet translated')).toBeNull()

    await screen.findByRole('heading', { level: 2, name: 'Problem' })
    const sections = screen.getAllByRole('region').filter((r) => r.tagName === 'SECTION' && r.classList.contains('lesson-section'))
    expect(sections.map((s) => s.id)).toEqual(['problem', 'analogy', 'structure', 'interaction', 'example', 'when-to-use'])
    expect(sections.map((s) => within(s).getAllByRole('heading', { level: 2 })[0].textContent)).toEqual(sectionHeadings)
    for (const s of sections) expect(s).toHaveAccessibleName(within(s).getAllByRole('heading', { level: 2 })[0].textContent!)

    const toc = screen.getByRole('navigation', { name: 'On this page' })
    const links = within(toc).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(sectionHeadings)
    expect(links.map((l) => l.getAttribute('href'))).toEqual(sections.map((s) => `#${s.id}`))
  })

  it('embeds the diagram, the scene and the example, and links their lines into the example', async () => {
    renderAt('/patterns/observer')
    const editor = await screen.findByLabelText('C# example code')
    await waitFor(() => expect(editor).toHaveValue(example))
    expect(screen.getByRole('figure', { name: 'Structure diagram' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Interaction scene' })).toBeInTheDocument()
    // The scene links its first frame on mount; the diagram takes over on focus.
    expect(editor).toHaveAttribute('data-highlighted', '5-5')
    fireEvent.focus(screen.getByTestId('class-observer'))
    expect(editor).toHaveAttribute('data-highlighted', '12-15')
  })

  it('"Restore original" puts the example back after an edit', async () => {
    renderAt('/patterns/observer')
    const editor = await screen.findByLabelText('C# example code')
    await waitFor(() => expect(editor).not.toHaveAttribute('readonly'))
    const restore = screen.getByRole('button', { name: 'Restore original' })
    expect(restore).toBeDisabled()
    fireEvent.change(editor, { target: { value: 'Console.WriteLine(1);' } })
    expect(restore).toBeEnabled()
    fireEvent.click(restore)
    expect(editor).toHaveValue(example)
  })

  it('marks the Lesson visited when opened', async () => {
    renderAt('/patterns/observer')
    await waitFor(async () => expect((await getProgress('observer')).lessonVisited).toBe(true))
  })

  it('lists the Lookalikes with their difference', async () => {
    renderAt('/patterns/observer')
    const heading = await screen.findByRole('heading', { level: 3, name: 'Often confused with' })
    const list = heading.nextElementSibling as HTMLElement
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Mediator')
    expect(items[0]).toHaveTextContent('Mediator coordinates peers that talk to each other through it')
    // Not built yet: named, not linked.
    expect(within(items[0]).queryByRole('link')).toBeNull()
    expect(items[1]).toHaveTextContent('Chain of Responsibility')
  })

  it('ends with a Practice block listing each Exercise with its status and link', async () => {
    await recordExerciseEvent('observer', 'complete', { type: 'checked', allPassed: true })
    renderAt('/patterns/observer')
    const practice = await screen.findByRole('region', { name: 'Practice' })
    const links = within(practice).getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/patterns/observer/practice/complete',
      '/patterns/observer/practice/refactor',
      '/patterns/observer/practice/build',
    ])
    expect(links[0]).toHaveTextContent('Finish the weather station')
    expect(await within(links[0]).findByText('Solved')).toBeInTheDocument()
    expect(within(links[1]).getByText('Not started')).toBeInTheDocument()
  })

  it('highlights the TOC entry of the section in view', async () => {
    renderAt('/patterns/observer')
    await screen.findByRole('heading', { level: 2, name: 'Problem' })
    const toc = screen.getByRole('navigation', { name: 'On this page' })
    const link = (name: string) => within(toc).getByRole('link', { name })
    expect(link('Problem')).toHaveAttribute('aria-current', 'location')
    await waitFor(() => expect(observers.flatMap((o) => o.targets.map((t) => t.id))).toContain('when-to-use'))
    scrollInto('problem', false)
    scrollInto('structure', true)
    expect(link('Structure')).toHaveAttribute('aria-current', 'location')
    expect(link('Problem')).not.toHaveAttribute('aria-current')
    // Two in view: the first one wins.
    scrollInto('interaction', true)
    expect(link('Structure')).toHaveAttribute('aria-current', 'location')
  })

  it('shows "Not yet translated" when the Lesson falls back to English', async () => {
    await i18n.changeLanguage('de')
    renderAt('/patterns/observer')
    expect(await screen.findByText('Not yet translated')).toBeInTheDocument()
  })

  it.each(['memento', 'no-such-pattern'])('shows the coming-soon state for %s', async (id) => {
    renderAt(`/patterns/${id}`)
    expect(screen.getByRole('heading', { level: 1, name: 'This pattern is coming soon' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to the Catalog' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull()
    await new Promise((r) => setTimeout(r, 20))
    expect((await getProgress(id)).lessonVisited).toBe(false)
  })
})
