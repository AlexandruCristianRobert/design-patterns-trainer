# M5 · IDE Features Add-on Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A learner presses **Enable IDE features** (it shows the download size). The app then lazily downloads extra Roslyn assemblies, and the C# editor gains completion, hover, in-file go-to-definition and format document. A setting loads them automatically on later visits. This works in Sandbox, Lesson examples, Exercises and exams.

**Architecture:**
- **Feasibility spike (Task 1).** It decides how the extra assemblies load:
  - **(A, preferred)** lazy-load `Microsoft.CodeAnalysis.Workspaces` + `Microsoft.CodeAnalysis.CSharp.Workspaces` (+ their `System.Composition.*` dependencies if needed) into the existing compiler worker; or
  - **(B, fallback)** boot a separate on-demand "IDE worker" from a second published bundle.
- **IDE service.** The language services live in a new .NET library, `core/DesignPatterns.Ide`, built on Workspaces APIs only (`Recommender`, `Formatter`, `SemanticModel` symbol lookup, `ISymbol` display and XML docs). It needs no `Microsoft.CodeAnalysis.Features`/MEF unless the spike shows they work and are small. It reuses `CompilerDefaults` (references, parse options, global-usings tree), so results match the compiler.
- **Web side.** One `IdeClient` interface hides A versus B. Monaco providers call it.

**Tech Stack:**
- M4 stack
- `Microsoft.CodeAnalysis.CSharp.Workspaces` 5.0.0 (same Roslyn version as `Microsoft.CodeAnalysis.CSharp` 5.0.0 in `DesignPatterns.Core`)
- Monaco contributions: `gotoSymbol`, `format`, plus the existing `suggest`/`hover` contribs

**Spec:** `docs/superpowers/specs/2026-10-22-design-patterns-trainer-design.md`, §11 (IDE features add-on, "Starts with a feasibility spike"), §8 ("Editor v1"), §5 (runtime rules), §10 (compiler worker). Also ADR 0001 (Roslyn in a Web Worker).

## Global Constraints

- Everything from the M1–M4 Global Constraints binds: i18n for all copy, `DESIGN.md` tokens, `uxkin:no-ui-slop` for UI, Lucide only, no emoji, and the commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Spec §11, verbatim:** "A toolbar button 'Enable IDE features' (Lucide icon, size shown) lazily downloads Roslyn Workspaces/Features assemblies into the compiler worker, enabling completion, hover, in-file go-to-definition and format document; a setting loads them automatically on later visits. Allowed in exams. Starts with a feasibility spike."
- **Default bundle unchanged.** Nothing new is downloaded until the learner opts in, or the auto-load setting is on. The default bundle's boot size and time must not grow by more than 2%. The spike measures both.
- **Worker isolation.** IDE features run in the compiler worker (A) or a dedicated IDE worker (B), never in the runner worker or on the main thread. They never execute learner code.
- **Single-threaded WebAssembly.** Only async-safe Roslyn calls are allowed. Run every call with `ConcurrentBuild(false)` semantics. Nothing may block on a monitor ("Cannot wait on monitors on this runtime").
- **Latency targets** in the browser, after load, on the spike machine:
  - completion ≤ 300 ms at the 95th percentile on a 150-line file
  - hover ≤ 200 ms
  - format ≤ 500 ms

  Every request is cancellable: a newer request supersedes an older one.
- **Positions.** Monaco uses 1-based line and column; Roslyn uses 0-based offsets. All conversions live in one tested helper.

### Test budget (carried over from the user's M4 requirement: total test runtime ≤ 30 min)

- Each task runs only the commands in its Verify step.
- Reviewers run no tests.
- The full suites run once at the end of Task 6, and once by the controller after the final fix wave.
- Implementers report the seconds of every test command. The controller keeps the running total.

## Rulings made in this plan

1. **Workspaces-only services first.** Use `Recommender.GetRecommendedSymbolsAtPositionAsync`, `Formatter.FormatAsync`, `SemanticModel.GetSymbolInfo`/`GetDeclaredSymbol` plus `ISymbol.Locations`, and `ToDisplayString`/`GetDocumentationCommentXml`. This avoids `Microsoft.CodeAnalysis.Features`, which is large and MEF-heavy. Features is adopted only if the spike shows it loads, works, and adds ≤ 5 MB compressed.
2. **Gating on the spike.**
   - The spike ends with ADR `docs/adr/0003-ide-features-loading.md` recording A or B, the measured sizes and latencies, and the API set that works.
   - Tasks 2–6 are written for approach A. If the ADR picks B, the controller rules the delta: the worker and bundle changes in Task 3 only. Tasks 2, 4, 5 and 6 are unaffected, because of `IdeClient`.
   - If **neither** works, M5 stops after Task 1. The ADR explains why, and the controller reports to the user.
