using DesignPatterns.Core.Execution;
using DesignPatterns.Core.Protocol;

namespace DesignPatterns.Content.Tests;

/// <summary>Spec §3.3: every Quiz Question with expectedOutput must print exactly that when compiled and run.</summary>
[Collection(ConsoleCaptureCollection.Name)]
public class QuizOutputTests
{
    internal sealed class QuizQuestionYaml
    {
        public string Id { get; set; } = "";
        public string? Code { get; set; }
        public string? ExpectedOutput { get; set; }
    }

    private static string QuizDir => Path.Combine(ContentLocator.Root, "quiz");

    private static List<QuizQuestionYaml> Read(string file) =>
        ContentLocator.Yaml.Deserialize<List<QuizQuestionYaml>>(File.ReadAllText(Path.Combine(QuizDir, file))) ?? [];

    public static IEnumerable<object?[]> OutputQuestions()
    {
        var rows = Directory.Exists(QuizDir)
            ? Directory.GetFiles(QuizDir, "*.en.yaml").Order()
                .SelectMany(f => Read(Path.GetFileName(f)).Where(q => q.ExpectedOutput is not null)
                    .Select(q => new object?[] { Path.GetFileName(f), q.Id }))
                .ToList()
            : [];
        if (rows.Count == 0) rows.Add([null, null]); // xUnit fails a Theory with no data
        return rows;
    }

    [Theory, MemberData(nameof(OutputQuestions))]
    public async Task Code_PrintsExpectedOutput(string? file, string? id)
    {
        if (file is null) return;
        var q = Read(file).Single(x => x.Id == id);
        Assert.False(string.IsNullOrWhiteSpace(q.Code), $"{id}: expectedOutput needs code");

        var compiled = CompilerService.Compile(new CompileRequest(q.Code!, CompilePurpose.Run));
        var errors = compiled.Diagnostics.Where(d => d.Level == Core.Compilation.DiagnosticLevel.Error)
            .Select(d => $"{d.Id} {d.StartLine}:{d.StartColumn} {d.Message}");
        Assert.True(compiled.Success, $"{id}: " + string.Join("; ", errors));

        var outcome = await LoadedProgram.Load(Convert.FromBase64String(compiled.AssemblyBase64!), q.Code!).RunMainAsync();
        Assert.True(outcome.HasEntryPoint, $"{id}: code must be a runnable program");
        Assert.Null(outcome.Exception);
        Assert.Equal(Normalize(q.ExpectedOutput!), Normalize(outcome.Stdout));
    }

    private static string Normalize(string s) =>
        string.Join('\n', s.Replace("\r\n", "\n").Split('\n').Select(l => l.TrimEnd())).TrimEnd();
}
