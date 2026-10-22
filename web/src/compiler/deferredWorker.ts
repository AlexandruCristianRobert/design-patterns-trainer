import type { FromWorker, ToWorker, WorkerLike } from './workerRpc'

/**
 * A WorkerLike whose real worker is created only once `gate` resolves; messages posted earlier are buffered.
 * Used to boot the runner after the compiler: both load the same .NET bundle, and starting the second download only
 * after the first finished lets it come from the HTTP cache instead of downloading everything twice in parallel.
 * If the gate rejects, the worker reports a bootError with the gate's message.
 */
export function deferredWorker(gate: Promise<unknown>, create: () => WorkerLike): WorkerLike {
  let real: WorkerLike | null = null
  let terminated = false
  const buffered: ToWorker[] = []

  const proxy: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage(m) {
      if (real) real.postMessage(m)
      else buffered.push(m)
    },
    terminate() {
      terminated = true
      real?.terminate()
    },
  }

  gate.then(
    () => {
      if (terminated) return
      real = create()
      real.onmessage = (e: { data: FromWorker }) => proxy.onmessage?.(e)
      real.onerror = (e) => proxy.onerror?.(e)
      for (const m of buffered.splice(0)) real.postMessage(m)
    },
    (e: unknown) => {
      if (terminated) return
      proxy.onmessage?.({ data: { type: 'bootError', message: e instanceof Error ? e.message : String(e) } })
    },
  )
  return proxy
}
