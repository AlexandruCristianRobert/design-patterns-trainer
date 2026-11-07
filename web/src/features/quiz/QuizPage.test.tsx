import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDbForTests } from '../../progress/db'
import { listQuizResults, recordAnswer, saveQuizResult } from '../../quiz/quizStore'
import { QUIZ_SETTINGS_KEY } from '../../quiz/settings'
import { QuizPage } from './QuizPage'

// A fixed bank of two questions per Quiz Topic, so these tests don't move as the real bank grows (M2).
vi.mock('../../content/quiz', async (orig) => {
  const actual = await orig<typeof import('../../content/quiz')>()
  const bank = actual.getQuizTopics().flatMap((t) =>
    [1, 2].map((n) => ({
      id: `${t.id}-${n}`,
      topicId: t.id,
      question: `${t.title} question ${n}?`,
      options: [0, 1, 2, 3].map((i) => ({ text: `Option ${i}`, correct: i === 0, explanation: `Because ${i}.` })),
    })),
  )
  return { ...actual, getQuizBank: () => bank }
})

vi.mock('../../quiz/quizStore', async (orig) => {
  const actual = await orig<typeof import('../../quiz/quizStore')>()
  return { ...actual, saveQuizResult: vi.fn(actual.saveQuizResult) }
})

beforeEach(async () => {
  localStorage.clear()
  await resetDbForTests()
})
afterEach(() => {
  vi.useRealTimers()
  vi.mocked(saveQuizResult).mockClear()
})

const DAY = 86_400_000
const OUTCOME = /^(Correct\.|Not quite\.)/

async function answerAll(n: number) {
  for (let i = 1; i <= n; i++) {
    await screen.findByText(`Question ${i} of ${n}`)
    fireEvent.keyDown(document.body, { key: '1' })
    fireEvent.keyDown(document.body, { key: 'Enter' })
    await screen.findByText(OUTCOME)
    fireEvent.keyDown(document.body, { key: 'Enter' })
  }
}

/** Answers every question and locks the last one; pressing its "See results" is left to the caller. */
async function answerUpToLast(n: number) {
  for (let i = 1; i <= n; i++) {
    await screen.findByText(`Question ${i} of ${n}`)
    fireEvent.keyDown(document.body, { key: '1' })
    fireEvent.keyDown(document.body, { key: 'Enter' })
    await screen.findByText(OUTCOME)
    if (i < n) fireEvent.keyDown(document.body, { key: 'Enter' })
  }
}

async function startWhenLoaded() {
  const start = screen.getByRole('button', { name: 'Start quiz' })
  // Start's focus can't mark "boxes loaded" here: it is skipped when the boxes arrive while Start is disabled
  await waitFor(() => expect(screen.queryByText('Loading your question history…')).toBeNull())
  expect(start).toBeEnabled()
  fireEvent.click(start)
}

