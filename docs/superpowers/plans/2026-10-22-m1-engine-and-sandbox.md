# M1 · Engine & Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real C# compiles, runs and is graded by Checks inside the browser, exposed to the learner as a Sandbox page deployed to GitHub Pages.

**Architecture:** A .NET 10 core library (Roslyn compile pipeline, API policy, Contract verifier, program/Check runner, JSON protocol) is tested natively with xUnit and hosted in the browser by one .NET WebAssembly bundle exporting `[JSExport]` entry points. A React + Vite app instantiates that bundle in two module Web Workers — a long-lived compiler worker and a disposable runner worker that is terminated on a 5 s timeout. The Sandbox page wires Monaco, live diagnostics and Run on top.

**Tech Stack:** .NET 10 SDK, C# 14, Microsoft.CodeAnalysis.CSharp 5.x, Basic.Reference.Assemblies.Net100, xUnit · Node 24, React 19, TypeScript (strict), Vite, react-router, i18next + react-i18next, monaco-editor + @monaco-editor/react, lucide-react, Vitest + Testing Library, Playwright · GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-22-design-patterns-trainer-design.md` (milestone M1; §4 Grading, §5 Runtime rules, §8 Sandbox/editor, §9 i18n, §10 Architecture). Also read `CONTEXT.md`, `DESIGN.md`, `docs/adr/0001-*`, `docs/adr/0002-*`.

## Global Constraints

- .NET SDK pinned by `global.json`: `"version": "10.0.100", "rollForward": "latestFeature"`.
- Learner code compiles with `LanguageVersion.CSharp14`, `NullableContextOptions.Enable`, against .NET 10 reference assemblies.
- Implicit global usings for learner code, exactly: `System`, `System.Collections.Generic`, `System.Linq`, `System.Threading`, `System.Threading.Tasks`.
- Forbidden APIs → diagnostic id `DP0001`, English message `Not available in the browser runtime: <api>`, arg `api`. List in Task 2.
- Run/Check time limit: **5000 ms** per runner request. Stdout cap: **65,536** characters. Runner worker recycled after **50** loads.
- Live diagnostics debounce: **500 ms**; latest request wins.
- Checks contain no human-readable text — reason keys + string args only. Reason keys: `isFalse`, `notEqual`, `notSame`, `same`, `didNotThrow`, `wrongException`, `typeNotFound`, `threw`, `timedOut`, plus custom keys via `Expect.Fail`.
- JSON wire format: camelCase properties, enums as camelCase strings, nulls omitted.
- Every UI string goes through i18next (`en` namespace files); no literal copy in components. Roslyn `CS*` messages are displayed as emitted.
- UI follows `DESIGN.md` tokens (foundation A). Load the `uxkin:no-ui-slop` skill before any UI task. Icons from `lucide-react` only; no emoji.
- Static hosting: Vite `base` comes from env `VITE_BASE` (default `/`). No server code anywhere.
- Commits end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Fast typing:** an older diagnostics response arriving after a newer one must not overwrite newer markers → `useLiveDiagnostics` latest-wins test (Task 9).
2. **Output flood** (`while (true) Console.Write("x");`): memory stays bounded at the 65,536-char cap until the runner is killed → `CappedStringWriter` drop-beyond-cap test (Task 3) + timeout e2e (Task 10).
3. **Exceptions in static constructors / async code:** learner sees the real exception type, not `TypeInitializationException`/`TargetInvocationException` → unwrap tests (Task 3).
4. **A Check hangs mid-run:** remaining Checks still run on a fresh runner with the program reloaded → `RunnerHost` reload-after-timeout test (Task 8).
5. **Compiler not ready or failed to boot:** Run is disabled while starting; a boot failure shows a recoverable message → `CompilerClient` bootError test (Task 8) + Sandbox status test (Task 9).

---

## File Structure

```
.gitignore · global.json · Directory.Build.props · DesignPatterns.slnx
core/DesignPatterns.Checks/            Check authoring API (referenced by learner+check code)
  CheckAttribute.cs · CheckFailedException.cs · Expect.cs · CheckContext.cs · Code.cs · TypeFacts.cs · Source.cs
core/DesignPatterns.Core/
  Compilation/ CSharpCompiler.cs · CompilerDefaults.cs · LoadedMetadata.cs · DiagnosticInfo.cs · CompilationOutcome.cs · ApiPolicy.cs
  Contracts/   Contract.cs · ContractVerifier.cs · ContractViolation.cs
  Execution/   RuntimeLimits.cs · CappedStringWriter.cs · ConsoleCapture.cs · LoadedProgram.cs · RunOutcome.cs · CheckResult.cs · ExceptionUnwrapper.cs
  Protocol/    Messages.cs · ProtocolJson.cs · CompilerService.cs · RunnerService.cs
compiler/DesignPatterns.Wasm/          Program.cs · CompilerExports.cs · RunnerExports.cs · smoke.mjs
tests/DesignPatterns.Core.Tests/       Compilation/ · Contracts/ · Execution/ · Protocol/ · TestCompile.cs
web/
  package.json · vite.config.ts · tsconfig*.json · index.html · playwright.config.ts · scripts/postbuild.mjs
  public/dotnet/                       (generated by build:dotnet; gitignored)
  src/main.tsx · App.tsx
  src/styles/tokens.css · base.css
  src/theme/ThemeProvider.tsx
  src/i18n/index.ts · src/locales/en/common.json · sandbox.json · diagnostics.json
  src/compiler/protocol.ts · dotnetBoot.ts · workerRpc.ts · compiler.worker.ts · runner.worker.ts · CompilerClient.ts · RunnerHost.ts · CompilerProvider.tsx
  src/editor/monacoSetup.ts · monacoTheme.ts · CodeEditor.tsx · useLiveDiagnostics.ts · diagnosticMessage.ts
  src/features/sandbox/SandboxPage.tsx · OutputPanel.tsx · runSandbox.ts
  src/features/dev/DevEnginePage.tsx
  e2e/sandbox.spec.ts · e2e/engine.spec.ts
.github/workflows/ci.yml
```

---

### Task 1: Repo scaffold and Roslyn compile pipeline

**Files:**
- Create: `.gitignore`, `global.json`, `Directory.Build.props`, `DesignPatterns.slnx`
- Create: `core/DesignPatterns.Core/DesignPatterns.Core.csproj`, `Compilation/{CSharpCompiler,CompilerDefaults,DiagnosticInfo,CompilationOutcome}.cs`
- Test: `tests/DesignPatterns.Core.Tests/Compilation/CSharpCompilerTests.cs`, `tests/DesignPatterns.Core.Tests/TestCompile.cs`

**Interfaces:**
- Produces:
  ```csharp
  namespace DesignPatterns.Core.Compilation;
  public enum DiagnosticLevel { Error, Warning, Info }
  public enum SourceFile { User, Checks }
  public sealed record DiagnosticInfo(string Id, DiagnosticLevel Level, string Message, SourceFile File,
      int StartLine, int StartColumn, int EndLine, int EndColumn,          // 1-based
      IReadOnlyDictionary<string, string>? Args = null);
  public sealed record CompilationOutcome(bool Success, IReadOnlyList<DiagnosticInfo> Diagnostics,
      CSharpCompilation Compilation, SyntaxTree UserTree, byte[]? Assembly);
  public static class CSharpCompiler {
      public static CompilationOutcome Analyze(string userSource);                         // diagnostics only, no emit
      public static CompilationOutcome Build(string userSource, string? checksSource = null); // emit PE bytes when no errors
  }
  // tests/TestCompile.cs
  public static class TestCompile { public static byte[] Bytes(string user, string? checks = null); } // asserts success, prints diagnostics on failure
  ```

