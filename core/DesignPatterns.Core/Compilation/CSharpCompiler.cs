using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace DesignPatterns.Core.Compilation;

public static class CSharpCompiler
{
    /// <summary>Diagnostics only; never emits an assembly.</summary>
    public static CompilationOutcome Analyze(string userSource) => Run(userSource, null, emit: false);

    /// <summary>Compiles and emits PE bytes when there are no errors.</summary>
    public static CompilationOutcome Build(string userSource, string? checksSource = null) =>
        Run(userSource, checksSource, emit: true);

    private static CompilationOutcome Run(string userSource, string? checksSource, bool emit)
    {
        var userTree = CSharpSyntaxTree.ParseText(userSource, CompilerDefaults.ParseOptions, CompilerDefaults.UserPath);
        var trees = new List<SyntaxTree> { CompilerDefaults.GlobalUsingsTree(), userTree };
        if (checksSource is not null)
            trees.Add(CSharpSyntaxTree.ParseText(checksSource, CompilerDefaults.ParseOptions, CompilerDefaults.ChecksPath));

        var options = new CSharpCompilationOptions(HasEntryPoint(userTree)
                ? OutputKind.ConsoleApplication
                : OutputKind.DynamicallyLinkedLibrary)
            .WithNullableContextOptions(NullableContextOptions.Enable);

        var compilation = CSharpCompilation.Create(
            $"UserCode_{Guid.NewGuid():N}", trees, CompilerDefaults.References, options);

        var diagnostics = compilation.GetDiagnostics()
            .Where(d => d.Severity != DiagnosticSeverity.Hidden)
            .ToList();
        byte[]? assembly = null;

        if (emit && !diagnostics.Any(d => d.Severity == DiagnosticSeverity.Error))
        {
            using var ms = new MemoryStream();
            var result = compilation.Emit(ms);
            diagnostics = result.Diagnostics.Where(d => d.Severity != DiagnosticSeverity.Hidden).ToList();
            if (result.Success) assembly = ms.ToArray();
        }

        var infos = diagnostics.Select(ToInfo).ToList();
        return new CompilationOutcome(
            !diagnostics.Any(d => d.Severity == DiagnosticSeverity.Error), infos, compilation, userTree, assembly);
    }

    private static bool HasEntryPoint(SyntaxTree tree) =>
        tree.GetRoot().DescendantNodes().Any(n =>
            n is GlobalStatementSyntax ||
            n is MethodDeclarationSyntax m && m.Identifier.ValueText == "Main" &&
                m.Modifiers.Any(SyntaxKind.StaticKeyword));

    private static DiagnosticInfo ToInfo(Diagnostic d)
    {
        var level = d.Severity switch
        {
            DiagnosticSeverity.Error => DiagnosticLevel.Error,
            DiagnosticSeverity.Warning => DiagnosticLevel.Warning,
            _ => DiagnosticLevel.Info,
        };
        if (!d.Location.IsInSource)
            return new DiagnosticInfo(d.Id, level, d.GetMessage(), SourceFile.User, 1, 1, 1, 1);

        var span = d.Location.GetLineSpan();
        var file = span.Path == CompilerDefaults.ChecksPath ? SourceFile.Checks : SourceFile.User;
        return new DiagnosticInfo(d.Id, level, d.GetMessage(), file,
            span.StartLinePosition.Line + 1, span.StartLinePosition.Character + 1,
            span.EndLinePosition.Line + 1, span.EndLinePosition.Character + 1);
    }
}
