import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AnnotatedCode, BadgeList } from './AnnotatedCode'

const code = `
var a = 1;
var b = new Wolf();
return b;
`

describe('AnnotatedCode', () => {
  it('splits the code into lines and tints the marked ones', () => {
    const { container } = render(
      <AnnotatedCode code={code} marks={[{ line: 2, tone: 'bad', badge: '1', note: 'names a concrete class' }]} />,
    )
    const lines = container.querySelectorAll('.code-line')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toHaveAttribute('data-tone', 'bad')
    expect(lines[0]).not.toHaveAttribute('data-tone')
  })
  it('keeps the badge and note apart from the code for screen readers and copying', () => {
    const { container } = render(
      <AnnotatedCode code={code} marks={[{ line: 2, tone: 'bad', badge: '1', note: 'names a concrete class' }]} />,
    )
    const line = container.querySelectorAll('.code-line')[1]
    expect(line).toHaveTextContent('var b = new Wolf(); (note 1: names a concrete class)')
    expect(line.querySelector('.code-annot')).not.toBeNull()
  })
  it('uses the authored badge on a warn mark, and "!" when there is none', () => {
    const { container } = render(
      <AnnotatedCode
        code={code}
        marks={[
          { line: 1, tone: 'warn', badge: '2' },
          { line: 3, tone: 'warn' },
        ]}
      />,
    )
    expect([...container.querySelectorAll('.code-line .code-badge')].map((b) => b.textContent)).toEqual(['2', '!'])
  })
  it('also lists the notes under the code, for narrow screens', () => {
    const { container } = render(
      <AnnotatedCode
        code={code}
        marks={[
          { line: 1, tone: 'ok', badge: '1', note: 'a default' },
          { line: 2, tone: 'bad' },
          { line: 3, tone: 'warn', note: 'may fail' },
        ]}
      />,
    )
    const items = container.querySelectorAll('pre + .code-notes li')
    expect([...items].map((li) => li.textContent)).toEqual(['1 a default', '! may fail'])
  })
  it('renders no notes list when no mark has a note', () => {
    const { container } = render(<AnnotatedCode code={code} marks={[{ line: 2, tone: 'bad', badge: '1' }]} />)
    expect(container.querySelector('.code-notes')).toBeNull()
  })
  it('is wide at the top level and plain when nested', () => {
    const { container, rerender } = render(<AnnotatedCode code={code} />)
    expect(container.querySelector('figure')).toHaveClass('lesson-wide')
    rerender(<AnnotatedCode code={code} wide={false} />)
    expect(container.querySelector('figure')).not.toHaveClass('lesson-wide')
  })
  it('shows a caption when given', () => {
    render(<AnnotatedCode code={code} caption="Before: only wolves" />)
    expect(screen.getByText('Before: only wolves').tagName).toBe('FIGCAPTION')
  })
  it('fails loudly when a mark points past the code', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<AnnotatedCode code={code} marks={[{ line: 9, tone: 'bad' }]} />)).toThrow(
      'AnnotatedCode: mark on line 9, but the code has 3 lines',
    )
  })
})

describe('BadgeList', () => {
  it('keeps the list items and its tone', () => {
    render(
      <BadgeList tone="bad">
        <ol>
          <li>First</li>
          <li>Second</li>
        </ol>
      </BadgeList>,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('list').closest('.badge-list')).toHaveAttribute('data-tone', 'bad')
  })
  it('badges only the first `count` items; later ones get a plain marker', () => {
    render(
      <BadgeList tone="bad" count={2}>
        {'\n'}
        <ol>
          {'\n'}
          <li>First</li>
          <li>Second</li>
          <li>Third</li>
        </ol>
      </BadgeList>,
    )
    const items = screen.getAllByRole('listitem')
    expect(items.map((li) => li.hasAttribute('data-plain'))).toEqual([false, false, true])
    expect(items[2]).toHaveTextContent('Third')
  })
})