3. **The setting lives in `localStorage`** (`dpt.ide.autoload`). It is a per-device convenience, not Progress, so it is not exported.
4. **Exams.** IDE features are allowed (spec §11). Completion lists only symbols from the learner's file and the referenced BCL. It never reveals Checks or reference solutions, because those aren't in the compilation the IDE sees.

## Review Focus

1. **Default users pay nothing.** A learner who never opts in downloads no extra bytes and sees no slower boot. Tests: the spike measures it; the Task 3 e2e asserts that no IDE assembly request happens without opt-in.
2. **Stale or wrong positions.** Completion, hover and definition must target the current text and position. A request made against old text must not apply its result. Tests: the position-conversion unit tests (Task 2), and cancellation tests in `IdeClient` (Task 4).
3. **Errors never break editing.** If the IDE assemblies fail to download or throw, the editor keeps working as before, and a recoverable notice offers a retry. Tests: Task 4 and 5 tests with a failing fake client.
4. **Implicit usings and top-level statements.** Completion, hover and definition must work in top-level statements, with the app's implicit usings (`System`, `System.Linq`, …), exactly as the compiler sees them. Tests: Task 2 xUnit cases.
5. **Exam integrity.** No Check source or reference solution is ever part of the IDE compilation. Tests: a Task 2 unit test asserts that the IDE compilation contains exactly the global-usings tree and the user tree.

---

### Task 1: Feasibility spike and ADR

**Files:**
- Create: `docs/adr/0003-ide-features-loading.md`
- Create: a minimal proof-of-concept on the branch, under `spike/` or behind a dev-only flag. It is kept only if it is clean; otherwise it is deleted before commit.

**Questions the spike must answer, with measurements:**
1. Can `Microsoft.CodeAnalysis.CSharp.Workspaces` (5.0.0, same version as the compiler) and its dependencies be published as **lazy-loaded** assemblies in the `Microsoft.NET.Sdk.WebAssembly` project, and loaded on demand from JS inside the compiler worker? Check the SDK's lazy-load item support in .NET 10 and the runtime's JS lazy-load API. Record exactly what worked.
2. With them loaded, do these work single-threaded in the browser worker?
   - an `AdhocWorkspace` (or a workspace-free alternative)
   - `Recommender` completion at a position in a top-level-statements file using the app's references and global usings
   - `Formatter.FormatAsync`
   - symbol lookup for hover and definition

   Record the latencies.
3. What are the sizes?
   - extra download bytes, raw and compressed, as served by `vite preview`
   - the default bundle's size and boot time before and after the change
4. If (1) fails: does approach B work (a second bundle and worker), and what is its size?
5. Is `Microsoft.CodeAnalysis.Features` viable? Answer this only if it's cheap to try; otherwise record "not attempted, Workspaces-only suffices".

**Deliverable:** an ADR in the style of ADR 0001/0002, recording:
- the decision (A or B)
- the measured numbers
- the API set to use
- known limitations
- the exact build/publish changes Task 3 must make

- [ ] **Step 1:** Do the spike in the real `compiler/DesignPatterns.Wasm` project, on this branch. Revert anything that is not kept.
- [ ] **Step 2: Verify.** Run `dotnet build compiler/DesignPatterns.Wasm`, plus the spike's own browser measurement script. Do not run other suites. Report the seconds.
- [ ] **Step 3: Commit** `docs: ADR 0003 IDE features loading (spike result)`.

### Task 2: IDE service library (.NET)

**Files:**
- Create: `core/DesignPatterns.Ide/DesignPatterns.Ide.csproj`, referencing `DesignPatterns.Core` and `Microsoft.CodeAnalysis.CSharp.Workspaces` 5.0.0
- Create: `IdeService.cs`, `IdeProtocol.cs`, `Positions.cs`
- Create: `tests/DesignPatterns.Ide.Tests/…`, added to `DesignPatterns.slnx`

**Interfaces:**
```csharp
public sealed record CompletionItemInfo(string Label, string Kind, string? Detail, string InsertText);
public sealed record CompletionResult(IReadOnlyList<CompletionItemInfo> Items, int ReplaceStart, int ReplaceEnd); // offsets in user source
public sealed record HoverResult(string Markdown, int Start, int End);           // null result = nothing to show
public sealed record DefinitionResult(int Start, int End);                       // in-file only; null when outside the file
public static class IdeService {
  Task<CompletionResult> CompleteAsync(string source, int offset, CancellationToken ct);
  Task<HoverResult?> HoverAsync(string source, int offset, CancellationToken ct);
  Task<DefinitionResult?> DefinitionAsync(string source, int offset, CancellationToken ct);
  Task<string> FormatAsync(string source, CancellationToken ct);
}
public static class Positions { int ToOffset(string text, int line1, int column1); (int Line1, int Column1) ToLineColumn(string text, int offset); }
```

