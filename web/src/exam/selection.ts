import { getCatalog } from '../content/catalog'
import type { ExamQuestionContent } from '../content/exam'
import type { ExamScope, ExamSetup } from './types'

export function scopePatternIds(scope: ExamScope, pool: ExamQuestionContent[]): Set<string> {
  const ids = new Set(pool.map((q) => q.patternId))
  if (scope.kind === 'all') return ids
  if (scope.kind === 'patterns') return new Set(scope.patternIds.filter((id) => ids.has(id)))
  const wanted = new Set(scope.categories)
  const inCategory = new Set(getCatalog().filter((c) => wanted.has(c.category)).map((c) => c.id))
  return new Set([...ids].filter((id) => inCategory.has(id)))
}

function inScope(setup: Pick<ExamSetup, 'scope'>, pool: ExamQuestionContent[]): ExamQuestionContent[] {
  const ids = scopePatternIds(setup.scope, pool)
  return pool.filter((q) => ids.has(q.patternId))
}

export function availableCount(setup: Pick<ExamSetup, 'scope'>, pool: ExamQuestionContent[]): number {
  return inScope(setup, pool).length
}

/** Question keys: least-recently-seen first, one per Pattern per pass, never repeating a question. */
export function selectQuestions(
  pool: ExamQuestionContent[],
  setup: ExamSetup,
  lastSeen: Record<string, string>,
  random: () => number,
): string[] {
  const sorted = inScope(setup, pool)
    .map((q) => {
      const seen = lastSeen[q.key]
      const time = seen === undefined ? Number.NEGATIVE_INFINITY : Date.parse(seen)
      return { q, time: Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time, tie: random() }
    })
    .sort((a, b) => (a.time === b.time ? a.tie - b.tie : a.time < b.time ? -1 : 1))
    .map((x) => x.q)

  const picked: ExamQuestionContent[] = []
  let remaining = sorted
  while (picked.length < setup.count && remaining.length > 0) {
    const used = new Set<string>()
    const next: ExamQuestionContent[] = []
    for (const q of remaining) {
      if (picked.length < setup.count && !used.has(q.patternId)) {
        used.add(q.patternId)
        picked.push(q)
      } else next.push(q)
    }
    remaining = next
  }
  return picked.map((q) => q.key)
}
