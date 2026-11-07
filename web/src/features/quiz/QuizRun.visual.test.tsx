import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getQuizBank } from '../../content/quiz'
import type { RunQuestion } from '../../quiz/run'
import { QuizRun } from './QuizRun'

const q = getQuizBank().find((x) => x.id === 'configureawait-false-library')!
// display order: [3, 0, 1, 2] — so file option 1 shows as C, 2 as D, 3 as A; the correct one is B
const display = [q.options[3], q.options[0], q.options[1], q.options[2]]
const withVisual: RunQuestion = { question: q, topicTitle: 'Async & concurrency', options: display }
const plain: RunQuestion = {
  question: { id: 'plain', topicId: 'testing', question: 'Plain?', options: [] },
  topicTitle: 'Testing',
  options: ['w1', 'right', 'w2', 'w3'].map((t) => ({ text: t, correct: t === 'right', explanation: `Why ${t}.` })),
}
const record = vi.fn(async () => null)
const key = (k: string, target: Element = document.body) => fireEvent.keyDown(target, { key: k })
const panel = () => screen.getByRole('region', { name: 'Question visual' })

beforeEach(() => record.mockClear())

function setup() {
  render(<QuizRun questions={[withVisual, plain]} onFinish={() => {}} onQuit={() => {}} record={record} />)
}

describe('QuizRun with a Question Visual', () => {
  it('shows the Setup before answering, without tabs or autoplay', async () => {
    setup()
    expect(within(panel()).getByText('Where does the code after the await run?')).toBeInTheDocument()
    expect(within(panel()).queryByRole('group', { name: 'Views' })).not.toBeInTheDocument()
    expect(within(panel()).getByText('Step 1 of 4')).toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(await within(panel()).findByText('runs the click handler')).toBeInTheDocument() // the drawing loaded
  })

  it('a wrong answer opens and autoplays that Option’s Claim play, labelled with its display letter', async () => {
    setup()
    key('3') // display C = file option 1 (thread pool)
    key('Enter')
    const tabs = within(panel()).getByRole('group', { name: 'Views' })
    expect(within(tabs).getAllByRole('button').map((b) => b.textContent)).toEqual(['What really happens', 'What A claims', 'What C claims', 'What D claims'])
    expect(within(tabs).getByRole('button', { name: 'What C claims' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(panel()).getByText('ReadAsync is moved to the thread pool')).toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('a correct answer opens the Reality play', () => {
    setup()
    key('2')
    key('Enter')
    expect(within(panel()).getByRole('button', { name: 'What really happens' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(panel()).getByText('await without ConfigureAwait')).toBeInTheDocument()
  })

  it('“See what A claims” in an Explanation opens that tab', () => {
    setup()
    key('2')
    key('Enter')
    fireEvent.click(screen.getByRole('button', { name: 'See what A claims' }))
    expect(within(panel()).getByRole('button', { name: 'What A claims' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('steps all stages together; the shorter one holds its last caption', () => {
    setup()
    key('2')
    key('Enter')
    fireEvent.click(within(panel()).getByRole('button', { name: 'What A claims' })) // claim 3 steps, reality 4 steps
    const forward = within(panel()).getByRole('button', { name: 'Step forward' })
    for (let i = 0; i < 3; i++) fireEvent.click(forward)
    expect(within(panel()).getByText('Step 4 of 4')).toBeInTheDocument()
    expect(within(panel()).getByText(/the continuation must return to the request thread/)).toBeInTheDocument()
    expect(forward).toBeDisabled()
  })

  it('arrows step after answering from anywhere, stopping playback', () => {
    setup()
    key('2')
    key('Enter')
    key('ArrowRight')
    expect(within(panel()).getByText('Step 2 of 6')).toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: 'Play' })).toBeInTheDocument()
    key('ArrowLeft')
    expect(within(panel()).getByText('Step 1 of 6')).toBeInTheDocument()
  })

  it('before answering, arrows on a radio belong to the radios; inside the panel they step', () => {
    setup()
    key('ArrowRight', screen.getAllByRole('radio')[0])
    expect(within(panel()).getByText('Step 1 of 4')).toBeInTheDocument()
    key('ArrowRight', within(panel()).getByRole('button', { name: 'Play' }))
    expect(within(panel()).getByText('Step 2 of 4')).toBeInTheDocument()
  })

  it('plays once at 1600 ms per step and stops on the last step', () => {
    vi.useFakeTimers()
    try {
      setup()
      key('2')
      key('Enter')
      // one timer per step, each scheduled by the render the previous one caused
      for (let i = 0; i < 5; i++) act(() => vi.advanceTimersByTime(1600))
      expect(within(panel()).getByText('Step 6 of 6')).toBeInTheDocument()
      expect(within(panel()).getByRole('button', { name: 'Play' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('captions are live regions', () => {
    setup()
    expect(within(panel()).getByText('A click handler on the UI thread calls a library method.')).toHaveAttribute('aria-live', 'polite')
  })

  it('Enter moves on mid-play, and a question without a visual has no visual panel', () => {
    setup()
    key('2')
    key('Enter')
    key('Enter')
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Question visual' })).not.toBeInTheDocument()
    expect(screen.getByText('1–4 select · Enter submits · Esc quits')).toBeInTheDocument()
  })

  it('shows the arrow hint only on questions with a visual', () => {
    setup()
    expect(screen.getByText('1–4 select · Enter submits · ←/→ step the visual · Esc quits')).toBeInTheDocument()
  })

  it('returning to a tab starts it at step 1, stopped', () => {
    setup()
    key('2')
    key('Enter') // Reality autoplays
    fireEvent.click(within(panel()).getByRole('button', { name: 'What A claims' }))
    fireEvent.click(within(panel()).getByRole('button', { name: 'What really happens' }))
    expect(within(panel()).getByText('Step 1 of 6')).toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('Space plays and pauses while the panel has focus', () => {
    setup()
    key('2')
    key('Enter')
    fireEvent.click(within(panel()).getByRole('button', { name: 'Pause' })) // stop the autoplay
    key(' ', panel())
    expect(within(panel()).getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    key(' ', panel())
    expect(within(panel()).getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('ignores the arrows while the quit confirmation is open', () => {
    setup()
    key('2')
    key('Enter')
    fireEvent.click(screen.getByRole('button', { name: 'Quit quiz' }))
    key('ArrowRight')
    expect(within(panel()).getByText('Step 1 of 6')).toBeInTheDocument()
  })
})
