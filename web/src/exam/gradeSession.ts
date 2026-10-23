import type { CompilerClient } from '../compiler/CompilerClient'
import type { RunnerHost } from '../compiler/RunnerHost'
import { getExamQuestion } from '../content/exam'
import { getExamQuestionText } from '../content/text'
import { gradeExercise } from '../features/exercise/gradeExercise'
import { questionScore } from './scoring'
import type { ExamSession, QuestionGrade, QuestionResult } from './types'

async function gradeQuestion(session: ExamSession, key: string, compiler: Pick<CompilerClient, 'compile'>, runner: Pick<RunnerHost, 'exclusive' | 'load' | 'runCheck'>): Promise<QuestionResult> {
  const named = session.setup.named
  const answer = session.answers[key] ?? { code: '', identification: null }
  const question = getExamQuestion(key)
  const patternId = question?.patternId ?? key.split('/')[0]
  const identifiedCorrectly = named ? null : answer.identification === patternId
  const fail = (checksTotal: number, grade: QuestionGrade = { kind: 'error' }): QuestionResult => ({
    questionKey: key,
    patternId,
    identification: answer.identification,
    identifiedCorrectly,
    grade,
    checksPassed: 0,
    checksTotal,
    score: questionScore(named, identifiedCorrectly === true, 0, checksTotal),
  })

  // Ruling 6: anything that throws (including content that has since gone) scores 0 for Checks.
  if (!question) return fail(0)
  let expectedIds: string[]
  try {
    expectedIds = Object.keys(getExamQuestionText(key, 'en').value.checks)
  } catch {
    return fail(0)
  }
  const total = expectedIds.length
  try {
    const g = await gradeExercise(answer.code, question, expectedIds, compiler, runner)
    if (g.kind === 'compileErrors') return fail(total, { kind: 'compileErrors', diagnostics: g.diagnostics })
    if (g.kind === 'contractViolations') return fail(total, { kind: 'contractViolations', violations: g.violations })
    const passed = g.results.filter((r) => r.status === 'passed').length
    return { ...fail(total, { kind: 'checked', results: g.results }), checksPassed: passed, score: questionScore(named, identifiedCorrectly === true, passed, total) }
  } catch {
    return fail(total)
  }
}

/** Grades every question of the session, one after another, so the single runner is never shared. */
export async function gradeSession(
  session: ExamSession,
  compiler: Pick<CompilerClient, 'compile'>,
  runner: Pick<RunnerHost, 'exclusive' | 'load' | 'runCheck'>,
  onProgress?: (done: number, total: number) => void,
): Promise<QuestionResult[]> {
  const out: QuestionResult[] = []
  const total = session.questionKeys.length
  for (const key of session.questionKeys) {
    out.push(await gradeQuestion(session, key, compiler, runner))
    onProgress?.(out.length, total)
  }
  return out
}
