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
const isoString = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'not a date')
const answer = z.strictObject({ code: z.string(), identification: z.string().nullable() })
const examSetup = z.strictObject({
  count: z.number().int().min(1),
  scope: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('all') }),
    z.strictObject({ kind: z.literal('categories'), categories: z.array(z.enum(['creational', 'structural', 'behavioral'])) }),
    z.strictObject({ kind: z.literal('patterns'), patternIds: z.array(z.string()) }),
  ]),
  named: z.boolean(),
  timed: z.boolean(),
})
const diagnostic = z.strictObject({
  id: z.string(),
  level: z.enum(['error', 'warning', 'info']),
  message: z.string(),
  file: z.enum(['user', 'checks']),
  startLine: z.number(),
  startColumn: z.number(),
  endLine: z.number(),
  endColumn: z.number(),
  args: z.record(z.string(), z.string()).optional(),
})
const checkResult = z.strictObject({
  id: z.string(),
  status: z.enum(['passed', 'failed', 'errored', 'timedOut']),
  reason: z.string().optional(),
  args: z.record(z.string(), z.string()).optional(),
})
const violation = z.strictObject({
  code: z.enum(['missingType', 'wrongKind', 'missingMember']),
  type: z.string(),
  member: z.string().optional(),
})
const grade = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('checked'), results: z.array(checkResult) }),
  z.strictObject({ kind: z.literal('compileErrors'), diagnostics: z.array(diagnostic) }),
  z.strictObject({ kind: z.literal('contractViolations'), violations: z.array(violation) }),
  z.strictObject({ kind: z.literal('error') }),
])
const questionResult = z.strictObject({
  questionKey: z.string(),
  patternId: z.string(),
  identification: z.string().nullable(),
  identifiedCorrectly: z.boolean().nullable(),
  grade,
  checksPassed: z.number().int().min(0),
  checksTotal: z.number().int().min(0),
  score: z.number().min(0).max(1),
})
const examSession = z
  .strictObject({
    id: z.string().min(1),
    status: z.enum(['inProgress', 'submitted', 'abandoned']),
    setup: examSetup,
    questionKeys: z.array(z.string()),
    startedAt: isoString,
    deadline: isoString.nullable(),
    answers: z.record(z.string(), answer),
    endedAt: isoString.optional(),
    submittedBy: z.enum(['learner', 'timer']).optional(),
    results: z.array(questionResult).optional(),
    score: z.number().min(0).max(1).optional(),
    passed: z.boolean().optional(),
  })
  .refine((s) => s.questionKeys.every((k) => k in s.answers), 'every question needs an answer')
  .refine(
    (s) => s.status !== 'submitted' || (s.results !== undefined && s.score !== undefined && s.passed !== undefined && s.endedAt !== undefined),
    'a submitted session needs its results',
  )
const examSessions = z
  .array(examSession)
  .refine((all) => all.filter((s) => s.status === 'inProgress').length <= 1, 'at most one session in progress')
  .refine((all) => new Set(all.map((s) => s.id)).size === all.length, 'duplicate session ids')
const exportSchema = z.object({
  app: z.literal('design-patterns-trainer'),
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string(),
  progress: z.array(patternProgress),
  drafts: z.array(draft),
  examSessions: examSessions.optional(),
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
  // a v1 file has no sessions: importing it clears exam history (Ruling 8); a v2 file must carry them
  if (version === 2 && parsed.data.examSessions === undefined) return { ok: false, reason: 'notAnExport' }
  const examSessions: ExamSession[] = version === 2 ? (parsed.data.examSessions ?? []) : []

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
