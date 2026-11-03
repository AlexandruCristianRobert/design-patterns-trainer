import { describe, expect, it } from 'vitest'
import { diffValues, showWhitespace, type DiffPart } from './diffValues'

const join = (parts: DiffPart[]) => parts.map((p) => p.text).join('')
const changed = (parts: DiffPart[]) => parts.filter((p) => p.changed).map((p) => p.text)

describe('diffValues', () => {
  it('marks a missing space as a gap on one side and the space on the other', () => {
    const d = diffValues('bed, pouch', 'bed,pouch')
    expect(d.expected).toEqual([
      { text: 'bed,', changed: false },
      { text: ' ', changed: true, width: 1 },
      { text: 'pouch', changed: false },
    ])
    expect(d.actual).toEqual([
      { text: 'bed,', changed: false },
      { text: '', changed: true, width: 1 },
      { text: 'pouch', changed: false },
    ])
  })
  it('marks each of several differences on its own', () => {
    const d = diffValues('Mall 22 kW, Depot 3 kW', 'Mall  22 kW, Depot  3 kW')
    expect(changed(d.actual)).toEqual([' ', ' '])
    expect(join(d.actual)).toBe('Mall  22 kW, Depot  3 kW')
    expect(join(d.expected)).toBe('Mall 22 kW, Depot 3 kW')
  })
  it('marks a replaced word on both sides', () => {
    const d = diffValues('row 2: lie-flat bed', 'row 2: standard bed')
    expect(join(d.expected)).toBe('row 2: lie-flat bed')
    expect(join(d.actual)).toBe('row 2: standard bed')
    expect(d.expected[0]).toEqual({ text: 'row 2: ', changed: false })
  })
  it('marks the whole value when the two share little', () => {
    expect(diffValues('Hello', 'Bye')).toEqual({
      expected: [{ text: 'Hello', changed: true }],
      actual: [{ text: 'Bye', changed: true }],
    })
  })
  it('handles an empty value', () => {
    const d = diffValues('', 'x')
    expect(join(d.expected)).toBe('')
    expect(changed(d.actual)).toEqual(['x'])
  })
})

describe('showWhitespace', () => {
  it('makes spaces, tabs and line breaks visible', () => {
    expect(showWhitespace(' \t\r\n')).toBe('·→↵')
  })
})