async function chooseTopics(...names: RegExp[]) {
  fireEvent.click(await screen.findByRole('radio', { name: 'Choose topics' }))
  for (const n of names) fireEvent.click(screen.getByRole('checkbox', { name: n }))
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('QuizPage', () => {
  it('remembers the chosen length', async () => {
    const { unmount } = render(<QuizPage />)
    fireEvent.click(await screen.findByRole('button', { name: '25' }))
    expect(JSON.parse(localStorage.getItem(QUIZ_SETTINGS_KEY)!).length).toBe(25)
    unmount()
    render(<QuizPage />)
    expect(await screen.findByRole('button', { name: '25' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('focuses Start once the boxes have loaded', async () => {
    render(<QuizPage />)
    const start = await screen.findByRole('button', { name: 'Start quiz' })
    await waitFor(() => expect(start).toBeEnabled())
    await waitFor(() => expect(start).toHaveFocus())
  })

  it('does not show the capped note while the custom length is invalid', async () => {
    render(<QuizPage />)
    fireEvent.click(await screen.findByRole('radio', { name: 'Choose topics' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Testing/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } })
    expect(screen.getByText('Enter a whole number from 1 to 2.')).toBeInTheDocument()
    expect(screen.queryByText(/uses all of them/)).toBeNull()
  })

  it('shows due and new counts per topic and needs at least one chosen topic', async () => {
    render(<QuizPage />)
    fireEvent.click(await screen.findByRole('radio', { name: 'Choose topics' }))
    expect(screen.getByText('Choose at least one topic.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeDisabled()
    const row = screen.getByRole('checkbox', { name: /Testing/ })
    expect(row.closest('label')).toHaveTextContent('0 due · 2 new')
    fireEvent.click(row)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start quiz' })).toBeEnabled())
  })

  it('runs a 5-question quiz, shows the score and adds it to the history', async () => {
    render(<QuizPage />)
    fireEvent.click(await screen.findByRole('button', { name: '5' }))
    const start = screen.getByRole('button', { name: 'Start quiz' })
    await waitFor(() => expect(start).toHaveFocus()) // focus marks "history loaded"
    fireEvent.click(start)
    await answerAll(5)
    expect(await screen.findByRole('heading', { name: 'Quiz complete' })).toBeInTheDocument()
    expect(screen.getByText(/^\d \/ 5 \(\d+%\)$/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    const history = await screen.findByRole('region', { name: 'Quiz history' })
    expect(await within(history).findByText(/^\d \/ 5$/)).toBeInTheDocument()
    expect(within(history).getByText('All topics')).toBeInTheDocument()
  })

  it('does not start the quiz when Enter is pressed in the Custom number field', async () => {
    render(<QuizPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Custom' }))
    const input = screen.getByRole('spinbutton')
    input.focus()
    const notPrevented = fireEvent.keyDown(input, { key: 'Enter' })
    expect(notPrevented).toBe(false)
    expect(screen.queryByText(/^Question 1 of/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeInTheDocument()
  })

  it('caps the length at the questions available in the chosen topics', async () => {
    render(<QuizPage />)
    fireEvent.click(await screen.findByRole('button', { name: '10' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Choose topics' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Testing/ }))
    expect(screen.getByText('These topics have 2 questions, so the quiz uses all of them.')).toBeInTheDocument()
  })

  it('remembers "Choose topics" with nothing ticked, and Start stays disabled after a reload', async () => {
    const { unmount } = render(<QuizPage />)
    await chooseTopics()
    expect(JSON.parse(localStorage.getItem(QUIZ_SETTINGS_KEY)!).topics).toEqual([])
    unmount()
    render(<QuizPage />)
    expect(await screen.findByRole('radio', { name: 'Choose topics' })).toBeChecked()
    for (const box of screen.getAllByRole('checkbox')) expect(box).not.toBeChecked()
    expect(screen.getByText('Choose at least one topic.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Loading your question history…')).toBeNull())
    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeDisabled()
  })

  describe('the setup clock', () => {
    const T0 = new Date('2026-11-06T10:00:00.000Z')
    const testingRow = () => screen.getByRole('checkbox', { name: /Testing/ }).closest('label')!

    it('counts a Box 1 question as due when the page returns to the setup two days later', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(T0)
      await recordAnswer('testing-1', false, new Date()) // Box 1: due again one day later
      render(<QuizPage />)
      await chooseTopics(/Testing/)
      await waitFor(() => expect(testingRow()).toHaveTextContent('0 due · 1 new'))
      await startWhenLoaded()
      await screen.findByText('Question 1 of 2')
      vi.setSystemTime(T0.getTime() + 2 * DAY)
      fireEvent.keyDown(document.body, { key: 'Escape' })
      fireEvent.click(screen.getByRole('button', { name: 'Quit' }))
      await waitFor(() => expect(testingRow()).toHaveTextContent('1 due · 1 new'))
    })

    it('recounts when the tab becomes visible again on a setup left open for two days', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(T0)
      await recordAnswer('testing-1', false, new Date())
      render(<QuizPage />)
      await chooseTopics(/Testing/)
      await waitFor(() => expect(testingRow()).toHaveTextContent('0 due · 1 new'))
      vi.setSystemTime(T0.getTime() + 2 * DAY)
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      expect(testingRow()).toHaveTextContent('1 due · 1 new')
    })
  })

  describe('setup paths', () => {
    it('All, then Start: a quiz of the chosen length from the whole bank', async () => {
      render(<QuizPage />)
      fireEvent.click(await screen.findByRole('button', { name: '5' }))
      expect(screen.getByRole('radio', { name: /All topics/ })).toBeChecked()
      await startWhenLoaded()
      expect(await screen.findByText('Question 1 of 5')).toBeInTheDocument()
    })

    it('Choose with two topics, then Start: only those topics, capped at their questions', async () => {
      render(<QuizPage />)
      await chooseTopics(/Testing/, /CLR & memory/)
      await startWhenLoaded()
      const seen = new Set<string>()
      for (let i = 1; i <= 4; i++) {
        await screen.findByText(`Question ${i} of 4`)
        seen.add(document.querySelector('.quiz-topic')!.textContent!)
        fireEvent.keyDown(document.body, { key: '1' })
        fireEvent.keyDown(document.body, { key: 'Enter' })
        await screen.findByText(OUTCOME)
        fireEvent.keyDown(document.body, { key: 'Enter' })
      }
      expect([...seen].sort()).toEqual(['CLR & memory', 'Testing'])
      expect(await screen.findByRole('heading', { name: 'Quiz complete' })).toBeInTheDocument()
    })

    it('clamps a Custom length to the pool', async () => {
      render(<QuizPage />)
      await chooseTopics(/Testing/)
      fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '50' } })
      expect(screen.getByText('These topics have 2 questions, so the quiz uses all of them.')).toBeInTheDocument()
      await startWhenLoaded()
      expect(await screen.findByText('Question 1 of 2')).toBeInTheDocument()
    })
  })

  describe('finishing', () => {
    async function twoQuestionQuiz() {
      render(<QuizPage />)
      await chooseTopics(/Testing/)
      await startWhenLoaded()
      await answerUpToLast(2)
    }

    it('quitting while the result save is pending shows no end screen and keeps no Quiz Result', async () => {
      const gate = deferred()
      const actual = vi.mocked(saveQuizResult).getMockImplementation()!
      vi.mocked(saveQuizResult).mockImplementationOnce(async (r) => {
        await gate.promise
        return actual(r)
      })
      await twoQuestionQuiz()
      fireEvent.keyDown(document.body, { key: 'Enter' }) // See results: the save starts
      expect(saveQuizResult).toHaveBeenCalledTimes(1)
      fireEvent.keyDown(document.body, { key: 'Escape' })
      fireEvent.click(screen.getByRole('button', { name: 'Quit' }))
      expect(await screen.findByRole('button', { name: 'Start quiz' })).toBeInTheDocument()
      await act(async () => gate.resolve())
      await waitFor(async () => expect(await listQuizResults()).toEqual([]))
      const history = await screen.findByRole('region', { name: 'Quiz history' })
      await waitFor(() => expect(within(history).getByText('No quizzes yet.')).toBeInTheDocument())
      expect(screen.queryByRole('heading', { name: 'Quiz complete' })).toBeNull()
    })

    it('saves one Quiz Result only when Enter is pressed twice on the last question', async () => {
      await twoQuestionQuiz()
      fireEvent.keyDown(document.body, { key: 'Enter' })
      fireEvent.keyDown(document.body, { key: 'Enter' })
      expect(await screen.findByRole('heading', { name: 'Quiz complete' })).toBeInTheDocument()
      expect(saveQuizResult).toHaveBeenCalledTimes(1)
      expect(await listQuizResults()).toHaveLength(1)
    })

    it('shows saveFailed on a failing save, and the end screen still shows the score', async () => {
      vi.mocked(saveQuizResult).mockRejectedValueOnce(new Error('QuotaExceededError'))
      await twoQuestionQuiz()
      fireEvent.keyDown(document.body, { key: 'Enter' })
      expect(await screen.findByRole('heading', { name: 'Quiz complete' })).toBeInTheDocument()
      expect(screen.getByText(/^\d \/ 2 \(\d+%\)$/)).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent("This result couldn't be saved to your quiz history.")
    })
  })
})
