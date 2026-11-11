import type { CheckResult, ContractViolation, DiagnosticInfo } from '../compiler/protocol'
import type { Category } from '../content/schema'

export type ExamScope =
  | { kind: 'all' }
  | { kind: 'categories'; categories: Category[] }
  | { kind: 'patterns'; patternIds: string[] }

/** A Helper the learner used on one Exam Question. */
export type HelpUse = 'check' | 'pattern' | 'solution' | 'hint1' | 'hint2' | 'hint3'

export interface ExamSetup {
  count: number
  scope: ExamScope
  named: boolean
  timed: boolean
  /** Helpers are offered during the session. Missing (sessions from before Helpers) means off. */
  helpers?: boolean
}

export interface ExamAnswer {
  code: string
  /** Pattern id, or null when not chosen. */
  identification: string | null
  /** The Helpers used on this question, each once, in first-use order. Missing means none. */
  help?: HelpUse[]
}

export type QuestionGrade =
  | { kind: 'checked'; results: CheckResult[] }
  | { kind: 'compileErrors'; diagnostics: DiagnosticInfo[] }
  | { kind: 'contractViolations'; violations: ContractViolation[] }
  | { kind: 'error' }

export interface QuestionResult {
  questionKey: string
  patternId: string
  identification: string | null
  /** null in Named mode. */
  identifiedCorrectly: boolean | null
  grade: QuestionGrade
  checksPassed: number
  checksTotal: number
  /** 0..1 */
  score: number
}

export type ExamStatus = 'inProgress' | 'submitted' | 'abandoned'

export interface ExamSession {
  id: string
  status: ExamStatus
  setup: ExamSetup
  questionKeys: string[]
  startedAt: string
  deadline: string | null
  answers: Record<string, ExamAnswer>
  endedAt?: string
  submittedBy?: 'learner' | 'timer'
  results?: QuestionResult[]
  score?: number
  passed?: boolean
}
