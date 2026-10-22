import type { PatternMeta } from '../content/schema'
import type { PatternProgress } from './progressStore'

export type NextStep = { kind: 'readLesson' } | { kind: 'exercise'; exerciseId: string; index: number } | { kind: 'examReady' }

export function nextStep(meta: PatternMeta, progress: PatternProgress): NextStep {
  if (!progress.lessonVisited) return { kind: 'readLesson' }
  const index = meta.exercises.findIndex((id) => {
    const s = progress.exercises[id]?.status
    return s !== 'solved' && s !== 'solvedWithHelp'
  })
  return index === -1 ? { kind: 'examReady' } : { kind: 'exercise', exerciseId: meta.exercises[index], index }
}
