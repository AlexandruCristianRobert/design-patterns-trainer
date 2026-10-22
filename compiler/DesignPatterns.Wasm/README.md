# DesignPatterns.Wasm

The .NET 10 WebAssembly bundle that hosts Roslyn and the runner. JavaScript sees the exports as
`exports.DesignPatterns.Wasm.CompilerExports.{Compile, WarmUp}` and
`exports.DesignPatterns.Wasm.RunnerExports.{Load, RunMain, RunCheck}`. Every method takes and returns
protocol JSON (camelCase, see `core/DesignPatterns.Core/Protocol`).

## Publish

```sh
cd web && npm run build:dotnet      # runs web/scripts/publish-dotnet.mjs
```

The script publishes into `compiler/DesignPatterns.Wasm/bin/publish-staging/`, then copies only
`wwwroot/_framework` (without the `.br`/`.gz` twins, which a static host does not negotiate) to
`web/public/dotnet/wwwroot/_framework/` (gitignored). `web.config`, `*.staticwebassets.endpoints.json`
and the other root-level publish files are not needed by the browser loader and are left out.
`SatelliteResourceLanguages=en` keeps Roslyn's localized resource folders out of the bundle.

- The script passes `-p:PublishDir=...` (relative to this project folder), not `-o`. With SDK 10.0.300 and a repo
  path containing a space, `-o` makes MSBuild fail with `MSB1008: Only one project can be specified`.
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
| `web/public/dotnet` after `build:dotnet` (182 files, uncompressed only) | 40.0 MB (39,969,863 B) |
| Same files as Brotli (not shipped; what a Brotli-serving host would send) | 11.0 MB |
| Before trimming (all publish output incl. `.br`/`.gz`, culture folders and root files; 658 files) | 77.9 MB |
| Runtime boot (`dotnet.create()`) under Node | ~120 ms |
| `WarmUp()` (first Roslyn compile + emit) | ~1.3 s |
| First `Compile` after warm-up (run purpose) | ~380 ms |

## WebAssembly notes

- The runtime is single-threaded, so Roslyn must compile with `concurrentBuild: false`. Otherwise the
  compile fails with `Cannot wait on monitors on this runtime` in `ClsComplianceChecker.WaitForWorkers`.
  `CSharpCompiler` sets this option.
- `PublishTrimmed=false`. Learner code and Roslyn need the untrimmed framework.
