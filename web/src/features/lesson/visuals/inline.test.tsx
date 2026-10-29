import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { lessonVisuals } from './index'
import { Key, Role, Slot } from './inline'

describe('inline marks', () => {
  it('Role renders inline code carrying the role for colour', () => {
    render(<p><Role kind="contract">IEnemy</Role></p>)
    const tag = screen.getByText('IEnemy')
    expect(tag.tagName).toBe('CODE')
    expect(tag).toHaveClass('role-tag')
    expect(tag).toHaveAttribute('data-role', 'contract')
  })
  it('Key marks the phrase to remember', () => {
    render(<p><Key>only IEnemy</Key></p>)
    expect(screen.getByText('only IEnemy').tagName).toBe('MARK')
  })
  it('Slot renders an inline open-slot marker', () => {
    render(<p><Slot>Get a vehicle</Slot></p>)
    expect(screen.getByText('Get a vehicle')).toHaveClass('slot')
  })
  it('lessonVisuals exposes the inline marks to MDX', () => {
    expect(Object.keys(lessonVisuals)).toEqual(expect.arrayContaining(['Role', 'Key', 'Slot']))
  })
})
