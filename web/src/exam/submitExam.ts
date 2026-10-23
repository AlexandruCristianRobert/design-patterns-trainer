import type { CompilerClient } from '../compiler/CompilerClient'
import type { RunnerHost } from '../compiler/RunnerHost'
import { finishSession, getSession } from './examStore'
import { gradeSession } from './gradeSession'
import { isPass, sessionScore } from './scoring'
import type { ExamSession } from './types'

export interface ExamEngine {
  compiler: Pick<CompilerClient, 'compile'>
  runner: Pick<RunnerHost, 'exclusive' | 'load' | 'runCheck'>
}

/** One grading per session id in this tab; concurrent callers share the promise. */
const inFlight = new Map<string, Promise<ExamSession | undefined>>()

async function run(id: string, by: 'learner' | 'timer', engine: ExamEngine, onProgress?: (done: number, total: number) => void): Promise<ExamSession | undefined> {
  const session = await getSession(id)
  if (!session || session.status !== 'inProgress') return session
  const results = await gradeSession(session, engine.compiler, engine.runner, onProgress)
  const score = sessionScore(results.map((r) => r.score))
  return (await finishSession(id, { results, score, passed: isPass(score), by }, new Date())) ?? (await getSession(id))
}

/** `onProgress` is heard only by the caller that starts the grading; a caller that joins one in flight just gets the result. */
export function submitExam(sessionId: string, by: 'learner' | 'timer', engine: ExamEngine, onProgress?: (done: number, total: number) => void): Promise<ExamSession | undefined> {
  const running = inFlight.get(sessionId)
  if (running) return running
  const p = run(sessionId, by, engine, onProgress).finally(() => inFlight.delete(sessionId))
  inFlight.set(sessionId, p)
  return p
}
