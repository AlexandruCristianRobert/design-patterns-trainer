import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RunnerHost } from './RunnerHost'
import { FakeWorker } from './testing/FakeWorker'

const outcome = JSON.stringify({ stdout: 'hi', truncated: false, hasEntryPoint: true })
const loadReq = { assemblyBase64: 'QQ==', source: 'src' }
const loadRes = JSON.stringify({ checkIds: ['a', 'b'], hasEntryPoint: true })

function setup() {
  const workers: FakeWorker[] = []
  const host = new RunnerHost(() => {
    const w = new FakeWorker()
    workers.push(w)
    return w
  })
  return { workers, host }
}

describe('RunnerHost', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('times out runMain after 5000 ms, terminates and respawns the worker', async () => {
    const { workers, host } = setup()
    workers[0].emitReady()
    await host.ready
    const p = host.runMain()
    await vi.advanceTimersByTimeAsync(5000)
    expect(await p).toEqual({ kind: 'timedOut' })
    expect(workers[0].terminated).toBe(true)
    expect(workers).toHaveLength(2)
  })

  it('does not start the timeout before the worker is ready', async () => {
    const { workers, host } = setup()
    const p = host.runMain()
    await vi.advanceTimersByTimeAsync(6000)
    workers[0].emitReady()
    await vi.advanceTimersByTimeAsync(0)
    const m = workers[0].posted[0]
    expect(m.method).toBe('runMain')
    workers[0].reply(m.id, outcome)
    expect(await p).toEqual({ kind: 'ok', value: JSON.parse(outcome) })
    expect(workers[0].terminated).toBe(false)
  })

  it('reloads the remembered program before the next check after a timeout', async () => {
    const { workers, host } = setup()
    workers[0].emitReady()
    const lp = host.load(loadReq)
    await vi.advanceTimersByTimeAsync(0)
    workers[0].reply(workers[0].posted[0].id, loadRes)
    expect(await lp).toEqual({ checkIds: ['a', 'b'], hasEntryPoint: true })

    const p1 = host.runCheck('a')
    await vi.advanceTimersByTimeAsync(5000)
    expect(await p1).toEqual({ kind: 'timedOut' })

    const p2 = host.runCheck('b')
    workers[1].emitReady()
    await vi.advanceTimersByTimeAsync(0)
    expect(workers[1].posted.map((m) => m.method)).toEqual(['load'])
    expect(JSON.parse(workers[1].posted[0].payload)).toEqual(loadReq)
    workers[1].reply(workers[1].posted[0].id, loadRes)
    await vi.advanceTimersByTimeAsync(0)
    expect(workers[1].posted.map((m) => m.method)).toEqual(['load', 'runCheck'])
    expect(workers[1].posted[1].payload).toBe('b')
    workers[1].reply(workers[1].posted[1].id, JSON.stringify({ id: 'b', status: 'passed' }))
    expect(await p2).toEqual({ kind: 'ok', value: { id: 'b', status: 'passed' } })
  })

  it('recycles the worker before the 51st load', async () => {
    const { workers, host } = setup()
    workers[0].emitReady()
    for (let i = 0; i < 50; i++) {
      const p = host.load(loadReq)
      await vi.advanceTimersByTimeAsync(0)
      const w = workers[0]
      w.reply(w.posted[w.posted.length - 1].id, loadRes)
      await p
    }
    expect(workers).toHaveLength(1)
    const p = host.load(loadReq)
    expect(workers).toHaveLength(2)
    expect(workers[0].terminated).toBe(true)
    workers[1].emitReady()
    await vi.advanceTimersByTimeAsync(0)
    workers[1].reply(workers[1].posted[0].id, loadRes)
    await p
  })
})