- [ ] **Step 1: Scaffold repo and projects**

Run `git init` (the folder is not yet a repository). `.gitignore` covers `bin/ obj/ node_modules/ web/public/dotnet/ web/dist/ web/test-results/ web/playwright-report/ .vs/ *.user`. `Directory.Build.props`: `Nullable=enable`, `ImplicitUsings=enable`, `TreatWarningsAsErrors=true`, `LangVersion=latest`. Create `DesignPatterns.slnx` with `dotnet new sln -n DesignPatterns`, `dotnet new classlib -o core/DesignPatterns.Core -f net10.0`, `dotnet new xunit -o tests/DesignPatterns.Core.Tests -f net10.0`, add both to the solution, reference Core from Tests. In Core: `dotnet add package Microsoft.CodeAnalysis.CSharp --version 5.0.0` (latest 5.x if 5.0.0 is unavailable) and `dotnet add package Basic.Reference.Assemblies.Net100`. Delete template `Class1.cs`/`UnitTest1.cs`.

- [ ] **Step 2: Write failing tests** in `CSharpCompilerTests.cs`:

```csharp
[Fact] public void Build_HelloWorld_Succeeds() {
    var r = CSharpCompiler.Build("Console.WriteLine(\"hi\");");
    Assert.True(r.Success); Assert.NotNull(r.Assembly);
}
[Fact] public void Build_UndefinedName_ReportsCS0103AtPosition() {
    var d = Assert.Single(CSharpCompiler.Build("var x = y;").Diagnostics, d => d.Id == "CS0103");
    Assert.Equal((DiagnosticLevel.Error, SourceFile.User, 1, 9), (d.Level, d.File, d.StartLine, d.StartColumn));
}
[Fact] public void Build_UsesCSharp14() =>
    Assert.Equal(LanguageVersion.CSharp14, CSharpCompiler.Build("class A {}").Compilation.LanguageVersion);
[Fact] public void Build_ImplicitUsings_AllowListAndLinq() =>
    Assert.True(CSharpCompiler.Build("var l = new List<int> { 1, 2 }; Console.WriteLine(l.Sum());").Success);
[Fact] public void Build_NullableEnabled_WarnsCS8600() =>
    Assert.Contains(CSharpCompiler.Build("string s = null; Console.WriteLine(s);").Diagnostics,
        d => d.Id == "CS8600" && d.Level == DiagnosticLevel.Warning);
[Fact] public void Build_LibraryWithoutEntryPoint_Succeeds() =>
    Assert.True(CSharpCompiler.Build("public class A {}").Success);
[Fact] public void Analyze_DoesNotEmit() => Assert.Null(CSharpCompiler.Analyze("class A {}").Assembly);
[Fact] public void Build_ChecksErrors_AreTaggedChecks() =>
    Assert.Contains(CSharpCompiler.Build("public class A {}", "static class C { static void M() { nope(); } }").Diagnostics,
        d => d.File == SourceFile.Checks && d.Id == "CS0103");
```

- [ ] **Step 3: Run tests — expect compile failure** (`dotnet test` → "CSharpCompiler does not exist").

- [ ] **Step 4: Implement**
  - `CompilerDefaults`: `CSharpParseOptions(LanguageVersion.CSharp14)`; global-usings syntax tree (path `GlobalUsings.g.cs`) with `global using global::<ns>;` for the five namespaces; references = `Basic.Reference.Assemblies.Net100.References.All` (Task 4 appends more).
  - Trees: user path `user.cs`, checks path `checks.cs`. `OutputKind.ConsoleApplication` when the user tree has a `GlobalStatementSyntax` or a `static` method named `Main`; else `DynamicallyLinkedLibrary`. Assembly name `UserCode_<guid N>`. `NullableContextOptions.Enable`.
  - Diagnostics: drop `Hidden`; map file by tree path (`checks.cs` → `Checks`, everything else incl. no location → `User`, location-less → line 1 col 1); positions from `GetLineSpan()` + 1.
  - `Build` emits to `MemoryStream` only when no error diagnostics; `Success` = no errors.

- [ ] **Step 5: Run tests — expect PASS** (`dotnet test`).

- [ ] **Step 6: Commit** existing docs (`CONTEXT.md`, `DESIGN.md`, `docs/`) in a first commit `docs: add context, ADRs, design foundation, spec and M1 plan`, then the scaffold + compiler as `feat(core): Roslyn compile pipeline`.

---

### Task 2: Browser API policy (DP0001)

**Files:**
- Create: `core/DesignPatterns.Core/Compilation/ApiPolicy.cs`
- Modify: `core/DesignPatterns.Core/Compilation/CSharpCompiler.cs` (append policy diagnostics in `Analyze` and `Build`; any DP0001 makes `Success` false and suppresses emit)
- Test: `tests/DesignPatterns.Core.Tests/Compilation/ApiPolicyTests.cs`

**Interfaces:**
- Consumes: `CSharpCompilation`, user `SyntaxTree`, `DiagnosticInfo` (Task 1)
- Produces: `public static class ApiPolicy { public static IReadOnlyList<DiagnosticInfo> Find(CSharpCompilation compilation, SyntaxTree userTree); }`

Forbidden (match by symbol or its containing type/namespace, report the most specific listed name as `api`):
- Namespaces: `System.IO` (allowed types: `StringReader`, `StringWriter`, `TextReader`, `TextWriter`), `System.Net`, `System.Reflection.Emit`
- Types: `System.Threading.Thread`, `System.Threading.ThreadPool`, `System.Threading.Tasks.Parallel`, `System.Diagnostics.Process`
- Members: `System.Environment.Exit`, `System.Console.Read`, `System.Console.ReadLine`, `System.Console.ReadKey`

- [ ] **Step 1: Write failing tests**

```csharp
[Theory]
[InlineData("System.IO.File.ReadAllText(\"a\");", "System.IO.File")]
[InlineData("Console.ReadLine();", "System.Console.ReadLine")]
[InlineData("new Thread(() => {}).Start();", "System.Threading.Thread")]
[InlineData("Parallel.For(0, 2, i => {});", "System.Threading.Tasks.Parallel")]
[InlineData("Environment.Exit(0);", "System.Environment.Exit")]
public void Forbidden_ReportsDP0001(string code, string api) {
    var r = CSharpCompiler.Analyze(code);
    var d = Assert.Single(r.Diagnostics, d => d.Id == "DP0001");
    Assert.Equal(api, d.Args!["api"]);
    Assert.Equal($"Not available in the browser runtime: {api}", d.Message);
    Assert.False(r.Success);
}
[Theory]
[InlineData("var w = new System.IO.StringWriter(); w.Write(1);")]
[InlineData("await Task.Delay(1); var t = Task.Run(() => 1);")]
[InlineData("var l = new Lazy<int>(() => 1); lock (l) { }")]
public void Allowed_HasNoDP0001(string code) =>
    Assert.DoesNotContain(CSharpCompiler.Analyze(code).Diagnostics, d => d.Id == "DP0001");
[Fact] public void Forbidden_BlocksEmit() => Assert.Null(CSharpCompiler.Build("Console.ReadLine();").Assembly);
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement `ApiPolicy.Find`** — walk `IdentifierNameSyntax`/`MemberAccessExpressionSyntax`/`ObjectCreationExpressionSyntax` nodes of the user tree, resolve with the semantic model, report one DP0001 per offending node location (dedupe nested matches on the same span).
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat(core): DP0001 browser API policy`.

---

### Task 3: Program execution — load, run Main, capture output

