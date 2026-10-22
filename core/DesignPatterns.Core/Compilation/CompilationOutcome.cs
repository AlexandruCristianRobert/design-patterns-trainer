using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

namespace DesignPatterns.Core.Compilation;

public sealed record CompilationOutcome(
    bool Success,
    IReadOnlyList<DiagnosticInfo> Diagnostics,
    CSharpCompilation Compilation,
    SyntaxTree UserTree,
    byte[]? Assembly);
