import { describe, expect, it } from 'vitest'
import { deferredWorker } from './deferredWorker'
import { FakeWorker } from './testing/FakeWorker'
import { WorkerChannel } from './workerRpc'

function gate() {
  let open!: () => void
  let fail!: (e: Error) => void
  const promise = new Promise<void>((res, rej) => {
    open = res
    fail = rej
  })
  return { promise, open, fail }
}

describe('deferredWorker', () => {
  it('creates the real worker only after the gate opens, then forwards both ways', async () => {
    const g = gate()
    const created: FakeWorker[] = []
    const channel = new WorkerChannel(deferredWorker(g.promise, () => {
      const w = new FakeWorker()
      created.push(w)
      return w
    }))
    const call = channel.call('load', 'x')
    await Promise.resolve()
    expect(created).toHaveLength(0)

    g.open()
    await g.promise
    await Promise.resolve()
    expect(created).toHaveLength(1)
    created[0].emitReady()
    await channel.ready
    await Promise.resolve()
    created[0].reply(created[0].posted[0].id, 'done')
    expect(await call).toBe('done')

    created[0].emitError('boom')
    expect((await channel.failed).message).toBe('boom')
    expect(created[0].terminated).toBe(true)
  })

  it('reports a boot error when the gate fails, and never creates a terminated worker', async () => {
    const g = gate()
    let createdCount = 0
    const channel = new WorkerChannel(deferredWorker(g.promise, () => {
      createdCount++
      return new FakeWorker()
    }))
    g.fail(new Error('compiler down'))
    await expect(channel.ready).rejects.toThrow('compiler down')

    const g2 = gate()
    const w = deferredWorker(g2.promise, () => {
      createdCount++
      return new FakeWorker()
    })
    w.terminate()
    g2.open()
    await g2.promise
    await Promise.resolve()
    expect(createdCount).toBe(0)
  })
})
