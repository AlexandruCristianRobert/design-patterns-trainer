using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class SchoolSportsDayChecks
{
    [Check("points-follow-each-event")]
    static void PointsFollowEachEvent()
    {
        var actual = new SportsDay([new Sprint("Ana", 1), new LongJump("Ben", 4), new Sprint("Cleo", 3), new LongJump("Dan", 2)]).Points();
        Expect.That(actual == 12, "wrongPoints", new { expected = 12, actual });
    }

    [Check("a-certificate-for-each-result")]
    static void ACertificateForEachResult()
    {
        const string expected = "Ben: long jump, 4 m | Ana: sprint, place 1 | Cleo: sprint, place 3";
        var actual = string.Join(" | ", new SportsDay([new LongJump("Ben", 4), new Sprint("Ana", 1), new Sprint("Cleo", 3)]).Certificates());
        Expect.That(actual == expected, "wrongCertificates", new { expected, actual });
    }

    [Check("each-result-accepts-a-visitor")]
    static void EachResultAcceptsAVisitor()
    {
        const BindingFlags All = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
        string[] results = ["Sprint", "LongJump"];
        var types = CheckContext.Current.Assembly.GetTypes();

        // IResultVisitor, or ResultVisitor as an abstract class, generic or not. When both exist, the interface counts.
        var visitors = types.Where(t => !t.IsNested && t.Name.Split('`')[0] is "IResultVisitor" or "ResultVisitor")
            .OrderBy(t => t.IsInterface ? 0 : 1).ToList();
        Expect.That(visitors.Count > 0, "noVisitor");
        var visits = visitors[0].GetMethods(All);

        foreach (var name in results)
        {
            var result = types.First(t => t.Name == name);
            var count = visits.Count(m => m.GetParameters() is [var p] && p.ParameterType == result);
            Expect.That(count == 1, "notOneVisit", new { result = name, visitor = visitors[0].Name.Split('`')[0], count });

            var accepts = result.GetMethods(All | BindingFlags.DeclaredOnly).Any(m =>
                (m.Name == "Accept" || m.Name.EndsWith(".Accept")) && m.GetParameters() is [var p]
                && visitors.Contains(p.ParameterType.IsGenericType ? p.ParameterType.GetGenericTypeDefinition() : p.ParameterType));
            Expect.That(accepts, "noAccept", new { result = name });
        }

        // The results keep only their data and Accept: the rules live in the visitors.
        string[] data = ["Pupil", "Place", "Metres"];
        foreach (var name in results)
            foreach (var own in types.Where(t => t.IsAssignableFrom(types.First(e => e.Name == name))))
            {
                var extra = own.GetMembers(All | BindingFlags.Static | BindingFlags.DeclaredOnly).FirstOrDefault(m =>
                    m is PropertyInfo or MethodInfo { IsSpecialName: false }
                    && !m.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute))
                    && m.Name.Split('.')[^1] is var n && n != "Accept" && !data.Contains(n));
                Expect.That(extra is null, "ruleLeft", new { result = own.Name.Split('`')[0], member = extra?.Name });
            }

        // No code asks which result it has.
        foreach (var node in Source.Root.DescendantNodes())
        {
            SyntaxNode? type = node switch
            {
                BinaryExpressionSyntax b when b.OperatorToken.ValueText is "is" or "as" => b.Right,
                DeclarationPatternSyntax d => d.Type,
                RecursivePatternSyntax r => r.Type,
                TypePatternSyntax t => t.Type,
                ConstantPatternSyntax c => c.Expression,
                CaseSwitchLabelSyntax c => c.Value,
                _ => null,
            };
            var named = type switch { QualifiedNameSyntax q => q.Right.Identifier.ValueText, SimpleNameSyntax s => s.Identifier.ValueText, _ => "" };
            var getType = node is InvocationExpressionSyntax { ArgumentList.Arguments.Count: 0 } call
                && call.Expression switch { MemberAccessExpressionSyntax m => m.Name.Identifier.ValueText, IdentifierNameSyntax i => i.Identifier.ValueText, _ => "" } == "GetType";
            var shown = node.AncestorsAndSelf().FirstOrDefault(a => a is IsPatternExpressionSyntax or SwitchExpressionArmSyntax or SwitchLabelSyntax) ?? node;
            Expect.That(!results.Contains(named) && !getType, "asksTheKind", new { code = shown.ToString().Split('\n')[0].Trim() });
        }
    }
}
