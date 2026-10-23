import { describe, expect, it, vi } from 'vitest'
import { loadIdeExports, type DotnetRuntime } from './dotnetBoot'
import { IDE_DOWNLOAD_FAILED } from './protocol'

// resources.lazyAssembly as the SDK 10.0.300 boot config lists it: an array of assets, sorted by name.
const lazyAssembly = [
  'DesignPatterns.Ide',
  'Humanizer',
  'Microsoft.CodeAnalysis.CSharp.Workspaces',
  'Microsoft.CodeAnalysis.Workspaces',
  'System.Composition.AttributedModel',
  'System.Composition.Convention',
  'System.Composition.Hosting',
  'System.Composition.Runtime',
  'System.Composition.TypedParts',
].map((n) => ({ virtualPath: `${n}.wasm`, name: `${n}.abcdef1234.wasm` }))

function fakeRuntime(lazy = lazyAssembly) {
  const ide = { WarmUp: vi.fn() }
  const runtime = {
    getConfig: () => ({ mainAssemblyName: 'DesignPatterns.Wasm', resources: { lazyAssembly: lazy } }),
    getAssemblyExports: vi.fn(async () => ({ DesignPatterns: { Ide: { IdeExports: ide } } })),
    INTERNAL: { loadLazyAssembly: vi.fn(async (_virtualPath: string) => true) },
  }
  return { runtime: runtime as unknown as DotnetRuntime & typeof runtime, ide }
}

describe('loadIdeExports', () => {
  it('loads the lazy assemblies dependencies first, then binds the DesignPatterns.Ide exports', async () => {
    const { runtime, ide } = fakeRuntime()
    expect(await loadIdeExports(runtime)).toBe(ide)
    expect(runtime.INTERNAL.loadLazyAssembly.mock.calls.map((c) => c[0])).toEqual([
      'Humanizer.wasm',
      'System.Composition.AttributedModel.wasm',
      'System.Composition.Convention.wasm',
      'System.Composition.Hosting.wasm',
      'System.Composition.Runtime.wasm',
      'System.Composition.TypedParts.wasm',
      'Microsoft.CodeAnalysis.Workspaces.wasm',
      'Microsoft.CodeAnalysis.CSharp.Workspaces.wasm',
      'DesignPatterns.Ide.wasm',
    ])
    expect(runtime.getAssemblyExports).toHaveBeenCalledWith('DesignPatterns.Ide')
  })

  it('refuses a lazy assembly it does not know the place of', async () => {
    const { runtime } = fakeRuntime([...lazyAssembly, { virtualPath: 'Extra.wasm', name: 'Extra.x.wasm' }])
    await expect(loadIdeExports(runtime)).rejects.toThrow('Extra.wasm')
    expect(runtime.INTERNAL.loadLazyAssembly).not.toHaveBeenCalled()
  })

  it('turns a failed lazy download into a clear message that says to reload', async () => {
    const { runtime } = fakeRuntime()
    runtime.INTERNAL.loadLazyAssembly.mockRejectedValueOnce(new Error("download 'Humanizer.x.wasm' failed 503 Service Unavailable"))
    const error = (await loadIdeExports(runtime).catch((e: unknown) => e)) as Error
    expect(error.message).toMatch(/^IDE features couldn't be downloaded; reload the page to try again./)
    expect(error.message).toContain('failed 503')
    expect(runtime.getAssemblyExports).not.toHaveBeenCalled()
  })

  it('fails with its own error, not a download failure, when the runtime has no loadLazyAssembly', async () => {
    const { runtime } = fakeRuntime()
    ;(runtime as { INTERNAL?: unknown }).INTERNAL = undefined
    const error = (await loadIdeExports(runtime).catch((e: unknown) => e)) as Error
    expect(error.message).toContain('runtime API changed')
    expect(error.message.startsWith(IDE_DOWNLOAD_FAILED)).toBe(false)
  })

  it('fails clearly when the bundle has no lazy assemblies', async () => {
    const { runtime } = fakeRuntime([])
    await expect(loadIdeExports(runtime)).rejects.toThrow('no lazy IDE assemblies')
  })
})
