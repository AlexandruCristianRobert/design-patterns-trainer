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

// IDE features (ADR 0003). Positions are Monaco's: 1-based line and column; ranges are end-exclusive.
export type IdeMethod = 'complete' | 'hover' | 'definition' | 'format'
export interface IdePositionRequest {
  source: string
  line: number
  column: number
}
export interface IdeFormatRequest {
  source: string
}
export interface IdeRange {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}
export type IdeCompletionKind =
  | 'class'
  | 'interface'
  | 'struct'
  | 'enum'
  | 'method'
  | 'property'
  | 'field'
  | 'event'
  | 'local'
  | 'parameter'
  | 'namespace'
  | 'keyword'
export interface IdeCompletionItem {
  label: string
  kind: IdeCompletionKind
  detail?: string
  insertText: string
}
export interface IdeCompletion {
  items: IdeCompletionItem[]
  /** What an accepted item replaces: the identifier around the cursor. */
  range: IdeRange
}
export interface IdeHover {
  markdown: string
  range: IdeRange
}
export interface IdeDefinition {
  range: IdeRange
}
export interface IdeFormat {
  text: string
}
/**
 * How a failed IDE download's error message starts. The runtime cannot fetch a lazy assembly twice, so only a new page
 * can retry: the worker keeps this failure, and the UI offers a reload instead of Try again.
 */
export const IDE_DOWNLOAD_FAILED = "IDE features couldn't be downloaded; reload the page to try again."
/** How the error starts when the runtime lacks the internal lazy-loading API (an SDK change); not a download failure. */
export const IDE_RUNTIME_UNSUPPORTED = "This browser runtime can't load IDE features (runtime API changed)."
/** A newer request of the same kind replaced this one; `cancelled` says .NET saw the cancellation mid-call. */
export interface Superseded {
  superseded: true
  cancelled?: true
}
/** web/public/dotnet/ide-manifest.json, written by scripts/publish-dotnet.mjs. */
export interface IdeManifest {
  /** The fingerprinted lazy .wasm file names. */
  assemblies: string[]
  /** Their summed gzip-9 sizes: what enabling IDE features downloads from a gzip host. */
  bytes: number
}