- `Kind` is one of: `class`, `interface`, `struct`, `enum`, `method`, `property`, `field`, `event`, `local`, `parameter`, `namespace`, `keyword`.
- The IDE compilation is built exactly like `CSharpCompiler.Analyze`: `CompilerDefaults.References`, `ParseOptions`, `GlobalUsingsTree()` plus the user tree.
- Keyword completion is included. A small fixed C# keyword list filtered by context is acceptable.

- [ ] **Step 1: Write failing xUnit tests:**
  - **Completion:**
    - `Console.` in top-level code lists `WriteLine` (method).
    - `var xs = new List<int>(); xs.` lists `Add`.
    - A user type's members complete after `.`.
    - Implicit `System.Linq` gives `Where` on a list.
  - **Hover:**
    - Over `WriteLine`, it shows the signature in a code fence.
    - Over a user class name, it shows `class Name`.
  - **Definition:**
    - On a use of a user method, it returns the declaration span.
    - On `Console`, it returns null (outside the file).
  - **Format:** `class A{void M(){int x=1;}}` comes back formatted (Allman braces, 4 spaces).
  - **Positions:** round-trips with CRLF and LF, and covers end of file.
  - **Cancellation:** a cancelled token throws `OperationCanceledException`.
  - **Integrity (Review Focus 5):** the compilation's syntax trees are exactly 2.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Verify.** Run `dotnet test tests/DesignPatterns.Ide.Tests` only, and report the seconds.
- [ ] **Step 4: Commit** `feat(ide): Roslyn language services for the editor`.

### Task 3: Lazy load and worker protocol

**Files:**
- Modify: `compiler/DesignPatterns.Wasm/*.csproj`. Add the `DesignPatterns.Ide` reference and the lazy-load items, as the ADR states.
- Create: `compiler/DesignPatterns.Wasm/IdeExports.cs`. It holds the `[JSExport]` methods `Complete`, `Hover`, `Definition` and `Format`, which take and return JSON through `ProtocolJson`.
- Modify: `web/scripts/publish-dotnet.mjs`. Write `web/public/dotnet/ide-manifest.json` with `{ assemblies: string[], bytes: number }`.
- Modify: `web/src/compiler/compiler.worker.ts`, `dotnetBoot.ts` and `protocol.ts` (`loadIde`, `complete`, `hover`, `definition`, `format`).

**Interfaces:**
- **Worker methods:**
  - `loadIde` lazy-loads the assemblies and calls `IdeExports.WarmUp`.
  - `complete`, `hover`, `definition` and `format` take `{ source, line, column }`, or `{ source }` for format. They answer with the protocol JSON from Task 2, with positions converted to 1-based line and column.
- **Request superseding:** each method carries a request id. A newer request of the same kind makes the worker drop the older result and return `{ superseded: true }`.

- [ ] **Step 1: Write failing tests.**
  - Unit tests in `workerRpc`/protocol with a fake channel:
    - `loadIde` once
    - calls before load reject with a clear error
    - superseded results are dropped
  - An e2e test, `web/e2e/ide.spec.ts`. On a normal Sandbox visit, no network request goes to any assembly named in `ide-manifest.json` (Review Focus 1).
- [ ] **Step 2: Implement.** Run `npm run build:dotnet`. That publish is a build, not a test.
- [ ] **Step 3: Verify.** Run only:
  - `npx vitest run src/compiler`
  - `npx playwright test e2e/ide.spec.ts`

  Report the seconds.
- [ ] **Step 4: Commit** `feat(compiler): lazy-loaded IDE assemblies and worker methods`.

### Task 4: `IdeClient` and Monaco providers

**Files:**
- Create: `web/src/editor/ide/IdeClient.ts` (+ test), `web/src/editor/ide/monacoProviders.ts` (+ test)
- Modify: `web/src/editor/monacoFeatures.ts`. Import the `gotoSymbol` and `format` contributions.

**Interfaces:**
```ts
export interface IdeClient {
  status: 'off' | 'loading' | 'ready' | 'failed'
  load(): Promise<void>
  complete(source: string, line: number, column: number, signal: AbortSignal): Promise<CompletionResult | null>
  hover(...): Promise<HoverResult | null>
  definition(...): Promise<DefinitionResult | null>
  format(source: string): Promise<string>
}
export function registerIdeProviders(monaco, client: IdeClient): IDisposable   // completion, hover, definition, document formatting for 'csharp'
```
- The providers return nothing while the status is not `ready`.
- Each provider passes Monaco's cancellation token through as an `AbortSignal`.
- A result is applied only if the model's version hasn't changed since the request (Review Focus 2).

