using Basic.Reference.Assemblies;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

namespace DesignPatterns.Core.Compilation;

/// <summary>What the editor IDE services compile against: BCL only, so Checks and Roslyn never appear in completion or hover.</summary>
internal static class IdeDefaults
{
    public static CSharpParseOptions ParseOptions => CompilerDefaults.ParseOptions;

    public static IReadOnlyList<MetadataReference> References { get; } = [.. Net100.References.All];

    /// <summary>Taken from the grading compilation's own tree so the two cannot drift.</summary>
    public static string GlobalUsingsText => CompilerDefaults.GlobalUsingsTree().GetText().ToString();
}
