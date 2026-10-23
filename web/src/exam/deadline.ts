import type { ExamSession, ExamSetup } from './types'

export const MINUTES_PER_QUESTION = 15

export function deadlineFor(startedAt: string, setup: ExamSetup, questionCount: number): string | null {
  if (!setup.timed) return null
  return new Date(Date.parse(startedAt) + questionCount * MINUTES_PER_QUESTION * 60_000).toISOString()
}

export function remainingMs(session: Pick<ExamSession, 'deadline'>, now: number): number | null {
  if (session.deadline === null) return null
  return Math.max(0, Date.parse(session.deadline) - now)
}

export function isExpired(session: Pick<ExamSession, 'status' | 'deadline'>, now: number): boolean {
  return session.status === 'inProgress' && session.deadline !== null && now >= Date.parse(session.deadline)
}
