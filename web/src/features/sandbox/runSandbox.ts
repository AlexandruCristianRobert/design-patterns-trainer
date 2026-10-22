import type { CompilerClient } from '../../compiler/CompilerClient'
import type { DiagnosticInfo } from '../../compiler/protocol'
import type { RunnerHost } from '../../compiler/RunnerHost'

export type SandboxOutput =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'compileErrors'; diagnostics: DiagnosticInfo[] }
  | { kind: 'noEntryPoint' }
  | { kind: 'timedOut' }
  | { kind: 'completed'; stdout: string; truncated: boolean; exception?: { type: string; message: string } }

export async function runSandbox(
  source: string,
  compiler: Pick<CompilerClient, 'compile'>,
  runner: Pick<RunnerHost, 'load' | 'runMain'>,
): Promise<SandboxOutput> {
  const compiled = await compiler.compile({ source, purpose: 'run' })
  if (!compiled.success || !compiled.assemblyBase64) {
    return { kind: 'compileErrors', diagnostics: compiled.diagnostics.filter((d) => d.level === 'error') }
  }
  const loaded = await runner.load({ assemblyBase64: compiled.assemblyBase64, source })
  if (!loaded.hasEntryPoint) return { kind: 'noEntryPoint' }

  const run = await runner.runMain()
  if (run.kind === 'timedOut') return { kind: 'timedOut' }
  const { stdout, truncated, exception } = run.value
  return exception ? { kind: 'completed', stdout, truncated, exception } : { kind: 'completed', stdout, truncated }
}
