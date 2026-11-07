import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getQuizVisuals } from '../../../content/quizVisuals'
import { drawingIds, loadDrawing } from './registry'

const visuals = getQuizVisuals()

describe('question drawings', () => {
  it('exist exactly for the visuals that have content', () => {
    expect(drawingIds().sort()).toEqual([...visuals.keys()].sort())
  })

  for (const [id, v] of visuals) {
    it(`${id}: draws every stage at every step, and nothing else`, async () => {
      const drawing = await loadDrawing(id)!
      const stages = [v.setup, ...v.reality.stages, ...v.claims.flatMap((c) => [c.claim, c.reality])]
      expect(Object.keys(drawing).sort()).toEqual(stages.map((s) => s.id).sort())
      for (const s of stages) {
        const Stage = drawing[s.id]
        const stepIds = s.steps.map((step) => step.id)
        for (let i = 0; i < stepIds.length; i++) {
          const { unmount } = render(<Stage stepIds={stepIds} stepIndex={i} reduced={false} />)
          unmount()
        }
      }
    })
  }
})
