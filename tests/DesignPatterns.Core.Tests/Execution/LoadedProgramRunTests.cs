using DesignPatterns.Core.Execution;

namespace DesignPatterns.Core.Tests.Execution;

// Console.SetOut is process-global: every test that captures console output must share this
// non-parallel collection (xUnit never runs tests of one collection concurrently).
[CollectionDefinition(Name, DisableParallelization = true)]
public class ConsoleCaptureCollection { public const string Name = "ConsoleCapture"; }

[Collection(ConsoleCaptureCollection.Name)]
public class LoadedProgramRunTests
{
    static Task<RunOutcome> Run(string code) => LoadedProgram.Load(TestCompile.Bytes(code), code).RunMainAsync();

    [Fact] public async Task PrintsOutput() => Assert.Equal("Hello" + Environment.NewLine, (await Run("Console.WriteLine(\"Hello\");")).Stdout);
    [Fact] public async Task PreservesUnicode() => Assert.Equal("Ünïcødé ✓", (await Run("Console.Write(\"Ünïcødé ✓\");")).Stdout);

    [Fact]
    public async Task TruncatesAtCap()
    {
        var r = await Run("Console.Write(new string('x', 70000));");
        Assert.Equal(65_536, r.Stdout.Length);
        Assert.True(r.Truncated);
    }

    [Fact]
    public async Task ReportsUnwrappedException() =>
        Assert.Equal(new ExceptionInfo("System.InvalidOperationException", "boom"),
            (await Run("throw new InvalidOperationException(\"boom\");")).Exception);

    [Fact]
    public async Task UnwrapsStaticConstructorException() =>
        Assert.Equal("System.ArgumentException",
            (await Run("_ = S.V; static class S { public static int V; static S() { throw new ArgumentException(\"x\"); } }")).Exception!.Type);

    [Fact] public async Task AwaitsAsyncTopLevel() => Assert.Equal("done", (await Run("await Task.Delay(10); Console.Write(\"done\");")).Stdout);

    [Fact]
    public async Task UnwrapsExceptionAfterAwait() =>
        Assert.Equal("System.FormatException", (await Run("await Task.Yield(); throw new FormatException();")).Exception!.Type);

    [Fact]
    public async Task NoEntryPoint()
    {
        var r = await Run("public class A {}");
        Assert.False(r.HasEntryPoint);
        Assert.Equal("", r.Stdout);
    }

    [Fact]
    public async Task SameTypeNamesInTwoLoadsDoNotConflict()
    {
        Assert.Equal("1", (await Run("Console.Write(Foo.V); static class Foo { public const int V = 1; }")).Stdout);
        Assert.Equal("2", (await Run("Console.Write(Foo.V); static class Foo { public const int V = 2; }")).Stdout);
    }

    [Fact]
    public async Task RunsExplicitAsyncTaskMain() =>
        Assert.Equal("a", (await Run("class P { static async Task Main() { await Task.Delay(5); Console.Write(\"a\"); } }")).Stdout);

    [Fact]
    public async Task RunsAsyncTaskIntMainWithArgs() =>
        Assert.Equal("0", (await Run("class P { static async Task<int> Main(string[] args) { await Task.Yield(); Console.Write(args.Length); return 0; } }")).Stdout);

    [Fact]
    public async Task RunsSyncMainWithArgs() =>
        Assert.Equal("s0", (await Run("class P { static void Main(string[] args) { Console.Write(\"s\" + args.Length); } }")).Stdout);

    [Fact]
    public async Task RestoresConsoleOut()
    {
        var before = Console.Out;
        await Run("Console.Write(1);");
        Assert.Same(before, Console.Out);
    }

    [Fact]
    public async Task CapturesConsoleErrorInTheSameStream() =>
        Assert.Equal("a!b", (await Run("Console.Write(\"a\"); Console.Error.Write(\"!\"); Console.Write(\"b\");")).Stdout);

    [Fact]
    public async Task ConsoleErrorCountsTowardsTheCap()
    {
        var r = await Run("Console.Write(new string('x', 65000)); Console.Error.Write(new string('e', 1000));");
        Assert.Equal(65_536, r.Stdout.Length);
        Assert.True(r.Truncated);
    }

    [Fact]
    public async Task RestoresConsoleError()
    {
        var before = Console.Error;
        await Run("Console.Error.Write(1);");
        Assert.Same(before, Console.Error);
    }
}
