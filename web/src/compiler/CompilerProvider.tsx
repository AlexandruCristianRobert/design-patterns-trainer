import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { CompilerClient } from './CompilerClient'
import { deferredWorker } from './deferredWorker'
import { RunnerHost } from './RunnerHost'
import type { WorkerLike } from './workerRpc'

export type CompilerStatus = 'starting' | 'ready' | 'failed'

export interface Engine {
  compiler: CompilerClient
  runner: RunnerHost
}

interface CompilerContextValue extends Engine {
  status: CompilerStatus
  error?: string
}

const CompilerContext = createContext<CompilerContextValue | null>(null)

let defaultEngine: Engine | null = null

/**
 * One compiler and one runner per page: booting .NET is expensive, so the workers are created once
 * (lazily, outside React's render/effect lifecycle so StrictMode double-invocation doesn't spawn extras).
 * The literal `new Worker(new URL(...), { type: 'module' })` form is what lets Vite bundle the workers; the cast is
 * needed only because WorkerLike types onmessage/onerror more narrowly than the DOM.
 * The runner boots only after the compiler is ready, so its copy of the .NET bundle comes from the HTTP cache instead
 * of a second download running in parallel.
 */
function getDefaultEngine(): Engine {
  if (!defaultEngine) {
    const compiler = new CompilerClient(
      () => new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
    )
    const runner = new RunnerHost(() =>
      deferredWorker(
        compiler.ready,
        () => new Worker(new URL('./runner.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
      ),
    )
    defaultEngine = { compiler, runner }
  }
  return defaultEngine
}

export function CompilerProvider({ children, engine }: { children: ReactNode; engine?: Engine }) {
  const [current] = useState(() => engine ?? getDefaultEngine())
  const [state, setState] = useState<{ status: CompilerStatus; error?: string }>({ status: 'starting' })

  useEffect(() => {
    let active = true
    let failed = false
    const fail = (e: unknown) => {
      failed = true
      if (active) setState({ status: 'failed', error: e instanceof Error ? e.message : String(e) })
    }
    Promise.all([current.compiler.ready, current.runner.ready]).then(
      () => active && !failed && setState({ status: 'ready' }),
      fail,
    )
    // A compiler that dies later (worker error, runtime exit) is not restarted: surface it like a failed start.
    // (The runner recovers from its own crashes, see RunnerHost.)
    void current.compiler.failed.then(fail)
    return () => {
      active = false
    }
  }, [current])

  return <CompilerContext value={{ ...current, ...state }}>{children}</CompilerContext>
}

export function useCompiler(): { status: CompilerStatus; compiler: CompilerClient; runner: RunnerHost; error?: string } {
  const value = useContext(CompilerContext)
  if (!value) throw new Error('useCompiler must be used inside <CompilerProvider>')
  return value
}
