using System.Reflection;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace DesignPatterns.Checks;

public sealed class CheckContext(Assembly assembly, string source)
{
    public static CheckContext Current { get; set; } = null!;

    public Assembly Assembly { get; } = assembly;
    public string Source { get; } = source;

    internal CompilationUnitSyntax? ParsedRoot { get; set; }
}
