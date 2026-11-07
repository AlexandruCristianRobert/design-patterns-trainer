import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { getQuizBank } from '../../content/quiz'
import { QuizRun } from './QuizRun'

// motion reads the preference once per module graph, so this lives in its own file.
beforeAll(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList)
})

describe('Question Visual under prefers-reduced-motion', () => {
  it('does not autoplay after answering', () => {
    const q = getQuizBank().find((x) => x.id === 'configureawait-false-library')!
    render(<QuizRun questions={[{ question: q, topicTitle: 'Async', options: q.options }]} onFinish={() => {}} onQuit={() => {}} record={async () => null} />)
    fireEvent.keyDown(document.body, { key: '2' })
    fireEvent.keyDown(document.body, { key: 'Enter' })
    const panel = screen.getByRole('region', { name: 'Question visual' })
    expect(within(panel).getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(within(panel).getByText('Step 1 of 4')).toBeInTheDocument()
  })
})
