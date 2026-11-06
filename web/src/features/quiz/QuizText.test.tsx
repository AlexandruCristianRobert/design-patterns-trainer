import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { QuizText } from './QuizText'

it('renders paragraphs, inline code and fenced code blocks', () => {
  const { container } = render(<QuizText text={'First `x` here.\n\nSecond.\n\n```csharp\nvar a = 1;\n```\nAfter.'} />)
  expect(container.querySelectorAll('p')).toHaveLength(3)
  expect(screen.getByText('x').tagName).toBe('CODE')
  expect(container.querySelector('pre.quiz-code code')?.textContent).toBe('var a = 1;')
})
