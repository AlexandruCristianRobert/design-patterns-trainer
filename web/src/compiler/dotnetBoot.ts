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

export async function bootDotnet(): Promise<WasmExports> {
  const url = new URL(`${import.meta.env.BASE_URL}dotnet/wwwroot/_framework/dotnet.js`, self.location.origin).href
  const { dotnet } = await import(/* @vite-ignore */ url)
  const runtime = await dotnet.create()
  const exports = await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName)
  return exports.DesignPatterns.Wasm as WasmExports
}
