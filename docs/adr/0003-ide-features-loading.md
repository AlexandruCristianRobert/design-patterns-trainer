# IDE features are lazy-loaded Workspaces assemblies in the compiler worker

IDE features (spec §11: completion, hover, in-file go-to-definition, format document) need `Microsoft.CodeAnalysis.CSharp.Workspaces`, which the default bundle does not ship. We publish Workspaces 5.0.0 and its dependencies, plus a small `DesignPatterns.Ide` assembly, in the existing `DesignPatterns.Wasm` bundle, marked with the SDK's `BlazorWebAssemblyLazyLoad` item. The compiler worker fetches them only when the learner opts in, with `runtime.INTERNAL.loadLazyAssembly`. This is approach **A**. No second bundle or worker is needed. We use only the Workspaces-level APIs. `Microsoft.CodeAnalysis.Features` is not used.

The decision rests on a spike (M5 Task 1, 2026-10-23). It ran in headless Chromium (Playwright), on Windows, on the spike machine, against the Release publish served by the **Vite dev server** (`npx vite --port 5299 --strictPort`, not `vite preview`). That server sends the files uncompressed, so the bytes on the wire equal the raw size, and the gzip and Brotli figures below were computed with Node zlib. The probe was a 150-line top-level-statements file. Every call was made with the text slightly changed, so the timings are not cache hits. There were 30 calls per API (15 for format), and the first call is reported separately.

## Measurements

| What | Default bundle | With lazy IDE items |
| --- | --- | --- |
| Files fetched at boot | 184 requests (182 `_framework` files) | 184 requests (unchanged) |
| Boot bytes | 39,975,864 B | 39,978,119 B (+2,255 B, +0.006%: the boot config inside `dotnet.js` lists the lazy resources) |
| Boot to ready (`dotnet.create` + `WarmUp`), 3 runs | 1955 / 2053 / 1957 ms | 1980 / 2026 / 2059 ms |
| Extra download on opt-in (9 files) | — | 5,698,497 B raw, 2,119,498 B gzip-9, 1,668,472 B Brotli-11 |
| Load: fetch + `loadLazyAssembly` of the 9 files (localhost) | — | 363 ms |
| `Init`: MEF host 149 ms, `AdhocWorkspace` 97 ms, solution 74 ms | — | 323 ms |

**What the boot numbers support:** bytes grow by 0.006%. Boot time is not distinguishable from noise at n=3. One further baseline run read 1599 ms; it was excluded as a likely warm-cache outlier. Run-to-run variance (about ±50 ms) is larger than the 2% budget, so the timings cannot prove the budget either way. The real invariant is that no IDE assembly is requested at default boot. Task 3's e2e checks it.

**Expected time to ready after opt-in:** at most about 2.25 s on localhost, from the spike's parts: the load (363 ms), plus `Init` (323 ms), plus the cold first completion and format (859 + 702 ms); 363 + 323 + 859 + 702 = 2,247 ms. Network time on a real host comes on top. **Measured in Task 3** (e2e `ide.spec.ts`, Vite dev server, localhost): `loadIde` end to end, which is fetch + `loadLazyAssembly` ×9 + `WarmUp` (workspace setup plus one completion and one format on a 3-line sample), took **1,238 ms**. That is less than the sum because the warm-up file is small, so its cold calls are cheaper than the spike's 150-line ones.

The largest lazy files are `Microsoft.CodeAnalysis.Workspaces` (4.2 MB raw, 1.17 MB br), `Microsoft.CodeAnalysis.CSharp.Workspaces` (0.93 MB) and `Humanizer` (0.35 MB). The 5 `System.Composition.*` files and `DesignPatterns.Ide` total under 0.2 MB.

| API, warm (150-line file) | first call | p50 | p95 | Target |
| --- | --- | --- | --- | --- |
| `Recommender.GetRecommendedSymbolsAtPositionAsync`, member access (`notifier.`) | 859 ms | 120 ms | 150 ms | ≤ 300 ms p95 |
| Same, top-level statement position (583 symbols) | — | 104 ms | 111 ms | ≤ 300 ms p95 |
| `SemanticModel.LookupSymbols`, no workspace (for comparison) | 120 ms | 112 ms | 123 ms | — |
| Hover (`GetSymbolInfo` / `GetDeclaredSymbol` + `ToDisplayString`) | 93 ms | 88 ms | 104 ms | ≤ 200 ms |
| Definition (same lookup + `ISymbol.Locations`) | 86 ms | 88 ms | 104 ms | — |
| `Formatter.FormatAsync(Document)` | 702 ms | 337 ms | 426 ms | ≤ 500 ms |
| `SyntaxNode.NormalizeWhitespace()` (for comparison) | 212 ms | 144 ms | 178 ms | — |

All calls ran single-threaded. None hit "Cannot wait on monitors", provided the async exports are returned to JS as `Task<string>` (a Promise) and never blocked on.

## API set

