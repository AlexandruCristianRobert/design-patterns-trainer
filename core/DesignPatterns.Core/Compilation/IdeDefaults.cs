using Basic.Reference.Assemblies;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

namespace DesignPatterns.Core.Compilation;

/// <summary>What the editor IDE services compile against: BCL only, so Checks and Roslyn never appear in completion or hover.</summary>
internal static class IdeDefaults
{
    public static CSharpParseOptions ParseOptions => CompilerDefaults.ParseOptions;

    /// <summary>
    /// A console app with nullable on, like the learner's file, and <c>ConcurrentBuild(false)</c> because the browser
    /// runtime is single-threaded (ADR 0003).
    /// </summary>
    public static CSharpCompilationOptions CompilationOptions { get; } =
        new CSharpCompilationOptions(OutputKind.ConsoleApplication)
            .WithNullableContextOptions(NullableContextOptions.Enable)
            .WithConcurrentBuild(false);

    public static IReadOnlyList<MetadataReference> References { get; } = [.. Net100.References.All];

    /// <summary>Taken from the grading compilation's own tree so the two cannot drift.</summary>
    public static string GlobalUsingsText => CompilerDefaults.GlobalUsingsTree().GetText().ToString();
}
