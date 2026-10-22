import { z } from 'zod'
import { getDb } from './db'
import { notifyProgressChanged, type PatternProgress } from './progressStore'
import type { Draft } from './drafts'

export interface ProgressExport {
  app: 'design-patterns-trainer'
  schemaVersion: 1
  exportedAt: string
  progress: PatternProgress[]
  drafts: Draft[]
}
export type ImportResult = { ok: true; patterns: number; drafts: number } | { ok: false; reason: 'invalidJson' | 'notAnExport' | 'unsupportedVersion' }

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
const exportSchema = z.object({
  app: z.literal('design-patterns-trainer'),
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  progress: z.array(patternProgress),
  drafts: z.array(draft),
})

export async function exportProgress(): Promise<ProgressExport> {
  const db = await getDb()
  const tx = db.transaction(['progress', 'drafts'], 'readonly')
  const [progress, drafts] = await Promise.all([tx.objectStore('progress').getAll(), tx.objectStore('drafts').getAll()])
  await tx.done
  return { app: 'design-patterns-trainer', schemaVersion: 1, exportedAt: new Date().toISOString(), progress, drafts }
}

/** Validates the whole payload first, then replaces both stores in a single transaction. */
export async function importProgress(json: string): Promise<ImportResult> {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'invalidJson' }
  }
  if (typeof raw !== 'object' || raw === null || (raw as { app?: unknown }).app !== 'design-patterns-trainer') return { ok: false, reason: 'notAnExport' }
  if ((raw as { schemaVersion?: unknown }).schemaVersion !== 1) return { ok: false, reason: 'unsupportedVersion' }
  const parsed = exportSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, reason: 'notAnExport' }
  const { progress, drafts } = parsed.data

  const db = await getDb()
  const tx = db.transaction(['progress', 'drafts'], 'readwrite')
  const p = tx.objectStore('progress')
  const d = tx.objectStore('drafts')
  await Promise.all([p.clear(), d.clear()])
  await Promise.all([...progress.map((x) => p.put(x)), ...drafts.map((x) => d.put(x))])
  await tx.done
  notifyProgressChanged()
  return { ok: true, patterns: progress.length, drafts: drafts.length }
}
