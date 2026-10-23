import { getCatalog } from './catalog'
import { getPattern } from './patterns'
import { parseContent, schemas } from './schema'
import type { ExamQuestionMeta } from './schema'

export { getExamQuestionText } from './text'

const yaml = import.meta.glob('../../../content/patterns/*/exam/*/question.yaml', { eager: true, import: 'default' })
const cs = import.meta.glob('../../../content/patterns/*/exam/*/{solution,checks}.cs', {
  eager: true,
  query: '?raw',
  import: 'default',
})

const root = '../../../content/patterns/'

/** Every Exam Question opens with this; there is no per-question starter. */
export const EXAM_STARTER = '// Write your solution here.\n'

export interface ExamQuestionContent {
  /** `${patternId}/${id}` */
  key: string
  patternId: string
  id: string
  meta: ExamQuestionMeta
  solution: string
  checks: string
}

function file(files: Record<string, unknown>, path: string): unknown {
  if (!(root + path in files)) throw new Error(`${root}${path}: missing file`)
  return files[root + path]
}

let pool: ExamQuestionContent[] | undefined

/** Every built Pattern's Exam Questions, in catalog order. */
export function getExamPool(): ExamQuestionContent[] {
  if (pool) return pool
  const out: ExamQuestionContent[] = []
  for (const { id: patternId, built } of getCatalog()) {
    if (!built) continue
    for (const id of getPattern(patternId)!.meta.examQuestions) {
      const base = `${patternId}/exam/${id}/`
      const solution = file(cs, `${base}solution.cs`)
      const checks = file(cs, `${base}checks.cs`)
      if (typeof solution !== 'string' || typeof checks !== 'string') throw new Error(`${root}${base}: unreadable file`)
      out.push({
        key: `${patternId}/${id}`,
        patternId,
        id,
        meta: parseContent(schemas.examQuestion, file(yaml, `${base}question.yaml`), `${base}question.yaml`),
        solution,
        checks,
      })
    }
  }
  pool = out
  return out
}

export function getExamQuestion(key: string): ExamQuestionContent | undefined {
  return getExamPool().find((q) => q.key === key)
}
