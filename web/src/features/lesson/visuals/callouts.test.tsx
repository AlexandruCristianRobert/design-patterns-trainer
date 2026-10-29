import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KeyIdea, Note, Pitfall } from './callouts'

describe('callouts', () => {
  it('KeyIdea is a labelled aside with its text', () => {
    render(<KeyIdea>Spawning is one job.</KeyIdea>)
    const box = screen.getByRole('complementary', { name: 'Key idea' })
    expect(box).toHaveTextContent('Spawning is one job.')
    expect(box.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
  it('Note shows the chosen icon, hidden from screen readers', () => {
    render(<Note icon="lock">It is protected.</Note>)
    expect(screen.getByText('It is protected.').closest('.lesson-callout')!.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })
  it('Pitfall is a warning card headed by its title', () => {
    render(<Pitfall title="Making it public">Callers rely on it.</Pitfall>)
    expect(screen.getByRole('heading', { name: 'Making it public' })).toBeInTheDocument()
    expect(screen.getByText('Callers rely on it.').closest('.pitfall')).not.toBeNull()
  })
})
