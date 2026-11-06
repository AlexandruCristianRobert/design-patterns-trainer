import type { BoxRecord } from './leitner'
import type { QuizResult } from './quizStore'

export function quizSummary(results: QuizResult[], boxes: ReadonlyMap<string, BoxRecord>, bankIds: readonly string[]) {
  const total = results.reduce((s, r) => s + r.total, 0)
  const correct = results.reduce((s, r) => s + r.correct, 0)
  return {
    quizzes: results.length,
    averagePercent: total === 0 ? null : Math.round((correct / total) * 100),
    seen: bankIds.filter((id) => boxes.has(id)).length,
    total: bankIds.length,
  }
}
