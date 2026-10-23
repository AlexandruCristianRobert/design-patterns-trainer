import { describe, expect, it, vi } from 'vitest'
import type { IdeExports } from './dotnetBoot'
import { CompilerClient } from './CompilerClient'
import { IdeHost } from './ideHost'
import { IDE_DOWNLOAD_FAILED } from './protocol'
import type { FromWorker, ToWorker, WorkerLike } from './workerRpc'

/** Fake IDE exports whose calls stay pending until the test settles them. */
function fakeExports() {
  const calls: { method: string; json: string; id: number; resolve(r: string): void; reject(e: Error): void }[] = []
  const call = (method: string) =>
    vi.fn((json: string, id: number) => new Promise<string>((resolve, reject) => calls.push({ method, json, id, resolve, reject })))
  const exports = {
    WarmUp: vi.fn(async () => 'ok'),
    Complete: call('Complete'),
    Hover: call('Hover'),
    Definition: call('Definition'),
    Format: call('Format'),
    Cancel: vi.fn(),
  } satisfies IdeExports
  return { exports, calls }
}

/** A host whose "yield to the event loop" step is controlled by the test. */
function setup() {
  const { exports, calls } = fakeExports()
  const load = vi.fn(async () => exports)
  const turns: (() => void)[] = []
  const host = new IdeHost(load, () => new Promise<void>((r) => turns.push(r)))
  const nextTurn = async () => {
    for (const t of turns.splice(0)) t()
    await new Promise((r) => setTimeout(r, 0))
  }
  return { host, load, exports, calls, nextTurn }
}

const req = (column: number) => JSON.stringify({ source: 'Console.', line: 1, column })

