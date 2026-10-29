import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CodePair, Verdict } from './verdict'

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
