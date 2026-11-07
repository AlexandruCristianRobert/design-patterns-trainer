using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class TollRoadChargesChecks
{
    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected = ["AB-123: car", "LK-77: lorry, 4 axles", "CD-456: car", "MB-9: motorbike", "takings: 30 EUR"];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("each-vehicle-pays-its-toll")]
    static void EachVehiclePaysItsToll()
    {
        var actual = TollRoad.Takings([new Motorbike("MB-1"), new Lorry("LK-2", 2), new Car("AB-3"), new Lorry("LK-4", 6)]);
        Expect.That(actual == 46, "wrongTakings", new { expected = 46, actual });
    }

    [Check("each-vehicle-gets-its-ticket")]
    static void EachVehicleGetsItsTicket()
    {
        const string expected = "MB-1: motorbike | LK-2: lorry, 3 axles | AB-3: car";
        var actual = string.Join(" | ", TollRoad.Tickets([new Motorbike("MB-1"), new Lorry("LK-2", 3), new Car("AB-3")]));
        Expect.That(actual == expected, "wrongTickets", new { expected, actual });
    }

    [Check("each-vehicle-accepts-a-visitor")]
    static void EachVehicleAcceptsAVisitor()
    {
        const BindingFlags All = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
        string[] vehicles = ["Car", "Lorry", "Motorbike"];
        var types = CheckContext.Current.Assembly.GetTypes();

        // IVehicleVisitor, or VehicleVisitor as an abstract class, generic or not. When both exist, the interface counts.
        var visitors = types.Where(t => !t.IsNested && t.Name.Split('`')[0] is "IVehicleVisitor" or "VehicleVisitor")
            .OrderBy(t => t.IsInterface ? 0 : 1).ToList();
        Expect.That(visitors.Count > 0, "noVisitor");
        var visits = visitors[0].GetMethods(All);

        foreach (var name in vehicles)
        {
            var vehicle = types.First(t => t.Name == name);
            var count = visits.Count(m => m.GetParameters() is [var p] && p.ParameterType == vehicle);
            Expect.That(count == 1, "notOneVisit", new { vehicle = name, visitor = visitors[0].Name.Split('`')[0], count });

            var accepts = vehicle.GetMethods(All | BindingFlags.DeclaredOnly).Any(m =>
                (m.Name == "Accept" || m.Name.EndsWith(".Accept")) && m.GetParameters() is [var p]
                && visitors.Contains(p.ParameterType.IsGenericType ? p.ParameterType.GetGenericTypeDefinition() : p.ParameterType));
            Expect.That(accepts, "noAccept", new { vehicle = name });
        }

        // No code asks which vehicle it has.
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
            Expect.That(!vehicles.Contains(named) && !getType, "asksTheKind", new { code = shown.ToString().Split('\n')[0].Trim() });
        }
    }
}
