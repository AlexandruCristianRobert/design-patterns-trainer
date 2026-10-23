import { describe, expect, it, vi } from 'vitest'
import { createIdeClient } from './IdeClient'

const range = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }
const compiler = (over: Record<string, unknown> = {}) =>
  ({
    loadIde: vi.fn(async () => {}),
    complete: vi.fn(async () => ({ items: [], range })),
    hover: vi.fn(async () => null),
    definition: vi.fn(async () => null),
    format: vi.fn(async () => ({ text: 'ok' })),
    ...over,
  }) as never

describe('createIdeClient', () => {
  it('goes off -> loading -> ready and notifies subscribers', async () => {
    const c = createIdeClient(compiler())
    const seen: string[] = []
    c.subscribe(() => seen.push(c.status))
    expect(c.status).toBe('off')
    await c.load()
    expect(seen).toEqual(['loading', 'ready'])
  })

  it('reports failure and allows a retry', async () => {
    const loadIde = vi.fn().mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce(undefined)
    const c = createIdeClient(compiler({ loadIde }))
    await expect(c.load()).rejects.toThrow('net')
    expect(c.status).toBe('failed')
    expect(c.error?.message).toBe('net')
    await c.load()
    expect(c.status).toBe('ready')
  })

  it('maps superseded and aborted results to null, and format to the input', async () => {
    const c = createIdeClient(
      compiler({ complete: vi.fn(async () => ({ superseded: true })), format: vi.fn(async () => ({ superseded: true })) }),
    )
    expect(await c.complete('s', 1, 1, new AbortController().signal)).toBeNull()
    expect(await c.format('src')).toBe('src')
    const ac = new AbortController()
    ac.abort()
    expect(await createIdeClient(compiler()).complete('s', 1, 1, ac.signal)).toBeNull()
  })
})