**Files:**
- Create: `core/DesignPatterns.Core/Execution/{RuntimeLimits,CappedStringWriter,ConsoleCapture,ExceptionUnwrapper,RunOutcome,LoadedProgram}.cs`
- Test: `tests/DesignPatterns.Core.Tests/Execution/{CappedStringWriterTests,LoadedProgramRunTests}.cs`

**Interfaces:**
- Consumes: `TestCompile.Bytes` (Task 1)
- Produces:
  ```csharp
  namespace DesignPatterns.Core.Execution;
  public static class RuntimeLimits { public const int MaxOutputChars = 65_536; public const int TimeoutMs = 5_000; public const int RecycleAfterLoads = 50; }
  public sealed class CappedStringWriter(int capacity) : TextWriter { public bool Truncated { get; } public override string ToString(); }
  public sealed record ExceptionInfo(string Type, string Message);
  public sealed record RunOutcome(string Stdout, bool Truncated, ExceptionInfo? Exception, bool HasEntryPoint);
  public sealed class LoadedProgram {
      public static LoadedProgram Load(byte[] assembly, string userSource);   // fresh non-collectible AssemblyLoadContext per load
      public Assembly Assembly { get; }  public string Source { get; }  public bool HasEntryPoint { get; }
      public Task<RunOutcome> RunMainAsync();
  }
  ```

- [ ] **Step 1: Write failing tests**

```csharp
// CappedStringWriterTests
[Fact] public void DropsWritesBeyondCapacity() {
    var w = new CappedStringWriter(10);
    for (var i = 0; i < 1000; i++) w.Write("abc");
    Assert.Equal(10, w.ToString().Length); Assert.True(w.Truncated);
}
// LoadedProgramRunTests
static Task<RunOutcome> Run(string code) => LoadedProgram.Load(TestCompile.Bytes(code), code).RunMainAsync();
[Fact] public async Task PrintsOutput() => Assert.Equal("Hello" + Environment.NewLine, (await Run("Console.WriteLine(\"Hello\");")).Stdout);
[Fact] public async Task PreservesUnicode() => Assert.Equal("Ünïcødé ✓", (await Run("Console.Write(\"Ünïcødé ✓\");")).Stdout);
[Fact] public async Task TruncatesAtCap() {
    var r = await Run("Console.Write(new string('x', 70000));");
    Assert.Equal(65_536, r.Stdout.Length); Assert.True(r.Truncated);
}
[Fact] public async Task ReportsUnwrappedException() =>
    Assert.Equal(new ExceptionInfo("System.InvalidOperationException", "boom"),
        (await Run("throw new InvalidOperationException(\"boom\");")).Exception);
[Fact] public async Task UnwrapsStaticConstructorException() =>
    Assert.Equal("System.ArgumentException",
        (await Run("_ = S.V; static class S { public static int V; static S() { throw new ArgumentException(\"x\"); } }")).Exception!.Type);
[Fact] public async Task AwaitsAsyncTopLevel() => Assert.Equal("done", (await Run("await Task.Delay(10); Console.Write(\"done\");")).Stdout);
[Fact] public async Task UnwrapsExceptionAfterAwait() =>
    Assert.Equal("System.FormatException", (await Run("await Task.Yield(); throw new FormatException();")).Exception!.Type);
[Fact] public async Task NoEntryPoint() {
    var r = await Run("public class A {}");
    Assert.False(r.HasEntryPoint); Assert.Equal("", r.Stdout);
}
[Fact] public async Task SameTypeNamesInTwoLoadsDoNotConflict() {
    Assert.Equal("1", (await Run("Console.Write(Foo.V); static class Foo { public const int V = 1; }")).Stdout);
    Assert.Equal("2", (await Run("Console.Write(Foo.V); static class Foo { public const int V = 2; }")).Stdout);
}
[Fact] public async Task RestoresConsoleOut() { var before = Console.Out; await Run("Console.Write(1);"); Assert.Same(before, Console.Out); }
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.**
  - `RunMainAsync`: if the entry point's declaring type has a static method `<Main>$` or `Main` returning `Task`/`Task<int>`, invoke and **await** it (never the synthesized sync wrapper — blocking `GetResult()` deadlocks single-threaded WebAssembly); otherwise invoke `Assembly.EntryPoint`. Pass `new object[] { Array.Empty<string>() }` when the method takes one parameter.
  - `ConsoleCapture.RunAsync(Func<Task>) → (string stdout, bool truncated)` swaps `Console.Out` to a `CappedStringWriter(RuntimeLimits.MaxOutputChars)` and restores it in `finally`.
  - `ExceptionUnwrapper.Unwrap(Exception)`: peel `TargetInvocationException`, `TypeInitializationException`, single-inner `AggregateException`; `ExceptionInfo(type.FullName, message)`.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat(core): load and run learner programs with capped output`.

---

### Task 4: Check runtime (`DesignPatterns.Checks`) and Check execution

**Files:**
- Create: `core/DesignPatterns.Checks/DesignPatterns.Checks.csproj` (net10.0, references Microsoft.CodeAnalysis.CSharp same version as Core) and `{CheckAttribute,CheckFailedException,Expect,CheckContext,Code,TypeFacts,Source}.cs`
- Create: `core/DesignPatterns.Core/Compilation/LoadedMetadata.cs`, `core/DesignPatterns.Core/Execution/CheckResult.cs`
- Modify: `CompilerDefaults.cs` (add metadata refs for `DesignPatterns.Checks`, `Microsoft.CodeAnalysis`, `Microsoft.CodeAnalysis.CSharp`), `LoadedProgram.cs` (add Check discovery + run), Core csproj (`AllowUnsafeBlocks=true`, ProjectReference to Checks)
- Test: `tests/DesignPatterns.Core.Tests/Execution/CheckRunTests.cs`

**Interfaces:**
- Produces (`namespace DesignPatterns.Checks`):
  ```csharp
  [AttributeUsage(AttributeTargets.Method)] public sealed class CheckAttribute(string id) : Attribute { public string Id { get; } = id; }
  public sealed class CheckFailedException(string reason, IReadOnlyDictionary<string, string> args) : Exception(reason) {
      public string Reason { get; } public IReadOnlyDictionary<string, string> Args { get; } }
  public static class Expect {
      public static void That(bool condition, string reason = "isFalse", object? args = null);
      public static void Equal<T>(T expected, T actual);            // notEqual {expected, actual}
      public static void Same(object? a, object? b);                // notSame
      public static void NotSame(object? a, object? b);             // same
      public static TException Throws<TException>(Action action) where TException : Exception; // didNotThrow {expected} | wrongException {expected, actual}
      [DoesNotReturn] public static void Fail(string reason, object? args = null);
  }
  public sealed class CheckContext(Assembly assembly, string source) { public static CheckContext Current { get; set; } public Assembly Assembly { get; } public string Source { get; } }
  public static class Code { public static TypeFacts Type(string name); }   // typeNotFound {type}
  public sealed class TypeFacts {
      public Type Clr { get; } public bool IsInterface { get; } public bool IsAbstract { get; } public bool IsSealed { get; }
      public IReadOnlyList<ConstructorInfo> Constructors { get; }   // instance ctors, all accessibilities
      public IReadOnlyList<FieldInfo> StaticFields { get; }         // all accessibilities
      public bool Implements(string interfaceName);
  }
  public static class Source { public static CompilationUnitSyntax Root { get; } }  // parsed from CheckContext.Current.Source, cached per context
  ```
  `args` objects are anonymous-type instances; each public property becomes a string arg via `Convert.ToString(value, CultureInfo.InvariantCulture)` (`null` → `"null"`).
