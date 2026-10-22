import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { CompilerClient } from './CompilerClient'
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
 * needed only because WorkerLike types onmessage more narrowly than the DOM.
 */
function getDefaultEngine(): Engine {
  defaultEngine ??= {
    compiler: new CompilerClient(
      () => new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
    ),
    runner: new RunnerHost(
      () => new Worker(new URL('./runner.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
    ),
  }
  return defaultEngine
}

export function CompilerProvider({ children, engine }: { children: ReactNode; engine?: Engine }) {
  const [current] = useState(() => engine ?? getDefaultEngine())
  const [state, setState] = useState<{ status: CompilerStatus; error?: string }>({ status: 'starting' })

  useEffect(() => {
    let active = true
    Promise.all([current.compiler.ready, current.runner.ready]).then(
      () => active && setState({ status: 'ready' }),
      (e: unknown) => active && setState({ status: 'failed', error: e instanceof Error ? e.message : String(e) }),
    )
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