- **Host:** `MefHostServices.Create([typeof(Workspace).Assembly, typeof(CSharpFormattingOptions).Assembly])`. MEF composition by reflection works in the browser.
- **Workspace:** `new AdhocWorkspace(host)`, and one project built with:
  - `CSharpCompilationOptions(ConsoleApplication)` with `NullableContextOptions.Enable` and `WithConcurrentBuild(false)`
  - `CSharpParseOptions(LanguageVersion.CSharp14)`
  - `Basic.Reference.Assemblies.Net100.References.All`
  - a `GlobalUsings.g.cs` document plus `user.cs`

  Each request uses `Solution.WithDocumentText` on a held `Solution`. Changes are never applied to the workspace.
- **Completion:** `Recommender.GetRecommendedSymbolsAtPositionAsync(Document, int)`.
- **Hover:** walk up from `root.FindToken(pos)`, taking `GetSymbolInfo(node).Symbol ?? GetDeclaredSymbol(node)`. Show it with `ToDisplayString(SymbolDisplayFormat.MinimallyQualifiedFormat)` and `GetDocumentationCommentXml()`.
- **Definition:** the same symbol's `Locations`, filtered to `IsInSource` in `user.cs`.
- **Format:** `Formatter.FormatAsync(Document)`, then `GetTextAsync()`.

## Considered Options

- **B: a second bundle and a dedicated IDE worker.** Not needed, because lazy loading into the compiler worker works. B would also cost a third in-memory runtime plus a second copy of Roslyn and the reference assemblies (about 11 MB br). Not built.
- **Workspace-free, `SemanticModel`-only.** `LookupSymbols` completion works with similar latency, and hover and definition need no workspace. Formatting does not work this way: `Formatter` needs workspace services. The only workspace-free formatter is `NormalizeWhitespace()`, and it rewrites the learner's layout. It expands one-line initializers and bodies, reflows the learner's own line breaks, and defaults to CRLF. It is rejected for "Format document". Since Workspaces is needed for `Formatter` anyway, `Recommender` is used for completion. It handles more contexts than a hand-written `LookupSymbols` dispatch.
- **`Microsoft.CodeAnalysis.Features`.** Not attempted: Workspaces-only suffices. It is not in the local package cache, and it would bring keywords, snippets and Quick Info formatting. It is much larger and MEF-heavy (ruling 1).

## Consequences

- **Build changes for Task 3:**
  - Add a library project, `DesignPatterns.Ide` (net10.0, `AllowUnsafeBlocks`), and add it to `DesignPatterns.slnx`. It references `Microsoft.CodeAnalysis.CSharp.Workspaces` 5.0.0 and `Basic.Reference.Assemblies.Net100` 1.8.13, and holds the `[JSExport]` IDE class. *As built:* the project is `core/DesignPatterns.Ide` (Task 2). It gets the BCL references through Core's internal `IdeDefaults`, and holds `IdeService`, the platform-neutral JSON layer `IdeWire` and the `[JSExport]` class `IdeExports` (Task 3). The exports must live in this lazy assembly and not in `DesignPatterns.Wasm`, so that `getAssemblyExports('DesignPatterns.Ide')` binds them only after the load.
  - `DesignPatterns.Wasm.csproj` gets a `ProjectReference` to it and 9 `BlazorWebAssemblyLazyLoad` items, using the `.wasm` file names: `DesignPatterns.Ide`, `Microsoft.CodeAnalysis.Workspaces`, `Microsoft.CodeAnalysis.CSharp.Workspaces`, `Humanizer`, and `System.Composition.{AttributedModel,Convention,Hosting,Runtime,TypedParts}`.
  - The SDK fails the build with `BLAZORSDK1001` if a listed name is not in the publish output.
  - `publish-dotnet.mjs` already copies every `_framework` file, lazy ones included. Task 3 changes it so that after copying it writes `web/public/dotnet/ide-manifest.json`:
    - `{ "assemblies": [<the 9 fingerprinted .wasm file names>], "bytes": <sum of the gzip-compressed sizes of those 9 files> }`
    - `bytes` is computed at publish time with Node `zlib`, using **gzip level 9** (`gzipSync(buf, { level: 9 })`), summed over the 9 files. Gzip is used because GitHub Pages serves gzip, not Brotli. The file names are read from `resources.lazyAssembly` in the boot config that is embedded in `dotnet.js` between `/*json-start*/` and `/*json-end*/`. Value as built in Task 3: about 2.14 MB (2,143,489 B; it shifts by a few bytes with each build of `DesignPatterns.Ide`).
    - The "Enable IDE features" button shows `bytes` in MB. `vite.config.ts` reads the manifest when Vite starts and builds it in as `__IDE_BYTES__` (null if the file is absent), so the app fetches nothing before the learner opts in.
