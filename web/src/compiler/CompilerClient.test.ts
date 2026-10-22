import { describe, expect, it } from 'vitest'
import { CompilerClient } from './CompilerClient'
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
