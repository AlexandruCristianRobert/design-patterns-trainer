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

  it('the Factory Method Lesson shows its Problem, Analogy and Structure visuals', async () => {
    renderAt('/patterns/factory-method')
    expect((await screen.findAllByRole('complementary', { name: 'Key idea' }))[0]).toBeInTheDocument()
    expect(document.querySelectorAll('#problem .code-line[data-tone="bad"]').length).toBeGreaterThanOrEqual(5)
    expect(screen.getByRole('figure', { name: /written once/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /two families/i })).toBeInTheDocument()
    expect([...document.querySelectorAll('#structure .role-tag[data-role="contract"]')].map((e) => e.textContent)).toContain('IEnemy')
  })

  it('the Factory Method Lesson shows its Interaction and When-to-use visuals', async () => {
    renderAt('/patterns/factory-method')
    expect((await screen.findAllByRole('complementary', { name: 'Key idea' }))[0]).toBeInTheDocument()
    expect(document.querySelectorAll('#interaction .fig-point')).toHaveLength(3)
    const when = document.querySelector('#when-to-use')!
    expect(when.querySelectorAll('.checklist .verdict[data-tone="ok"]')).toHaveLength(3)
    expect(when.querySelectorAll('.checklist .verdict[data-tone="bad"]')).toHaveLength(1)
    expect(when.querySelectorAll('.pitfall')).toHaveLength(3)
    expect(when.querySelectorAll('.pitfall .code-pair')).toHaveLength(3)
    expect(within(when as HTMLElement).getByRole('figure', { name: /which tool/i })).toBeInTheDocument()
    expect(within(when as HTMLElement).getByRole('figure', { name: /when is the object made/i })).toBeInTheDocument()
  })

  it('the Factory Method box-and-arrow figures read their pictures aloud', async () => {
    renderAt('/patterns/factory-method')
    await screen.findAllByRole('complementary', { name: 'Key idea' })
    const point2 = document.querySelectorAll('#interaction .fig-point')[1] as HTMLElement
    expect(within(point2).getByRole('figure')).toHaveAccessibleDescription(/calls CreateEnemy().*new/i)
    const when = document.querySelector('#when-to-use') as HTMLElement
    expect(within(when).getByRole('figure', { name: /simple factory/i })).toHaveAccessibleDescription(/one switch knows/i)
  })

  it('the Factory Method Problem badges only the three bullets that point at code', async () => {
    renderAt('/patterns/factory-method')
    await screen.findAllByRole('complementary', { name: 'Key idea' })
    const items = [...document.querySelectorAll('#problem .badge-list li')]
    expect(items.map((li) => li.hasAttribute('data-plain'))).toEqual([false, false, false, true])
  })

  it('the Observer Lesson shows its visuals', async () => {
    renderAt('/patterns/observer')
    const keyIdeas = await screen.findAllByRole('complementary', { name: 'Key idea' })
    expect(keyIdeas.length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('#problem .code-line[data-tone="bad"]').length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('#problem .badge-list li').length).toBe(4)
    expect(document.querySelectorAll('#interaction .fig-point')).toHaveLength(3)
    const when = document.querySelector('#when-to-use')!
    expect(when.querySelectorAll('.checklist .verdict[data-tone="ok"]')).toHaveLength(2)
    expect(when.querySelectorAll('.checklist .verdict[data-tone="bad"]')).toHaveLength(1)
    expect(when.querySelectorAll('.pitfall .code-pair').length).toBe(4)
    expect(screen.getByRole('figure', { name: /one list, every reader/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /one to many/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /push and pull/i })).toBeInTheDocument()
  })

  it('the Strategy Lesson shows its visuals', async () => {
    renderAt('/patterns/strategy')
    const keyIdeas = await screen.findAllByRole('complementary', { name: 'Key idea' })
    expect(keyIdeas.length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('#problem .code-line[data-tone="bad"]').length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('#problem .badge-list li').length).toBe(4)
    expect(document.querySelectorAll('#interaction .fig-point')).toHaveLength(3)
    const when = document.querySelector('#when-to-use')!
    expect(when.querySelectorAll('.checklist .verdict[data-tone="ok"]')).toHaveLength(3)
    expect(when.querySelectorAll('.checklist .verdict[data-tone="bad"]')).toHaveLength(1)
    expect(when.querySelectorAll('.pitfall .code-pair').length).toBe(4)
    expect(screen.getByRole('figure', { name: /trip plan/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /holds one/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /interface or delegate/i })).toBeInTheDocument()
  })

  it('the Decorator Lesson shows its visuals', async () => {
    renderAt('/patterns/decorator')
    const keyIdeas = await screen.findAllByRole('complementary', { name: 'Key idea' })
    expect(keyIdeas.length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('#problem .code-line[data-tone="bad"]').length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('#problem .badge-list li').length).toBe(4)
    expect(document.querySelectorAll('#interaction .fig-point')).toHaveLength(3)
    const when = document.querySelector('#when-to-use')!
    expect(when.querySelectorAll('.checklist .verdict[data-tone="ok"]')).toHaveLength(3)
    expect(when.querySelectorAll('.checklist .verdict[data-tone="bad"]')).toHaveLength(1)
    expect(when.querySelectorAll('.pitfall .code-pair').length).toBe(3)
    expect(screen.getByRole('figure', { name: /each new feature doubles/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /still hangs on the wall/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /is one and has one/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /each layer is itself a stream/i })).toBeInTheDocument()
  })

  it('the Decorator Lesson colours the inner object as the concrete component, never primary', async () => {
    renderAt('/patterns/decorator')
    await screen.findAllByRole('complementary', { name: 'Key idea' })
    const own = (b: Element) => b.querySelector(':scope > .lesson-box-text')?.firstChild?.textContent?.trim()
    const inner = [...document.querySelectorAll('.lesson-box')].filter((b) => own(b) === 'plain' || own(b) === 'file' || own(b) === 'Photo')
    expect(inner.length).toBeGreaterThanOrEqual(4)
    for (const b of inner) expect(b.hasAttribute('data-role')).toBe(false)
    expect(document.querySelectorAll('#structure .lesson-box[data-role="primary"]').length).toBeGreaterThanOrEqual(1)
    const scope = '#problem, #analogy, #structure, #interaction, #when-to-use'
    const layers = [...document.querySelectorAll(`:is(${scope.split(', ').map((s) => s + ' .lesson-box, ' + s + ' .role-tag').join(', ')})`)].filter((e) => {
      const t = e.classList.contains('role-tag') ? e.textContent?.trim() : own(e)
      return !!t && /^(Uppercase|SpeakerTag)/.test(t)
    })
    expect(layers.length).toBeGreaterThanOrEqual(10)
    for (const e of layers) expect(e.getAttribute('data-role')).toBe('concrete')
    const named = [...document.querySelectorAll('.lesson-box')].filter((b) => ['Frame', 'Mat', 'GZipStream', 'BufferedStream'].includes(own(b) ?? ''))
    expect(named).toHaveLength(4)
    for (const b of named) expect(b.getAttribute('data-role')).toBe('concrete')
    for (const b of document.querySelectorAll('.lesson-box[data-role="primary"]')) expect(own(b)).toBe('CaptionDecorator')
  })

  it('the Singleton Lesson shows its visuals', async () => {
    renderAt('/patterns/singleton')
    const keyIdeas = await screen.findAllByRole('complementary', { name: 'Key idea' })
    expect(keyIdeas.length).toBeGreaterThanOrEqual(3)
    expect(document.querySelectorAll('#problem .code-line[data-tone="bad"]').length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('#problem .badge-list li').length).toBe(4)
    expect(document.querySelectorAll('#interaction .fig-point')).toHaveLength(3)
    const when = document.querySelector('#when-to-use')!
    expect(when.querySelectorAll('.checklist .verdict[data-tone="ok"]')).toHaveLength(3)
    expect(when.querySelectorAll('.checklist .verdict[data-tone="bad"]')).toHaveLength(1)
    expect(when.querySelectorAll('.pitfall')).toHaveLength(4)
    expect(when.querySelectorAll('.pitfall .code-pair').length).toBe(3)
    expect(when.querySelectorAll('.code-pair')).toHaveLength(4)
    expect(when.querySelectorAll('.code-line[data-tone="warn"]').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('figure', { name: /two dispensers/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /one book/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /three locks/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /what an object can do/i })).toBeInTheDocument()
  })

  it('the Abstract Factory Lesson shows its visuals', async () => {
    renderAt('/patterns/abstract-factory')
    const keyIdeas = await screen.findAllByRole('complementary', { name: 'Key idea' })
    expect(keyIdeas.length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('#problem .code-line[data-tone="bad"]').length).toBeGreaterThanOrEqual(10)
    const items = [...document.querySelectorAll('#problem .badge-list li')]
    expect(items.map((li) => li.hasAttribute('data-plain'))).toEqual([false, false, false, true])
    expect(document.querySelectorAll('#interaction .fig-point')).toHaveLength(3)
    const when = document.querySelector('#when-to-use')!
    expect(when.querySelectorAll('.checklist .verdict[data-tone="ok"]')).toHaveLength(3)
    expect(when.querySelectorAll('.checklist .verdict[data-tone="bad"]')).toHaveLength(1)
    expect(when.querySelectorAll('.pitfall')).toHaveLength(3)
    expect(when.querySelectorAll('.pitfall .code-pair')).toHaveLength(3)
    expect(screen.getByRole('figure', { name: /pick the collection once/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /one kitchen, a whole family/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /one overridable method vs one object/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /a new product kind touches every kitchen/i })).toBeInTheDocument()
    const point2 = document.querySelectorAll('#interaction .fig-point')[1] as HTMLElement
    expect(within(point2).getByRole('figure')).toHaveAccessibleDescription(/MakeDrink.*MakeMain/i)
  })

  it('the Builder Lesson shows its visuals', async () => {
    renderAt('/patterns/builder')
    const keyIdeas = await screen.findAllByRole('complementary', { name: 'Key idea' })
    expect(keyIdeas.length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('#problem .code-line[data-tone="bad"]').length).toBeGreaterThanOrEqual(5)
    const items = [...document.querySelectorAll('#problem .badge-list li')]
    expect(items.map((li) => li.hasAttribute('data-plain'))).toEqual([false, false, false, true])
    expect(document.querySelectorAll('#interaction .fig-point')).toHaveLength(3)
    const when = document.querySelector('#when-to-use')!
    expect(when.querySelectorAll('.checklist .verdict[data-tone="ok"]')).toHaveLength(3)
    expect(when.querySelectorAll('.checklist .verdict[data-tone="bad"]')).toHaveLength(1)
    expect(when.querySelectorAll('.pitfall')).toHaveLength(3)
    expect(when.querySelectorAll('.pitfall .code-pair')).toHaveLength(3)
    expect(screen.getByRole('figure', { name: /choose first, build last/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /steps in, one checked product out/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /when a plain initializer is enough/i })).toBeInTheDocument()
    const point2 = document.querySelectorAll('#interaction .fig-point')[1] as HTMLElement
    expect(within(point2).getByRole('figure')).toHaveAccessibleDescription(/Build.*throws/i)
  })

  it('the Prototype Lesson shows its visuals', async () => {
    renderAt('/patterns/prototype')
    const keyIdeas = await screen.findAllByRole('complementary', { name: 'Key idea' })
    expect(keyIdeas.length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('#problem .code-line[data-tone="bad"]').length).toBeGreaterThanOrEqual(5)
    const items = [...document.querySelectorAll('#problem .badge-list li')]
    expect(items.map((li) => li.hasAttribute('data-plain'))).toEqual([false, false, false, true])
    expect(document.querySelectorAll('#interaction .fig-point')).toHaveLength(3)
    const when = document.querySelector('#when-to-use')!
    expect(when.querySelectorAll('.checklist .verdict[data-tone="ok"]')).toHaveLength(3)
    expect(when.querySelectorAll('.checklist .verdict[data-tone="bad"]')).toHaveLength(1)
    expect(when.querySelectorAll('.pitfall')).toHaveLength(3)
    expect(when.querySelectorAll('.pitfall .code-pair')).toHaveLength(3)
    expect(screen.getByRole('figure', { name: /copy from the key, not the blueprint/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /clone\(\) hands back a table of the same kind/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /shared chair list or a list of its own/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /three tools, one shared catch/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /named templates, copied on request/i })).toBeInTheDocument()
    const point2 = document.querySelectorAll('#interaction .fig-point')[1] as HTMLElement
    expect(within(point2).getByRole('figure')).toHaveAccessibleDescription(/Clone.*RoundTable/i)
  })

  it('the Adapter Lesson shows its visuals', async () => {
    renderAt('/patterns/adapter')
    const keyIdeas = await screen.findAllByRole('complementary', { name: 'Key idea' })
    expect(keyIdeas.length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('#problem .code-line[data-tone="bad"]').length).toBeGreaterThanOrEqual(5)
    const items = [...document.querySelectorAll('#problem .badge-list li')]
    expect(items.map((li) => li.hasAttribute('data-plain'))).toEqual([false, false, false, true])
    expect(document.querySelectorAll('#interaction .fig-point')).toHaveLength(3)
    const when = document.querySelector('#when-to-use')!
    expect(when.querySelectorAll('.checklist .verdict[data-tone="ok"]')).toHaveLength(3)
    expect(when.querySelectorAll('.checklist .verdict[data-tone="bad"]')).toHaveLength(1)
    expect(when.querySelectorAll('.pitfall')).toHaveLength(2)
    expect(when.querySelectorAll('.pitfall .code-pair')).toHaveLength(2)
    expect(screen.getByRole('figure', { name: /neither side changes/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /the log sees only irunsource/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /holding the sdk or inheriting from it/i })).toBeInTheDocument()
    const points = document.querySelectorAll('#interaction .fig-point')
    expect(within(points[0] as HTMLElement).getByRole('figure')).toHaveAccessibleDescription(/GetRuns.*FetchActivities/i)
    expect(within(points[1] as HTMLElement).getByRole('figure')).toHaveAccessibleDescription(/miles.*kilometres/i)
    expect(within(points[2] as HTMLElement).getByRole('figure')).toHaveAccessibleDescription(/PaceWatchSdk.*unchanged/i)
  })

  it('the Bridge Lesson shows its visuals', async () => {
    renderAt('/patterns/bridge')
    const keyIdeas = await screen.findAllByRole('complementary', { name: 'Key idea' })
    expect(keyIdeas.length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('#problem .code-line[data-tone="bad"]').length).toBeGreaterThanOrEqual(8)
    const items = [...document.querySelectorAll('#problem .badge-list li')]
    expect(items.map((li) => li.hasAttribute('data-plain'))).toEqual([false, false, false, true])
    expect(document.querySelectorAll('#interaction .fig-point')).toHaveLength(3)
    const when = document.querySelector('#when-to-use')!
    expect(when.querySelectorAll('.checklist .verdict[data-tone="ok"]')).toHaveLength(3)
    expect(when.querySelectorAll('.checklist .verdict[data-tone="bad"]')).toHaveLength(1)
    expect(when.querySelectorAll('.pitfall')).toHaveLength(2)
    expect(when.querySelectorAll('.pitfall .code-pair')).toHaveLength(2)
    expect(screen.getByRole('figure', { name: /every pair is a class/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /any switch, any lamp/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /the player holds an output/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /planned up front or fitted afterwards/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /parts that both vary or one algorithm that swaps/i })).toBeInTheDocument()
    const points = document.querySelectorAll('#interaction .fig-point')
    expect(within(points[0] as HTMLElement).getByRole('figure')).toHaveAccessibleDescription(/PodcastPlayer.*Headphones/i)
    expect(within(points[1] as HTMLElement).getByRole('figure')).toHaveAccessibleDescription(/Play.*Start/i)
    expect(within(points[2] as HTMLElement).getByRole('figure')).toHaveAccessibleDescription(/Speaker.*Skip30/i)
  })

  it('the Composite Lesson shows its visuals', async () => {
    renderAt('/patterns/composite')
    const keyIdeas = await screen.findAllByRole('complementary', { name: 'Key idea' })
    expect(keyIdeas.length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('#problem .code-line[data-tone="bad"]').length).toBeGreaterThanOrEqual(9)
    const items = [...document.querySelectorAll('#problem .badge-list li')]
    expect(items.map((li) => li.hasAttribute('data-plain'))).toEqual([false, false, false, true])
    expect(document.querySelectorAll('#interaction .fig-point')).toHaveLength(3)
    const when = document.querySelector('#when-to-use')!
    expect(when.querySelectorAll('.checklist .verdict[data-tone="ok"]')).toHaveLength(3)
    expect(when.querySelectorAll('.checklist .verdict[data-tone="bad"]')).toHaveLength(1)
    expect(when.querySelectorAll('.pitfall')).toHaveLength(2)
    expect(when.querySelectorAll('.pitfall .code-pair')).toHaveLength(2)
    expect(screen.getByRole('figure', { name: /boxes inside boxes/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /weigh any box the same way/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /is one and has many/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /a combo inside a combo/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /where the child methods live/i })).toBeInTheDocument()
    const points = document.querySelectorAll('#interaction .fig-point')
    expect(within(points[0] as HTMLElement).getByRole('figure')).toHaveAccessibleDescription(/OrderTicket.*Lunch/i)
    expect(within(points[1] as HTMLElement).getByRole('figure')).toHaveAccessibleDescription(/Lunch.*Burger.*Sides/i)
    expect(within(points[2] as HTMLElement).getByRole('figure')).toHaveAccessibleDescription(/Fries.*4/i)
  })

  it('the Facade Lesson shows its visuals', async () => {
    renderAt('/patterns/facade')
    const keyIdeas = await screen.findAllByRole('complementary', { name: 'Key idea' })
    expect(keyIdeas.length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('#problem .code-line[data-tone="bad"]').length).toBeGreaterThanOrEqual(10)
    const items = [...document.querySelectorAll('#problem .badge-list li')]
    expect(items.map((li) => li.hasAttribute('data-plain'))).toEqual([false, false, false, true])
    expect(document.querySelectorAll('#interaction .fig-point')).toHaveLength(3)
    const when = document.querySelector('#when-to-use')!
    expect(when.querySelectorAll('.checklist .verdict[data-tone="ok"]')).toHaveLength(3)
    expect(when.querySelectorAll('.checklist .verdict[data-tone="bad"]')).toHaveLength(1)
    expect(when.querySelectorAll('.pitfall')).toHaveLength(1)
    expect(when.querySelectorAll('.pitfall .code-pair')).toHaveLength(1)
    expect(screen.getByRole('figure', { name: /every client knows all four/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /one contact/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /what the concierge arranges/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /one desk in front of four classes/i })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /simplify many or translate one/i })).toBeInTheDocument()
    const points = document.querySelectorAll('#interaction .fig-point')
    expect(within(points[0] as HTMLElement).getByRole('figure')).toHaveAccessibleDescription(/SignUpPage.*EnrolmentDesk/i)
    expect(within(points[1] as HTMLElement).getByRole('figure')).toHaveAccessibleDescription(/SeatRegister.*PaymentGateway.*LearnerAccounts.*WelcomeMailer/i)
    expect(within(points[2] as HTMLElement).getByRole('figure')).toHaveAccessibleDescription(/SeatRegister.*directly/i)
  })
})
