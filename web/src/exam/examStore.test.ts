import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { beforeEach, describe, expect, it } from 'vitest'
import { DB_NAME, getDb, resetDbForTests } from '../progress/db'
import { exportProgress, importProgress } from '../progress/exportImport'
import { getAllProgress, markLessonVisited } from '../progress/progressStore'
import { loadDraft, saveDraft } from '../progress/drafts'
import { EXAM_STARTER } from '../content/exam'
import {
  abandonSession,
  bestExamScores,
  createSession,
  ExamInProgressError,
  finishSession,
  getInProgressSession,
  getSession,
  lastSeenByQuestion,
  listSessions,
  ExamSessionGoneError,
  saveAnswer,
} from './examStore'
import type { ExamAnswer, ExamSetup, QuestionResult } from './types'

const setup: ExamSetup = { count: 2, scope: { kind: 'all' }, named: false, timed: true }
const t = (m: number) => new Date(Date.UTC(2026, 0, 1, 10, m))
const result = (patternId: string, score: number): QuestionResult => ({
  questionKey: `${patternId}/q`,
  patternId,
  identification: patternId,
  identifiedCorrectly: true,
  grade: { kind: 'error' },
  checksPassed: 0,
  checksTotal: 0,
  score,
})
const starterAnswers: Record<string, ExamAnswer> = {
  'observer/a': { code: EXAM_STARTER, identification: null },
  'observer/b': { code: EXAM_STARTER, identification: null },
}
const finishArgs = (results: QuestionResult[], score = 0.5, answers = starterAnswers) => ({ results, score, passed: score >= 0.7, by: 'learner' as const, answers })

beforeEach(async () => {
  await resetDbForTests()
})

describe('create / get', () => {
  it('creates a session with starter answers and a deadline, and round-trips', async () => {
    const s = await createSession(setup, ['observer/a', 'observer/b'], t(0))
    expect(s.status).toBe('inProgress')
    expect(s.answers).toEqual({
      'observer/a': { code: EXAM_STARTER, identification: null },
      'observer/b': { code: EXAM_STARTER, identification: null },
    })
    expect(s.deadline).toBe(t(30).toISOString())
    expect(await getSession(s.id)).toEqual(s)
    expect(await getInProgressSession()).toEqual(s)
  })
  it('refuses a second session while one is in progress', async () => {
    await createSession(setup, ['observer/a'], t(0))
    await expect(createSession(setup, ['observer/b'], t(1))).rejects.toBeInstanceOf(ExamInProgressError)
    expect(await listSessions()).toHaveLength(1)
  })
  it('lets exactly one of two simultaneous creates win', async () => {
    const results = await Promise.allSettled([createSession(setup, ['observer/a'], t(0)), createSession(setup, ['observer/b'], t(0))])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(lost.reason).toBeInstanceOf(ExamInProgressError)
    expect(await listSessions()).toHaveLength(1)
  })
  it('allows a new session once the previous one has ended', async () => {
    const a = await createSession(setup, ['observer/a'], t(0))
    await abandonSession(a.id, t(1))
    await expect(createSession(setup, ['observer/b'], t(2))).resolves.toBeDefined()
  })
})

describe('answers', () => {
  it('persists the code and the identification', async () => {
    const s = await createSession(setup, ['observer/a'], t(0))
    await saveAnswer(s.id, 'observer/a', { code: 'class A {}', identification: 'observer' })
    expect((await getSession(s.id))!.answers['observer/a']).toEqual({ code: 'class A {}', identification: 'observer' })
  })
  it('ignores a question key that is not in the session', async () => {
    const s = await createSession(setup, ['observer/a'], t(0))
    await saveAnswer(s.id, 'observer/zzz', { code: 'x', identification: null })
    expect(Object.keys((await getSession(s.id))!.answers)).toEqual(['observer/a'])
  })
  it('ignores answers after submit', async () => {
    const s = await createSession(setup, ['observer/a'], t(0))
    await finishSession(s.id, finishArgs([result('observer', 1)]), t(5))
    await saveAnswer(s.id, 'observer/a', { code: 'late', identification: 'observer' })
    expect((await getSession(s.id))!.answers['observer/a'].code).toBe(EXAM_STARTER)
  })
  it('ignores answers after abandon, silently', async () => {
    const s = await createSession(setup, ['observer/a'], t(0))
    await abandonSession(s.id, t(1))
    await expect(saveAnswer(s.id, 'observer/a', { code: 'late', identification: null })).resolves.toBeUndefined()
  })
  it('rejects when the session no longer exists (an import replaced it)', async () => {
    await expect(saveAnswer('gone', 'observer/a', { code: 'x', identification: null })).rejects.toBeInstanceOf(ExamSessionGoneError)
  })
})

