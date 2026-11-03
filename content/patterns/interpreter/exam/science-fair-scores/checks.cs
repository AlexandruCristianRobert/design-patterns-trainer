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
        foreach (var type in parts)
            Expect.That(WorksItOut(type, typeof(Score), "Points"), "notItsOwnPoints", new { type = type.Name });

        var test = TypeTest(parts.Select(t => t.Name).ToArray());
        Expect.That(test is null, "typeTest", new { code = test });
    }

    // The class works out its own answer: the method is written in the class, or in a class of its own between it and the base.
    static bool WorksItOut(Type type, Type @base, string method)
    {
        if (!@base.IsAssignableFrom(type)) return false;
        MethodInfo? found;
        if (@base.IsInterface)
        {
            var map = type.GetInterfaceMap(@base);
            var i = Array.FindIndex(map.InterfaceMethods, m => m.Name == method);
            found = i < 0 ? null : map.TargetMethods[i];
        }
        else found = type.GetMethods(BindingFlags.Public | BindingFlags.Instance).FirstOrDefault(m => m.Name == method);
        return found is { IsAbstract: false } && found.DeclaringType != @base && found.DeclaringType != typeof(object);
    }

    // The first piece of code that tests whether something is one of the named classes; null when there is none.
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
