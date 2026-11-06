import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '../../progress/db'
import { QUIZ_SETTINGS_KEY } from '../../quiz/settings'
import { QuizPage } from './QuizPage'

beforeEach(async () => {
  localStorage.clear()
  await resetDbForTests()
})

async function answerAll(n: number) {
  for (let i = 1; i <= n; i++) {
    await screen.findByText(`Question ${i} of ${n}`)
    fireEvent.keyDown(document.body, { key: '1' })
    fireEvent.keyDown(document.body, { key: 'Enter' })
    await screen.findByRole('status')
    fireEvent.keyDown(document.body, { key: 'Enter' })
  }
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
})