describe('finish / abandon / list', () => {
  it('stores exactly the graded answers, not a write that landed during grading', async () => {
    const s = await createSession(setup, ['observer/a'], t(0))
    await saveAnswer(s.id, 'observer/a', { code: 'graded', identification: 'observer' })
    const graded = (await getSession(s.id))!.answers
    await saveAnswer(s.id, 'observer/a', { code: 'typed during grading', identification: null })
    const done = await finishSession(s.id, finishArgs([result('observer', 1)], 1, graded), t(5))
    expect(done!.answers).toEqual(graded)
    expect((await getSession(s.id))!.answers).toEqual({ 'observer/a': { code: 'graded', identification: 'observer' } })
  })
  it('finishes once; a second finish returns undefined and keeps the first result', async () => {
    const s = await createSession(setup, ['observer/a'], t(0))
    const first = await finishSession(s.id, finishArgs([result('observer', 1)], 1), t(5))
    expect(first).toMatchObject({ status: 'submitted', score: 1, passed: true, submittedBy: 'learner', endedAt: t(5).toISOString() })
    expect(await finishSession(s.id, finishArgs([result('observer', 0)], 0), t(6))).toBeUndefined()
    expect((await getSession(s.id))!.score).toBe(1)
  })
  it('abandoned sessions have no score and cannot be finished', async () => {
    const s = await createSession(setup, ['observer/a'], t(0))
    await abandonSession(s.id, t(2))
    const got = (await getSession(s.id))!
    expect(got).toMatchObject({ status: 'abandoned', endedAt: t(2).toISOString() })
    expect(got.score).toBeUndefined()
    expect(await finishSession(s.id, finishArgs([]), t(3))).toBeUndefined()
  })
  it('lists newest first', async () => {
    const a = await createSession(setup, ['observer/a'], t(0))
    await abandonSession(a.id, t(1))
    const b = await createSession(setup, ['observer/b'], t(10))
    await abandonSession(b.id, t(11))
    const c = await createSession(setup, ['observer/c'], t(5))
    expect((await listSessions()).map((s) => s.id)).toEqual([b.id, c.id, a.id])
  })
  it('orders by startedAt descending regardless of insertion order', async () => {
    const db = await getDb()
    const mk = (id: string, m: number) => ({
      id,
      status: 'abandoned' as const,
      setup,
      questionKeys: [],
      startedAt: t(m).toISOString(),
      deadline: null,
      answers: {},
    })
    for (const [id, m] of [['b', 20], ['a', 10], ['d', 40], ['c', 30]] as const) await db.put('examSessions', mk(id, m))
    expect((await listSessions()).map((s) => s.id)).toEqual(['d', 'c', 'b', 'a'])
  })
})

describe('derived data', () => {
  it('lastSeenByQuestion gives the latest startedAt per key', async () => {
    const a = await createSession(setup, ['observer/a', 'observer/b'], t(0))
    await abandonSession(a.id, t(1))
    const b = await createSession(setup, ['observer/b'], t(10))
    await abandonSession(b.id, t(11))
    expect(await lastSeenByQuestion()).toEqual({ 'observer/a': t(0).toISOString(), 'observer/b': t(10).toISOString() })
  })
  it('lastSeenByQuestion counts abandoned sessions (the learner was shown those questions)', async () => {
    const a = await createSession(setup, ['observer/a'], t(0))
    await abandonSession(a.id, t(1))
    expect(await lastSeenByQuestion()).toEqual({ 'observer/a': t(0).toISOString() })
  })
  it('bestExamScores takes the max per Pattern over submitted sessions only', async () => {
    const a = await createSession(setup, ['k'], t(0))
    await finishSession(a.id, finishArgs([result('observer', 0.4), result('strategy', 0.9)]), t(1))
    const b = await createSession(setup, ['k'], t(2))
    await finishSession(b.id, finishArgs([result('observer', 0.8)]), t(3))
    const c = await createSession(setup, ['k'], t(4))
    const db = await getDb()
    // abandoned and in-progress sessions carrying high results (as a hand-edited store could): they must not count
    await db.put('examSessions', { ...c, status: 'abandoned', results: [result('observer', 1), result('zzz', 1)] })
    const d = await createSession(setup, ['k'], t(6))
    await db.put('examSessions', { ...d, results: [result('observer', 1), result('yyy', 1)] })
    expect(await bestExamScores()).toEqual({ observer: 0.8, strategy: 0.9 })
  })
})

describe('database upgrade', () => {
  it('keeps progress and drafts when a v1 database opens at v2', async () => {
    const v1 = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('progress', { keyPath: 'patternId' })
        db.createObjectStore('drafts', { keyPath: 'key' })
      },
    })
    await v1.put('progress', { patternId: 'observer', lessonVisited: true, exercises: {} })
    await v1.put('drafts', { key: 'lesson:observer', code: 'x', contentVersion: 1, updatedAt: 'now' })
    v1.close()
    expect((await getAllProgress())[0]).toMatchObject({ patternId: 'observer', lessonVisited: true })
    expect((await loadDraft('lesson:observer', 1))?.draft.code).toBe('x')
    expect(await listSessions()).toEqual([])
  })
  it('releases its connection when another tab upgrades, and does not hand out the closed one', async () => {
    await markLessonVisited('observer')
    const upgraded = await openDB(DB_NAME, 3) // would hang on `blocked` unless our connection closes
    upgraded.close()
    // the stale connection was dropped, so a fresh open runs (and is refused by the newer schema) instead of reusing a closed handle
    await expect(getAllProgress()).rejects.toThrow(/Could not open local storage/)
  })
})

