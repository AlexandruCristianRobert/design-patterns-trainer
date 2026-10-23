import type { CompilerClient } from '../../compiler/CompilerClient'
import { isSuperseded } from '../../compiler/CompilerClient'
import type { IdeCompletion, IdeDefinition, IdeHover, Superseded } from '../../compiler/protocol'

export type IdeStatus = 'off' | 'loading' | 'ready' | 'failed'
export type CompletionResult = IdeCompletion
export type HoverResult = IdeHover
export type DefinitionResult = IdeDefinition

/** What the Monaco providers and the React layer see of the IDE features; positions are 1-based. */
export interface IdeClient {
  readonly status: IdeStatus
  /** The last load failure, if status is 'failed'. */
  readonly error: Error | null
  /** Calls the listener whenever status changes; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void
  load(): Promise<void>
  complete(source: string, line: number, column: number, signal: AbortSignal): Promise<CompletionResult | null>
  hover(source: string, line: number, column: number, signal: AbortSignal): Promise<HoverResult | null>
  definition(source: string, line: number, column: number, signal: AbortSignal): Promise<DefinitionResult | null>
  /** Resolves with the formatted source; the input unchanged if the request was superseded. */
  format(source: string): Promise<string>
}

type Compiler = Pick<CompilerClient, 'loadIde' | 'complete' | 'hover' | 'definition' | 'format'>

/** Wraps the compiler worker's IDE methods. Create one per app and share it (the React layer provides it). */
export function createIdeClient(compiler: Compiler): IdeClient {
  let status: IdeStatus = 'off'
  let error: Error | null = null
  let loading: Promise<void> | null = null
  const listeners = new Set<() => void>()
  const set = (s: IdeStatus) => {
    status = s
    for (const l of [...listeners]) l()
  }

  // A cancelled or superseded request is null, never an error.
  const run = async <T>(call: () => Promise<T | Superseded | null>, signal: AbortSignal): Promise<T | null> => {
    if (signal.aborted) return null
    const result = await call()
    return signal.aborted || isSuperseded(result) ? null : result
  }

  return {
    get status() {
      return status
    },
    get error() {
      return error
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    load() {
      if (status === 'ready') return Promise.resolve()
      loading ??= (async () => {
        error = null
        set('loading')
        try {
          await compiler.loadIde()
          set('ready')
        } catch (e) {
          error = e instanceof Error ? e : new Error(String(e))
          loading = null
          set('failed')
          throw error
        }
      })()
      return loading
    },
    complete: (source, line, column, signal) => run(() => compiler.complete({ source, line, column }), signal),
    hover: (source, line, column, signal) => run(() => compiler.hover({ source, line, column }), signal),
    definition: (source, line, column, signal) => run(() => compiler.definition({ source, line, column }), signal),
    async format(source) {
      const result = await compiler.format({ source })
      return isSuperseded(result) ? source : result.text
    },
  }
}
