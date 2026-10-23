import { describe, expect, it, vi } from 'vitest'
import { gradeExercise } from './gradeExercise'
import type { ExerciseContent } from '../../content/patterns'
import type { CheckResult, CompileResponse, DiagnosticInfo } from '../../compiler/protocol'
import type { Timed } from '../../compiler/RunnerHost'
import { fakeExclusive } from '../../compiler/testing/fakeExclusive'

const exercise = {
  id: 'e',
  meta: { kind: 'complete', version: 1, contract: { types: [] } },
  starter: '',
  solution: '',
  checks: 'CHECKS',
} as unknown as ExerciseContent

const diag = (file: 'user' | 'checks'): DiagnosticInfo => ({
  id: 'CS1002', level: 'error', message: 'm', file, startLine: 1, startColumn: 1, endLine: 1, endColumn: 2,
})

function fakes(response: Partial<CompileResponse>, ids: string[], runs: Record<string, Timed<CheckResult>>) {
  const compile = vi.fn(async () => ({ success: true, diagnostics: [], contractViolations: [], assemblyBase64: 'AAA', ...response }))
  const { exclusive, guard } = fakeExclusive()
  const load = vi.fn(async () => {
    guard('load')
    return { checkIds: ids, hasEntryPoint: false }
  })
  const runCheck = vi.fn(async (id: string) => {
    guard('runCheck')
    return runs[id]
  })
  return { compile, load, runCheck, exclusive }
}
const ok = (id: string): Timed<CheckResult> => ({ kind: 'ok', value: { id, status: 'passed' } })

describe('gradeExercise', () => {
  it('compiles for checking with checks source and contract', async () => {
    const f = fakes({}, [], {})
    await gradeExercise('SRC', exercise, [], f, f).catch(() => undefined)
    expect(f.compile).toHaveBeenCalledWith({ source: 'SRC', purpose: 'check', checksSource: 'CHECKS', contract: exercise.meta.contract })
  })
  it('contract violations short-circuit', async () => {
    const v = [{ code: 'missingType' as const, type: 'X' }]
    const f = fakes({ success: false, contractViolations: v }, [], {})
    expect(await gradeExercise('s', exercise, ['a', 'b'], f, f)).toEqual({ kind: 'contractViolations', violations: v })
    expect(f.load).not.toHaveBeenCalled()
    expect(f.runCheck).not.toHaveBeenCalled()
  })
  it('keeps only user-file errors', async () => {
    const f = fakes({ success: false, diagnostics: [diag('user'), diag('checks')] }, [], {})
    expect(await gradeExercise('s', exercise, ['a', 'b'], f, f)).toEqual({ kind: 'compileErrors', diagnostics: [diag('user')] })
  })
  it('throws on a checks-file error', async () => {
    const f = fakes({ success: false, diagnostics: [diag('checks')] }, [], {})
    await expect(gradeExercise('s', exercise, ['a', 'b'], f, f)).rejects.toThrow()
  })
  it('reports allPassed in checkIds order', async () => {
    const f = fakes({}, ['b', 'a'], { a: ok('a'), b: ok('b') })
    const r = await gradeExercise('s', exercise, ['a', 'b'], f, f)
    expect(r).toEqual({ kind: 'checked', allPassed: true, results: [{ id: 'b', status: 'passed' }, { id: 'a', status: 'passed' }] })
    expect(f.load).toHaveBeenCalledWith({ assemblyBase64: 'AAA', source: 's' })
  })
  it('runs the load and every check inside one exclusive runner job', async () => {
    const f = fakes({}, ['a', 'b'], { a: ok('a'), b: ok('b') })
    await gradeExercise('s', exercise, ['a', 'b'], f, f)
    expect(f.exclusive).toHaveBeenCalledTimes(1)
    expect(f.runCheck).toHaveBeenCalledTimes(2)
  })
  it('turns a timeout into timedOut and keeps running', async () => {
    const f = fakes({}, ['a', 'b'], { a: { kind: 'timedOut' }, b: ok('b') })
    const r = await gradeExercise('s', exercise, ['a', 'b'], f, f)
    expect(r).toEqual({
      kind: 'checked',
      allPassed: false,
      results: [{ id: 'a', status: 'timedOut', reason: 'timedOut' }, { id: 'b', status: 'passed' }],
    })
  })
})

describe('gradeExercise with no usable checks', () => {
  it('throws instead of passing when no checks are discovered', async () => {
    const f = fakes({}, [], {})
    await expect(gradeExercise('s', exercise, [], f, f)).rejects.toThrow(/no checks/)
    expect(f.runCheck).not.toHaveBeenCalled()
  })
  it('throws when the discovered checks differ from the ones the text describes', async () => {
    const f = fakes({}, ['a', 'c'], { a: ok('a'), c: ok('c') })
    await expect(gradeExercise('s', exercise, ['a', 'b'], f, f)).rejects.toThrow(/do not match/)
    expect(f.runCheck).not.toHaveBeenCalled()
  })
})

describe('gradeExercise with a plain Gradable', () => {
  it('accepts an object that is not an ExerciseContent', async () => {
    const gradable = { id: 'q', checks: 'CHECKS', meta: { contract: { types: [] } } }
    const f = fakes({}, ['a'], { a: ok('a') })
    const r = await gradeExercise('s', gradable, ['a'], f, f)
    expect(r).toEqual({ kind: 'checked', allPassed: true, results: [{ id: 'a', status: 'passed' }] })
  })
})