describe('IdeHost', () => {
  it('loads the IDE assemblies and warms up once, however often loadIde is sent', async () => {
    const { host, load, exports } = setup()
    await Promise.all([host.handle('loadIde', '', 1), host.handle('loadIde', '', 2)])
    await host.handle('loadIde', '', 3)
    expect(load).toHaveBeenCalledTimes(1)
    expect(exports.WarmUp).toHaveBeenCalledTimes(1)
  })

  it('keeps a failed download failed: the runtime cannot re-fetch a lazy assembly, so it says to reload', async () => {
    const load = vi.fn().mockRejectedValue(new Error(`${IDE_DOWNLOAD_FAILED} (503)`))
    const host = new IdeHost(load, async () => {})
    await expect(host.handle('loadIde', '', 1)).rejects.toThrow('reload the page')
    await expect(host.handle('loadIde', '', 2)).rejects.toThrow('reload the page')
    expect(load).toHaveBeenCalledTimes(1)
    await expect(host.handle('complete', req(1), 3)).rejects.toThrow('IDE features are not loaded')
  })

  it('retries any other failure, and binds the exports only once', async () => {
    const { exports } = fakeExports()
    exports.WarmUp.mockRejectedValueOnce(new Error('warm-up broke'))
    const load = vi.fn(async () => exports)
    const host = new IdeHost(load, async () => {})
    await expect(host.handle('loadIde', '', 1)).rejects.toThrow('warm-up broke')
    await expect(host.handle('loadIde', '', 2)).resolves.toBe('ok')
    expect(load).toHaveBeenCalledTimes(1)
    expect(exports.WarmUp).toHaveBeenCalledTimes(2)
  })

  it('retries a load that failed before the exports were bound', async () => {
    const { exports } = fakeExports()
    const load = vi.fn().mockRejectedValueOnce(new Error('runtime API changed')).mockResolvedValue(exports)
    const host = new IdeHost(load, async () => {})
    await expect(host.handle('loadIde', '', 1)).rejects.toThrow('runtime API changed')
    await expect(host.handle('loadIde', '', 2)).resolves.toBe('ok')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('rejects IDE calls made before loadIde with a clear error', async () => {
    const { host } = setup()
    await expect(host.handle('complete', req(9), 1)).rejects.toThrow('IDE features are not loaded')
    await expect(host.handle('format', '{"source":""}', 2)).rejects.toThrow('IDE features are not loaded')
  })

  it('passes the payload and request id to the export and returns its JSON', async () => {
    const { host, calls, nextTurn } = setup()
    await host.handle('loadIde', '', 1)
    const p = host.handle('hover', req(3), 7)
    await nextTurn()
    expect(calls).toMatchObject([{ method: 'Hover', json: req(3), id: 7 }])
    calls[0].resolve('{"markdown":"x"}')
    await expect(p).resolves.toBe('{"markdown":"x"}')
  })

  it('drops an older request that a newer one of the same kind replaced before it started', async () => {
    const { host, calls, nextTurn } = setup()
    await host.handle('loadIde', '', 1)
    const older = host.handle('complete', req(1), 2)
    const newer = host.handle('complete', req(2), 3)
    await nextTurn()
    await expect(older).resolves.toBe('{"superseded":true}')
    expect(calls.map((c) => c.id)).toEqual([3])
    calls[0].resolve('{"items":[]}')
    await expect(newer).resolves.toBe('{"items":[]}')
  })

  it('cancels a running older request and answers superseded for it', async () => {
    const { host, exports, calls, nextTurn } = setup()
    await host.handle('loadIde', '', 1)
    const older = host.handle('complete', req(1), 2)
    await nextTurn()
    const newer = host.handle('complete', req(2), 3)
    expect(exports.Cancel).toHaveBeenCalledWith(2)
    calls[0].resolve('{"cancelled":true}') // .NET saw the cancellation
    await expect(older).resolves.toBe('{"superseded":true,"cancelled":true}')
    await nextTurn()
    calls[1].resolve('{"items":[]}')
    await expect(newer).resolves.toBe('{"items":[]}')
  })

  it('drops the result of an older request that finished after a newer one arrived', async () => {
    const { host, calls, nextTurn } = setup()
    await host.handle('loadIde', '', 1)
    const older = host.handle('format', '{"source":"a"}', 2)
    await nextTurn()
    void host.handle('format', '{"source":"b"}', 3)
    calls[0].resolve('{"text":"a"}') // the cancel did not land: the call had no await in between
    await expect(older).resolves.toBe('{"superseded":true}')
  })

  it('answers superseded, not an error, for an older request that fails after a newer one arrived', async () => {
    const { host, calls, nextTurn } = setup()
    await host.handle('loadIde', '', 1)
    const older = host.handle('hover', req(1), 2)
    await nextTurn()
    const newer = host.handle('hover', req(2), 3)
    calls[0].reject(new Error('boom'))
    await expect(older).resolves.toBe('{"superseded":true}')
    await nextTurn()
    calls[1].reject(new Error('boom too'))
    await expect(newer).rejects.toThrow('boom too') // the latest request still reports its error
  })

  it('does not let requests of different kinds supersede each other', async () => {
    const { host, exports, calls, nextTurn } = setup()
    await host.handle('loadIde', '', 1)
    const completion = host.handle('complete', req(1), 2)
    const hover = host.handle('hover', req(1), 3)
    await nextTurn()
    expect(exports.Cancel).not.toHaveBeenCalled()
    calls[0].resolve('{"items":[]}')
    calls[1].resolve('null')
    await expect(completion).resolves.toBe('{"items":[]}')
    await expect(hover).resolves.toBe('null')
  })

  it('knows which methods are its own', () => {
    const { host } = setup()
    expect(['loadIde', 'complete', 'hover', 'definition', 'format'].every((m) => host.handles(m))).toBe(true)
    expect(host.handles('compile')).toBe(false)
  })
})

/** A WorkerLike that runs an IdeHost in-process, the way compiler.worker.ts does. */
function hostWorker(host: IdeHost): WorkerLike {
  const w: WorkerLike = {
    onmessage: null,
    onerror: null,
    terminate() {},
    postMessage({ id, method, payload }: ToWorker) {
      const send = (m: FromWorker) => w.onmessage?.({ data: m })
      host.handle(method, payload, id).then(
        (result) => send({ type: 'result', id, ok: true, result }),
        (e: Error) => send({ type: 'result', id, ok: false, error: e.message }),
      )
    },
  }
  queueMicrotask(() => w.onmessage?.({ data: { type: 'ready' } }))
  return w
}

describe('IdeHost behind CompilerClient', () => {
  it('lets Try again succeed after a WarmUp failure', async () => {
    const { exports } = fakeExports()
    exports.WarmUp.mockRejectedValueOnce(new Error('warm-up broke'))
    const client = new CompilerClient(() => hostWorker(new IdeHost(async () => exports, async () => {})))
    await expect(client.loadIde()).rejects.toThrow('warm-up broke')
    await expect(client.loadIde()).resolves.toBeUndefined()
    expect(exports.WarmUp).toHaveBeenCalledTimes(2)
  })

  it('keeps a download failure failed across retries', async () => {
    const load = vi.fn().mockRejectedValue(new Error(`${IDE_DOWNLOAD_FAILED} (503)`))
    const client = new CompilerClient(() => hostWorker(new IdeHost(load, async () => {})))
    await expect(client.loadIde()).rejects.toThrow(IDE_DOWNLOAD_FAILED)
    await expect(client.loadIde()).rejects.toThrow(IDE_DOWNLOAD_FAILED)
    expect(load).toHaveBeenCalledTimes(1)
  })
})
