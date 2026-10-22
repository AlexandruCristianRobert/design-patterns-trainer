using DesignPatterns.Core;
using DesignPatterns.Core.Execution;

namespace DesignPatterns.Core.Tests.Execution;

[Collection(ConsoleCaptureCollection.Name)]
public class CheckRunTests
{
    static LoadedProgram Load(string user, string checks) => LoadedProgram.Load(TestCompile.Bytes(user, checks), user);

    internal const string Singleton = "public sealed class Logger { private Logger() {} public static Logger Instance { get; } = new(); }";
    internal const string SingletonChecks = """
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
    [Fact] public async Task UnknownId_Throws() =>
        await Assert.ThrowsAsync<ArgumentException>(() => Load(Singleton, SingletonChecks).RunCheckAsync("nope"));
    [Fact] public async Task NullArg_IsNullString() {
        var r = await Load("public class A {}", "using DesignPatterns.Checks; static class C { [Check(\"n\")] static void N() => Expect.Equal<string?>(null, \"x\"); }").RunCheckAsync("n");
        Assert.Equal(("null", "x"), (r.Args!["expected"], r.Args!["actual"]));
    }
    [Fact] public async Task SourceRoot_CachedAcrossChecks() {
        var p = Load("public class A {}", """
            using DesignPatterns.Checks; using Microsoft.CodeAnalysis.CSharp.Syntax;
            static class C {
                static object? first;
                [Check("a")] static void A() => first = Source.Root;
                [Check("b")] static void B() => Expect.Same(first, Source.Root);
            }
            """);
        Assert.Equal(CheckStatus.Passed, (await p.RunCheckAsync("a")).Status);
        Assert.Equal(CheckStatus.Passed, (await p.RunCheckAsync("b")).Status);
    }
}
