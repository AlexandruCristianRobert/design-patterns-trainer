import { describe, expect, it } from 'vitest'
import { edgeEnds, parallelSlots, selfLoop, slotOffset } from './edgeGeometry'

const box = (cx: number, cy: number) => ({ cx, cy, w: 100, h: 60 })

describe('parallel edges', () => {
  it('groups edges by unordered node pair and offsets a pair by +-6', () => {
    const slots = parallelSlots([
      { id: 'a', from: 'x', to: 'y' },
      { id: 'b', from: 'y', to: 'x' },
      { id: 'c', from: 'x', to: 'z' },
    ])
    expect(slotOffset(slots.get('a')!)).toBe(-6)
    expect(slotOffset(slots.get('b')!)).toBe(6)
    expect(slotOffset(slots.get('c')!)).toBe(0)
  })

  it('moves a vertical edge sideways by the offset, ends staying on the box outlines', () => {
    const top = box(0, 0)
    const bottom = box(0, 200)
    const plain = edgeEnds(bottom, top, 0, true)
    const moved = edgeEnds(bottom, top, 6, true)
    expect(Math.abs(moved.a.x - plain.a.x)).toBeCloseTo(6)
    expect(moved.a.y).toBeCloseTo(plain.a.y)
    expect(moved.b.y).toBeCloseTo(plain.b.y)
  })

  it('keeps two opposite edges 12px apart on the same pair', () => {
    const p = box(0, 0)
    const q = box(300, 0)
    const forward = edgeEnds(p, q, slotOffset({ index: 0, count: 2 }), false)
    const back = edgeEnds(q, p, slotOffset({ index: 1, count: 2 }), true)
    expect(Math.abs(forward.a.y - back.b.y)).toBeCloseTo(12)
  })
})

describe('self-loops', () => {
  it('draws a loop with extent on the right side of the box, with its label beside it', () => {
    const b = box(100, 50)
    const loop = selfLoop(b)
    expect(loop.path).toMatch(/^M 150 38 C .* 150 62$/)
    expect(loop.label.x).toBeGreaterThan(150)
    expect(loop.label.y).toBe(50)
  })

  it('is not part of a parallel group', () => {
    expect(parallelSlots([{ id: 's', from: 'a', to: 'a' }]).size).toBe(0)
  })
})
