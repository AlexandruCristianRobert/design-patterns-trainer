import type { CompilerClient } from '../../compiler/CompilerClient'
import { checkResultOf, type RunnerHost } from '../../compiler/RunnerHost'
import type { CheckResult, ContractViolation, DiagnosticInfo } from '../../compiler/protocol'
import type { ExerciseContent } from '../../content/patterns'

export type GradeResult =
  | { kind: 'compileErrors'; diagnostics: DiagnosticInfo[] }
  | { kind: 'contractViolations'; violations: ContractViolation[] }
  | { kind: 'checked'; results: CheckResult[]; allPassed: boolean }

/**
 * Compiles the learner's code with the Exercise's checks and runs every check. `expectedIds` are the check ids the
 * Exercise text describes. When the checks found in `checks.cs` are missing or differ from them, the Exercise itself
 * is broken, so this throws rather than reporting a pass the learner didn't earn. The page shows that as its
 * recoverable "the checks couldn't run" error.
 */
export async function gradeExercise(
  source: string,
  exercise: ExerciseContent,
  expectedIds: readonly string[],
  compiler: Pick<CompilerClient, 'compile'>,
  runner: Pick<RunnerHost, 'load' | 'runCheck'>,
): Promise<GradeResult> {
  const res = await compiler.compile({ source, purpose: 'check', checksSource: exercise.checks, contract: exercise.meta.contract })
  if (res.contractViolations.length > 0) return { kind: 'contractViolations', violations: res.contractViolations }
  const errors = res.diagnostics.filter((d) => d.level === 'error')
  const userErrors = errors.filter((d) => d.file === 'user')
  if (userErrors.length > 0) return { kind: 'compileErrors', diagnostics: userErrors }
  if (errors.length > 0) throw new Error(`${exercise.id}: checks.cs failed to compile: ${errors[0].message}`)
  if (!res.success || !res.assemblyBase64) throw new Error(`${exercise.id}: compilation failed without diagnostics`)

  const { checkIds } = await runner.load({ assemblyBase64: res.assemblyBase64, source })
  if (checkIds.length === 0) throw new Error(`${exercise.id}: no checks were found in checks.cs`)
  const expected = new Set(expectedIds)
  if (checkIds.length !== expected.size || !checkIds.every((id) => expected.has(id))) {
    throw new Error(`${exercise.id}: the checks in checks.cs (${checkIds.join(', ')}) do not match the text`)
  }
  const results: CheckResult[] = []
  for (const id of checkIds) results.push(checkResultOf(id, await runner.runCheck(id)))
  return { kind: 'checked', results, allPassed: results.every((r) => r.status === 'passed') }
}
