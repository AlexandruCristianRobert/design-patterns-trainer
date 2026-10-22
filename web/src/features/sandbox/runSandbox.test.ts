import { describe, expect, it, vi } from 'vitest'
import type { CompileResponse, DiagnosticInfo, LoadResponse, RunOutcome } from '../../compiler/protocol'
import type { Timed } from '../../compiler/RunnerHost'
import { CrashSignal } from '../../compiler/workerRpc'
import { runSandbox } from './runSandbox'

const d = (level: DiagnosticInfo['level'], id: string): DiagnosticInfo => ({
  id,
  level,
  message: id,
  file: 'user',
  startLine: 1,
  startColumn: 1,
  endLine: 1,
  endColumn: 2,
})

function fakes(opts: { compile: CompileResponse; load?: LoadResponse; run?: Timed<RunOutcome> }) {
  const compiler = { compile: vi.fn(async () => opts.compile) }
  const runner = {
    load: vi.fn(async () => opts.load ?? { checkIds: [], hasEntryPoint: true }),
    runMain: vi.fn(async (): Promise<Timed<RunOutcome>> => opts.run ?? { kind: 'timedOut' }),
  }
  return { compiler, runner }
}

const ok: CompileResponse = {
  success: true,
  diagnostics: [d('warning', 'CS0168')],
  contractViolations: [],
  assemblyBase64: 'QQ==',
}

describe('runSandbox', () => {
  it('returns compileErrors with only errors', async () => {
    const { compiler, runner } = fakes({
      compile: { success: false, diagnostics: [d('error', 'CS0103'), d('warning', 'CS0168')], contractViolations: [] },
    })
    expect(await runSandbox('src', compiler, runner)).toEqual({
      kind: 'compileErrors',
      diagnostics: [d('error', 'CS0103')],
    })
    expect(compiler.compile).toHaveBeenCalledWith({ source: 'src', purpose: 'run' })
    expect(runner.load).not.toHaveBeenCalled()
    expect(runner.runMain).not.toHaveBeenCalled()
  })

  it('returns noEntryPoint without calling runMain', async () => {
    const { compiler, runner } = fakes({ compile: ok, load: { checkIds: [], hasEntryPoint: false } })
    expect(await runSandbox('class A {}', compiler, runner)).toEqual({ kind: 'noEntryPoint' })
    expect(runner.load).toHaveBeenCalledWith({ assemblyBase64: 'QQ==', source: 'class A {}' })
    expect(runner.runMain).not.toHaveBeenCalled()
  })

  it('maps timedOut and completed', async () => {
    const timed = fakes({ compile: ok, run: { kind: 'timedOut' } })
    expect(await runSandbox('src', timed.compiler, timed.runner)).toEqual({ kind: 'timedOut' })

    const exception = { type: 'System.Exception', message: 'boom' }
    const done = fakes({
      compile: ok,
      run: { kind: 'ok', value: { stdout: 'hi\n', truncated: true, hasEntryPoint: true, exception } },
    })
    expect(await runSandbox('src', done.compiler, done.runner)).toEqual({
      kind: 'completed',
      stdout: 'hi\n',
      truncated: true,
      exception,
    })

    const plain = fakes({
      compile: ok,
      run: { kind: 'ok', value: { stdout: 'x', truncated: false, hasEntryPoint: true } },
    })
    expect(await runSandbox('src', plain.compiler, plain.runner)).toEqual({
      kind: 'completed',
      stdout: 'x',
      truncated: false,
    })
  })

  it('maps a crashed run, and a load that crashed the runtime, to crashed', async () => {
    const crashed = fakes({ compile: ok, run: { kind: 'crashed', message: 'Program terminated with exit(1)' } })
    expect(await runSandbox('src', crashed.compiler, crashed.runner)).toEqual({ kind: 'crashed' })

    const loadCrash = fakes({ compile: ok })
    loadCrash.runner.load.mockRejectedValueOnce(new CrashSignal('Program terminated with exit(1)'))
    expect(await runSandbox('src', loadCrash.compiler, loadCrash.runner)).toEqual({ kind: 'crashed' })
    expect(loadCrash.runner.runMain).not.toHaveBeenCalled()
  })
})
