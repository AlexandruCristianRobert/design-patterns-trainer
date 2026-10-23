# IDE features are lazy-loaded Workspaces assemblies in the compiler worker

IDE features (spec §11: completion, hover, in-file go-to-definition, format document) need `Microsoft.CodeAnalysis.CSharp.Workspaces`, which the default bundle does not ship. We publish Workspaces 5.0.0 and its dependencies, plus a small `DesignPatterns.Ide` assembly, in the existing `DesignPatterns.Wasm` bundle, marked with the SDK's `BlazorWebAssemblyLazyLoad` item. The compiler worker fetches them only when the learner opts in, with `runtime.INTERNAL.loadLazyAssembly`. This is approach **A**. No second bundle or worker is needed. We use only the Workspaces-level APIs. `Microsoft.CodeAnalysis.Features` is not used.

The decision rests on a spike (M5 Task 1, 2026-10-23). It ran in headless Chromium (Playwright), on Windows, on the spike machine, against the Release publish served by the Vite dev server on :5299. The probe was a 150-line top-level-statements file. Every call was made with the text slightly changed, so the timings are not cache hits. There were 30 calls per API (15 for format), and the first call is reported separately.

## Measurements

| What | Default bundle | With lazy IDE items |
| --- | --- | --- |
| Files fetched at boot | 184 requests (182 `_framework` files) | 184 requests (unchanged) |
| Boot bytes | 39,975,864 B | 39,978,119 B (+2,255 B, +0.006%: the boot config inside `dotnet.js` lists the lazy resources) |
| Boot to ready (`dotnet.create` + `WarmUp`), 3 runs | 1955 / 2053 / 1957 ms | 1980 / 2026 / 2059 ms (same within run-to-run noise, mean +1.7%) |
| Extra download on opt-in (9 files) | — | 5,698,497 B raw (what Vite serves: uncompressed), 2,119,498 B gzip-9, 1,668,472 B Brotli-11 |
| Load: fetch + `loadLazyAssembly` of the 9 files (localhost) | — | 363 ms |
| `Init`: MEF host 149 ms, `AdhocWorkspace` 97 ms, solution 74 ms | — | 323 ms |

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
  - Add a library project, `compiler/DesignPatterns.Ide` (net10.0, `AllowUnsafeBlocks`). It references `Microsoft.CodeAnalysis.CSharp.Workspaces` 5.0.0 and `Basic.Reference.Assemblies.Net100` 1.8.13, and holds the `[JSExport]` IDE class.
  - `DesignPatterns.Wasm.csproj` gets a `ProjectReference` to it and 9 `BlazorWebAssemblyLazyLoad` items, using the `.wasm` file names: `DesignPatterns.Ide`, `Microsoft.CodeAnalysis.Workspaces`, `Microsoft.CodeAnalysis.CSharp.Workspaces`, `Humanizer`, and `System.Composition.{AttributedModel,Convention,Hosting,Runtime,TypedParts}`.
  - The SDK fails the build with `BLAZORSDK1001` if a listed name is not in the publish output.
  - `publish-dotnet.mjs` needs no change: it already copies every `_framework` file.
- **JS load sequence:**
  1. `dotnetBoot` must also hand back the `runtime`.
  2. For each entry of `runtime.getConfig().resources.lazyAssembly`, with dependencies first (Humanizer, then System.Composition, then Workspaces, then CSharp.Workspaces, then DesignPatterns.Ide), `await runtime.INTERNAL.loadLazyAssembly(virtualPath)`.
  3. Call `runtime.getAssemblyExports('DesignPatterns.Ide')`, then `Init()`.

  `INTERNAL` is an internal runtime API, the one Blazor's `LazyAssemblyLoader` uses. It is pinned by the SDK version (pack 10.0.8 / SDK 10.0.300), so an SDK upgrade must re-check it.
- **Assembly boundary:** no code in `DesignPatterns.Wasm` or `DesignPatterns.Core` may reference a Workspaces type. Only the lazy `DesignPatterns.Ide` assembly does.
- **Cold first calls:** the first completion (about 0.9 s) and the first format (about 0.7 s) are slow, because the runtime JITs them. `Init` should warm both with a throwaway call before reporting the features ready.
- **Cancellation:** a running call cannot be preempted on the single-threaded runtime, and `[JSExport]` cannot take a `CancellationToken`. Supersession is cooperative: the worker drops queued requests that a newer one replaced, and can trip a `CancellationTokenSource`, passed to the Roslyn calls, from a later message processed between awaits.
- **Hover has no BCL docs:** `Basic.Reference.Assemblies` ships no XML doc files, so hover shows signatures only for BCL symbols. Doc comments appear only for the learner's own symbols.
- **No keywords:** completion lists symbols only, with no keywords or snippets (those live in Features). A static C# keyword list may be merged in.
- **IDE references are BCL-only:** the IDE compilation does not include the Checks or Roslyn references that the grading compilation adds, so Checks never leak into completion (ruling 4).