- [ ] **Step 1: Write failing tests** with a fake client:
  - a completion item maps to a Monaco `CompletionItem` with its kind and range
  - a result for an older model version is ignored
  - errors return `null` and don't throw
  - the formatting provider returns one full-range edit
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Verify.** Run `npx vitest run src/editor` and report the seconds.
- [ ] **Step 4: Commit** `feat(editor): Monaco providers backed by the IDE client`.

### Task 5: "Enable IDE features" button and setting

**Load `uxkin:no-ui-slop` first.**

**Files:**
- Modify: `web/src/code/CodePanel.tsx`, adding a toolbar button
- Create: `web/src/editor/ide/useIde.ts` (a shared singleton state, `localStorage` `dpt.ide.autoload`) and `IdeButton.tsx` (+ tests)
- Modify: `web/src/locales/en/common.json` (`ide.*`)

**Behaviour:**
- **The button.** It's a square icon button in the CodePanel toolbar, using the Lucide `Sparkles` or `Wand2` icon. Its tooltip reads "Enable IDE features (≈ {{size}} MB download)", with the size from `ide-manifest.json` rounded to 0.1. Pressing it starts the download.
- **States:**
  - **Loading:** the button shows an inline spinner and the label "Loading IDE features…".
  - **Ready:** the button becomes a pressed toggle, "IDE features on".
  - **Failed:** the inline error reads "IDE features couldn't be loaded. Editing still works." with **Try again**.
- **Auto-load.** After the first successful load, a checkbox in the same popover appears: "Load IDE features automatically on this device". When it is on, `useIde` loads on app start, after the compiler is ready.
- **Format document.** It is available from the editor context menu and with Shift+Alt+F once ready.
- **Scope.** It works in the Sandbox, Lesson example, Exercise and Exam session editors (spec §11 allows exams).

- [ ] **Step 1: Write failing tests:**
  - the button shows the size from a mocked manifest
  - clicking it calls `load`, then the button reaches ready
  - a failed load shows the error and a retry
  - the auto-load checkbox writes to `localStorage`
  - when the flag is set, `load` is called on mount
  - the button is present in the exam editor too
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Verify.** Run `npx vitest run src/editor src/code` and do one visual check at 390 and 1440 px, including the keyboard. Report the seconds.
- [ ] **Step 4: Commit** `feat(web): Enable IDE features button and auto-load setting`.

### Task 6: End-to-end IDE flow and the full run

**Files:** modify `web/e2e/ide.spec.ts`.

```ts
test('enabling IDE features gives completion, hover, definition and format', ...)  // Sandbox: click button, wait ready; type "Console." → suggest widget lists WriteLine; hover WriteLine → hover shows signature; F12 on a user method call → cursor jumps to declaration; Shift+Alt+F reformats a one-line class
test('auto-load setting loads on the next visit', ...)                              // enable + tick setting, reload → ready without clicking
test('IDE features work in an exam session', ...)                                   // start a 1-question exam, enable, completion works
```

- [ ] **Step 1:** Write the tests.
- [ ] **Step 2: Verify** with the one full run of M5:
  - `npm test -- --run`
  - `npx tsc -b`
  - `npm run lint`
  - `dotnet test`
  - `npm run e2e`

  Report the seconds.
- [ ] **Step 3: Commit** `test(web): end-to-end IDE features`.

## Appendix: M5 follow-ups (from the per-task and final reviews)

- Verify on the deployed GitHub Pages site: the lazy `.wasm` files are served gzip-compressed (the shown size assumes gzip), and lazy loading works under the `/<repo>/` base.
- Format hint hard-codes "Shift+Alt+F" (Mac shows wrong keys); use the `common:keys.*` pattern.
- Screen-reader polish: one persistent live region in `IdeProvider` (alert on failure, announce ready); drop `aria-pressed` on the ready button (it is a disclosure).
- `.icon-btn[aria-pressed='true']` selector is global; scope it to `.ide-menu`.
- `IdeButton` offer popover can stay open if status leaves `off` via auto-load or another editor.
- Tests: `Format_Crlf` exact structure; numeric-literal keyword suppression; keywords at offset 0 after a leading `//`; `Cancel_DuringARealCompletion` uses a pre-tripped token; e2e same-task supersede relies on Chromium message order.
- Completion lists the implicit `Program` class.
- `INTERNAL.loadLazyAssembly` is an internal runtime API; re-check on every .NET SDK feature-band change (CI `ide.spec.ts` is the guard).