- Produces (`namespace DesignPatterns.Core`):
  ```csharp
  public static class LoadedMetadata { public static MetadataReference For(Assembly loaded); } // via AssemblyExtensions.TryGetRawMetadata — works without Assembly.Location (WebAssembly)
  public enum CheckStatus { Passed, Failed, Errored, TimedOut }
  public sealed record CheckResult(string Id, CheckStatus Status, string? Reason = null, IReadOnlyDictionary<string, string>? Args = null);
  // LoadedProgram additions:
  public IReadOnlyList<string> CheckIds { get; }      // [Check] static, parameterless, void/Task methods, in metadata-token order; duplicate id → InvalidOperationException at Load
  public Task<CheckResult> RunCheckAsync(string id);  // unknown id → ArgumentException; output discarded
  ```

- [ ] **Step 1: Write failing tests** (`CheckRunTests`; helper `Load(user, checks)` = `LoadedProgram.Load(TestCompile.Bytes(user, checks), user)`):

```csharp
const string Singleton = "public sealed class Logger { private Logger() {} public static Logger Instance { get; } = new(); }";
const string SingletonChecks = """
    using DesignPatterns.Checks;
    static class C {
        [Check("same-instance")] static void Same() => Expect.Same(Logger.Instance, Logger.Instance);
        [Check("private-ctor")] static void Ctor() => Expect.That(Code.Type("Logger").Constructors.All(c => !c.IsPublic), "publicConstructor");
    }
    """;
[Fact] public async Task PassingChecks_InDeclarationOrder() {
    var p = Load(Singleton, SingletonChecks);
    Assert.Equal(new[] { "same-instance", "private-ctor" }, p.CheckIds);
    foreach (var id in p.CheckIds) Assert.Equal(CheckStatus.Passed, (await p.RunCheckAsync(id)).Status);
}
[Fact] public async Task NotSame_Fails() {
    var r = await Load("public sealed class Logger { private Logger() {} public static Logger Instance => new(); }", SingletonChecks).RunCheckAsync("same-instance");
    Assert.Equal((CheckStatus.Failed, "notSame"), (r.Status, r.Reason));
}
[Fact] public async Task LearnerException_IsErroredThrew() {
    var r = await Load("public static class X { public static void Go() => throw new NotImplementedException(); }",
        "using DesignPatterns.Checks; static class C { [Check(\"go\")] static void Go() => X.Go(); }").RunCheckAsync("go");
    Assert.Equal((CheckStatus.Errored, "threw", "System.NotImplementedException"), (r.Status, r.Reason, r.Args!["type"]));
}
[Fact] public async Task CustomFailArgs() {
    var r = await Load("public class A {}",
        "using DesignPatterns.Checks; static class C { [Check(\"n\")] static void N() => Expect.Fail(\"didNotNotify\", new { observer = \"PhoneDisplay\" }); }").RunCheckAsync("n");
    Assert.Equal(("didNotNotify", "PhoneDisplay"), (r.Reason, r.Args!["observer"]));
}
[Fact] public async Task Equal_ReportsExpectedActual() {
    var r = await Load("public class A {}", "using DesignPatterns.Checks; static class C { [Check(\"e\")] static void E() => Expect.Equal(3, 4); }").RunCheckAsync("e");
    Assert.Equal(("notEqual", "3", "4"), (r.Reason, r.Args!["expected"], r.Args!["actual"]));
}
[Fact] public async Task MissingType_TypeNotFound() {
    var r = await Load("public class A {}", "using DesignPatterns.Checks; static class C { [Check(\"t\")] static void T() => Code.Type(\"Nope\"); }").RunCheckAsync("t");
    Assert.Equal(("typeNotFound", "Nope"), (r.Reason, r.Args!["type"]));
}
[Fact] public async Task Source_SyntaxCheck() {
    var r = await Load("public class A { public int F(int x) { if (x > 0) return 1; return 0; } }", """
        using DesignPatterns.Checks; using Microsoft.CodeAnalysis.CSharp.Syntax;
        static class C { [Check("no-if")] static void NoIf() => Expect.That(!Source.Root.DescendantNodes().OfType<IfStatementSyntax>().Any(), "usesIf"); }
        """).RunCheckAsync("no-if");
    Assert.Equal((CheckStatus.Failed, "usesIf"), (r.Status, r.Reason));
}
[Fact] public async Task AsyncCheck_IsAwaited() =>
    Assert.Equal(CheckStatus.Passed, (await Load("public class A {}",
        "using DesignPatterns.Checks; static class C { [Check(\"a\")] static async Task A() { await Task.Delay(5); Expect.That(true); } }").RunCheckAsync("a")).Status);
[Fact] public void DuplicateIds_Throw() => Assert.Throws<InvalidOperationException>(() => Load("public class A {}",
    "using DesignPatterns.Checks; static class C { [Check(\"x\")] static void A() {} [Check(\"x\")] static void B() {} }"));
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.** `RunCheckAsync` sets `CheckContext.Current` before invoking; maps no exception → `Passed`, `CheckFailedException` → `Failed(reason, args)`, any other (unwrapped via `ExceptionUnwrapper`) → `Errored("threw", {type, message})`. Learner assemblies resolve `DesignPatterns.Checks` from the default context, so `CheckContext` is shared.
- [ ] **Step 4: Run — expect PASS** (whole suite).
- [ ] **Step 5: Commit** `feat(core): Check authoring API and Check runner`.

---

### Task 5: Contract verifier

**Files:**
- Create: `core/DesignPatterns.Core/Contracts/{Contract,ContractViolation,ContractVerifier}.cs`
- Test: `tests/DesignPatterns.Core.Tests/Contracts/ContractVerifierTests.cs`

**Interfaces:**
- Consumes: `CompilationOutcome.Compilation` from `CSharpCompiler.Analyze` (Task 1)
- Produces:
  ```csharp
  namespace DesignPatterns.Core.Contracts;
  public enum ContractTypeKind { Class, AbstractClass, Interface, Any }
  public sealed record ContractType(string Name, ContractTypeKind Kind, IReadOnlyList<string> Members);
  public sealed record Contract(IReadOnlyList<ContractType> Types);
  public enum ContractViolationCode { MissingType, WrongKind, MissingMember }
  public sealed record ContractViolation(ContractViolationCode Code, string Type, string? Member = null);
  public static class ContractVerifier { public static IReadOnlyList<ContractViolation> Verify(CSharpCompilation compilation, Contract contract); }
  ```

Rules: a type matches by simple name among **public source-declared** types in any namespace. `Class` = non-interface class (abstract allowed); `AbstractClass` = abstract class; `Interface`; `Any`. Each member string is parsed with `SyntaxFactory.ParseMemberDeclaration` (append `;` if it does not end in `;` or `}`): method → public method with same name, same `static`-ness, same return type and parameter types compared as `ToDisplayString(SymbolDisplayFormat.MinimallyQualifiedFormat)` against the parsed type text (whitespace-normalized); parameter names ignored. Property → public, same name/type/static-ness, public getter if `get` listed, public setter if `set` listed. Constructor (`Milk(ICoffee inner)`) → public instance constructor with those parameter types. An unparseable member string throws `ArgumentException` (content bug).

- [ ] **Step 1: Write failing tests**

```csharp
static IReadOnlyList<ContractViolation> V(string code, params ContractType[] types) =>
    ContractVerifier.Verify(CSharpCompiler.Analyze(code).Compilation, new Contract(types));
