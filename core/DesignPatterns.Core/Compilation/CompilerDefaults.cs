using Basic.Reference.Assemblies;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Text;

namespace DesignPatterns.Core.Compilation;

internal static class CompilerDefaults
{
    public const string UserPath = "user.cs";
    public const string ChecksPath = "checks.cs";
    public const string GlobalUsingsPath = "GlobalUsings.g.cs";

    public static readonly CSharpParseOptions ParseOptions = new(LanguageVersion.CSharp14);

    public static readonly string[] ImplicitUsings =
    [
        "System",
        "System.Collections.Generic",
        "System.Linq",
        "System.Threading",
        "System.Threading.Tasks",
    ];

    public static IReadOnlyList<MetadataReference> References { get; } =
    [
        .. Net100.References.All,
        LoadedMetadata.For(typeof(DesignPatterns.Checks.CheckContext).Assembly),
        LoadedMetadata.For(typeof(Microsoft.CodeAnalysis.SyntaxNode).Assembly),
        LoadedMetadata.For(typeof(Microsoft.CodeAnalysis.CSharp.CSharpSyntaxTree).Assembly),
    ];

    public static SyntaxTree GlobalUsingsTree() =>
        CSharpSyntaxTree.ParseText(
            SourceText.From(string.Concat(ImplicitUsings.Select(ns => $"global using global::{ns};\n"))),
            ParseOptions,
            GlobalUsingsPath);
}
