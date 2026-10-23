import { getDb } from '../progress/db'
import { notifyProgressChanged } from '../progress/progressStore'
import { EXAM_STARTER } from '../content/exam'
import { deadlineFor } from './deadline'
import type { ExamAnswer, ExamSession, ExamSetup, QuestionResult } from './types'

export class ExamInProgressError extends Error {
  constructor() {
    super('An Exam Session is already in progress.')
    this.name = 'ExamInProgressError'
  }
}

/** The session was removed while it was open, for example by an import that replaced every stored exam. */
export class ExamSessionGoneError extends Error {
  constructor() {
    super('This Exam Session no longer exists.')
    this.name = 'ExamSessionGoneError'
  }
}

const inProgress = (all: ExamSession[]) => all.find((s) => s.status === 'inProgress')

export async function createSession(setup: ExamSetup, questionKeys: string[], now: Date): Promise<ExamSession> {
  const db = await getDb()
  const tx = db.transaction('examSessions', 'readwrite')
  if (inProgress(await tx.store.getAll())) {
    await tx.done
    throw new ExamInProgressError()
  }
  const startedAt = now.toISOString()
  const session: ExamSession = {
    id: crypto.randomUUID(),
    status: 'inProgress',
    setup: structuredClone(setup),
    questionKeys: [...questionKeys],
    startedAt,
    deadline: deadlineFor(startedAt, setup, questionKeys.length),
    answers: Object.fromEntries(questionKeys.map((k) => [k, { code: EXAM_STARTER, identification: null }])),
  }
  await tx.store.put(session)
  await tx.done
  notifyProgressChanged()
  return session
}

export async function getSession(id: string): Promise<ExamSession | undefined> {
  return (await getDb()).get('examSessions', id)
}

export async function getInProgressSession(): Promise<ExamSession | undefined> {
  return inProgress(await (await getDb()).getAll('examSessions'))
}

export async function listSessions(): Promise<ExamSession[]> {
  const all = await (await getDb()).getAll('examSessions')
  return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

/**
 * Runs `change` on an in-progress session inside one readwrite transaction; returns the updated session or undefined.
 * With `mustExist`, a session that isn't stored at all rejects with ExamSessionGoneError instead.
 */
async function mutate(id: string, change: (s: ExamSession) => ExamSession, mustExist = false): Promise<ExamSession | undefined> {
  const db = await getDb()
  const tx = db.transaction('examSessions', 'readwrite')
  const cur = await tx.store.get(id)
  if (!cur && mustExist) {
    await tx.done
    throw new ExamSessionGoneError()
  }
  let next: ExamSession | undefined
  if (cur && cur.status === 'inProgress') {
    next = change(cur)
    await tx.store.put(next)
  }
  await tx.done
  if (next) notifyProgressChanged()
  return next
}

/** A no-op once the session has ended; rejects with ExamSessionGoneError when the session no longer exists. */
export async function saveAnswer(id: string, questionKey: string, answer: ExamAnswer): Promise<void> {
  await mutate(
    id,
    (s) => (!(questionKey in s.answers) ? s : { ...s, answers: { ...s.answers, [questionKey]: { code: answer.code, identification: answer.identification } } }),
    true,
  )
}

/** `answers` are the ones that were graded: the record keeps exactly those, never a write that landed during grading. */
export function finishSession(
  id: string,
  r: { results: QuestionResult[]; score: number; passed: boolean; by: 'learner' | 'timer'; answers: Record<string, ExamAnswer> },
  now: Date,
): Promise<ExamSession | undefined> {
  return mutate(id, (s) => ({
    ...s,
    status: 'submitted',
    endedAt: now.toISOString(),
    submittedBy: r.by,
    results: r.results,
    score: r.score,
    passed: r.passed,
    answers: structuredClone(r.answers),
  }))
}

export async function abandonSession(id: string, now: Date): Promise<void> {
  await mutate(id, (s) => ({ ...s, status: 'abandoned', endedAt: now.toISOString() }))
}

export async function lastSeenByQuestion(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const s of await listSessions()) for (const k of s.questionKeys) out[k] ??= s.startedAt
  return out
}

/** Ruling 3: the highest question score each Pattern has earned in any submitted session. */
export async function bestExamScores(): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const s of await listSessions())
    if (s.status === 'submitted') for (const r of s.results ?? []) out[r.patternId] = Math.max(out[r.patternId] ?? 0, r.score)
  return out
}
