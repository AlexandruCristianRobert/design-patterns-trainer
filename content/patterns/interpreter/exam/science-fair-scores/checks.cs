using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class ScienceFairChecks
{
    static Entry Judged(string title, params (string Criterion, int Points)[] marks)
    {
        var entry = new Entry(title);
        foreach (var (criterion, points) in marks) entry.Give(criterion, points);
        return entry;
    }

    // Four entries, each with the words the failure messages use for it.
    static (Entry Entry, string Said)[] Entries() =>
    [
        (Judged("Volcano", ("idea", 8), ("build", 6), ("talk", 7)), "Volcano (idea 8, build 6, talk 7)"),
        (Judged("Robot bee", ("idea", 9), ("build", 9), ("talk", 4)), "Robot bee (idea 9, build 9, talk 4)"),
        (Judged("Mould", ("idea", 3), ("talk", 10)), "Mould (idea 3, talk 10, no build points)"),
        (Judged("Sundial"), "Sundial (no points given)"),
    ];

    // Works the formula out for each of the four entries.
    static void Try(Score score, string written, int[] expected)
    {
        var entries = Entries();
        for (var i = 0; i < entries.Length; i++)
        {
            var actual = score.Points(entries[i].Entry);
            Expect.That(actual == expected[i], "wrongPoints", new { score = written, entry = entries[i].Said, expected = expected[i], actual });
        }
    }

    [Check("marks-and-bonuses-give-their-points")]
    static void MarksAndBonusesGiveTheirPoints()
    {
        var entry = Judged("Kite", ("idea", 4), ("idea", 6));
        Expect.That(entry.PointsFor("idea") == 6, "wrongGive", new { expected = 6, actual = entry.PointsFor("idea") });

        Try(new Mark("idea"), "Mark(\"idea\")", [8, 9, 3, 0]);
        Try(new Mark("build"), "Mark(\"build\")", [6, 9, 0, 0]);
        Try(new Bonus(2), "Bonus(2)", [2, 2, 2, 2]);
    }

    [Check("joining-parts-ask-the-parts-they-hold")]
    static void JoiningPartsAskThePartsTheyHold()
    {
        Try(new Added(new Mark("idea"), new Mark("talk")), "Added(Mark(\"idea\"), Mark(\"talk\"))", [15, 13, 13, 0]);
        Try(new Best(new Mark("build"), new Mark("talk")), "Best(Mark(\"build\"), Mark(\"talk\"))", [7, 9, 10, 0]);
        Try(new Half(new Mark("talk")), "Half(Mark(\"talk\"))", [3, 2, 5, 0]);
        Try(new Capped(10, new Added(new Mark("idea"), new Mark("build"))), "Capped(10, Added(Mark(\"idea\"), Mark(\"build\")))", [10, 10, 3, 0]);
    }

    [Check("nested-formulas-score-every-entry")]
    static void NestedFormulasScoreEveryEntry()
    {
        Try(new Capped(20, new Added(new Mark("idea"), new Added(new Best(new Mark("build"), new Mark("talk")), new Half(new Bonus(5))))),
            "Capped(20, Added(Mark(\"idea\"), Added(Best(Mark(\"build\"), Mark(\"talk\")), Half(Bonus(5)))))", [17, 20, 15, 2]);
        Try(new Added(new Half(new Added(new Mark("idea"), new Mark("build"))), new Best(new Capped(5, new Mark("talk")), new Bonus(3))),
            "Added(Half(Added(Mark(\"idea\"), Mark(\"build\"))), Best(Capped(5, Mark(\"talk\")), Bonus(3)))", [12, 13, 6, 3]);
    }

    [Check("each-part-scores-itself")]
    static void EachPartScoresItself()
    {
        var parts = new[] { typeof(Mark), typeof(Bonus), typeof(Added), typeof(Best), typeof(Half), typeof(Capped) };
        ExpectOwnWork(typeof(Score), parts, "Points", ["Entry"]);

        var test = TypeTest(parts.Select(t => t.Name).ToArray());
        Expect.That(test is null, "typeTest", new { code = test });
    }

    // ---- Each part does all of its own work ----

    // Each part is a base type with its own method; the base has no code; no other class is a base type;
    // and no part calls a method written outside the parts, the base and the input types.
    static void ExpectOwnWork(Type @base, Type[] parts, string method, string[] inputs)
    {
        foreach (var type in parts)
        {
            Expect.That(@base.IsAssignableFrom(type), "notAPart", new { type = type.Name });
            Expect.That(Declares(type, @base, method), "notItsOwn", new { type = type.Name });
        }

        var code = @base.GetMethods(BindingFlags.DeclaredOnly | BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
            .FirstOrDefault(m => !m.IsAbstract && !m.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute)));
        Expect.That(code is null, "baseHasCode", new { member = code?.Name });

        var extra = CheckContext.Current.Assembly.GetTypes().FirstOrDefault(t =>
            t != @base && @base.IsAssignableFrom(t) && !parts.Contains(t) && !t.Name.Contains('<')
            && !t.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute)));
        Expect.That(extra is null, "extraPart", new { type = extra?.Name });

        var partNames = parts.Select(p => p.Name).ToHashSet();
        var allowed = partNames.Append(@base.Name).Concat(inputs).ToHashSet();
        var declarations = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().ToList();
        var outside = declarations.Where(d => !allowed.Contains(d.Identifier.ValueText))
            .SelectMany(d => d.Members.OfType<MethodDeclarationSyntax>()).Select(m => m.Identifier.ValueText).ToHashSet();
        var call = declarations.Where(d => partNames.Contains(d.Identifier.ValueText)).SelectMany(d => d.DescendantNodes())
            .FirstOrDefault(n => n is BaseExpressionSyntax || n is InvocationExpressionSyntax i && outside.Contains(CalledName(i)));
        Expect.That(call is null, "callsOutside", new { code = (call is BaseExpressionSyntax ? call.Parent : call)?.ToString() });
    }

    // The method is written in the class itself.
    static bool Declares(Type type, Type @base, string method)
    {
        MethodInfo? found;
        if (@base.IsInterface)
        {
            var map = type.GetInterfaceMap(@base);
            var i = Array.FindIndex(map.InterfaceMethods, m => m.Name == method);
            found = i < 0 ? null : map.TargetMethods[i];
        }
        else found = type.GetMethods(BindingFlags.Public | BindingFlags.Instance).FirstOrDefault(m => m.Name == method);
        return found is { IsAbstract: false } && found.DeclaringType == type;
    }

    static string CalledName(InvocationExpressionSyntax call) => call.Expression switch
    {
        MemberAccessExpressionSyntax m => m.Name.Identifier.ValueText,
        MemberBindingExpressionSyntax b => b.Name.Identifier.ValueText,
        SimpleNameSyntax s => s.Identifier.ValueText,
        _ => "",
    };

    // The first piece of code that tests which class something is: is, as, a type pattern, typeof or nameof on one
    // of the named classes, or any GetType(); null when there is none.
    static string? TypeTest(string[] names)
    {
        static string Name(SyntaxNode? n) => n switch
        {
            QualifiedNameSyntax q => q.Right.Identifier.ValueText,
            SimpleNameSyntax s => s.Identifier.ValueText,
            _ => "",
        };

        foreach (var node in Source.Root.DescendantNodes())
        {
            if (node is InvocationExpressionSyntax call)
            {
                if (CalledName(call) == "GetType" && call.ArgumentList.Arguments.Count == 0) return call.ToString();
                if (call.Expression is IdentifierNameSyntax { Identifier.ValueText: "nameof" }
                    && call.ArgumentList.Arguments.Any(a => names.Contains(Name(a.Expression)))) return call.ToString();
                continue;
            }
            SyntaxNode? named = node switch
            {
                BinaryExpressionSyntax b when b.OperatorToken.ValueText is "is" or "as" => b.Right,
                DeclarationPatternSyntax d => d.Type,
                RecursivePatternSyntax r => r.Type,
                TypePatternSyntax t => t.Type,
                ConstantPatternSyntax c => c.Expression,
                CaseSwitchLabelSyntax c => c.Value,
                TypeOfExpressionSyntax t => t.Type,
                _ => null,
            };
            if (named is not null && names.Contains(Name(named))) return node.ToString();
        }
        return null;
    }
}
