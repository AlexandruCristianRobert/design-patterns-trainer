import { useEffect, useRef, useState } from 'react'
import { useCompiler } from '../../compiler/CompilerProvider'
import type { CheckResult } from '../../compiler/protocol'
import { checkResultOf } from '../../compiler/RunnerHost'

// Dev-only harness (registered only when import.meta.env.DEV): grades a fixed Singleton end to end.
// Mirrors the Singleton fixture in tests/DesignPatterns.Core.Tests/Execution/CheckRunTests.cs, plus a check that
// overflows the stack: it kills the runtime, and the check after it proves the runner recovered and reloaded.
const source =
  'public sealed class Logger { private Logger() {} public static Logger Instance { get; } = new(); }'
const checksSource = `using DesignPatterns.Checks;
static class C {
    [Check("same-instance")] static void Same() => Expect.Same(Logger.Instance, Logger.Instance);
    [Check("overflow")] static void Overflow() => Deep(0);
    static int Deep(int n) => Deep(n + 1) + 1;
    [Check("private-ctor")] static void Ctor() => Expect.That(Code.Type("Logger").Constructors.All(c => !c.IsPublic), "publicConstructor");
}`

export function DevEnginePage() {
  const { status, compiler, runner, error } = useCompiler()
  const [output, setOutput] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (status !== 'ready' || started.current) return
    started.current = true
    void (async () => {
      try {
        const compiled = await compiler.compile({
          source,
          purpose: 'check',
          checksSource,
          contract: { types: [{ name: 'Logger', kind: 'class', members: ['static Logger Instance { get; }'] }] },
        })
        if (!compiled.success || !compiled.assemblyBase64) {
          setOutput(JSON.stringify({ compile: compiled }))
          return
        }
        const assemblyBase64 = compiled.assemblyBase64
        const results = await runner.exclusive(async () => {
          const loaded = await runner.load({ assemblyBase64, source })
          const out: CheckResult[] = []
          for (const id of loaded.checkIds) out.push(checkResultOf(id, await runner.runCheck(id)))
          return out
        })
        setOutput(JSON.stringify(results))
      } catch (e) {
        setOutput(JSON.stringify({ error: String(e) }))
      }
    })()
  }, [status, compiler, runner])

  const text = output ?? (status === 'failed' ? JSON.stringify({ error }) : null)
  return text === null ? null : <pre data-testid="engine-results">{text}</pre>
}