static readonly ContractType IObs = new("IObserver", ContractTypeKind.Interface, ["void Update(int temp)"]);
const string Obs = "public interface IObserver { void Update(int t); } public class WeatherStation { public void Subscribe(IObserver o) {} }";
[Fact] public void Satisfied() => Assert.Empty(V(Obs, IObs, new("WeatherStation", ContractTypeKind.Class, ["void Subscribe(IObserver o)"])));
[Fact] public void MissingType() => Assert.Equal(new ContractViolation(ContractViolationCode.MissingType, "Station"), Assert.Single(V(Obs, new ContractType("Station", ContractTypeKind.Any, []))));
[Fact] public void WrongKind() => Assert.Equal(ContractViolationCode.WrongKind, Assert.Single(V("public class IObserver { public void Update(int t) {} }", IObs)).Code);
[Fact] public void MisspelledMember() => Assert.Equal(new ContractViolation(ContractViolationCode.MissingMember, "IObserver", "void Update(int temp)"),
    Assert.Single(V("public interface IObserver { void Updte(int t); }", IObs)));
[Fact] public void ParameterTypeMismatch() => Assert.Single(V("public interface IObserver { void Update(long t); }", IObs));
[Fact] public void StaticPropertyRequired() => Assert.Single(V("public class Logger { public Logger Instance { get; } = null!; }",
    new ContractType("Logger", ContractTypeKind.Class, ["static Logger Instance { get; }"])));
[Fact] public void PublicConstructorRequired() {
    var milk = new ContractType("Milk", ContractTypeKind.Class, ["Milk(ICoffee inner)"]);
    Assert.Empty(V("public interface ICoffee {} public class Milk { public Milk(ICoffee inner) {} }", milk));
    Assert.Single(V("public interface ICoffee {} public class Milk { private Milk(ICoffee inner) {} }", milk));
}
[Fact] public void NonPublicTypeIsMissing() => Assert.Equal(ContractViolationCode.MissingType, Assert.Single(V("interface IObserver { void Update(int t); }", IObs)).Code);
[Fact] public void GenericParameterTypes() => Assert.Empty(V("public class Bus { public void Send(List<string> m) {} }",
    new ContractType("Bus", ContractTypeKind.Class, ["void Send(List<string> messages)"])));
```

- [ ] **Step 2: Run — expect FAIL.** · [ ] **Step 3: Implement.** · [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat(core): Contract verifier`.

---

### Task 6: JSON protocol and services

**Files:**
- Create: `core/DesignPatterns.Core/Protocol/{Messages,ProtocolJson,CompilerService,RunnerService}.cs`
- Modify: enums from Tasks 1, 4, 5 gain `[JsonStringEnumMemberName("<camelCase>")]` on each member
- Test: `tests/DesignPatterns.Core.Tests/Protocol/{ProtocolJsonTests,ServicesTests}.cs`

**Interfaces:**
- Consumes: `CSharpCompiler` (T1–2), `LoadedProgram`, `CheckResult` (T3–4), `Contract*` (T5)
- Produces:
  ```csharp
  namespace DesignPatterns.Core.Protocol;
  public enum CompilePurpose { Diagnostics, Run, Check }
  public sealed record CompileRequest(string Source, CompilePurpose Purpose, string? ChecksSource = null, Contract? Contract = null);
  public sealed record CompileResponse(bool Success, IReadOnlyList<DiagnosticInfo> Diagnostics, IReadOnlyList<ContractViolation> ContractViolations, string? AssemblyBase64);
  public sealed record LoadRequest(string AssemblyBase64, string Source);
  public sealed record LoadResponse(IReadOnlyList<string> CheckIds, bool HasEntryPoint);
  public static class ProtocolJson { public static string Serialize<T>(T value); public static T Deserialize<T>(string json); } // source-generated JsonSerializerContext, camelCase, omit nulls
  public static class CompilerService { public static CompileResponse Compile(CompileRequest request); }
  public sealed class RunnerService {   // holds the current LoadedProgram
      public LoadResponse Load(LoadRequest request);
      public Task<RunOutcome> RunMainAsync();          // before Load → InvalidOperationException
      public Task<CheckResult> RunCheckAsync(string id);
  }
  ```
  `Compile` by purpose: **Diagnostics** → `Analyze`, no assembly. **Run** → `Build(source)`. **Check** → `Analyze` user; stop on errors; verify Contract when present, stop with `Success=false` and violations; then `Build(source, checksSource)`.

- [ ] **Step 1: Write failing tests**

```csharp
[Fact] public void CompileRequest_ParsesCamelCaseJson() {
    var r = ProtocolJson.Deserialize<CompileRequest>("""
        {"source":"x","purpose":"check","checksSource":"y","contract":{"types":[{"name":"Logger","kind":"abstractClass","members":["static Logger Instance { get; }"]}]}}
        """);
    Assert.Equal((CompilePurpose.Check, ContractTypeKind.AbstractClass), (r.Purpose, r.Contract!.Types[0].Kind));
}
[Fact] public void CompileResponse_UsesCamelCaseEnumsAndOmitsNulls() {
    var json = ProtocolJson.Serialize(CompilerService.Compile(new("var x = y;", CompilePurpose.Diagnostics)));
    Assert.Contains("\"level\":\"error\"", json); Assert.Contains("\"file\":\"user\"", json); Assert.DoesNotContain("assemblyBase64", json);
}
[Fact] public void CheckResult_SerializesStatus() =>
    Assert.Contains("\"status\":\"timedOut\"", ProtocolJson.Serialize(new CheckResult("x", CheckStatus.TimedOut)));
[Fact] public void Check_StopsAtContractViolation() {
    var r = CompilerService.Compile(new("public class A {}", CompilePurpose.Check, "static class C {}",
        new Contract([new("Logger", ContractTypeKind.Class, [])])));
    Assert.False(r.Success); Assert.Null(r.AssemblyBase64);
    Assert.Equal(ContractViolationCode.MissingType, Assert.Single(r.ContractViolations).Code);
}
[Fact] public async Task Singleton_EndToEndThroughJson() {
    // Singleton/SingletonChecks constants as in Task 4; every hop goes through ProtocolJson to mimic the worker boundary
    var compiled = ProtocolJson.Deserialize<CompileResponse>(ProtocolJson.Serialize(CompilerService.Compile(new(Singleton, CompilePurpose.Check, SingletonChecks,
        new Contract([new("Logger", ContractTypeKind.Class, ["static Logger Instance { get; }"])])))));
    var runner = new RunnerService();
    var loaded = runner.Load(new(compiled.AssemblyBase64!, Singleton));
    Assert.False(loaded.HasEntryPoint);
    foreach (var id in loaded.CheckIds) Assert.Equal(CheckStatus.Passed, (await runner.RunCheckAsync(id)).Status);
}
[Fact] public Task RunBeforeLoad_Throws() => Assert.ThrowsAsync<InvalidOperationException>(() => new RunnerService().RunMainAsync());
```

