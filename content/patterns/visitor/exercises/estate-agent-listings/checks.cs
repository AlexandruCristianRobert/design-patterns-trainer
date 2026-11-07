using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class EstateAgentListingsChecks
{
    [Check("fees-follow-each-listing")]
    static void FeesFollowEachListing()
    {
        var actual = new Agency([new Flat(3, 2), new House(4, 120), new Flat(1, 0)]).Fees();
        Expect.That(actual == 200, "wrongFees", new { expected = 200, actual });
    }

    [Check("window-cards-describe-each-listing")]
    static void WindowCardsDescribeEachListing()
    {
        const string expected = "4-room house, 120 m² garden | 3-room flat, floor 2 | 2-room house, 0 m² garden";
        var actual = string.Join(" | ", new Agency([new House(4, 120), new Flat(3, 2), new House(2, 0)]).Cards());
        Expect.That(actual == expected, "wrongCards", new { expected, actual });
    }

    [Check("each-listing-accepts-a-visitor")]
    static void EachListingAcceptsAVisitor()
    {
        const BindingFlags All = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
        string[] listings = ["Flat", "House"];
        var types = CheckContext.Current.Assembly.GetTypes();

        // IListingVisitor, or ListingVisitor as an abstract class, generic or not. When both exist, the interface counts.
        var visitors = types.Where(t => !t.IsNested && t.Name.Split('`')[0] is "IListingVisitor" or "ListingVisitor")
            .OrderBy(t => t.IsInterface ? 0 : 1).ToList();
        Expect.That(visitors.Count > 0, "noVisitor");
        var visits = visitors[0].GetMethods(All);

        foreach (var name in listings)
        {
            var listing = types.First(t => t.Name == name);
            var count = visits.Count(m => m.GetParameters() is [var p] && p.ParameterType == listing);
            Expect.That(count == 1, "notOneVisit", new { listing = name, visitor = visitors[0].Name.Split('`')[0], count });

            var accepts = listing.GetMethods(All | BindingFlags.DeclaredOnly).Any(m =>
                (m.Name == "Accept" || m.Name.EndsWith(".Accept")) && m.GetParameters() is [var p]
                && visitors.Contains(p.ParameterType.IsGenericType ? p.ParameterType.GetGenericTypeDefinition() : p.ParameterType));
            Expect.That(accepts, "noAccept", new { listing = name });
        }

        // The listings keep only their data and Accept: the rules live in the visitors.
        string[] data = ["Rooms", "Floor", "Garden"];
        foreach (var name in listings)
            foreach (var own in types.Where(t => t.IsAssignableFrom(types.First(e => e.Name == name))))
            {
                var extra = own.GetMembers(All | BindingFlags.Static | BindingFlags.DeclaredOnly).FirstOrDefault(m =>
                    m is PropertyInfo or MethodInfo { IsSpecialName: false }
                    && !m.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute))
                    && m.Name.Split('.')[^1] is var n && n != "Accept" && !data.Contains(n));
                Expect.That(extra is null, "ruleLeft", new { listing = own.Name.Split('`')[0], member = extra?.Name });
            }

        // No code asks which listing it has.
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
            Expect.That(!listings.Contains(named) && !getType, "asksTheKind", new { code = shown.ToString().Split('\n')[0].Trim() });
        }
    }
}
