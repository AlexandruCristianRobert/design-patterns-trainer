import type { CheckResult, ContractViolation, DiagnosticInfo } from '../compiler/protocol'
import type { Category } from '../content/schema'

export type ExamScope =
  | { kind: 'all' }
  | { kind: 'categories'; categories: Category[] }
  | { kind: 'patterns'; patternIds: string[] }

export interface ExamSetup {
  count: number
  scope: ExamScope
  named: boolean
  timed: boolean
}

export interface ExamAnswer {
  code: string
  /** Pattern id, or null when not chosen. */
  identification: string | null
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
