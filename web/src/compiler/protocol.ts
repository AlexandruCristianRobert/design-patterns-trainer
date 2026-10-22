// Mirrors core/DesignPatterns.Core/Protocol JSON (camelCase, enums as camelCase strings, nulls omitted).
export type DiagnosticLevel = 'error' | 'warning' | 'info'
export interface DiagnosticInfo {
  id: string
  level: DiagnosticLevel
  message: string
  file: 'user' | 'checks'
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  args?: Record<string, string>
}
export interface ContractType {
  name: string
  kind: 'class' | 'abstractClass' | 'interface' | 'any'
  members: string[]
}
export interface CompileRequest {
  source: string
  purpose: 'diagnostics' | 'run' | 'check'
  checksSource?: string
  contract?: { types: ContractType[] }
}
export interface ContractViolation {
  code: 'missingType' | 'wrongKind' | 'missingMember'
  type: string
  member?: string
}
export interface CompileResponse {
  success: boolean
  diagnostics: DiagnosticInfo[]
  contractViolations: ContractViolation[]
  assemblyBase64?: string
}
export interface LoadRequest {
  assemblyBase64: string
  source: string
}
export interface LoadResponse {
  checkIds: string[]
  hasEntryPoint: boolean
}
export interface RunOutcome {
  stdout: string
  truncated: boolean
  exception?: { type: string; message: string }
  hasEntryPoint: boolean
}
export interface CheckResult {
  id: string
  status: 'passed' | 'failed' | 'errored' | 'timedOut'
  reason?: string
  args?: Record<string, string>
}
export const RUN_TIMEOUT_MS = 5000
export const RECYCLE_AFTER_LOADS = 50
