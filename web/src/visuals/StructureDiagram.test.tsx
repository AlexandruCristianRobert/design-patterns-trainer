import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getPattern } from '../content/patterns'
import { getPatternText } from '../content/text'
import { LessonProvider, useLinkedLines } from '../features/lesson/LessonContext'
import { StructureDiagram } from './StructureDiagram'

const { structure } = getPattern('observer')!
const descriptions = getPatternText('observer', 'en').value.structure

function Probe() {
  const { lines } = useLinkedLines()
  return <output data-testid="linked">{JSON.stringify(lines)}</output>
}

function setup() {
  render(
    <LessonProvider>
      <StructureDiagram structure={structure} descriptions={descriptions} />
      <Probe />
    </LessonProvider>,
  )
}

const node = (name: string) => screen.getByTestId(`class-${name}`)

describe('StructureDiagram', () => {
  it('renders every class box with its name, stereotype and members', () => {
    setup()
    for (const n of structure.nodes) expect(node(n.id)).toHaveTextContent(n.name)
    expect(node('observer')).toHaveTextContent('«interface»')
    expect(node('observer')).toHaveTextContent('void Update(int temperature)')
    expect(node('observer')).toHaveAttribute('data-role', 'contract')
  })

  it('makes class boxes keyboard-focusable', () => {
    setup()
    for (const n of structure.nodes) expect(node(n.id)).toHaveAttribute('tabindex', '0')
  })

  it('focus shows the description and links the class code lines', () => {
    setup()
    expect(screen.getByTestId('linked')).toHaveTextContent('null')
    fireEvent.focus(node('observer'))
    expect(screen.getByTestId('linked')).toHaveTextContent('[12,15]')
    expect(screen.getByTestId('diagram-description')).toHaveTextContent(descriptions.observer)
    fireEvent.blur(node('observer'))
    expect(screen.getByTestId('linked')).toHaveTextContent('null')
  })

  it('hover does the same', () => {
    setup()
    fireEvent.mouseEnter(node('subject'))
    expect(screen.getByTestId('linked')).toHaveTextContent('[17,34]')
    expect(screen.getByTestId('diagram-description')).toHaveTextContent(descriptions.subject)
  })
})
