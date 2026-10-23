import { describe, expect, it } from 'vitest'
import { CompilerClient, isSuperseded } from './CompilerClient'
import { FakeWorker } from './testing/FakeWorker'

describe('CompilerClient', () => {
  it('rejects ready and pending compiles on bootError', async () => {
    const w = new FakeWorker()
    const c = new CompilerClient(() => w)
    const pending = c.compile({ source: 'x', purpose: 'diagnostics' })
    w.emitBootError('no wasm')
    await expect(c.ready).rejects.toThrow('no wasm')
    await expect(pending).rejects.toThrow('no wasm')
    expect(w.terminated).toBe(true)
  })

  it('fails pending and later compiles and reports failed when the worker errors after ready', async () => {
    const w = new FakeWorker()
    const c = new CompilerClient(() => w)
    w.emitReady()
    await c.ready
    const pending = c.compile({ source: 'x', purpose: 'diagnostics' })
    await Promise.resolve()
    w.emitError('Uncaught RuntimeError: unreachable')
    await expect(pending).rejects.toThrow('Uncaught RuntimeError: unreachable')
    await expect(c.compile({ source: 'y', purpose: 'diagnostics' })).rejects.toThrow('unreachable')
    expect((await c.failed).message).toBe('Uncaught RuntimeError: unreachable')
    expect(w.terminated).toBe(true)
  })

  it('correlates out-of-order responses by id', async () => {
    const w = new FakeWorker()
    const c = new CompilerClient(() => w)
    w.emitReady()
    const p1 = c.compile({ source: 'a', purpose: 'run' })
    const p2 = c.compile({ source: 'b', purpose: 'run' })
    await c.ready
    await Promise.resolve()
    const [m1, m2] = w.posted
    expect(m1.method).toBe('compile')
    expect(JSON.parse(m1.payload).source).toBe('a')
    w.reply(m2.id, JSON.stringify({ success: true, diagnostics: [], contractViolations: [], assemblyBase64: 'B' }))
    w.reply(m1.id, JSON.stringify({ success: false, diagnostics: [], contractViolations: [] }))
    expect((await p1).success).toBe(false)
    expect((await p2).assemblyBase64).toBe('B')
  })

  it('rejects a compile when the worker reports an error', async () => {
    const w = new FakeWorker()
    const c = new CompilerClient(() => w)
    w.emitReady()
    const p = c.compile({ source: 'a', purpose: 'run' })
    await c.ready
    await Promise.resolve()
    w.replyError(w.posted[0].id, 'boom')
    await expect(p).rejects.toThrow('boom')
  })
})

describe('CompilerClient IDE methods', () => {
  async function ready() {
    const w = new FakeWorker()
    const c = new CompilerClient(() => w)
    w.emitReady()
    await c.ready
    return { w, c }
  }

  it('sends loadIde once, however often it is asked', async () => {
    const { w, c } = await ready()
    const a = c.loadIde()
    const b = c.loadIde()
    await Promise.resolve()
    expect(w.posted.map((m) => m.method)).toEqual(['loadIde'])
    w.reply(w.posted[0].id, 'ok')
    await Promise.all([a, b])
  })

  it('lets loadIde be retried after it failed', async () => {
    const { w, c } = await ready()
    const first = c.loadIde()
    await Promise.resolve()
    w.replyError(w.posted[0].id, 'fetch failed')
    await expect(first).rejects.toThrow('fetch failed')
    const second = c.loadIde()
    await Promise.resolve()
    expect(w.posted.map((m) => m.method)).toEqual(['loadIde', 'loadIde'])
    w.reply(w.posted[1].id, 'ok')
    await second
  })

  it('sends a position request and parses the answer', async () => {
    const { w, c } = await ready()
    const p = c.complete({ source: 'Console.', line: 1, column: 9 })
    await Promise.resolve()
    expect(w.last().method).toBe('complete')
    expect(JSON.parse(w.last().payload)).toEqual({ source: 'Console.', line: 1, column: 9 })
    const answer = { items: [{ label: 'WriteLine', kind: 'method', insertText: 'WriteLine' }], range: { startLine: 1, startColumn: 9, endLine: 1, endColumn: 9 } }
    w.reply(w.last().id, JSON.stringify(answer))
    expect(await p).toEqual(answer)
  })

  it('passes on the worker saying a request was superseded', async () => {
    const { w, c } = await ready()
    const p = c.hover({ source: 'x', line: 1, column: 1 })
    await Promise.resolve()
    w.reply(w.last().id, '{"superseded":true}')
    expect(isSuperseded(await p)).toBe(true)
  })

  it('drops an older result when a newer request of the same kind was sent', async () => {
    const { w, c } = await ready()
    const older = c.format({ source: 'a' })
    const newer = c.format({ source: 'b' })
    const hover = c.hover({ source: 'a', line: 1, column: 1 })
    await Promise.resolve()
    const [m1, m2, m3] = w.posted
    w.reply(m1.id, '{"text":"a"}') // the worker finished it before it saw the newer one
    w.reply(m2.id, '{"text":"b"}')
    w.reply(m3.id, 'null')
    expect(isSuperseded(await older)).toBe(true)
    expect(await newer).toEqual({ text: 'b' })
    expect(await hover).toBeNull()
  })
})
