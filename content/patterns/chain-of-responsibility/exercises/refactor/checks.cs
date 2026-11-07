using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class SupportInboxChecks
{
    static string Route(string subject) => new SupportInbox().Route(subject);

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "Billing team: Please refund order 1182",
            "Account team: I forgot my password",
            "Repairs team: My kettle arrived broken",
            "Billing team: A refund for a broken kettle",
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
        foreach (var (subject, expected) in new[]
        {
            ("Where is my refund?", "Billing team: Where is my refund?"),
            ("New password please", "Account team: New password please"),
            ("The lamp is broken", "Repairs team: The lamp is broken"),
        })
        {
            var actual = Route(subject);
            Expect.That(actual == expected, "wrongTeam", new { subject, expected, actual });
        }
    }

    [Check("first-team-in-line-wins")]
    static void FirstTeamInLineWins()
    {
        foreach (var (subject, expected) in new[]
        {
            ("A broken link in my password email", "Account team: A broken link in my password email"),
            ("My password for the refund of a broken fan", "Billing team: My password for the refund of a broken fan"),
        })
        {
            var actual = Route(subject);
            Expect.That(actual == expected, "wrongFirstTeam", new { subject, expected, actual });
        }
    }

    [Check("other-emails-go-to-the-general-inbox")]
    static void OtherEmailsGoToTheGeneralInbox()
    {
        var actual = Route("Can I add a gift note?");
        Expect.That(actual == "General inbox: Can I add a gift note?", "wrongGeneral",
            new { subject = "Can I add a gift note?", expected = "General inbox: Can I add a gift note?", actual });
    }

    [Check("teams-work-in-any-line")]
    static void TeamsWorkInAnyLine()
    {
        var link = Code.Type("SupportTeam").Clr;
        var take = link.GetMethod("Take", [typeof(string)]);
        if (take is null) Expect.Fail("noTake");
        string Take(string subject, params string[] line) => (string)take.Invoke(LineOf(link, line), [subject])!;

        var repairsFirst = Take("A refund for a broken kettle", "RepairsTeam", "BillingTeam");
        Expect.That(repairsFirst == "Repairs team: A refund for a broken kettle", "wrongLine",
            new { line = "RepairsTeam, then BillingTeam", subject = "A refund for a broken kettle", expected = "Repairs team: A refund for a broken kettle", actual = repairsFirst });

        var passedOn = Take("Please refund order 1182", "RepairsTeam", "BillingTeam");
        Expect.That(passedOn == "Billing team: Please refund order 1182", "wrongLine",
            new { line = "RepairsTeam, then BillingTeam", subject = "Please refund order 1182", expected = "Billing team: Please refund order 1182", actual = passedOn });

        var alone = Take("Please refund order 1182", "AccountTeam");
        Expect.That(alone == "General inbox: Please refund order 1182", "wrongLine",
            new { line = "AccountTeam on its own", subject = "Please refund order 1182", expected = "General inbox: Please refund order 1182", actual = alone });
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

        var held = FieldsOf(typeof(SupportInbox)).Count(f => HoldsOne(f.FieldType, link) || HoldsMany(f.FieldType, link));
        Expect.That(held == 1, "inboxHoldsMore", new { expected = 1, actual = held });

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "SupportInbox"))
        {
            var decides = declaration.DescendantNodes().Any(n =>
                n is IfStatementSyntax or SwitchStatementSyntax or SwitchExpressionSyntax or ConditionalExpressionSyntax
                || n is IdentifierNameSyntax { Identifier.ValueText: "Contains" });
            Expect.That(!decides, "inboxStillDecides");
        }

        foreach (var type in link.Assembly.GetTypes())
            foreach (var field in type.GetFields(AnyField))
                Expect.That(!HoldsMany(field.FieldType, link), "keptInACollection", new { type = type.Name, field = field.Name });
    }

    // ---- Fields that hold teams ----

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Every field of a type: its own and the ones it inherits, private ones included.
    static IEnumerable<FieldInfo> FieldsOf(Type type)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            foreach (var field in t.GetFields(AnyField))
                yield return field;
    }

    // A field of this type holds one team: the team type itself, a wider type, or one kind of team (never object).
    static bool HoldsOne(Type type, Type link) =>
        type != typeof(object) && (type.IsAssignableFrom(link) || link.IsAssignableFrom(type));

    // A field of this type holds many teams: an array or a collection of them.
    static bool HoldsMany(Type type, Type link) =>
        type.GetInterfaces().Append(type).Any(i =>
            i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEnumerable<>) && HoldsOne(i.GetGenericArguments()[0], link));

    // ---- Building a line ----

    // A new team of this type, joined to the next one the way the code allows: a public constructor that takes
    // the next team (null when there is none), or a public constructor without parameters and a public method that takes it.
    static object Make(Type type, Type link, object? next)
    {
        bool TakesLink(ParameterInfo[] ps) => ps is [var p] && p.ParameterType != typeof(object) && p.ParameterType.IsAssignableFrom(link);

        var withNext = type.GetConstructors().FirstOrDefault(c => TakesLink(c.GetParameters()));
        if (withNext is not null) return withNext.Invoke([next]);

        var bare = type.GetConstructor(Type.EmptyTypes);
        if (bare is null) Expect.Fail("cannotLink", new { type = type.Name });
        var made = bare.Invoke([]);
        if (next is null) return made;

        var setter = type.GetMethods(BindingFlags.Public | BindingFlags.Instance).FirstOrDefault(m => TakesLink(m.GetParameters()));
        if (setter is null) Expect.Fail("cannotLink", new { type = type.Name });
        setter.Invoke(made, [next]);
        return made;
    }

    // A line of the named teams, in this order; returns the first one.
    static object LineOf(Type link, params string[] names)
    {
        object? next = null;
        for (var i = names.Length - 1; i >= 0; i--)
            next = Make(Code.Type(names[i]).Clr, link, next);
        return next!;
    }
}
