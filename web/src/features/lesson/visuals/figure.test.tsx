import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Arrow, Box, Figure, Point, Track } from './figure'

describe('figure building blocks', () => {
  it('Figure gives screen readers the description instead of the drawing', () => {
    render(
      <Figure caption="Two families" description="Creators on the left make products on the right.">
        <Box role="primary">Level</Box>
      </Figure>,
    )
    const fig = screen.getByRole('figure', { name: 'Two families' })
    expect(fig).toHaveTextContent('Creators on the left make products on the right.')
    expect(screen.getByText('Level').closest('[aria-hidden="true"]')).not.toBeNull()
  })
  it('Box carries its role and an optional sub line', () => {
    render(
      <Box role="contract" sub="interface">
        IEnemy
      </Box>,
    )
    const box = screen.getByText('IEnemy').closest('.lesson-box')!
    expect(box).toHaveAttribute('data-role', 'contract')
    expect(box).toHaveTextContent('IEnemyinterface')
  })
  it('Box can be accented', () => {
    render(<Box accent>Factory Method</Box>)
    expect(screen.getByText('Factory Method').closest('.lesson-box')).toHaveClass('lesson-box-accent')
  })
  it('Track places a dot per position', () => {
    const { container } = render(<Track label="Factory Method" dots={[30, 48, 66]} caption="made fresh each time" />)
    const dots = container.querySelectorAll('.track-dot')
    expect([...dots].map((d) => (d as HTMLElement).style.left)).toEqual(['30%', '48%', '66%'])
  })
  it('Point numbers its card and shows the aside', () => {
    render(
      <Point n={2} title="The base class calls it." aside={<Box>Wolf</Box>}>
        Text.
      </Point>,
    )
    expect(screen.getByText('2')).toHaveClass('point-num')
    expect(screen.getByText('The base class calls it.')).toBeInTheDocument()
    expect(screen.getByText('Wolf')).toBeInTheDocument()
  })
  it('Arrow is decorative', () => {
    const { container } = render(<Arrow label="«creates»" dashed />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
