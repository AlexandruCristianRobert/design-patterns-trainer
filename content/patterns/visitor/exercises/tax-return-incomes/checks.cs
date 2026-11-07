using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class TaxReturnIncomesChecks
{
    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected = ["salary: 30000 EUR", "rent: 9000 EUR, costs 2000 EUR", "salary: 4000 EUR", "taxable income: 41000 EUR"];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("taxable-income-adds-up-every-income")]
    static void TaxableIncomeAddsUpEveryIncome()
    {
        var actual = new TaxReturn([new Rent(5000, 4000), new Salary(1000), new Rent(1200, 300)]).TaxableIncome();
        Expect.That(actual == 2900, "wrongTaxable", new { expected = 2900, actual });
    }

    [Check("lines-describe-each-income")]
    static void LinesDescribeEachIncome()
    {
        var taxReturn = new TaxReturn([new Rent(1200, 300), new Salary(2500), new Rent(800, 0)]);
        const string expected = "rent: 1200 EUR, costs 300 EUR | salary: 2500 EUR | rent: 800 EUR, costs 0 EUR";
        var actual = string.Join(" | ", taxReturn.Lines());
        Expect.That(actual == expected, "wrongLines", new { expected, actual });
    }

    [Check("each-income-accepts-a-visitor")]
    static void EachIncomeAcceptsAVisitor()
    {
        const BindingFlags All = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
        string[] incomes = ["Salary", "Rent"];
        var types = CheckContext.Current.Assembly.GetTypes();

        // IIncomeVisitor, or IncomeVisitor as an abstract class, generic or not. When both exist, the interface counts.
        var visitors = types.Where(t => !t.IsNested && t.Name.Split('`')[0] is "IIncomeVisitor" or "IncomeVisitor")
            .OrderBy(t => t.IsInterface ? 0 : 1).ToList();
        Expect.That(visitors.Count > 0, "noVisitor");
        var visits = visitors[0].GetMethods(All);

        foreach (var name in incomes)
        {
            var income = types.First(t => t.Name == name);
            var count = visits.Count(m => m.GetParameters() is [var p] && p.ParameterType == income);
            Expect.That(count == 1, "notOneVisit", new { income = name, visitor = visitors[0].Name.Split('`')[0], count });

            var accepts = income.GetMethods(All | BindingFlags.DeclaredOnly).Any(m =>
                (m.Name == "Accept" || m.Name.EndsWith(".Accept")) && m.GetParameters() is [var p]
                && visitors.Contains(p.ParameterType.IsGenericType ? p.ParameterType.GetGenericTypeDefinition() : p.ParameterType));
            Expect.That(accepts, "noAccept", new { income = name });

            // The old rules have left the incomes, and the types of yours they are, such as IIncome.
            var kept = types.Where(t => t.IsAssignableFrom(income)).SelectMany(t => t.GetMembers(All | BindingFlags.DeclaredOnly))
                .FirstOrDefault(m => m.Name.Split('.')[^1] is "Taxable" or "Line");
            Expect.That(kept is null, "ruleLeft", new { income = name, member = kept?.Name });
        }

        // No code asks which income it has.
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
            Expect.That(!incomes.Contains(named) && !getType, "asksTheKind", new { code = shown.ToString().Split('\n')[0].Trim() });
        }
    }
}
