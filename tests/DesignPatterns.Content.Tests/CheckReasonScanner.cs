using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace DesignPatterns.Content.Tests;

public static class CheckReasonScanner
{
    public static readonly IReadOnlySet<string> GenericReasons = new HashSet<string>
        { "isFalse", "notEqual", "notSame", "same", "didNotThrow", "wrongException", "typeNotFound", "threw", "timedOut" };

    /// <summary>String-literal reasons passed to Expect.Fail / Expect.That inside each [Check] method; generic reasons excluded.</summary>
    public static IReadOnlyDictionary<string, IReadOnlySet<string>> CustomReasonsByCheck(string checksSource)
    {
        var result = new Dictionary<string, IReadOnlySet<string>>();
        var root = CSharpSyntaxTree.ParseText(checksSource).GetRoot();
        foreach (var method in root.DescendantNodes().OfType<MethodDeclarationSyntax>())
        {
            var id = CheckId(method);
            if (id is null) continue;
            var reasons = new HashSet<string>();
            foreach (var call in method.DescendantNodes().OfType<InvocationExpressionSyntax>())
            {
                if (call.Expression is not MemberAccessExpressionSyntax { Expression: IdentifierNameSyntax { Identifier.Text: "Expect" } } access) continue;
                var index = access.Name.Identifier.Text switch { "Fail" => 0, "That" => 1, _ => -1 };
                if (index < 0 || call.ArgumentList.Arguments.Count <= index) continue;
                if (call.ArgumentList.Arguments[index].Expression is LiteralExpressionSyntax lit
                    && lit.IsKind(SyntaxKind.StringLiteralExpression)
                    && !GenericReasons.Contains(lit.Token.ValueText))
                    reasons.Add(lit.Token.ValueText);
            }
            result[id] = reasons;
        }
        return result;
    }

    private static string? CheckId(MethodDeclarationSyntax method) =>
        method.AttributeLists.SelectMany(l => l.Attributes)
            .Where(a => a.Name.ToString() is "Check" or "CheckAttribute")
            .Select(a => a.ArgumentList?.Arguments.FirstOrDefault()?.Expression as LiteralExpressionSyntax)
            .FirstOrDefault(l => l is not null)?.Token.ValueText;
}
