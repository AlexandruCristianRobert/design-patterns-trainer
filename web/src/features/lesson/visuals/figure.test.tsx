import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Arrow, Box, Figure, Grid, Point, Track } from './figure'

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
    expect(fig).toHaveAccessibleDescription('Creators on the left make products on the right.')
  })
  it('Figure is wide at the top level and plain when nested', () => {
    const { container, rerender } = render(<Figure caption="A">x</Figure>)
    expect(container.querySelector('figure')).toHaveClass('lesson-wide')
    rerender(
      <Figure caption="A" wide={false}>
        x
      </Figure>,
    )
    expect(container.querySelector('figure')).not.toHaveClass('lesson-wide')
  })
  it('Grid marks itself as stacking when its narrow layout is one column', () => {
    const { container } = render(
      <>
        <Grid cols="1fr 90px 1fr" narrowCols="1fr">a</Grid>
        <Grid cols="1fr 120px 1fr" narrowCols="1fr 70px 1fr">b</Grid>
        <Grid cols="1fr 1fr" narrowCols="minmax(0, 1fr)">c</Grid>
      </>,
    )
    const grids = [...container.querySelectorAll('.fig-grid')]
    expect(grids.map((g) => g.hasAttribute('data-narrow-stack'))).toEqual([true, false, true])
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
  it('Box can show its sub line with an icon', () => {
    render(
      <Box icon="building" sub="cargo bike" subIcon="bike">
        City depot
      </Box>,
    )
    const box = screen.getByText('City depot').closest('.lesson-box')!
    expect(box.querySelectorAll('svg')).toHaveLength(2)
    expect(box.querySelector('small svg')).not.toBeNull()
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