- [ ] **Step 2: Run — expect FAIL.** · [ ] **Step 3: Implement.** · [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat(core): JSON protocol and compiler/runner services`.

---

### Task 7: WebAssembly host (spike gate)

**Files:**
- Create: `compiler/DesignPatterns.Wasm/DesignPatterns.Wasm.csproj`, `Program.cs`, `CompilerExports.cs`, `RunnerExports.cs`, `smoke.mjs`
- Modify: `DesignPatterns.slnx` (add project)

**Interfaces:**
- Consumes: `CompilerService`, `RunnerService`, `ProtocolJson` (Task 6)
- Produces (JS sees them as `exports.DesignPatterns.Wasm.<Class>.<Method>`):
  ```csharp
  namespace DesignPatterns.Wasm;
  [SupportedOSPlatform("browser")] public static partial class CompilerExports {
      [JSExport] public static string Compile(string requestJson);   // CompileRequest → CompileResponse JSON
      [JSExport] public static string WarmUp();                      // builds a tiny program once; returns "ok"
  }
  [SupportedOSPlatform("browser")] public static partial class RunnerExports {   // one static RunnerService
      [JSExport] public static string Load(string requestJson);      // LoadRequest → LoadResponse JSON
      [JSExport] public static Task<string> RunMain();               // → RunOutcome JSON
      [JSExport] public static Task<string> RunCheck(string id);     // → CheckResult JSON
  }
  ```

csproj: `Sdk="Microsoft.NET.Sdk.WebAssembly"`, `TargetFramework=net10.0`, `OutputType=Exe`, `AllowUnsafeBlocks=true`, `PublishTrimmed=false` (learner code and Roslyn need the untrimmed framework), `InvariantGlobalization=true`, ProjectReference to Core. `Program.Main` returns immediately.

- [ ] **Step 1: Publish** — `dotnet publish compiler/DesignPatterns.Wasm -c Release -o web/public/dotnet`. Expected: `web/public/dotnet/wwwroot/_framework/dotnet.js` exists. If the SDK asks for the `wasm-tools` workload, run `dotnet workload install wasm-tools` and record that in the README and CI (Task 11). If `_framework` lands elsewhere, the path is set once in `web/src/compiler/dotnetBoot.ts` (Task 8).
- [ ] **Step 2: Node smoke** — `smoke.mjs` imports `web/public/dotnet/wwwroot/_framework/dotnet.js`, `dotnet.create()`, `getAssemblyExports(getConfig().mainAssemblyName)`, then Compile(run) `Console.WriteLine("Hello from wasm");` → Load → RunMain, and prints the RunOutcome JSON plus elapsed ms for WarmUp and the first Compile. Run `node compiler/DesignPatterns.Wasm/smoke.mjs`. Expected: `"stdout":"Hello from wasm\n"`. If the browser-wasm bundle cannot boot under Node, note it and rely on Task 10's browser check instead — do not block.
- [ ] **Step 3: Record** the publish size (`du -sh web/public/dotnet/wwwroot/_framework`) and the warm-up/compile timings in `compiler/DesignPatterns.Wasm/README.md`.
- [ ] **Step 4: Commit** `feat(wasm): JSExport host for compiler and runner`.

---

### Task 8: Web scaffold, worker protocol, CompilerClient and RunnerHost

**Files:**
- Create: `web/` via `npm create vite@latest web -- --template react-ts`; add deps `react-router i18next react-i18next monaco-editor @monaco-editor/react lucide-react`; dev deps `vitest jsdom @testing-library/react @testing-library/jest-dom @playwright/test`
- Modify: `web/package.json` scripts: `build:dotnet` = `dotnet publish ../compiler/DesignPatterns.Wasm -c Release -o public/dotnet`, `test` = `vitest`, `e2e` = `playwright test`; `vite.config.ts`: `base: process.env.VITE_BASE ?? '/'`, `worker.format: 'es'`, vitest `environment: 'jsdom'`
- Create: `web/src/compiler/{protocol,dotnetBoot,workerRpc,compiler.worker,runner.worker,CompilerClient,RunnerHost}.ts`
- Test: `web/src/compiler/{CompilerClient,RunnerHost}.test.ts` (with a `FakeWorker` test helper in `web/src/compiler/testing/FakeWorker.ts`)

**Interfaces:**
- Consumes: wasm exports (Task 7); JSON shapes (Task 6)
- Produces:
  ```ts
  // protocol.ts — mirrors Task 6 JSON exactly
  export type DiagnosticLevel = 'error' | 'warning' | 'info';
  export interface DiagnosticInfo { id: string; level: DiagnosticLevel; message: string; file: 'user' | 'checks';
    startLine: number; startColumn: number; endLine: number; endColumn: number; args?: Record<string, string> }
  export interface ContractType { name: string; kind: 'class' | 'abstractClass' | 'interface' | 'any'; members: string[] }
  export interface CompileRequest { source: string; purpose: 'diagnostics' | 'run' | 'check'; checksSource?: string; contract?: { types: ContractType[] } }
  export interface ContractViolation { code: 'missingType' | 'wrongKind' | 'missingMember'; type: string; member?: string }
  export interface CompileResponse { success: boolean; diagnostics: DiagnosticInfo[]; contractViolations: ContractViolation[]; assemblyBase64?: string }
  export interface LoadRequest { assemblyBase64: string; source: string }
  export interface LoadResponse { checkIds: string[]; hasEntryPoint: boolean }
  export interface RunOutcome { stdout: string; truncated: boolean; exception?: { type: string; message: string }; hasEntryPoint: boolean }
  export interface CheckResult { id: string; status: 'passed' | 'failed' | 'errored' | 'timedOut'; reason?: string; args?: Record<string, string> }
  export const RUN_TIMEOUT_MS = 5000; export const RECYCLE_AFTER_LOADS = 50;

  // workerRpc.ts — wire messages
  export type ToWorker = { id: number; method: string; payload: string };
  export type FromWorker = { type: 'ready' } | { type: 'bootError'; message: string }
    | { type: 'result'; id: number; ok: true; result: string } | { type: 'result'; id: number; ok: false; error: string };
  export interface WorkerLike { postMessage(m: ToWorker): void; terminate(): void; onmessage: ((e: { data: FromWorker }) => void) | null }

  // CompilerClient.ts
  export class CompilerClient {
    constructor(createWorker: () => WorkerLike);
    readonly ready: Promise<void>;                       // rejects with Error(message) on bootError
    compile(req: CompileRequest): Promise<CompileResponse>;
    dispose(): void;
  }
  // RunnerHost.ts
  export type Timed<T> = { kind: 'ok'; value: T } | { kind: 'timedOut' };
  export class RunnerHost {
    constructor(createWorker: () => WorkerLike, opts?: { timeoutMs?: number; recycleAfterLoads?: number });
    readonly ready: Promise<void>;
    load(req: LoadRequest): Promise<LoadResponse>;       // not timed; remembers req for reloads
    runMain(): Promise<Timed<RunOutcome>>;
    runCheck(id: string): Promise<Timed<CheckResult>>;
    dispose(): void;
  }
  ```

Worker boot (`dotnetBoot.ts`) — the one place that knows the bundle path:

```ts
export async function bootDotnet() {
  const url = new URL(`${import.meta.env.BASE_URL}dotnet/wwwroot/_framework/dotnet.js`, self.location.origin).href;
  const { dotnet } = await import(/* @vite-ignore */ url);
  const runtime = await dotnet.create();
  const exports = await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName);
  return exports.DesignPatterns.Wasm;
}
```

`compiler.worker.ts`: boot → `WarmUp()` → post `ready` (or `bootError`); dispatch `compile` to `CompilerExports.Compile`. `runner.worker.ts`: boot → `ready`; dispatch `load`/`runMain`/`runCheck`. Both reply `{type:'result', id, ok, result|error}`; exceptions become `ok:false`. Workers are created with `new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' })`.

RunnerHost semantics: a timeout timer starts when the request is posted to a **ready** worker. On timeout → `terminate()`, create a new worker, resolve `{kind:'timedOut'}`; the next `runMain`/`runCheck` first re-sends the remembered `load`. Before the 51st `load`, the worker is replaced (recycle).

- [ ] **Step 1: Write failing tests** (Vitest, `vi.useFakeTimers()`; `FakeWorker` records posted messages and lets the test emit `ready`/`result`):

