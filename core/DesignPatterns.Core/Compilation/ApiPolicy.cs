using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace DesignPatterns.Core.Compilation;

/// <summary>Flags APIs that cannot work in the browser (WebAssembly) runtime as DP0001.</summary>
public static class ApiPolicy
{
    public const string DiagnosticId = "DP0001";

    private static readonly string[] ForbiddenNamespaces = ["System.IO", "System.Net", "System.Reflection.Emit"];

    private static readonly HashSet<string> AllowedNamespaceTypes =
    [
        "System.IO.StringReader", "System.IO.StringWriter", "System.IO.TextReader", "System.IO.TextWriter",
    ];

    private static readonly HashSet<string> ForbiddenTypes =
    [
        "System.Threading.Thread", "System.Threading.ThreadPool",
        "System.Threading.Tasks.Parallel", "System.Diagnostics.Process",
    ];

    private static readonly HashSet<string> ForbiddenMembers =
    [
        "System.Environment.Exit", "System.Console.Read", "System.Console.ReadLine", "System.Console.ReadKey",
    ];

    public static IReadOnlyList<DiagnosticInfo> Find(CSharpCompilation compilation, SyntaxTree userTree)
    {
        var model = compilation.GetSemanticModel(userTree);
        var hits = new List<(SimpleNameSyntax Name, string Api)>();

        foreach (var name in userTree.GetRoot().DescendantNodes().OfType<SimpleNameSyntax>())
        {
            var info = model.GetSymbolInfo(name);
            var symbol = info.Symbol ?? info.CandidateSymbols.FirstOrDefault();
            if (symbol is not null && Match(symbol) is { } api) hits.Add((name, api));
        }

        var result = new List<DiagnosticInfo>();
        foreach (var (name, api) in hits)
        {
            // `var t = new Thread(...)`: the type name already carries the report; `var` would only duplicate it.
            if (IsVar(name) && hits.Any(h => !IsVar(h.Name) && h.Api == api && SameStatement(h.Name, name))) continue;

            var span = userTree.GetLineSpan(name.Span);
            result.Add(new DiagnosticInfo(
                DiagnosticId, DiagnosticLevel.Error, $"Not available in the browser runtime: {api}", SourceFile.User,
                span.StartLinePosition.Line + 1, span.StartLinePosition.Character + 1,
                span.EndLinePosition.Line + 1, span.EndLinePosition.Character + 1,
                new Dictionary<string, string> { ["api"] = api }));
        }
        return result;
    }

    private static bool IsVar(SimpleNameSyntax name) => name is IdentifierNameSyntax { IsVar: true };

    private static bool SameStatement(SyntaxNode a, SyntaxNode b) =>
        a.FirstAncestorOrSelf<StatementSyntax>() is { } statement && statement == b.FirstAncestorOrSelf<StatementSyntax>();

    private static string? Match(ISymbol symbol)
    {
        if (symbol is INamedTypeSymbol type)
        {
            var full = type.OriginalDefinition.ToDisplayString(SymbolDisplayFormat.CSharpErrorMessageFormat
                .WithGenericsOptions(SymbolDisplayGenericsOptions.None));
            if (ForbiddenTypes.Contains(full)) return full;
            if (InForbiddenNamespace(type.ContainingNamespace) && !AllowedNamespaceTypes.Contains(full)) return full;
            return null;
        }
        if (symbol is IMethodSymbol or IPropertySymbol or IFieldSymbol or IEventSymbol && symbol.ContainingType is { } owner)
        {
            var ownerName = owner.ToDisplayString(SymbolDisplayFormat.CSharpErrorMessageFormat);
            var member = $"{ownerName}.{symbol.Name}";
            return ForbiddenMembers.Contains(member) ? member : null;
        }
        return null;
    }

    private static bool InForbiddenNamespace(INamespaceSymbol? ns)
    {
        if (ns is null || ns.IsGlobalNamespace) return false;
        var name = ns.ToDisplayString();
        return ForbiddenNamespaces.Any(f => name == f || name.StartsWith(f + ".", StringComparison.Ordinal));
    }
}
