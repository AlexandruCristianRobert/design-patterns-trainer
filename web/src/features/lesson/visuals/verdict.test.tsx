import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Checklist, CodePair, Verdict } from './verdict'

describe('verdicts', () => {
  it('Verdict says good or avoid in words, not only by colour', () => {
    render(
      <>
        <Verdict ok>Use it here.</Verdict>
        <Verdict ok={false}>Skip it here.</Verdict>
      </>,
    )
    expect(screen.getByText('Use it here.').closest('.verdict')).toHaveTextContent('Good: Use it here.')
    expect(screen.getByText('Skip it here.').closest('.verdict')).toHaveTextContent('Avoid: Skip it here.')
    expect(screen.getByText('Skip it here.').closest('.verdict')).toHaveAttribute('data-tone', 'bad')
  })
  it('Verdict is a block, so MDX paragraphs can sit inside it', () => {
    render(<Verdict ok>Use it here.</Verdict>)
    expect(screen.getByText('Use it here.').closest('.verdict')!.tagName).toBe('DIV')
  })
  it('Checklist is announced as a list of its verdicts', () => {
    render(
      <Checklist>
        {'\n'}
        <Verdict ok>One.</Verdict>
        <Verdict ok>Two.</Verdict>
        <Verdict ok={false}>Three.</Verdict>
      </Checklist>,
    )
    const list = screen.getByRole('list')
    expect(list).toHaveClass('checklist')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Good: One.', 'Good: Two.', 'Avoid: Three.'])
  })
  it('CodePair shows both snippets under their labels', () => {
    render(
      <CodePair
        bad="public IEnemy CreateEnemy()"
        good="protected IEnemy CreateEnemy()"
        badLabel="leaks"
        goodLabel="a hook"
      />,
    )
    expect(screen.getByText('public IEnemy CreateEnemy()').tagName).toBe('CODE')
    expect(screen.getByText('leaks').closest('.verdict')).toHaveTextContent('Avoid: leaks')
    expect(screen.getByText('a hook').closest('.verdict')).toHaveTextContent('Good: a hook')
  })
})
