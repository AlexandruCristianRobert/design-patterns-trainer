import { z } from 'zod'
import { getDb } from './db'
import { notifyProgressChanged, type PatternProgress } from './progressStore'
import type { Draft } from './drafts'
import type { ExamSession } from '../exam/types'

export interface ProgressExport {
  app: 'design-patterns-trainer'
  schemaVersion: 2
  exportedAt: string
  progress: PatternProgress[]
  drafts: Draft[]
  examSessions: ExamSession[]
}
export type ImportResult =
  | { ok: true; patterns: number; drafts: number; exams: number }
  | { ok: false; reason: 'invalidJson' | 'notAnExport' | 'unsupportedVersion' }

const exerciseProgress = z.strictObject({
  status: z.enum(['notStarted', 'attempted', 'solvedWithHelp', 'solved']),
  usedHelp: z.boolean(),
  hintsRevealed: z.number().int().min(0),
  solutionRevealed: z.boolean(),
  checkedOnce: z.boolean(),
  updatedAt: z.string(),
})
const patternProgress = z.strictObject({
  patternId: z.string().min(1),
  lessonVisited: z.boolean(),
  exercises: z.record(z.string(), exerciseProgress),
})
const draft = z.strictObject({
  key: z.custom<Draft['key']>((v) => typeof v === 'string' && /^(exercise:[^/]+\/.+|lesson:.+)$/.test(v)),
  code: z.string(),
  contentVersion: z.number().int(),
  updatedAt: z.string(),
})
/** Shallow shape check of an Exam Session: enough to key, list and resume it without trusting the rest. */
const examSession = z.custom<ExamSession>((v) => {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Partial<ExamSession>
  return (
    typeof s.id === 'string' &&
    s.id.length > 0 &&
    (s.status === 'inProgress' || s.status === 'submitted' || s.status === 'abandoned') &&
    typeof s.startedAt === 'string' &&
    Array.isArray(s.questionKeys) &&
    s.questionKeys.every((k) => typeof k === 'string') &&
    typeof s.answers === 'object' &&
    s.answers !== null &&
    typeof s.setup === 'object' &&
    s.setup !== null &&
    (s.deadline === null || typeof s.deadline === 'string')
  )
})
const exportSchema = z.object({
  app: z.literal('design-patterns-trainer'),
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string(),
  progress: z.array(patternProgress),
  drafts: z.array(draft),
  examSessions: z.array(examSession).optional(),
})

export async function exportProgress(): Promise<ProgressExport> {
  const db = await getDb()
  const tx = db.transaction(['progress', 'drafts', 'examSessions'], 'readonly')
  const [progress, drafts, examSessions] = await Promise.all([
    tx.objectStore('progress').getAll(),
    tx.objectStore('drafts').getAll(),
    tx.objectStore('examSessions').getAll(),
  ])
  await tx.done
  return { app: 'design-patterns-trainer', schemaVersion: 2, exportedAt: new Date().toISOString(), progress, drafts, examSessions }
}

/** Validates the whole payload first, then replaces all three stores in a single transaction. Accepts v1 and v2. */
export async function importProgress(json: string): Promise<ImportResult> {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'invalidJson' }
  }
  if (typeof raw !== 'object' || raw === null || (raw as { app?: unknown }).app !== 'design-patterns-trainer') return { ok: false, reason: 'notAnExport' }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion
  if (version !== 1 && version !== 2) return { ok: false, reason: 'unsupportedVersion' }
  const parsed = exportSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, reason: 'notAnExport' }
  const { progress, drafts } = parsed.data
  // a v1 file has no sessions: importing it clears exam history (Ruling 8)
  const examSessions = version === 2 ? (parsed.data.examSessions ?? []) : []

  const db = await getDb()
  const tx = db.transaction(['progress', 'drafts', 'examSessions'], 'readwrite')
  const p = tx.objectStore('progress')
  const d = tx.objectStore('drafts')
  const e = tx.objectStore('examSessions')
  await Promise.all([p.clear(), d.clear(), e.clear()])
  await Promise.all([...progress.map((x) => p.put(x)), ...drafts.map((x) => d.put(x)), ...examSessions.map((x) => e.put(x))])
  await tx.done
  notifyProgressChanged()
  return { ok: true, patterns: progress.length, drafts: drafts.length, exams: examSessions.length }
}
