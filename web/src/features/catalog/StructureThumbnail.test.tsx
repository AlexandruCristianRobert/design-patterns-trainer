import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getPattern } from '../../content/patterns'
import { StructureThumbnail } from './StructureThumbnail'

describe('StructureThumbnail', () => {
  it('draws one rect per node and one line per edge inside a 72×44 box', () => {
    const { structure } = getPattern('observer')!
    const { container } = render(<StructureThumbnail structure={structure} />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('viewBox', '0 0 72 44')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    const rects = [...svg.querySelectorAll('rect')]
    expect(rects).toHaveLength(structure.nodes.length)
    expect(svg.querySelectorAll('line')).toHaveLength(structure.edges.length)
    for (const r of rects) {
      const x = Number(r.getAttribute('x'))
      const y = Number(r.getAttribute('y'))
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(x + Number(r.getAttribute('width'))).toBeLessThanOrEqual(72)
      expect(y + Number(r.getAttribute('height'))).toBeLessThanOrEqual(44)
    }
    expect(rects.map((r) => r.dataset.role)).toEqual(['primary', 'contract', 'concrete', 'concrete'])
    expect(rects[1]).toHaveAttribute('stroke-dasharray')
  })
})
