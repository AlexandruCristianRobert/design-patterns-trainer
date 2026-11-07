import type { ComponentType } from 'react'

/** What a stage drawing gets: the stage's step ids in content order, the step to draw, and the motion preference. */
export interface StageDrawingProps {
  stepIds: string[]
  stepIndex: number
  reduced: boolean
}

/** A question's bespoke drawings, one per stage id in its content file. Drawings hold no captions or controls. */
export type QuestionDrawing = Record<string, ComponentType<StageDrawingProps>>
