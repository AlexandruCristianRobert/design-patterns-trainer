// The one place that knows where the published .NET bundle lives (see compiler/DesignPatterns.Wasm/README.md).
export interface CompilerExports {
  Compile(json: string): string
  WarmUp(): string
}
export interface RunnerExports {
  Load(json: string): string
  RunMain(): Promise<string>
  RunCheck(id: string): Promise<string>
}
export interface WasmExports {
  CompilerExports: CompilerExports
  RunnerExports: RunnerExports
}
/** `DesignPatterns.Ide.IdeExports`, bound only after the lazy IDE assemblies are loaded (ADR 0003). */
export interface IdeExports {
  WarmUp(): Promise<string>
  Complete(json: string, requestId: number): Promise<string>
  Hover(json: string, requestId: number): Promise<string>
  Definition(json: string, requestId: number): Promise<string>
  Format(json: string, requestId: number): Promise<string>
  Cancel(requestId: number): void
}

/** An entry of `resources.lazyAssembly` in the SDK 10.0.300 boot config. */
export interface LazyAssemblyAsset {
  /** Unfingerprinted, e.g. `Humanizer.wasm`; what `loadLazyAssembly` takes. */
  virtualPath: string
  /** The fingerprinted file, e.g. `Humanizer.oqup3v7t3k.wasm`. */
  name: string
}

/** The part of the .NET runtime API the workers use. */
export interface DotnetRuntime {
  getConfig(): { mainAssemblyName: string; resources?: { lazyAssembly?: LazyAssemblyAsset[] } }
  getAssemblyExports(assemblyName: string): Promise<unknown>
  /** Internal API, the one Blazor's LazyAssemblyLoader uses; pinned by the SDK version (ADR 0003). */
  INTERNAL: { loadLazyAssembly(virtualPath: string): Promise<boolean> }
}

export interface DotnetBoot {
  wasm: WasmExports
  runtime: DotnetRuntime
}

export async function bootDotnet(): Promise<DotnetBoot> {
  const url = new URL(`${import.meta.env.BASE_URL}dotnet/wwwroot/_framework/dotnet.js`, self.location.origin).href
  const { dotnet } = await import(/* @vite-ignore */ url)
  const runtime = (await dotnet.create()) as DotnetRuntime
  const exports = (await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName)) as {
    DesignPatterns: { Wasm: WasmExports }
  }
  return { wasm: exports.DesignPatterns.Wasm, runtime }
}

/**
 * The lazy IDE assemblies in dependency order. The boot config lists them by name, and the runtime loads each one as
 * it is fetched, so a dependency must come first.
 */
const IDE_LOAD_ORDER = [
  'Humanizer',
  'System.Composition.AttributedModel',
  'System.Composition.Convention',
  'System.Composition.Hosting',
  'System.Composition.Runtime',
  'System.Composition.TypedParts',
  'Microsoft.CodeAnalysis.Workspaces',
  'Microsoft.CodeAnalysis.CSharp.Workspaces',
  'DesignPatterns.Ide',
].map((n) => `${n}.wasm`)

export const IDE_DOWNLOAD_FAILED = "IDE features couldn't be downloaded; reload the page to try again."

/** Fetches and loads the lazy IDE assemblies (compiler worker only), then binds their exports. */
export async function loadIdeExports(runtime: DotnetRuntime): Promise<IdeExports> {
  const lazy = runtime.getConfig().resources?.lazyAssembly ?? []
  if (lazy.length === 0) throw new Error('The .NET bundle has no lazy IDE assemblies; republish it with npm run build:dotnet.')
  const unknown = lazy.filter((a) => !IDE_LOAD_ORDER.includes(a.virtualPath))
  if (unknown.length > 0) {
    throw new Error(`Unknown lazy assembly ${unknown.map((a) => a.virtualPath).join(', ')}: add it to IDE_LOAD_ORDER.`)
  }
  const ordered = [...lazy].sort((a, b) => IDE_LOAD_ORDER.indexOf(a.virtualPath) - IDE_LOAD_ORDER.indexOf(b.virtualPath))
  try {
    for (const asset of ordered) await runtime.INTERNAL.loadLazyAssembly(asset.virtualPath)
  } catch (e) {
    // The runtime already retried the download. It has also marked the assembly as loaded, so it cannot be fetched
    // again in this worker: only a fresh page (a new worker) can try again.
    throw new Error(`${IDE_DOWNLOAD_FAILED} (${e instanceof Error ? e.message : String(e)})`)
  }
  const exports = (await runtime.getAssemblyExports('DesignPatterns.Ide')) as {
    DesignPatterns: { Ide: { IdeExports: IdeExports } }
  }
  return exports.DesignPatterns.Ide.IdeExports
}
