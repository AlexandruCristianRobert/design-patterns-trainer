import type { CompilerClient } from '../../compiler/CompilerClient'
import type { DiagnosticInfo } from '../../compiler/protocol'
import type { RunnerHost } from '../../compiler/RunnerHost'
import { CrashSignal } from '../../compiler/workerRpc'

export type SandboxOutput =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'compileErrors'; diagnostics: DiagnosticInfo[] }
  | { kind: 'noEntryPoint' }
  | { kind: 'timedOut' }
  /** The runtime died (typically a stack overflow); the runner has already recovered for the next run. */
  | { kind: 'crashed' }
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
  let loaded
  try {
    loaded = await runner.load({ assemblyBase64: compiled.assemblyBase64, source })
  } catch (e) {
    if (e instanceof CrashSignal) return { kind: 'crashed' }
    throw e
  }
  if (!loaded.hasEntryPoint) return { kind: 'noEntryPoint' }

  const run = await runner.runMain()
  if (run.kind === 'timedOut') return { kind: 'timedOut' }
  if (run.kind === 'crashed') return { kind: 'crashed' }
  const { stdout, truncated, exception } = run.value
  return exception ? { kind: 'completed', stdout, truncated, exception } : { kind: 'completed', stdout, truncated }
}
