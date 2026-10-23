import { vi, type Mock } from 'vitest'
import type { RunnerHost } from '../RunnerHost'

/**
 * A fake `RunnerHost.exclusive` that records whether a job is running, so a fake `load`/`runCheck`/`runMain` can
 * refuse calls made outside one.
 */
export function fakeExclusive() {
  const state = { inside: false }
  const impl: RunnerHost['exclusive'] = async (job) => {
    state.inside = true
    try {
      return await job()
    } finally {
      state.inside = false
    }
  }
  // vi.fn drops the generic signature; keep it so the fake satisfies Pick<RunnerHost, 'exclusive'>.
  const exclusive = vi.fn(impl) as Mock & RunnerHost['exclusive']
  const guard = (name: string) => {
    if (!state.inside) throw new Error(`${name} was called outside runner.exclusive`)
  }
  return { exclusive, guard, state }
}

/** The pass-through `exclusive` for fakes that don't care about the lock. */
export const passThroughExclusive: RunnerHost['exclusive'] = (job) => job()
