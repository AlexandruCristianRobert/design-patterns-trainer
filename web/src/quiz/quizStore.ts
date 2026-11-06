import { getDb } from '../progress/db'
import { notifyProgressChanged } from '../progress/progressStore'
import { nextBox, type Box, type BoxRecord } from './leitner'
import type { TopicSelection } from './run'

export interface QuizResult {
  id: string
  takenAt: string
  topics: TopicSelection
  total: number
  correct: number
}
export interface BoxChange {
  from: Box | undefined
  to: Box
}

export async function getBoxes(): Promise<Map<string, BoxRecord>> {
  const all = await (await getDb()).getAll('quizBoxes')
  return new Map(all.map((r) => [r.questionId, r]))
}

/** Applies one submitted answer to the question's Box (spec §4), in one transaction. */
export async function recordAnswer(questionId: string, correct: boolean, now: Date): Promise<BoxChange> {
  const db = await getDb()
  const tx = db.transaction('quizBoxes', 'readwrite')
  const prev = await tx.store.get(questionId)
  const to = nextBox(prev?.box, correct)
  await tx.store.put({ questionId, box: to, lastAnsweredAt: now.toISOString() })
  await tx.done
  notifyProgressChanged()
  return { from: prev?.box, to }
}

export async function saveQuizResult(r: Omit<QuizResult, 'id'>): Promise<QuizResult> {
  const result: QuizResult = { id: crypto.randomUUID(), ...r }
  await (await getDb()).put('quizResults', result)
  notifyProgressChanged()
  return result
}

/** Takes back a Quiz Result whose Quiz was quit while it was being saved (spec §5: a quit Quiz has no result). */
export async function deleteQuizResult(id: string): Promise<void> {
  await (await getDb()).delete('quizResults', id)
  notifyProgressChanged()
}

/** Newest first. */
export async function listQuizResults(): Promise<QuizResult[]> {
  const all = await (await getDb()).getAll('quizResults')
  return all.sort((a, b) => b.takenAt.localeCompare(a.takenAt))
}
