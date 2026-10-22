using DesignPatterns.Core.Execution;
using DesignPatterns.Core.Protocol;

namespace DesignPatterns.Content.Tests;

[Collection(ConsoleCaptureCollection.Name)]
public class ExampleTests
{
    public static IEnumerable<object?[]> Examples()
    {
        var patterns = Path.Combine(ContentLocator.Root, "patterns");
        var ids = Directory.Exists(patterns)
            ? Directory.GetDirectories(patterns).Order()
                .Where(d => File.Exists(Path.Combine(d, "example.cs")))
                .Select(Path.GetFileName).ToList()
            : [];
        if (ids.Count == 0) yield return [null]; // xUnit fails a Theory with no data
        foreach (var id in ids) yield return [id];
    }

    [Theory, MemberData(nameof(Examples))]
    public async Task Example_CompilesAndRuns(string? patternId)
    {
        if (patternId is null) return;
        var source = File.ReadAllText(Path.Combine(ContentLocator.Root, "patterns", patternId, "example.cs"));

        var compiled = CompilerService.Compile(new CompileRequest(source, CompilePurpose.Run));
        var errors = compiled.Diagnostics.Where(d => d.Level == Core.Compilation.DiagnosticLevel.Error)
            .Select(d => $"{d.Id} {d.StartLine}:{d.StartColumn} {d.Message}");
        Assert.True(compiled.Success, string.Join("; ", errors));

        var outcome = await LoadedProgram.Load(Convert.FromBase64String(compiled.AssemblyBase64!), source).RunMainAsync();
        Assert.True(outcome.HasEntryPoint, "example.cs must be a runnable program");
        Assert.Null(outcome.Exception);
        Assert.NotEqual("", outcome.Stdout);
    }
}
