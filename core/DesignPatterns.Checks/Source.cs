using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace DesignPatterns.Checks;

public static class Source
{
    public static CompilationUnitSyntax Root
    {
        get
        {
            var context = CheckContext.Current;
            return context.ParsedRoot ??= CSharpSyntaxTree.ParseText(context.Source, new CSharpParseOptions(LanguageVersion.CSharp14))
                .GetCompilationUnitRoot();
        }
    }
}
