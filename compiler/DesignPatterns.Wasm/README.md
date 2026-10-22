# DesignPatterns.Wasm

The .NET 10 WebAssembly bundle that hosts Roslyn and the runner. JavaScript sees the exports as
`exports.DesignPatterns.Wasm.CompilerExports.{Compile, WarmUp}` and
`exports.DesignPatterns.Wasm.RunnerExports.{Load, RunMain, RunCheck}`. Every method takes and returns
protocol JSON (camelCase, see `core/DesignPatterns.Core/Protocol`).

## Publish

```sh
dotnet publish compiler/DesignPatterns.Wasm -c Release -p:PublishDir=../../web/public/dotnet/
```

Output: `web/public/dotnet/wwwroot/_framework/dotnet.js` (gitignored).

- Use `-p:PublishDir=...` (relative to this project folder), not `-o`. With SDK 10.0.300 and a repo path
  containing a space, `-o` makes MSBuild fail with `MSB1008: Only one project can be specified`.
- The `wasm-tools` workload is **not** required. Without it the SDK prints
  "Publishing without optimizations ... we strongly recommend using `wasm-tools` workload" and the
  bundle still works. No workload was installed.

## Smoke test (Node)

```sh
node compiler/DesignPatterns.Wasm/smoke.mjs
```

It boots the bundle under Node, then runs WarmUp, then compiles, loads and runs `Console.WriteLine("Hello from wasm");`.
Expected output ends with `"stdout":"Hello from wasm\n"` and `SMOKE OK`.

## Measurements (2026-10-22, Windows, Node 26, Release, no wasm-tools)

| What | Value |
| --- | --- |
| `du -sh wwwroot/_framework` (raw + `.br` + `.gz`) | 74M |
| Uncompressed files only | 48M |
| Brotli files only (what a browser downloads) | 11M |
| Runtime boot (`dotnet.create()`) under Node | ~120 ms |
| `WarmUp()` (first Roslyn compile + emit) | ~1.3–1.4 s |
| First `Compile` after warm-up (run purpose) | ~360–390 ms |

## WebAssembly notes

- The runtime is single-threaded, so Roslyn must compile with `concurrentBuild: false`. Otherwise the
  compile fails with `Cannot wait on monitors on this runtime` in `ClsComplianceChecker.WaitForWorkers`.
  `CSharpCompiler` sets this option.
- `PublishTrimmed=false`. Learner code and Roslyn need the untrimmed framework.
