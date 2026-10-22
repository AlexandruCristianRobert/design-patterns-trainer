import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkResultOf, RunnerHost } from './RunnerHost'
import { FakeWorker } from './testing/FakeWorker'

const outcome = JSON.stringify({ stdout: 'hi', truncated: false, hasEntryPoint: true })
const loadReq = { assemblyBase64: 'QQ==', source: 'src' }
const loadRes = JSON.stringify({ checkIds: ['a', 'b'], hasEntryPoint: true })
const exitMessage = 'Program terminated with exit(1) (System.StackOverflowException)'

function setup(opts?: { recycleAfterLoads?: number }) {
  const workers: FakeWorker[] = []
  const host = new RunnerHost(() => {
    const w = new FakeWorker()
    workers.push(w)
    return w
  }, opts)
  return { workers, host }
}

/** Boots a respawned worker and answers the reload it receives first. */
async function bootAndReload(w: FakeWorker) {
  w.emitReady()
  await vi.advanceTimersByTimeAsync(0)
  expect(w.posted.map((m) => m.method)).toEqual(['load'])
  expect(JSON.parse(w.posted[0].payload)).toEqual(loadReq)
  w.reply(w.posted[0].id, loadRes)
  await vi.advanceTimersByTimeAsync(0)
}

async function loaded() {
  const s = setup()
  s.workers[0].emitReady()
  const lp = s.host.load(loadReq)
  await vi.advanceTimersByTimeAsync(0)
  s.workers[0].reply(s.workers[0].posted[0].id, loadRes)
  await lp
  return s
}

