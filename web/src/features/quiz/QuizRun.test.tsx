import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDbForTests } from '../../progress/db'
import type { RunQuestion } from '../../quiz/run'
import { QuizRun } from './QuizRun'

const rq = (id: string): RunQuestion => ({
  question: { id, topicId: 'testing', question: `Question ${id}?`, options: [] },
  topicTitle: 'Testing',
  options: [
    { text: `${id} wrong one`, correct: false, explanation: `Why ${id} one is wrong.` },
    { text: `${id} right`, correct: true, explanation: `Why ${id} right is right.` },
    { text: `${id} wrong two`, correct: false, explanation: `Why ${id} two is wrong.` },
    { text: `${id} wrong three`, correct: false, explanation: `Why ${id} three is wrong.` },
  ],
})
const key = (k: string, target: Element = document.body) => fireEvent.keyDown(target, { key: k })

beforeEach(async () => {
  await resetDbForTests()
})

function setup() {
  const onFinish = vi.fn()
  const onQuit = vi.fn()
  render(<QuizRun questions={[rq('q1'), rq('q2')]} onFinish={onFinish} onQuit={onQuit} />)
  return { onFinish, onQuit }
}

describe('QuizRun', () => {
  it('selects with 1–4, ignores Enter with nothing selected, then locks and reveals all four explanations', async () => {
    setup()
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
    key('Enter')
    expect(screen.queryByText(/Why q1/)).not.toBeInTheDocument()
    key('3')
    expect(screen.getByRole('radio', { name: /q1 wrong two/ })).toBeChecked()
    key('2')
    expect(screen.getByRole('radio', { name: /q1 right/ })).toBeChecked()
    key('Enter')
    expect(await screen.findByText('Correct.')).toBeInTheDocument()
    expect(screen.getAllByText(/^Why q1/)).toHaveLength(4)
    expect(screen.getByText('Your answer · correct')).toBeInTheDocument()
    expect(await screen.findByText('New → Box 2')).toBeInTheDocument()
    key('1')
    expect(screen.getByRole('radio', { name: /q1 right/ })).toBeChecked()
    for (const r of screen.getAllByRole('radio')) expect(r).toBeDisabled()
  })

  it('marks a wrong answer and shows the correct one', async () => {
    setup()
    key('1')
    key('Enter')
    expect(await screen.findByText('Not quite.')).toBeInTheDocument()
    expect(screen.getByText('Your answer · wrong')).toBeInTheDocument()
    expect(screen.getByText('Correct answer')).toBeInTheDocument()
  })

  it('moves on with Enter and reports every answer at the end', async () => {
    const { onFinish } = setup()
    key('2')
    key('Enter')
    await screen.findByText('Correct.')
    key('Enter')
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
    key('1')
    key('Enter')
    await screen.findByText('Not quite.')
    key('Enter')
    expect(onFinish).toHaveBeenCalledWith([
      { questionId: 'q1', topicId: 'testing', correct: true },
      { questionId: 'q2', topicId: 'testing', correct: false },
    ])
  })

  it('asks before quitting on Esc', () => {
    const { onQuit } = setup()
    key('Escape')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    key('Escape')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    key('Escape')
    fireEvent.click(screen.getByRole('button', { name: 'Quit' }))
    expect(onQuit).toHaveBeenCalled()
  })

  it('ignores the number keys while typing in a text field', () => {
    setup()
    const input = document.createElement('input')
    document.body.append(input)
    key('2', input)
    expect(screen.getByRole('radio', { name: /q1 right/ })).not.toBeChecked()
    input.remove()
  })

  it('lets a focused button handle Enter itself', () => {
    setup()
    key('2')
    const quit = screen.getByRole('button', { name: 'Quit quiz' })
    quit.focus()
    key('Enter', quit)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    for (const r of screen.getAllByRole('radio')) expect(r).toBeEnabled()
  })

  it('lets a focused link keep its own Enter', () => {
    setup()
    key('2')
    const link = document.createElement('a')
    link.href = '#elsewhere'
    document.body.append(link)
    link.focus()
    key('Enter', link)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    link.remove()
  })

  it('ignores Esc while typing in a text field', () => {
    setup()
    const input = document.createElement('input')
    document.body.append(input)
    key('Escape', input)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    input.remove()
  })

  describe('focus and announcements', () => {
    const radios = () => screen.getAllByRole('radio')

    it('renders the live region empty, then fills it after Submit', async () => {
      setup()
      const status = screen.getByRole('status')
      expect(status).toBeEmptyDOMElement()
      key('2')
      expect(status).toBeEmptyDOMElement()
      key('Enter')
      expect(screen.getByRole('status')).toBe(status)
      expect(status).toHaveTextContent('Correct.')
      await waitFor(() => expect(status).toHaveTextContent('New → Box 2'))
    })

    it('moves focus to Next after Submit, then to the first radio after Next', async () => {
      setup()
      key('2')
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
      const next = screen.getByRole('button', { name: 'Next question' })
      expect(document.activeElement).toBe(next)
      fireEvent.click(next)
      expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
      expect(document.activeElement).toBe(radios()[0])
    })

    it('moves focus to Next after Submit with Enter, and Enter on Next advances exactly once', async () => {
      setup()
      key('2')
      key('Enter')
      const next = screen.getByRole('button', { name: 'Next question' })
      expect(document.activeElement).toBe(next)
      key('Enter', next) // the window handler leaves a focused button alone
      expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
      fireEvent.click(next) // the native activation that Enter causes
      expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
      expect(document.activeElement).toBe(radios()[0])
      for (const r of radios()) expect(r).toBeEnabled()
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    })

    it('returns focus to the element that had it when the quit confirmation is cancelled', () => {
      setup()
      key('3')
      const third = radios()[2]
      third.focus()
      key('Escape', third)
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep going' }))
      fireEvent.click(screen.getByRole('button', { name: 'Keep going' }))
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(document.activeElement).toBe(third)
    })

    it('returns focus to the Quit button when the confirmation is closed with Esc', () => {
      setup()
      const quit = screen.getByRole('button', { name: 'Quit quiz' })
      quit.focus()
      fireEvent.click(quit)
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      key('Escape', document.activeElement!)
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Quit quiz' }))
    })

    it('falls back to the radio group when focus was on the page body', () => {
      setup()
      ;(document.activeElement as HTMLElement | null)?.blur()
      expect(document.activeElement).toBe(document.body)
      key('2')
      key('Escape')
      key('Escape', document.activeElement!)
      expect(document.activeElement).toBe(radios()[1]) // the selected one
    })
  })
})