```ts
it('times out runMain after 5000 ms, terminates and respawns the worker', async () => {
  const workers: FakeWorker[] = []; const host = new RunnerHost(() => { const w = new FakeWorker(); workers.push(w); return w; });
  workers[0].emitReady(); await host.ready;
  const p = host.runMain(); await vi.advanceTimersByTimeAsync(5000);
  expect(await p).toEqual({ kind: 'timedOut' });
  expect(workers[0].terminated).toBe(true); expect(workers).toHaveLength(2);
});
it('does not start the timeout before the worker is ready', async () => { /* runMain posted before ready; advance 6000; emitReady; reply ok → kind 'ok' */ });
it('reloads the remembered program before the next check after a timeout', async () => {
  /* load(req) ok → runCheck('a') times out → runCheck('b'): new worker receives method 'load' with req payload, then 'runCheck' with 'b' */
});
it('recycles the worker before the 51st load', async () => { /* 50 loads on worker 0; 51st load goes to worker 1; worker 0 terminated */ });
it('CompilerClient rejects ready and pending compiles on bootError', async () => {
  const w = new FakeWorker(); const c = new CompilerClient(() => w);
  const pending = c.compile({ source: 'x', purpose: 'diagnostics' }); w.emitBootError('no wasm');
  await expect(c.ready).rejects.toThrow('no wasm'); await expect(pending).rejects.toThrow('no wasm');
});
it('CompilerClient correlates out-of-order responses by id', async () => { /* two compiles; reply id 2 then id 1; each promise gets its own payload */ });
```

- [ ] **Step 2: Run** `npm test -- --run` — expect FAIL.
- [ ] **Step 3: Implement** the files above.
- [ ] **Step 4: Run** `npm test -- --run` — expect PASS; `npx tsc -b` — no errors.
- [ ] **Step 5: Commit** `feat(web): worker protocol, CompilerClient and RunnerHost`.

---

### Task 9: App shell, theme, i18n and Sandbox page

**Load `uxkin:no-ui-slop` before starting.** Follow `DESIGN.md` (tokens, 6px radius, 1px borders, Inter + JetBrains Mono, Lucide icons, visible 2px accent focus ring).

**Files:**
- Create: `web/src/styles/{tokens,base}.css` (all `DESIGN.md` tokens as CSS custom properties; dark under `[data-theme="dark"]` and under `@media (prefers-color-scheme: dark)` for `[data-theme="system"]`), `web/src/theme/ThemeProvider.tsx` (`'system' | 'light' | 'dark'`, persisted in `localStorage` key `dp.theme` inside try/catch, sets `data-theme` on `<html>`)
- Create: `web/src/i18n/index.ts` (i18next, `lng: 'en'`, `fallbackLng: 'en'`, namespaces `common`, `sandbox`, `diagnostics`), `web/src/locales/en/{common,sandbox,diagnostics}.json`
- Create: `web/src/compiler/CompilerProvider.tsx`, `web/src/editor/{monacoSetup,monacoTheme,CodeEditor,useLiveDiagnostics,diagnosticMessage}.ts(x)`, `web/src/features/sandbox/{SandboxPage,OutputPanel,runSandbox}.ts(x)`, `web/src/App.tsx` (routes: `/` → redirect `/sandbox`, `/sandbox`), `web/src/main.tsx`
- Test: `web/src/editor/{useLiveDiagnostics,diagnosticMessage,monacoTheme}.test.ts(x)`, `web/src/features/sandbox/{runSandbox,OutputPanel,SandboxPage}.test.ts(x)`

**Interfaces:**
- Consumes: `CompilerClient`, `RunnerHost`, protocol types (Task 8)
- Produces:
  ```ts
  // CompilerProvider.tsx
  export type CompilerStatus = 'starting' | 'ready' | 'failed';
  export function useCompiler(): { status: CompilerStatus; compiler: CompilerClient; runner: RunnerHost; error?: string };
  // monacoSetup.ts — bundles Monaco locally (no CDN): loader.config({ monaco }); editor worker via '?worker'; in DEV sets window.monaco
  // monacoTheme.ts
  export function buildMonacoTheme(readVar: (name: string) => string, base: 'vs' | 'vs-dark'): monaco.editor.IStandaloneThemeData;
  // CodeEditor.tsx
  export function CodeEditor(props: { value: string; onChange(v: string): void; diagnostics: DiagnosticInfo[]; readOnly?: boolean; ariaLabel: string }): JSX.Element;
  // useLiveDiagnostics.ts
  export function useLiveDiagnostics(source: string, compiler: Pick<CompilerClient, 'compile'> | null, delayMs?: number /* 500 */): DiagnosticInfo[];
  // diagnosticMessage.ts
  export function diagnosticMessage(d: DiagnosticInfo, t: TFunction): string;   // DP* → t(`diagnostics:${id}`, args); CS* → d.message
  // runSandbox.ts
  export type SandboxOutput =
    | { kind: 'idle' } | { kind: 'running' } | { kind: 'compileErrors'; diagnostics: DiagnosticInfo[] }
    | { kind: 'noEntryPoint' } | { kind: 'timedOut' }
    | { kind: 'completed'; stdout: string; truncated: boolean; exception?: { type: string; message: string } };
  export function runSandbox(source: string, compiler: Pick<CompilerClient, 'compile'>, runner: Pick<RunnerHost, 'load' | 'runMain'>): Promise<SandboxOutput>;
  ```
- `CodeEditor` shows only `file === 'user'` diagnostics as Monaco markers (severity by level), in theme `dp-light`/`dp-dark` built by `buildMonacoTheme` from the live CSS variables (`--bg`, `--text`, `--muted`, `--accent`, `--code-bg`, `--line-highlight`, `--border`).

Copy (exact `en` strings):
- `common.json`: `app.name` "Design Patterns Trainer"; `theme.system` "System", `theme.light` "Light", `theme.dark` "Dark"; `compiler.starting` "Starting the C# compiler…"; `compiler.ready` "C# compiler ready"; `compiler.failed` "The C# compiler couldn't start. Reload the page to try again."; `actions.reload` "Reload page".
- `sandbox.json`: `title` "Sandbox"; `intro` "Write any C# and run it. Nothing here is graded."; `run` "Run"; `running` "Running…"; `output.title` "Output"; `output.idle` "Run your program to see its output here."; `output.empty` "Your program finished without printing anything."; `output.truncated` "Output cut off at 64 KB."; `output.timedOut` "Stopped after 5 seconds — your program may contain an infinite loop."; `output.noEntryPoint` "Nothing to run — add top-level statements or a Main method."; `output.exception` "Unhandled exception: {{type}}: {{message}}"; `output.compileErrors` "Fix these errors to run your program:"; `output.location` "Line {{line}}, column {{column}}"; default code `defaultCode` = `Console.WriteLine("Hello, patterns!");`.
- `diagnostics.json`: `DP0001` "Not available in the browser runtime: {{api}}".

- [ ] **Step 1: Write failing tests**

```ts
it('useLiveDiagnostics keeps the newest result when responses arrive out of order', async () => {
  // fake compile: first call resolves after second; renderHook with source 'a' → advance 500 → rerender 'b' → advance 500
  // resolve call #2 (diag B) then call #1 (diag A) → result is [B]
});
it('useLiveDiagnostics waits 500 ms after the last change', async () => { /* 3 rerenders within 400 ms → exactly 1 compile call */ });
it('diagnosticMessage translates DP0001 and passes CS through', () => {
  expect(diagnosticMessage({ id: 'DP0001', args: { api: 'System.Console.ReadLine' }, ... }, t)).toBe('Not available in the browser runtime: System.Console.ReadLine');
  expect(diagnosticMessage({ id: 'CS0103', message: "The name 'y' does not exist in the current context", ... }, t)).toBe("The name 'y' does not exist in the current context");
});
it('runSandbox returns compileErrors with only errors', async () => { /* compile → success false, one error + one warning → diagnostics has the error only; runner not called */ });
it('runSandbox returns noEntryPoint without calling runMain', async () => { /* load → hasEntryPoint false */ });
it('runSandbox maps timedOut and completed', async () => { /* runMain → {kind:'timedOut'} → {kind:'timedOut'}; → ok outcome → completed with stdout */ });
it('OutputPanel renders timeout, truncation and exception copy', () => { /* exact strings from sandbox.json */ });
it('SandboxPage disables Run while the compiler is starting and shows the failure message when it fails', () => {
  /* mock useCompiler + CodeEditor; status 'starting' → Run disabled + "Starting the C# compiler…";
     status 'failed' → "The C# compiler couldn't start. Reload the page to try again." + "Reload page" button */
});
it('buildMonacoTheme maps CSS variables to editor colors', () => { /* readVar('--code-bg') → '#141416' → colors['editor.background'] === '#141416' */ });
```