describe('export / import v2', () => {
  it('round-trips sessions', async () => {
    const s = await createSession(setup, ['observer/a'], t(0))
    await finishSession(s.id, finishArgs([result('observer', 1)], 1), t(5))
    await saveDraft('lesson:observer', 'x', 1)
    const snap = await exportProgress()
    expect(snap.schemaVersion).toBe(2)
    expect(snap.examSessions).toHaveLength(1)
    await resetDbForTests()
    expect(await importProgress(JSON.stringify(snap))).toEqual({ ok: true, patterns: 0, drafts: 1, exams: 1 })
    expect(await getSession(s.id)).toEqual(snap.examSessions[0])
  })
  it('imports a v1 file and clears sessions', async () => {
    await createSession(setup, ['observer/a'], t(0))
    const v1 = { app: 'design-patterns-trainer', schemaVersion: 1, exportedAt: 'x', progress: [], drafts: [] }
    expect(await importProgress(JSON.stringify(v1))).toEqual({ ok: true, patterns: 0, drafts: 0, exams: 0 })
    expect(await listSessions()).toEqual([])
  })
  it('rejects a v3 file, leaving data untouched', async () => {
    const s = await createSession(setup, ['observer/a'], t(0))
    const snap = await exportProgress()
    expect(await importProgress(JSON.stringify({ ...snap, schemaVersion: 3 }))).toEqual({ ok: false, reason: 'unsupportedVersion' })
    expect(await getSession(s.id)).toEqual(s)
  })
  describe('rejects malformed sessions as notAnExport and leaves data untouched', () => {
    const submitted = (id: string) => ({
      id,
      status: 'submitted',
      setup,
      questionKeys: ['observer/a'],
      startedAt: t(0).toISOString(),
      deadline: t(15).toISOString(),
      answers: { 'observer/a': { code: 'x', identification: 'observer' } },
      endedAt: t(5).toISOString(),
      submittedBy: 'learner',
      results: [result('observer', 1)],
      score: 1,
      passed: true,
    })
    const inProgress = (id: string) => ({ ...submitted(id), status: 'inProgress', endedAt: undefined, submittedBy: undefined, results: undefined, score: undefined, passed: undefined })
    const cases: Array<[string, (snap: Record<string, unknown>) => unknown]> = [
      ['results is a number', () => [{ ...submitted('x'), results: 5 }]],
      ['results contains null', () => [{ ...submitted('x'), results: [null] }]],
      ['unknown grade kind', () => [{ ...submitted('x'), results: [{ ...result('observer', 1), grade: { kind: 'nope' } }] }]],
      ['answers is an array', () => [{ ...submitted('x'), answers: [] }]],
      ['answer missing for a question', () => [{ ...submitted('x'), questionKeys: ['observer/a', 'observer/b'] }]],
      ['garbage deadline', () => [{ ...inProgress('x'), deadline: 'soon' }]],
      ['garbage startedAt', () => [{ ...inProgress('x'), startedAt: 'yesterday' }]],
      ['submitted without results', () => [{ ...submitted('x'), results: undefined }]],
      ['submitted without score', () => [{ ...submitted('x'), score: undefined }]],
      ['two in progress', () => [inProgress('x'), inProgress('y')]],
    ]
    it.each(cases)('%s', async (_name, make) => {
      const s = await createSession(setup, ['observer/a'], t(0))
      const snap = (await exportProgress()) as unknown as Record<string, unknown>
      const bad = { ...snap, examSessions: make(snap) }
      expect(await importProgress(JSON.stringify(bad))).toEqual({ ok: false, reason: 'notAnExport' })
      expect(await listSessions()).toEqual([s])
    })
    it('a v2 file without examSessions', async () => {
      const s = await createSession(setup, ['observer/a'], t(0))
      const { examSessions: _omit, ...rest } = (await exportProgress()) as unknown as Record<string, unknown>
      expect(await importProgress(JSON.stringify(rest))).toEqual({ ok: false, reason: 'notAnExport' })
      expect(await listSessions()).toEqual([s])
    })
    it('accepts a well-formed submitted session plus one in progress', async () => {
      const snap = (await exportProgress()) as unknown as Record<string, unknown>
      const ok = await importProgress(JSON.stringify({ ...snap, examSessions: [submitted('a'), inProgress('b')] }))
      expect(ok).toMatchObject({ ok: true, exams: 2 })
    })
  })
})

it('getDb is the shared connection', async () => {
  expect(await getDb()).toBe(await getDb())
})
