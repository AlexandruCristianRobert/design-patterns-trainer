using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class SupportInboxChecks
{
    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "Billing team: Refund for order 1182",
            "Account team: Forgot my password",
            "Repairs team: Kettle arrived broken",
            "Billing team: Refund for a broken kettle",
            "General inbox: Do you ship to Iceland?",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("each-email-reaches-its-team")]
    static void EachEmailReachesItsTeam()
    {
        var inbox = new SupportInbox();
        var refund = inbox.Route("REFUND please");
        Expect.That(refund == "Billing team: REFUND please", "wrongTeam",
            new { subject = "REFUND please", expected = "Billing team: REFUND please", actual = refund });

        var password = inbox.Route("Password reset link expired");
        Expect.That(password == "Account team: Password reset link expired", "wrongTeam",
            new { subject = "Password reset link expired", expected = "Account team: Password reset link expired", actual = password });

        var broken = inbox.Route("The lamp is Broken");
        Expect.That(broken == "Repairs team: The lamp is Broken", "wrongTeam",
            new { subject = "The lamp is Broken", expected = "Repairs team: The lamp is Broken", actual = broken });
    }

    [Check("first-team-in-line-wins")]
    static void FirstTeamInLineWins()
    {
        var inbox = new SupportInbox();
        var both = inbox.Route("Broken link in my password email");
        Expect.That(both == "Account team: Broken link in my password email", "wrongFirstTeam",
            new { subject = "Broken link in my password email", expected = "Account team: Broken link in my password email", actual = both });

        var all = inbox.Route("Password needed for the refund of a broken fan");
        Expect.That(all == "Billing team: Password needed for the refund of a broken fan", "wrongFirstTeam",
            new { subject = "Password needed for the refund of a broken fan", expected = "Billing team: Password needed for the refund of a broken fan", actual = all });
    }

    [Check("other-emails-go-to-the-general-inbox")]
    static void OtherEmailsGoToTheGeneralInbox()
    {
        var inbox = new SupportInbox();
        var gift = inbox.Route("Can I add a gift note?");
        Expect.That(gift == "General inbox: Can I add a gift note?", "wrongGeneral",
            new { subject = "Can I add a gift note?", expected = "General inbox: Can I add a gift note?", actual = gift });

        var empty = inbox.Route("");
        Expect.That(empty == "General inbox: ", "wrongGeneral",
            new { subject = "(an empty subject)", expected = "General inbox: ", actual = empty });
    }

    [Check("teams-know-only-the-next")]
    static void TeamsKnowOnlyTheNext()
    {
        var link = Code.Type("SupportTeam").Clr;
        foreach (var name in new[] { "BillingTeam", "AccountTeam", "RepairsTeam" })
        {
            var type = Code.Type(name).Clr;
            Expect.That(link.IsAssignableFrom(type), "notATeam", new { type = name });
            Expect.That(FieldsOf(type).Any(f => !f.IsStatic && HoldsOne(f.FieldType, link)), "noNext", new { type = name });
        }

        var held = FieldsOf(typeof(SupportInbox)).Count(f => HoldsOne(f.FieldType, link));
        Expect.That(held == 1, "inboxHoldsMore", new { held });

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "SupportInbox"))
        {
            var decides = declaration.DescendantNodes().Any(n =>
                n is IfStatementSyntax or SwitchStatementSyntax or SwitchExpressionSyntax or ConditionalExpressionSyntax
                || n is InvocationExpressionSyntax { Expression: MemberAccessExpressionSyntax { Name.Identifier.ValueText: "Contains" or "StartsWith" or "EndsWith" or "IndexOf" } });
            Expect.That(!decides, "inboxStillDecides");
        }

        foreach (var type in link.Assembly.GetTypes())
            foreach (var field in type.GetFields(AnyField))
                Expect.That(!HoldsMany(field.FieldType, link), "keptInACollection", new { type = type.Name, field = field.Name });

        var written = CollectionInSource(["SupportTeam", "BillingTeam", "AccountTeam", "RepairsTeam"]);
        Expect.That(written is null, "collectionInCode", new { written });

        var loop = LoopCalling("Take");
        Expect.That(loop is null, "loopCallsEach", new { loop });
    }

    // ---- Who holds which link ----

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Every field of a type: its own and the ones it inherits, private ones included.
    static IEnumerable<FieldInfo> FieldsOf(Type type)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            foreach (var field in t.GetFields(AnyField))
                yield return field;
    }

    // A field of this type can hold one link.
    static bool HoldsOne(Type fieldType, Type link) => fieldType != typeof(object) && fieldType.IsAssignableFrom(link);

    // A field of this type holds many links: an array or a collection of them.
    static bool HoldsMany(Type fieldType, Type link)
    {
        bool IsLink(Type t) => t != typeof(object) && (t.IsAssignableFrom(link) || link.IsAssignableFrom(t));
        if (fieldType.IsArray) return IsLink(fieldType.GetElementType()!);
        return fieldType.GetInterfaces().Append(fieldType)
            .Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEnumerable<>))
            .Any(i => IsLink(i.GetGenericArguments()[0]));
    }

    // The first type written in the code that collects links, such as List<SupportTeam> or SupportTeam[]; null when there is none.
    static string? CollectionInSource(string[] names)
    {
        bool Mentions(SyntaxNode node) =>
            node.DescendantNodesAndSelf().OfType<IdentifierNameSyntax>().Any(n => names.Contains(n.Identifier.ValueText));
        foreach (var node in Source.Root.DescendantNodes())
        {
            if (node is GenericNameSyntax generic && generic.TypeArgumentList.Arguments.Any(Mentions)) return generic.ToString();
            if (node is ArrayTypeSyntax array && Mentions(array.ElementType)) return array.ToString();
        }
        return null;
    }

    // The first loop or lambda inside a class that calls the given method, such as a foreach over the links; null when there is none.
    static string? LoopCalling(string method)
    {
        bool Calls(SyntaxNode node) => node.DescendantNodes().OfType<InvocationExpressionSyntax>().Any(i =>
            i.Expression is MemberAccessExpressionSyntax access && access.Name.Identifier.ValueText == method
            || i.Expression is MemberBindingExpressionSyntax binding && binding.Name.Identifier.ValueText == method);
        var loop = Source.Root.DescendantNodes().Where(n => n.Ancestors().OfType<TypeDeclarationSyntax>().Any()).FirstOrDefault(n =>
            n is ForEachStatementSyntax or ForStatementSyntax or WhileStatementSyntax or DoStatementSyntax or LambdaExpressionSyntax && Calls(n));
        return loop?.ToString().Split('\n')[0].Trim();
    }
}
