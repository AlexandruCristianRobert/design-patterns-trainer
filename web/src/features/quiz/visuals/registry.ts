import type { QuestionDrawing } from './drawing'

// Lazy: each question's drawing is its own chunk, so the Quiz bundle does not grow with the number of visuals.
const modules = import.meta.glob<{ default: QuestionDrawing }>('./drawings/*.tsx')
const prefix = './drawings/'

export const drawingIds = (): string[] => Object.keys(modules).map((p) => p.slice(prefix.length, -'.tsx'.length))

export function loadDrawing(questionId: string): Promise<QuestionDrawing> | undefined {
  return modules[`${prefix}${questionId}.tsx`]?.().then((m) => m.default)
}