- [ ] **Step 2: Run** `npm test -- --run` — expect FAIL.
- [ ] **Step 3: Implement.** Layout per spec §8: header (app name, theme switch); Sandbox = editor (left/top) and output panel (right/bottom) split ≥ 1024 px, stacked below; Run button primary with Lucide `Play` icon and `Ctrl/Cmd+Enter` shortcut; compiler status shown as a quiet inline status line with `data-state={status}` on its element; compile errors listed with "Line L, column C" that move the editor cursor on click.
- [ ] **Step 4: Run** `npm test -- --run` — expect PASS; `npm run build` — succeeds.
- [ ] **Step 5: Visual check** with `npm run build:dotnet && npm run dev`: inspect `/sandbox` at 390 px and 1440 px, light and dark, keyboard-only (Tab to editor, Run, theme switch; focus visible). Fix issues found.
- [ ] **Step 6: Commit** `feat(web): app shell, theming, i18n and Sandbox page`.

---

### Task 10: Dev engine harness and end-to-end tests

**Files:**
- Create: `web/src/features/dev/DevEnginePage.tsx` (route `/dev/engine`, registered only when `import.meta.env.DEV`)
- Create: `web/playwright.config.ts` (`webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true }`, chromium only, test timeout 120 s), `web/e2e/{sandbox,engine}.spec.ts`

**Interfaces:**
- Consumes: `useCompiler`, protocol types (Tasks 8–9); `window.monaco` in DEV (Task 9)
- Produces: `DevEnginePage` runs the Task 4 Singleton + checks through `compiler.compile({purpose:'check', contract})` → `runner.load` → `runner.runCheck` per id, and renders `JSON.stringify(results)` in `<pre data-testid="engine-results">` once done.

Helper in specs: `setCode(page, code)` = `page.evaluate(c => window.monaco.editor.getModels()[0].setValue(c), code)`; `waitReady(page)` = wait for `[data-state="ready"]`.

- [ ] **Step 1: Write the e2e tests**

```ts
test('runs hello world', async ({ page }) => {
  await page.goto('/sandbox'); await waitReady(page);
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByText('Hello, patterns!')).toBeVisible();
});
test('stops an infinite loop after 5 s and recovers', async ({ page }) => {
  await page.goto('/sandbox'); await waitReady(page);
  await setCode(page, 'while (true) { Console.Write("x"); }');
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByText('Stopped after 5 seconds — your program may contain an infinite loop.')).toBeVisible({ timeout: 10_000 });
  await setCode(page, 'Console.WriteLine("back");');
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByText('back', { exact: true })).toBeVisible();
});
test('shows a live error squiggle', async ({ page }) => {
  await page.goto('/sandbox'); await waitReady(page);
  await setCode(page, 'var x = y;');
  await expect(page.locator('.squiggly-error').first()).toBeVisible({ timeout: 5_000 });
});
test('reports DP0001 for Console.ReadLine', async ({ page }) => {
  await page.goto('/sandbox'); await waitReady(page);
  await setCode(page, 'var s = Console.ReadLine();');
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByText('Not available in the browser runtime: System.Console.ReadLine')).toBeVisible();
});
// engine.spec.ts
test('grades a Singleton in the browser', async ({ page }) => {
  await page.goto('/dev/engine');
  const results = JSON.parse(await page.getByTestId('engine-results').textContent({ timeout: 60_000 }) ?? '[]');
  expect(results.map((r: { id: string; status: string }) => [r.id, r.status])).toEqual([['same-instance', 'passed'], ['private-ctor', 'passed']]);
});
```

- [ ] **Step 2: Run** `npm run build:dotnet && npx playwright install chromium && npm run e2e` — expect FAIL only for the missing `/dev/engine` page.
- [ ] **Step 3: Implement `DevEnginePage`.**
- [ ] **Step 4: Run** `npm run e2e` — expect all PASS. If `dotnet.js` fails to boot inside a module worker, stop and report: this is the ADR 0001 gate.
- [ ] **Step 5: Commit** `test(web): end-to-end Sandbox and in-browser grading`.

---

### Task 11: CI and GitHub Pages deploy

**Files:**
- Create: `.github/workflows/ci.yml`, `web/scripts/postbuild.mjs`, `README.md` (prerequisites: .NET 10 SDK, Node 24; commands: `dotnet test`, `npm run build:dotnet`, `npm run dev`, `npm test`, `npm run e2e`)
- Modify: `web/package.json` (`build` = `tsc -b && vite build && node scripts/postbuild.mjs`)

`postbuild.mjs` copies `dist/index.html` → `dist/404.html` and writes an empty `dist/.nojekyll` (the `_framework` folder starts with an underscore).

Workflow: on `push` and `pull_request`. Job **test**: checkout → `actions/setup-dotnet` (`global-json-file: global.json`) → `actions/setup-node` (24, npm cache on `web/package-lock.json`) → `dotnet test` → in `web/`: `npm ci`, `npm run build:dotnet`, `npm test -- --run`, `npx playwright install --with-deps chromium`, `npm run e2e`. Job **deploy** (needs test, only `refs/heads/main`): permissions `pages: write`, `id-token: write`; build with `VITE_BASE=/${{ github.event.repository.name }}/ npm run build`; `actions/upload-pages-artifact` (path `web/dist`) → `actions/deploy-pages`.

- [ ] **Step 1: Local check** — `cd web && VITE_BASE=/design-patterns/ npm run build`; expect `dist/404.html`, `dist/.nojekyll`, `dist/dotnet/wwwroot/_framework/dotnet.js`; `npx vite preview --base /design-patterns/` → `/design-patterns/sandbox` runs hello world (manual).
- [ ] **Step 2: Commit** `ci: test, build and deploy to GitHub Pages`.
- [ ] **Step 3: Publish (needs the user)** — ask the user for the GitHub repository name/visibility and confirmation before creating it or pushing. Then enable Pages (source: GitHub Actions), push `main`, and watch the run (`gh run watch`). Expected: both jobs green; the Pages URL serves `/sandbox` and runs hello world.
- [ ] **Step 4: Record** the first-load transfer size measured in the deployed site's DevTools Network tab in `README.md`.

---

## Self-review notes

- Spec coverage for M1: §4 grading core (Checks, reasons, Contract) → Tasks 4–6; §5 runtime rules → Tasks 1–3, 8; §8 Sandbox + editor v1 → Task 9; §9 i18n for UI and DP diagnostics → Task 9; §10 architecture (core/compiler/web/tests, two workers, Pages) → Tasks 1, 7, 8, 11. Content pipeline, Lessons, Exercises, Progress, Exam and IDE features are M2–M5 by design.
- The async-entry-point rule (Task 3) and `TryGetRawMetadata` references (Task 4) exist specifically because WebAssembly is single-threaded and has no `Assembly.Location`; keep them even though native tests would pass without them.
