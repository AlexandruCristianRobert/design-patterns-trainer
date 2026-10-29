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
    expect(lines[1]).toHaveTextContent('var b = new Wolf();1names a concrete class')
    expect(lines[0]).not.toHaveAttribute('data-tone')
  })
  it('shows a "!" badge for warn marks', () => {
    const { container } = render(<AnnotatedCode code={code} marks={[{ line: 1, tone: 'warn', badge: '2' }]} />)
    expect(container.querySelector('.code-badge')).toHaveTextContent('!')
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
})
