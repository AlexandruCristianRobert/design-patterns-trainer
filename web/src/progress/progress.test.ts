import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { applyExerciseEvent, type ExerciseEvent, type ExerciseProgress } from './progressStore'
import { getAllProgress, getProgress, markLessonVisited, recordExerciseEvent } from './progressStore'
import { deleteDraft, loadDraft, saveDraft } from './drafts'
import { exportProgress, importProgress } from './exportImport'
import { nextStep } from './nextStep'
import { resetDbForTests } from './db'
import type { PatternMeta } from '../content/schema'

const T = '2026-01-01T00:00:00.000Z'
const run = (events: ExerciseEvent[]): ExerciseProgress => {
  let p: ExerciseProgress | undefined
  for (const e of events) p = applyExerciseEvent(p, e, T)
  return p!
}
const pass: ExerciseEvent = { type: 'checked', allPassed: true }
const fail: ExerciseEvent = { type: 'checked', allPassed: false }

beforeEach(async () => {
  await resetDbForTests()
})

describe('applyExerciseEvent', () => {
  it('solve without help → solved', () => {
    expect(run([fail]).status).toBe('attempted')
    expect(run([fail, pass]).status).toBe('solved')
  })
  it('hint before solving → solvedWithHelp', () => {
    const p = run([{ type: 'hintRevealed' }, pass])
    expect(p.status).toBe('solvedWithHelp')
    expect(p.usedHelp).toBe(true)
    expect(p.hintsRevealed).toBe(1)
  })
  it('hint after solved does not downgrade', () => {
    const p = run([pass, { type: 'hintRevealed' }])
    expect(p.status).toBe('solved')
    expect(p.usedHelp).toBe(false)
  })
  it('solution cannot be revealed before the first check', () => {
    const p = run([{ type: 'solutionRevealed' }])
    expect(p.solutionRevealed).toBe(false)
    expect(p.usedHelp).toBe(false)
    const q = run([fail, { type: 'solutionRevealed' }, pass])
    expect(q.solutionRevealed).toBe(true)
    expect(q.status).toBe('solvedWithHelp')
  })
  it('failed check after solved does not downgrade', () => {
    expect(run([pass, fail]).status).toBe('solved')
    expect(run([{ type: 'hintRevealed' }, pass, fail]).status).toBe('solvedWithHelp')
  })
  it('reset returns to notStarted and clears help', () => {
    const p = run([{ type: 'hintRevealed' }, pass, { type: 'reset' }])
    expect(p).toMatchObject({ status: 'notStarted', usedHelp: false, hintsRevealed: 0, solutionRevealed: false, checkedOnce: false })
  })
})

describe('store', () => {
  it('returns empty default and persists events', async () => {
    expect(await getProgress('observer')).toEqual({ patternId: 'observer', lessonVisited: false, exercises: {} })
    await markLessonVisited('observer')
    const e = await recordExerciseEvent('observer', 'a', pass)
    expect(e.status).toBe('solved')
    const p = await getProgress('observer')
    expect(p.lessonVisited).toBe(true)
    expect(p.exercises.a.status).toBe('solved')
    expect(await getAllProgress()).toHaveLength(1)
  })
})

describe('drafts', () => {
  it('draft round-trips and is flagged stale on version change but kept', async () => {
    await saveDraft('exercise:observer/a', 'code', 1)
    expect((await loadDraft('exercise:observer/a', 1))?.stale).toBe(false)
    const r = await loadDraft('exercise:observer/a', 2)
    expect(r?.stale).toBe(true)
    expect(r?.draft.code).toBe('code')
    await deleteDraft('exercise:observer/a')
    expect(await loadDraft('exercise:observer/a', 1)).toBeUndefined()
  })
})

describe('export/import', () => {
  it('export → import round-trips progress and drafts', async () => {
    await recordExerciseEvent('observer', 'a', fail)
    await saveDraft('lesson:observer', 'x', 3)
    const snap = await exportProgress()
    expect(snap).toMatchObject({ app: 'design-patterns-trainer', schemaVersion: 1 })
    await resetDbForTests()
    expect(await importProgress(JSON.stringify(snap))).toEqual({ ok: true, patterns: 1, drafts: 1 })
    const again = await exportProgress()
    expect(again.progress).toEqual(snap.progress)
    expect(again.drafts).toEqual(snap.drafts)
  })
  it('import of invalid JSON / foreign object / schemaVersion 2 leaves existing data untouched', async () => {
    await recordExerciseEvent('observer', 'a', pass)
    const good = await exportProgress()
    expect(await importProgress('{nope')).toEqual({ ok: false, reason: 'invalidJson' })
    expect(await importProgress(JSON.stringify({ hello: 1 }))).toEqual({ ok: false, reason: 'notAnExport' })
    expect(await importProgress(JSON.stringify({ ...good, schemaVersion: 2 }))).toEqual({ ok: false, reason: 'unsupportedVersion' })
    const bad = { ...good, progress: [{ patternId: 'x', lessonVisited: 'yes', exercises: {} }] }
    expect(await importProgress(JSON.stringify(bad))).toEqual({ ok: false, reason: 'notAnExport' })
    expect((await exportProgress()).progress).toEqual(good.progress)
  })
})

describe('nextStep', () => {
  const meta = { exercises: ['a', 'b', 'c'] } as PatternMeta
  const ex = (status: ExerciseProgress['status']): ExerciseProgress => ({ status, usedHelp: false, hintsRevealed: 0, solutionRevealed: false, checkedOnce: false, updatedAt: T })
  it('readLesson → first unsolved exercise in pattern order → examReady', () => {
    expect(nextStep(meta, { patternId: 'p', lessonVisited: false, exercises: {} })).toEqual({ kind: 'readLesson' })
    expect(nextStep(meta, { patternId: 'p', lessonVisited: true, exercises: { a: ex('solved'), b: ex('attempted') } })).toEqual({ kind: 'exercise', exerciseId: 'b', index: 1 })
    expect(nextStep(meta, { patternId: 'p', lessonVisited: true, exercises: { a: ex('solved'), b: ex('solvedWithHelp'), c: ex('solved') } })).toEqual({ kind: 'examReady' })
  })
})
