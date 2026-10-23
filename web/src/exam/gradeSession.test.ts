import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getExamPool, getExamQuestion } from '../content/exam'
import { getExamQuestionText } from '../content/text'
import { resetDbForTests } from '../progress/db'
import { gradeSession } from './gradeSession'
import { submitExam } from './submitExam'
import { createSession, getSession, saveAnswer } from './examStore'
import type { ExamSession, ExamSetup } from './types'

const keys = getExamPool().filter((q) => q.patternId === 'observer').map((q) => q.key)
const idsOf = (key: string) => Object.keys(getExamQuestionText(key, 'en').value.checks)
const keyOfChecks = (checks: string) => getExamPool().find((q) => q.checks === checks)!.key

/** The learner's source drives the fake: PASS, FAIL1 (first check fails), CE (compile errors), CV (contract), THROW (load throws). */
function fakeEngine() {
  const state = { source: '', key: '' }
  const compile = vi.fn(async (req: { source: string; checksSource: string }) => {
    if (req.source === 'CE')
      return {
        success: false,
        diagnostics: [{ id: 'CS1002', level: 'error', message: 'm', file: 'user', startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }],
        contractViolations: [],
        assemblyBase64: undefined,
      }
    if (req.source === 'CV') return { success: false, diagnostics: [], contractViolations: [{ code: 'missingType', type: 'X' }], assemblyBase64: undefined }
    return { success: true, diagnostics: [], contractViolations: [], assemblyBase64: req.checksSource }
  })
  const load = vi.fn(async (req: { assemblyBase64: string; source: string }) => {
    if (req.source === 'THROW') throw new Error('crash')
    state.source = req.source
    state.key = keyOfChecks(req.assemblyBase64)
    return { checkIds: idsOf(state.key), hasEntryPoint: false }
  })
  const runCheck = vi.fn(async (id: string) => ({
    kind: 'ok' as const,
    value: state.source === 'FAIL1' && idsOf(state.key)[0] === id ? { id, status: 'failed' as const, reason: 'x' } : { id, status: 'passed' as const },
  }))
  // The fake only fills the parts of the engine that grading touches.
  return { compiler: { compile } as never, runner: { load, runCheck } as never, compile, load, runCheck }
}

const setupOf = (named: boolean): ExamSetup => ({ count: 1, scope: { kind: 'all' }, named, timed: false })
function session(named: boolean, answers: [string, string | null][]): ExamSession {
  return {
    id: 's',
    status: 'inProgress',
    setup: setupOf(named),
    questionKeys: keys.slice(0, answers.length),
    startedAt: '2026-01-01T00:00:00.000Z',
    deadline: null,
    answers: Object.fromEntries(answers.map(([code, identification], i) => [keys[i], { code, identification }])),
  }
}

describe('gradeSession', () => {
  it('all pass with correct identification scores 1', async () => {
    const e = fakeEngine()
    const r = await gradeSession(session(false, [['PASS', 'observer']]), e.compiler, e.runner)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      questionKey: keys[0],
      patternId: 'observer',
      identifiedCorrectly: true,
      score: 1,
      checksPassed: idsOf(keys[0]).length,
      checksTotal: idsOf(keys[0]).length,
    })
    expect(r[0].grade.kind).toBe('checked')
  })
  it('wrong identification with all checks passing scores 0.8', async () => {
    const e = fakeEngine()
    const [r] = await gradeSession(session(false, [['PASS', 'strategy']]), e.compiler, e.runner)
    expect(r.identifiedCorrectly).toBe(false)
    expect(r.score).toBeCloseTo(0.8)
  })
  it('Named mode ignores identification', async () => {
    const e = fakeEngine()
    const [r] = await gradeSession(session(true, [['PASS', null]]), e.compiler, e.runner)
    expect(r.identifiedCorrectly).toBeNull()
    expect(r.score).toBe(1)
  })
  it('compile errors score 0 of the Check count', async () => {
    const e = fakeEngine()
    const [r] = await gradeSession(session(true, [['CE', null]]), e.compiler, e.runner)
    expect(r.grade.kind).toBe('compileErrors')
    expect(r).toMatchObject({ checksPassed: 0, checksTotal: idsOf(keys[0]).length, score: 0 })
  })
  it('contract violations score 0 of the Check count', async () => {
    const e = fakeEngine()
    const [r] = await gradeSession(session(true, [['CV', null]]), e.compiler, e.runner)
    expect(r.grade.kind).toBe('contractViolations')
    expect(r).toMatchObject({ checksPassed: 0, checksTotal: idsOf(keys[0]).length, score: 0 })
  })
  it('partial checks score proportionally', async () => {
    const e = fakeEngine()
    const [r] = await gradeSession(session(true, [['FAIL1', null]]), e.compiler, e.runner)
    const n = idsOf(keys[0]).length
    expect(r.checksPassed).toBe(n - 1)
    expect(r.score).toBeCloseTo((n - 1) / n)
  })
  it('a throwing grade gives an error result and later questions still grade', async () => {
    const e = fakeEngine()
    const r = await gradeSession(session(false, [['THROW', 'observer'], ['PASS', 'observer']]), e.compiler, e.runner)
    expect(r[0]).toMatchObject({ grade: { kind: 'error' }, checksPassed: 0, checksTotal: idsOf(keys[0]).length, score: 0.2 })
    expect(r[1].score).toBe(1)
  })
  it('a removed question scores as error', async () => {
    const e = fakeEngine()
    const s = session(true, [['PASS', null]])
    s.questionKeys = ['observer/gone']
    s.answers = { 'observer/gone': { code: 'PASS', identification: null } }
    expect(getExamQuestion('observer/gone')).toBeUndefined()
    const [r] = await gradeSession(s, e.compiler, e.runner)
    expect(r).toMatchObject({ questionKey: 'observer/gone', patternId: 'observer', grade: { kind: 'error' }, checksPassed: 0, checksTotal: 0, score: 0 })
  })
  it('calls onProgress 1..N', async () => {
    const e = fakeEngine()
    const calls: [number, number][] = []
    await gradeSession(session(true, [['PASS', null], ['PASS', null], ['PASS', null]]), e.compiler, e.runner, (d, t) => calls.push([d, t]))
    expect(calls).toEqual([[1, 3], [2, 3], [3, 3]])
  })
})

describe('submitExam', () => {
  beforeEach(async () => {
    await resetDbForTests()
  })
  async function started() {
    const s = await createSession(setupOf(false), [keys[0]], new Date())
    await saveAnswer(s.id, keys[0], { code: 'PASS', identification: 'observer' })
    return s
  }
  it('two concurrent calls grade once and resolve to the same session', async () => {
    const e = fakeEngine()
    const s = await started()
    const [a, b] = await Promise.all([submitExam(s.id, 'learner', e), submitExam(s.id, 'timer', e)])
    expect(e.compile).toHaveBeenCalledTimes(1)
    expect(a).toEqual(b)
    expect(a).toMatchObject({ status: 'submitted', submittedBy: 'learner', score: 1, passed: true })
    expect(await getSession(s.id)).toEqual(a)
  })
  it('a submitted session is not graded again', async () => {
    const e = fakeEngine()
    const s = await started()
    await submitExam(s.id, 'learner', e)
    const again = await submitExam(s.id, 'learner', e)
    expect(e.compile).toHaveBeenCalledTimes(1)
    expect(again?.status).toBe('submitted')
  })
  it('an unknown session returns undefined', async () => {
    const e = fakeEngine()
    expect(await submitExam('nope', 'learner', e)).toBeUndefined()
    expect(e.compile).not.toHaveBeenCalled()
  })
})
