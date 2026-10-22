import { getDb } from './db'

export type ExerciseStatus = 'notStarted' | 'attempted' | 'solvedWithHelp' | 'solved'
export interface ExerciseProgress {
  status: ExerciseStatus
  usedHelp: boolean
  hintsRevealed: number
  solutionRevealed: boolean
  checkedOnce: boolean
  updatedAt: string
}
export interface PatternProgress {
  patternId: string
  lessonVisited: boolean
  exercises: Record<string, ExerciseProgress>
}
export type ExerciseEvent =
  | { type: 'checked'; allPassed: boolean }
  | { type: 'hintRevealed' }
  | { type: 'solutionRevealed' }
  | { type: 'reset' }

const fresh = (now: string): ExerciseProgress => ({
  status: 'notStarted',
  usedHelp: false,
  hintsRevealed: 0,
  solutionRevealed: false,
  checkedOnce: false,
  updatedAt: now,
})
const isSolved = (s: ExerciseStatus) => s === 'solved' || s === 'solvedWithHelp'

export function applyExerciseEvent(prev: ExerciseProgress | undefined, e: ExerciseEvent, now: string): ExerciseProgress {
  if (e.type === 'reset') return fresh(now)
  const p = prev ?? fresh(now)
  switch (e.type) {
    case 'checked': {
      let status: ExerciseStatus
      if (isSolved(p.status)) status = p.status
      else if (e.allPassed) status = p.usedHelp ? 'solvedWithHelp' : 'solved'
      else status = 'attempted'
      return { ...p, status, checkedOnce: true, updatedAt: now }
    }
    case 'hintRevealed':
      return { ...p, usedHelp: p.usedHelp || !isSolved(p.status), hintsRevealed: p.hintsRevealed + 1, updatedAt: now }
    case 'solutionRevealed':
      if (!p.checkedOnce) return p
      return { ...p, usedHelp: p.usedHelp || !isSolved(p.status), solutionRevealed: true, updatedAt: now }
  }
}

const listeners = new Set<() => void>()
/** Subscribes to changes made through this module; returns an unsubscribe function. */
export function subscribeProgress(fn: () => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}
export function notifyProgressChanged(): void {
  for (const fn of [...listeners]) fn()
}

const empty = (patternId: string): PatternProgress => ({ patternId, lessonVisited: false, exercises: {} })

export async function getProgress(patternId: string): Promise<PatternProgress> {
  const db = await getDb()
  return (await db.get('progress', patternId)) ?? empty(patternId)
}

export async function getAllProgress(): Promise<PatternProgress[]> {
  return (await getDb()).getAll('progress')
}

export async function markLessonVisited(patternId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('progress', 'readwrite')
  const cur = (await tx.store.get(patternId)) ?? empty(patternId)
  if (!cur.lessonVisited) await tx.store.put({ ...cur, lessonVisited: true })
  await tx.done
  notifyProgressChanged()
}

export async function recordExerciseEvent(patternId: string, exerciseId: string, e: ExerciseEvent): Promise<ExerciseProgress> {
  const db = await getDb()
  const tx = db.transaction('progress', 'readwrite')
  const cur = (await tx.store.get(patternId)) ?? empty(patternId)
  const next = applyExerciseEvent(cur.exercises[exerciseId], e, new Date().toISOString())
  await tx.store.put({ ...cur, exercises: { ...cur.exercises, [exerciseId]: next } })
  await tx.done
  notifyProgressChanged()
  return next
}
