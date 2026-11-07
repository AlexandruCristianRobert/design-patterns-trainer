import type { QuizOption } from '../../../content/quiz'
import type { QuizVisual } from '../../../content/quizVisuals'
import type { QuizVisualStage } from '../../../content/schema'

export const LETTERS = ['A', 'B', 'C', 'D'] as const

/** One tab of a Question Visual: the stages shown side by side and stepped together. */
export interface View {
  key: string
  kind: 'setup' | 'reality' | 'claim'
  stages: QuizVisualStage[]
  /** Claim views: the Option's letter and position in this run (Options are shuffled per run). */
  letter?: string
  displayIndex?: number
}

export const setupView = (v: QuizVisual): View => ({ key: 'setup', kind: 'setup', stages: [v.setup] })

/** The views after answering: the Reality play, then one Claim play per wrong Option in display order. */
export function answerViews(v: QuizVisual, source: QuizOption[], display: QuizOption[]): View[] {
  const claims: View[] = v.claims.map((c) => {
    const displayIndex = display.findIndex((o) => o.text === source[c.option].text)
    return { key: `claim-${c.option}`, kind: 'claim', stages: [c.claim, c.reality], letter: LETTERS[displayIndex], displayIndex }
  })
  claims.sort((a, b) => a.displayIndex! - b.displayIndex!)
  return [{ key: 'reality', kind: 'reality', stages: v.reality.stages }, ...claims]
}

/** The chosen Option's Claim play when wrong, otherwise the Reality play. */
export function openingKey(views: View[], chosenDisplay: number, correct: boolean): string {
  if (correct) return 'reality'
  return views.find((v) => v.displayIndex === chosenDisplay)?.key ?? 'reality'
}

export const stepCount = (view: View): number => Math.max(...view.stages.map((s) => s.steps.length))

/** A shorter stage holds on its last step. */
export const stepIn = (stage: QuizVisualStage, step: number): number => Math.min(step, stage.steps.length - 1)