describe('RunnerHost crash recovery', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reports a runtime exit as crashed, respawns, reloads and runs the next call normally', async () => {
    const { workers, host } = await loaded()
    const p1 = host.runMain()
    await vi.advanceTimersByTimeAsync(0)
    workers[0].replyError(workers[0].last().id, exitMessage)
    expect(await p1).toEqual({ kind: 'crashed', message: exitMessage })
    expect(workers[0].terminated).toBe(true)
    expect(workers).toHaveLength(2)

    const p2 = host.runMain()
    await bootAndReload(workers[1])
    expect(workers[1].posted.map((m) => m.method)).toEqual(['load', 'runMain'])
    workers[1].reply(workers[1].last().id, outcome)
    expect(await p2).toEqual({ kind: 'ok', value: JSON.parse(outcome) })
  })

  it('keeps ordinary worker errors (not a runtime exit) as rejections without killing the worker', async () => {
    const { workers, host } = await loaded()
    const p = host.runMain()
    await vi.advanceTimersByTimeAsync(0)
    workers[0].replyError(workers[0].last().id, 'Unknown method: x')
    await expect(p).rejects.toThrow('Unknown method: x')
    expect(workers[0].terminated).toBe(false)
    expect(workers).toHaveLength(1)
  })

  it('treats the Worker error event as a crash', async () => {
    const { workers, host } = await loaded()
    const p = host.runCheck('a')
    await vi.advanceTimersByTimeAsync(0)
    workers[0].emitError('Uncaught RuntimeError: memory access out of bounds')
    expect(await p).toEqual({ kind: 'crashed', message: 'Uncaught RuntimeError: memory access out of bounds' })
    expect(workers[0].terminated).toBe(true)
    expect(workers).toHaveLength(2)
  })

  it('reports a boot failure of the respawned worker as crashed and recovers on the following call', async () => {
    const { workers, host } = await loaded()
    const p1 = host.runMain()
    await vi.advanceTimersByTimeAsync(0)
    workers[0].replyError(workers[0].last().id, exitMessage)
    await p1

    const p2 = host.runMain()
    workers[1].emitBootError('no wasm')
    expect(await p2).toEqual({ kind: 'crashed', message: 'no wasm' })
    expect(workers[1].terminated).toBe(true)
    expect(workers).toHaveLength(2) // no respawn loop: the next call spawns

    const p3 = host.runMain()
    expect(workers).toHaveLength(3)
    await bootAndReload(workers[2])
    workers[2].reply(workers[2].last().id, outcome)
    expect(await p3).toEqual({ kind: 'ok', value: JSON.parse(outcome) })
  })

  it('retries a request that was in flight on a worker killed by another request timing out', async () => {
    const { workers, host } = await loaded()
    const pa = host.runCheck('a')
    await vi.advanceTimersByTimeAsync(1000)
    const pb = host.runCheck('b')
    await vi.advanceTimersByTimeAsync(4000)
    expect(await pa).toEqual({ kind: 'timedOut' })

    await bootAndReload(workers[1])
    expect(workers[1].posted.map((m) => m.method)).toEqual(['load', 'runCheck'])
    expect(workers[1].last().payload).toBe('b')
    workers[1].reply(workers[1].last().id, JSON.stringify({ id: 'b', status: 'passed' }))
    expect(await pb).toEqual({ kind: 'ok', value: { id: 'b', status: 'passed' } })
  })

  it('sends a call made right after a timeout to the new worker (no microtask gap)', async () => {
    const { workers, host } = await loaded()
    const p1 = host.runMain()
    await vi.advanceTimersByTimeAsync(0)
    vi.advanceTimersByTime(5000) // synchronous: no microtasks run between the timeout and the next call
    const p2 = host.runMain()
    expect(await p1).toEqual({ kind: 'timedOut' })
    expect(workers[0].posted.map((m) => m.method)).toEqual(['load', 'runMain'])
    await bootAndReload(workers[1])
    workers[1].reply(workers[1].last().id, outcome)
    expect(await p2).toEqual({ kind: 'ok', value: JSON.parse(outcome) })
  })

  it('ignores a late reply from a terminated worker', async () => {
    const { workers, host } = await loaded()
    const p1 = host.runMain()
    await vi.advanceTimersByTimeAsync(5000)
    expect(await p1).toEqual({ kind: 'timedOut' })
    const p2 = host.runMain()
    workers[0].reply(workers[0].posted[1].id, outcome)
    workers[0].replyError(workers[0].posted[1].id, exitMessage)
    workers[0].emitError('late')
    await bootAndReload(workers[1])
    const fresh = JSON.stringify({ stdout: 'new', truncated: false, hasEntryPoint: true })
    workers[1].reply(workers[1].last().id, fresh)
    expect(await p2).toEqual({ kind: 'ok', value: JSON.parse(fresh) })
    expect(workers).toHaveLength(2)
  })

  it('exposes the current worker in ready after a respawn', async () => {
    const { workers, host } = await loaded()
    const p = host.runMain()
    await vi.advanceTimersByTimeAsync(5000)
    await p
    let ready = false
    void host.ready.then(() => (ready = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(ready).toBe(false)
    workers[1].emitReady()
    await vi.advanceTimersByTimeAsync(0)
    expect(ready).toBe(true)
  })

  it('postpones recycling while another request is in flight', async () => {
    const { workers, host } = setup({ recycleAfterLoads: 1 })
    workers[0].emitReady()
    const l1 = host.load(loadReq)
    await vi.advanceTimersByTimeAsync(0)
    workers[0].reply(workers[0].last().id, loadRes)
    await l1
    const run = host.runMain()
    await vi.advanceTimersByTimeAsync(0)
    const l2 = host.load(loadReq)
    expect(workers).toHaveLength(1)
    workers[0].reply(workers[0].posted[1].id, outcome)
    expect(await run).toEqual({ kind: 'ok', value: JSON.parse(outcome) })
    await vi.advanceTimersByTimeAsync(0)
    workers[0].reply(workers[0].last().id, loadRes)
    await l2
    const l3 = host.load(loadReq)
    expect(workers).toHaveLength(2)
    workers[1].emitReady()
    await vi.advanceTimersByTimeAsync(0)
    workers[1].reply(workers[1].last().id, loadRes)
    await l3
  })

  it('rejects a load that crashes the runtime without leaving a dead runner', async () => {
    const { workers, host } = setup()
    workers[0].emitReady()
    const lp = host.load(loadReq)
    await vi.advanceTimersByTimeAsync(0)
    workers[0].replyError(workers[0].last().id, exitMessage)
    await expect(lp).rejects.toThrow(exitMessage)
    expect(workers).toHaveLength(2)
    const p = host.runMain()
    await bootAndReload(workers[1])
    workers[1].reply(workers[1].last().id, outcome)
    expect(await p).toEqual({ kind: 'ok', value: JSON.parse(outcome) })
  })
})

describe('checkResultOf', () => {
  it('maps a crash to errored/threw with the exception type when known', () => {
    expect(checkResultOf('a', { kind: 'crashed', message: exitMessage })).toEqual({
      id: 'a',
      status: 'errored',
      reason: 'threw',
      args: { type: 'System.StackOverflowException' },
    })
    expect(checkResultOf('a', { kind: 'crashed', message: 'Program terminated with exit(1)' })).toEqual({
      id: 'a',
      status: 'errored',
      reason: 'threw',
      args: { type: 'crashed' },
    })
  })

  it('maps a timeout to timedOut and passes results through', () => {
    expect(checkResultOf('a', { kind: 'timedOut' })).toEqual({ id: 'a', status: 'timedOut', reason: 'timedOut' })
    expect(checkResultOf('a', { kind: 'ok', value: { id: 'a', status: 'passed' } })).toEqual({ id: 'a', status: 'passed' })
  })
})
