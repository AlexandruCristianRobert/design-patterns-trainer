import { describe, expect, it, vi } from 'vitest'
import type { IdeClient, IdeStatus } from './IdeClient'
import { registerIdeProviders } from './monacoProviders'
import { registerIdeProvidersWhenReady } from './registerOnce'

vi.mock('./monacoProviders', () => ({ registerIdeProviders: vi.fn() }))

function fakeClient(status: IdeStatus = 'off') {
  const listeners = new Set<() => void>()
  const c = {
    status,
    subscribe(l: () => void) {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    set(s: IdeStatus) {
      c.status = s
      for (const l of [...listeners]) l()
    },
    listeners,
  }
  return c
}

const asClient = (c: ReturnType<typeof fakeClient>) => c as unknown as IdeClient

describe('registerIdeProvidersWhenReady', () => {
  it('registers nothing while the IDE features are off, so Monaco shows no dead menu entries', () => {
    vi.mocked(registerIdeProviders).mockClear()
    const client = fakeClient()
    registerIdeProvidersWhenReady({ languages: {} } as never, asClient(client))
    client.set('loading')
    client.set('failed')
    expect(registerIdeProviders).not.toHaveBeenCalled()
  })

  it('registers exactly once on the first ready, however many editors are mounted', () => {
    vi.mocked(registerIdeProviders).mockClear()
    const monaco = { languages: {} } as never
    const client = fakeClient()
    registerIdeProvidersWhenReady(monaco, asClient(client))
    registerIdeProvidersWhenReady(monaco, asClient(client))
    registerIdeProvidersWhenReady(monaco, asClient(client))
    client.set('loading')
    client.set('ready')
    client.set('ready')
    registerIdeProvidersWhenReady(monaco, asClient(client)) // an editor mounted later
    expect(registerIdeProviders).toHaveBeenCalledTimes(1)
    expect(registerIdeProviders).toHaveBeenCalledWith(monaco, client)
    expect(client.listeners.size).toBe(0) // one-way: nobody listens once registered
  })

  it('registers at once for an editor mounted after the features are ready', () => {
    vi.mocked(registerIdeProviders).mockClear()
    const client = fakeClient('ready')
    registerIdeProvidersWhenReady({ languages: {} } as never, asClient(client))
    expect(registerIdeProviders).toHaveBeenCalledTimes(1)
  })

  it('stops listening when the editor unmounts before ready', () => {
    vi.mocked(registerIdeProviders).mockClear()
    const client = fakeClient()
    const stop = registerIdeProvidersWhenReady({ languages: {} } as never, asClient(client))
    stop()
    client.set('ready')
    expect(registerIdeProviders).not.toHaveBeenCalled()
  })
})