- **JS load sequence:**
  1. `dotnetBoot` must also hand back the `runtime`.
  2. For each entry of `runtime.getConfig().resources.lazyAssembly`, with dependencies first, call `await runtime.INTERNAL.loadLazyAssembly(asset.virtualPath)`. The order is Humanizer, then the 5 System.Composition files, then Workspaces, then CSharp.Workspaces, then DesignPatterns.Ide.
     - **Verified shape (SDK 10.0.300, Task 3):** `lazyAssembly` is an **array** of assets, `{ virtualPath: 'Humanizer.wasm', name: 'Humanizer.oqup3v7t3k.wasm', hash: 'sha256-…', cache: 'force-cache' }`, sorted by name, not by dependency. It is not the .NET 8 dictionary keyed by file name.
     - `loadLazyAssembly` finds the entry by `virtualPath`, accepting `.wasm` or `.dll`. It returns `false` for an assembly that is already loaded.
     - The corrected call is `for (const a of [...lazyAssembly].sort(byDependencyOrder)) await runtime.INTERNAL.loadLazyAssembly(a.virtualPath)`.
     - As built, this is `loadIdeExports` in `web/src/compiler/dotnetBoot.ts`, with the order fixed in `IDE_LOAD_ORDER`. A lazy assembly that is not in that list is refused, with an error naming it.
  3. Call `runtime.getAssemblyExports('DesignPatterns.Ide')`, then `WarmUp()` (see Cold first calls).

  `INTERNAL` is an internal runtime API, the one Blazor's `LazyAssemblyLoader` uses. It was verified on SDK 10.0.300 / pack 10.0.8; `global.json` allows `latestFeature`, so CI e2e (`ide.spec.ts`) is the guard against a runtime change. `loadIdeExports` checks that `INTERNAL.loadLazyAssembly` is a function before any download, and fails with its own error ("runtime API changed"), which is not a download failure and can be retried.
- **Assembly boundary:** no code in `DesignPatterns.Wasm` or `DesignPatterns.Core` may reference a Workspaces type. Only the lazy `DesignPatterns.Ide` assembly does.
- **Cold first calls:** the first completion (about 0.9 s) and the first format (about 0.7 s) are slow, because the runtime JITs them. **Decision (Task 3): there is no separate `Init`.** A single export, `IdeExports.WarmUp()`, builds the workspace on first use and runs one throwaway completion and one format on a small sample. The worker's `loadIde` resolves only after `WarmUp`, so "ready" means warm. A separate step would only add a second round trip, and nothing can usefully run between the two.
- **Cancellation:** a running call cannot be preempted on the single-threaded runtime, and `[JSExport]` cannot take a `CancellationToken`. Supersession is cooperative, as built in `web/src/compiler/ideHost.ts`:
  1. Each IDE export takes the worker's request id, and `IdeExports.Cancel(id)` trips that request's `CancellationTokenSource`. The token is passed to every Roslyn call. The registry is the platform-neutral `IdeRequests` class; `IdeExports` only forwards to it.
  2. A request first yields one task (`setTimeout 0`), so a newer request of the same kind that is already queued replaces it before it starts.
  3. When a newer request arrives, the running one is cancelled.
  4. Any older result is answered as `{ superseded: true }`. If .NET saw the cancellation, the answer also carries `cancelled: true`.
  5. `CompilerClient` also drops an older result that was already on its way back. An older request that *fails* after a newer one was sent also answers superseded, in both the worker and the client, so only the latest request reports an error.

  **Verified (Task 3):**
  - Roslyn honours a token tripped through `IdeRequests.Cancel` while the request is registered and not yet complete, and the answer is `IdeWire.Cancelled`. This is pinned by deterministic desktop tests in `DesignPatterns.Ide.Tests` (`IdeRequestsTests`).
  - The browser e2e asserts only the deterministic case: two completions posted in the same task, where the older one answers `{ superseded: true }`.
  - Observed in the browser but not asserted, because it depends on timing: a completion on a 150-line file, with a second one posted 20 ms later, answered `{ superseded: true, cancelled: true }` in every run so far. So the async Roslyn calls do yield to the worker's event loop, and a cancel can land mid-call. The e2e records the answer as an annotation.
  - A synchronous export (`Compile`) still cannot be interrupted.
- **A failed download is final for the page.** When a lazy fetch answers an HTTP error, the runtime retries it twice. But it has already recorded the asset in `loadedAssemblies`, so a later `loadLazyAssembly` for it returns `false` without loading anything. `loadIdeExports` therefore rejects with "IDE features couldn't be downloaded; reload the page to try again.", and `IdeHost` keeps that failure instead of retrying. It keeps only that one: after any other failure (a failed `WarmUp`, a runtime without `loadLazyAssembly`) the next `loadIde` runs again, and exports already bound are not bound twice. Compiling is unaffected; this is covered by an e2e that answers one lazy file with a 503.
- **Hover has no BCL docs:** `Basic.Reference.Assemblies` ships no XML doc files, so hover shows signatures only for BCL symbols. Doc comments appear only for the learner's own symbols.
- **No keywords:** completion lists symbols only, with no keywords or snippets (those live in Features). Keyword completion will be merged from a fixed C# keyword list.
- **IDE references are BCL-only:** the IDE compilation does not include the Checks or Roslyn references that the grading compilation adds, so Checks never leak into completion (ruling 4).
